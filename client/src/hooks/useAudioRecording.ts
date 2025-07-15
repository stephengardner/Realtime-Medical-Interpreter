import { useRef, useCallback } from "react";

type AudioRecordingProps = {
  onAudioChunk: (chunk: ArrayBuffer) => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
};

export function useAudioRecording({
  onAudioChunk,
  onSpeakingChange,
}: AudioRecordingProps) {
  const stream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const workletNode = useRef<AudioWorkletNode | null>(null);
  const isSpeakingRef = useRef(false);
  const speakingTimeout = useRef<number | null>(null);

  // Audio buffering to prevent tiny chunks
  const audioBuffer = useRef<ArrayBuffer[]>([]);
  const bufferTimeout = useRef<number | null>(null);
  const TARGET_BUFFER_SIZE = 3200; // ~200ms at 16kHz (200ms * 16kHz * 2 bytes)
  const VOLUME_THRESHOLD = 0.01; // Minimum volume to consider as speech
  const isCurrentlySpeaking = useRef(false);

  const calculateVolume = useCallback((audioData: ArrayBuffer): number => {
    const samples = new Int16Array(audioData);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += Math.abs(samples[i]);
    }
    return sum / samples.length / 32768; // Normalize to 0-1 range
  }, []);

  const flushBuffer = useCallback(() => {
    if (audioBuffer.current.length === 0) return;

    // Concatenate all buffered chunks
    const totalLength = audioBuffer.current.reduce(
      (sum, chunk) => sum + chunk.byteLength,
      0
    );
    const combinedBuffer = new ArrayBuffer(totalLength);
    const combinedView = new Uint8Array(combinedBuffer);

    let offset = 0;
    for (const chunk of audioBuffer.current) {
      combinedView.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    // Always send audio chunks - let OpenAI's VAD handle speech detection
    onAudioChunk(combinedBuffer);

    // Log with speech status for debugging
    const status = isCurrentlySpeaking.current ? "🎤 Speech" : "🔇 Silence";
    console.log(
      `[Audio] 📦 ${status}: ${totalLength} bytes (~${Math.round(
        totalLength / 32
      )}ms)`
    );

    // Clear the buffer
    audioBuffer.current = [];
  }, [onAudioChunk]);

  const stopRecording = useCallback(() => {
    if (speakingTimeout.current) {
      clearTimeout(speakingTimeout.current);
      speakingTimeout.current = null;
    }

    if (bufferTimeout.current) {
      clearTimeout(bufferTimeout.current);
      bufferTimeout.current = null;
    }

    // Flush any remaining audio in buffer
    flushBuffer();

    if (workletNode.current) {
      workletNode.current.port.onmessage = null;
      workletNode.current.disconnect();
      workletNode.current = null;
    }

    if (stream.current) {
      stream.current.getTracks().forEach((track) => track.stop());
      stream.current = null;
    }

    if (audioContext.current && audioContext.current.state !== "closed") {
      audioContext.current.close();
      audioContext.current = null;
    }

    if (isSpeakingRef.current) {
      isSpeakingRef.current = false;
      if (onSpeakingChange) onSpeakingChange(false);
    }

    // Clear audio buffer
    audioBuffer.current = [];

    // Reset speaking state
    isCurrentlySpeaking.current = false;
  }, [onSpeakingChange, flushBuffer]);

  const startRecording = useCallback(async () => {
    try {
      console.log("[Audio] 1. Stopping any previous recording instances.");
      stopRecording();

      console.log("[Audio] 2. Requesting microphone access.");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      });
      stream.current = mediaStream;
      console.log("[Audio] 3. Microphone access granted.");

      const context = new AudioContext({ sampleRate: 16000 });
      audioContext.current = context;
      console.log(`[Audio] 4. AudioContext created in state: ${context.state}`);

      if (context.state === "suspended") {
        console.log(
          "[Audio] 4a. AudioContext is suspended, attempting to resume."
        );
        await context.resume();
        console.log(
          `[Audio] 4b. AudioContext resumed, new state: ${context.state}`
        );
      }

      console.log("[Audio] 5. Loading AudioWorklet processor.");
      await context.audioWorklet.addModule("/pcm-processor.js");
      console.log("[Audio] 6. AudioWorklet processor loaded.");

      const node = new AudioWorkletNode(context, "pcm-processor");
      workletNode.current = node;
      console.log("[Audio] 7. AudioWorkletNode created.");

      node.port.onmessage = (event) => {
        const audioData = event.data as ArrayBuffer;

        // Calculate volume level to detect speech
        const volume = calculateVolume(audioData);
        const isSpeech = volume > VOLUME_THRESHOLD;

        // Update speaking state based on volume
        if (isSpeech && !isCurrentlySpeaking.current) {
          isCurrentlySpeaking.current = true;
          console.log(
            `[Audio] 🎤 Speech detected (volume: ${volume.toFixed(4)})`
          );
        } else if (!isSpeech && isCurrentlySpeaking.current) {
          // Use a small delay before marking as not speaking to avoid flickering
          setTimeout(() => {
            const currentVolume = calculateVolume(audioData);
            if (currentVolume <= VOLUME_THRESHOLD) {
              isCurrentlySpeaking.current = false;
              console.log(
                `[Audio] 🔇 Speech ended (volume: ${currentVolume.toFixed(4)})`
              );
            }
          }, 100);
        }

        // Add to buffer
        audioBuffer.current.push(audioData);

        // Calculate current buffer size
        const currentBufferSize = audioBuffer.current.reduce(
          (sum, chunk) => sum + chunk.byteLength,
          0
        );

        // If buffer is large enough, flush immediately
        if (currentBufferSize >= TARGET_BUFFER_SIZE) {
          if (bufferTimeout.current) {
            clearTimeout(bufferTimeout.current);
            bufferTimeout.current = null;
          }
          flushBuffer();
        } else {
          // Otherwise, set a timeout to flush after 200ms max
          if (bufferTimeout.current) {
            clearTimeout(bufferTimeout.current);
          }
          bufferTimeout.current = window.setTimeout(() => {
            flushBuffer();
            bufferTimeout.current = null;
          }, 200);
        }

        // Handle speaking detection for UI (based on volume)
        if (onSpeakingChange) {
          if (isSpeech && !isSpeakingRef.current) {
            isSpeakingRef.current = true;
            onSpeakingChange(true);
          }

          if (speakingTimeout.current) {
            clearTimeout(speakingTimeout.current);
          }

          speakingTimeout.current = window.setTimeout(() => {
            if (isSpeakingRef.current) {
              isSpeakingRef.current = false;
              onSpeakingChange(false);
            }
          }, 500); // 500ms of silence means they stopped
        }
      };

      const source = context.createMediaStreamSource(mediaStream);
      console.log(
        "[Audio] 8. MediaStreamSource created, connecting to worklet."
      );
      source.connect(node);
      // DO NOT connect to context.destination - this creates audio feedback!

      console.log(
        "[Audio] 9. ✅ Audio buffering enabled - chunks will be ~200ms"
      );
    } catch (error) {
      console.error("[Audio] CRITICAL ERROR starting audio recording:", error);
      stopRecording();
    }
  }, [onSpeakingChange, stopRecording, flushBuffer, calculateVolume]);

  return { startRecording, stopRecording };
}
