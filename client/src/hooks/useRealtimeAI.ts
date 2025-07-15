import { useRef, useCallback, useState, useEffect } from "react";

type RealtimeAIProps = {
  url: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onSessionReady?: (data: {
    sessionId: string;
    conversationId?: string;
  }) => void;
  onTranscript: (data: {
    id: string;
    text: string;
    is_user: boolean;
    finished: boolean;
    role?: string;
  }) => void;
  onTranslation: (data: {
    id: string;
    text: string;
    finished: boolean;
  }) => void;
  onAudioEvent: (data: {
    event:
      | "speech_started"
      | "speech_stopped"
      | "audio_playing"
      | "audio_stopped"
      | "session_ready";
  }) => void;
  onConversationStopped?: (data: {
    conversationId: string;
    summary: string | null;
  }) => void;
  onIntentsExtracted?: (data: {
    messageId: string;
    intents: Array<{
      type: string;
      confidence: number;
      [key: string]: any;
    }>;
  }) => void;
  onError?: (error: string) => void;
};

export function useRealtimeAI(props: RealtimeAIProps) {
  const ws = useRef<WebSocket | null>(null);
  const audioQueue = useRef<string[]>([]);
  const isPlaying = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const lastAudioByRole = useRef<{
    doctor: string | null;
    patient: string | null;
  }>({
    doctor: null,
    patient: null,
  }); // Store last audio for each role for repeat feature
  const currentSpeakerRole = useRef<"doctor" | "patient" | null>(null); // Track current speaker

  // Use refs to track the latest state values
  const isSessionReadyRef = useRef(false);

  // Use a ref to hold the latest callbacks
  const callbackRef = useRef(props);
  useEffect(() => {
    callbackRef.current = props;
  }, [props]);

  const processAudioQueue = useCallback(async () => {
    if (isPlaying.current || audioQueue.current.length === 0) {
      return;
    }

    isPlaying.current = true;
    callbackRef.current.onAudioEvent({ event: "audio_playing" });

    const audioData = audioQueue.current.shift();
    if (!audioData) {
      isPlaying.current = false;
      callbackRef.current.onAudioEvent({ event: "audio_stopped" });
      return;
    }

    // Store this audio data for potential replay
    // The translation audio should be stored under the role of the original speaker
    // since that's what the other person wants to hear repeated
    if (currentSpeakerRole.current) {
      lastAudioByRole.current[currentSpeakerRole.current] = audioData;
      console.log(
        `🔄 [useRealtimeAI] Stored translation audio for ${currentSpeakerRole.current}`
      );
    }

    try {
      if (!audioContext.current) {
        audioContext.current = new AudioContext({ sampleRate: 24000 });
      }
      if (audioContext.current.state === "suspended") {
        await audioContext.current.resume();
      }

      // OpenAI sends base64-encoded PCM16 audio data
      const decodedData = atob(audioData);
      const pcmData = new Int16Array(decodedData.length / 2);

      // Convert base64 decoded bytes to PCM16 samples
      for (let i = 0; i < pcmData.length; i++) {
        const byte1 = decodedData.charCodeAt(i * 2);
        const byte2 = decodedData.charCodeAt(i * 2 + 1);
        pcmData[i] = (byte2 << 8) | byte1; // Little-endian 16-bit
      }

      // Create audio buffer from PCM data
      const audioBuffer = audioContext.current.createBuffer(
        1,
        pcmData.length,
        24000
      );
      const channelData = audioBuffer.getChannelData(0);

      // Convert PCM16 to float32 for Web Audio API
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 32768.0; // Convert to -1.0 to 1.0 range
      }

      const source = audioContext.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.current.destination);
      source.start();
      source.onended = () => {
        isPlaying.current = false;
        callbackRef.current.onAudioEvent({ event: "audio_stopped" });
        processAudioQueue();
      };
    } catch (error) {
      console.error("Error playing audio:", error);
      isPlaying.current = false;
      callbackRef.current.onAudioEvent({ event: "audio_stopped" });
      processAudioQueue();
    }
  }, []);

  const replayLastAudio = useCallback(
    (requestingRole: "doctor" | "patient") => {
      // Get the OTHER person's last audio
      const otherRole = requestingRole === "doctor" ? "patient" : "doctor";
      const audioToReplay = lastAudioByRole.current[otherRole];

      if (audioToReplay) {
        console.log(
          `🔄 [useRealtimeAI] ${requestingRole} requested repeat - replaying last ${otherRole} audio`
        );
        audioQueue.current.push(audioToReplay);
        processAudioQueue();
      } else {
        console.log(`⚠️ [useRealtimeAI] No ${otherRole} audio to replay`);
      }
    },
    [processAudioQueue]
  );

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      //   console.log(
      //     "🔍 [useRealtimeAI] Raw WebSocket message received:",
      //     event.data
      //   );
      try {
        const data = JSON.parse(event.data);
        // console.log(
        //   "🔍 [useRealtimeAI] Parsed message:",
        //   JSON.stringify(data, null, 2)
        // );
        console.log("🔍 [useRealtimeAI] Message type:", data.type);

        if (data.type === "session_ready") {
          console.log("🎉 [useRealtimeAI] SESSION READY MESSAGE RECEIVED!");
          console.log(
            "🔍 [useRealtimeAI] Current isSessionReady state:",
            isSessionReady
          );
          console.log("🔍 [useRealtimeAI] Setting isSessionReady to true...");
          setIsSessionReady(true);
          isSessionReadyRef.current = true; // Update ref immediately
          console.log("🔍 [useRealtimeAI] Calling onSessionReady callback");
          callbackRef.current.onSessionReady?.({
            sessionId: data.data.sessionId,
            conversationId: data.data.conversationId,
          });
          callbackRef.current.onAudioEvent({ event: "session_ready" });
        } else if (data.type === "transcript") {
          console.log(
            "📝 [useRealtimeAI] Processing transcript message:",
            data
          );

          callbackRef.current.onTranscript(data.data);
        } else if (data.type === "translation") {
          console.log(
            "🔤 [useRealtimeAI] Processing translation message:",
            JSON.stringify(data, null, 2)
          );
          console.log("🔤 [useRealtimeAI] Translation data:", data.data);

          // Check for "repeat" command in the translation (since we need to check both languages)
          const translationText = data.data.text?.toLowerCase() || "";
          const isRepeatCommand =
            translationText.includes("repeat that") ||
            translationText.includes("repeat") ||
            translationText.includes("say that again") ||
            translationText.includes("repeta") ||
            translationText.includes("repite") ||
            translationText.includes("di eso otra vez");

          if (isRepeatCommand && data.data.finished) {
            console.log(
              "🔄 [useRealtimeAI] Detected repeat command in translation, replaying last audio"
            );
            if (currentSpeakerRole.current) {
              replayLastAudio(currentSpeakerRole.current);
            }
            return; // Don't process as normal translation
          }

          console.log(
            "🔤 [useRealtimeAI] Calling onTranslation callback with:",
            data.data
          );
          callbackRef.current.onTranslation(data.data);
        } else if (data.type === "audio") {
          console.log("🔊 [useRealtimeAI] Processing audio message");
          audioQueue.current.push(data.data);
          processAudioQueue();
        } else if (data.type === "event") {
          console.log(
            "📡 [useRealtimeAI] Processing event message:",
            data.data
          );
          if (data.data.event === "session_ready") {
            console.log("🎉 [useRealtimeAI] SESSION READY EVENT RECEIVED!");
            console.log(
              "🔍 [useRealtimeAI] Current isSessionReady state:",
              isSessionReady
            );
            console.log("🔍 [useRealtimeAI] Setting isSessionReady to true...");
            setIsSessionReady(true);
            isSessionReadyRef.current = true; // Update ref immediately
            console.log("🔍 [useRealtimeAI] Calling onSessionReady callback");
            callbackRef.current.onSessionReady?.({
              sessionId: "unknown",
              conversationId: undefined,
            });
          }
          console.log("[useRealtimeAI] Calling onAudioEvent with:", data.data);
          callbackRef.current.onAudioEvent(data.data);
        } else if (data.type === "conversation_stopped") {
          console.log(
            "🛑 [useRealtimeAI] Processing conversation stopped message:",
            data
          );
          callbackRef.current.onConversationStopped?.(data.data);
        } else if (data.type === "intents_extracted") {
          console.log(
            "🧠 [useRealtimeAI] Processing intents extracted message:",
            data
          );
          callbackRef.current.onIntentsExtracted?.(data.data);
        } else if (data.type === "error") {
          console.log("❌ [useRealtimeAI] Processing error message:", data);
          callbackRef.current.onError?.(data.data.message || "Unknown error");
        } else {
          console.log(
            "[useRealtimeAI] Unknown message type:",
            data.type,
            "Full data:",
            data
          );
        }
      } catch (error) {
        console.error("[useRealtimeAI] Error parsing message:", error);
        console.error("[useRealtimeAI] Raw message data:", event.data);
        callbackRef.current.onError?.("Error processing message from server.");
      }
    },
    [processAudioQueue, isSessionReady]
  );

  const start = useCallback(async () => {
    return new Promise<void>((resolve, reject) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        console.log(
          "[useRealtimeAI] WebSocket already open, resolving immediately"
        );
        return resolve();
      }

      console.log(
        "[useRealtimeAI] Creating new WebSocket connection to:",
        callbackRef.current.url
      );
      const newWs = new WebSocket(callbackRef.current.url);

      newWs.onopen = () => {
        console.log("[useRealtimeAI] WebSocket opened successfully");
        ws.current = newWs;
        setIsConnected(true);
        callbackRef.current.onConnect?.();
        resolve();
      };

      newWs.onmessage = (event) => {
        // console.log(
        //   "[useRealtimeAI] Raw WebSocket message received:",
        //   event.data
        // );
        handleMessage(event);
      };

      newWs.onclose = (event) => {
        console.log(
          "[useRealtimeAI] WebSocket closed. Code:",
          event.code,
          "Reason:",
          event.reason
        );
        ws.current = null;
        setIsConnected(false);
        setIsSessionReady(false);
        isSessionReadyRef.current = false; // Update ref
        callbackRef.current.onDisconnect?.();
      };

      newWs.onerror = (event) => {
        console.error("[useRealtimeAI] WebSocket error:", event);
        callbackRef.current.onError?.("WebSocket connection error.");
        reject(new Error("WebSocket connection error."));
      };
    });
  }, [handleMessage]);

  const stop = useCallback(() => {
    console.log("[useRealtimeAI] Stopping WebSocket connection");
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setIsConnected(false);
    setIsSessionReady(false);
    isSessionReadyRef.current = false; // Update ref
  }, []);

  const sendAudio = useCallback(
    (audioChunk: ArrayBuffer) => {
      const wsOpen = ws.current && ws.current.readyState === WebSocket.OPEN;
      const sessionReady = isSessionReadyRef.current; // Use ref instead of state
      const isReady = wsOpen && sessionReady;

      // console.log(
      //   `[useRealtimeAI] sendAudio called:
      //    - WS exists: ${!!ws.current}
      //    - WS state: ${wsState} (1=OPEN)
      //    - WS is open: ${wsOpen}
      //    - isSessionReady (ref): ${sessionReady}
      //    - isSessionReady (state): ${isSessionReady}
      //    - Final isReady: ${isReady}`
      // );

      if (isReady && ws.current) {
        // console.log(
        //   `[useRealtimeAI] ✅ Sending audio chunk: ${audioChunk.byteLength} bytes`
        // );
        ws.current.send(audioChunk);
      } else {
        console.log(`[useRealtimeAI] ❌ NOT READY - cannot send audio`);
      }
    },
    [isSessionReady] // Keep this for re-renders, but use ref for actual logic
  );

  const sendMessage = useCallback((message: any) => {
    const wsOpen = ws.current && ws.current.readyState === WebSocket.OPEN;

    if (wsOpen && ws.current) {
      console.log(`[useRealtimeAI] 📤 Sending message:`, message);
      ws.current.send(JSON.stringify(message));
    } else {
      console.log(
        `[useRealtimeAI] ❌ Cannot send message - WebSocket not open`
      );
    }
  }, []);

  // Speaker roles are now automatically detected by language on the server

  return {
    isConnected,
    isSessionReady,
    start,
    stop,
    sendAudio,
    sendMessage,
    replayLastAudio,
  };
}
