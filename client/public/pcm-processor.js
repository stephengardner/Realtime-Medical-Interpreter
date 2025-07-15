/**
 * A custom AudioWorkletProcessor to convert float32 audio data to 16-bit PCM.
 */
class PcmProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
    }
  
    process(inputs, outputs, parameters) {
      // We only expect one input, and we'll take the first channel.
      const input = inputs[0];
      const channelData = input[0];
  
      if (!channelData) {
        return true; // Keep processor alive
      }
  
      // The channelData is a Float32Array. We need to convert it to a 16-bit
      // signed integer PCM format.
      const pcmData = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        // Clamp the float32 value between -1 and 1, then scale to 16-bit integer range.
        const s = Math.max(-1, Math.min(1, channelData[i]));
        // 0x7FFF is the maximum positive value for a 16-bit signed integer.
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
  
      // Post the PCM data back to the main thread.
      // We transfer the underlying ArrayBuffer to avoid copying.
      this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
  
      // Return true to indicate that the processor should remain active.
      return true;
    }
  }
  
  registerProcessor('pcm-processor', PcmProcessor); 