import { WebSocket } from "ws";
import OpenAI from "openai";
import { Buffer } from "buffer";
import { Conversation, IConversation, SpeakerType } from "./models";
import { Document } from "mongoose";
import IntentRecognitionService from "./services/intent-recognition";
import fetch from "node-fetch";

interface WebhookAction {
  type: string;
  confidence: number;
  extractedAt: Date;
  [key: string]: any;
}

interface RealtimeSession {
  id: string;
  clientWs: WebSocket;
  openaiWs: WebSocket | null;
  isAlive: boolean;
  audioChunkCount: number; // Add counter for audio chunks
  currentUserItemId: string | null; // Track the current user item ID for translation linking
  conversation: (IConversation & Document) | null; // Database conversation document
  conversationId: string | null; // Track conversation ID for resumption
  currentSpeaker: SpeakerType; // Track the current speaker role from client
  languageConfig: {
    isDoctorSpanish: boolean;
    doctorLanguage: "spanish" | "english";
    patientLanguage: "spanish" | "english";
  }; // Track language configuration for this session
  pendingMessage: {
    originalText: string;
    speaker: SpeakerType;
    timestamp: Date;
    translatedText?: string; // Optional until translation is complete
  } | null; // Track pending message until translation is complete
  lastActivity: Date; // Track last activity for inactivity timeout
  inactivityTimeout: NodeJS.Timeout | null; // Track inactivity timeout
}

class RealtimeManager {
  private sessions = new Map<string, RealtimeSession>();
  private openai: OpenAI;
  private intentRecognitionService: IntentRecognitionService;
  private webhookUrl: string;

  // Configuration constants
  private readonly INACTIVITY_TIMEOUT_MINUTES = 15; // 15 minutes of inactivity
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

  constructor(openai: OpenAI) {
    this.openai = openai;
    this.intentRecognitionService = new IntentRecognitionService(openai);
    this.webhookUrl =
      process.env.WEBHOOK_URL || "https://webhook.site/YOUR_WEBHOOK_ID_HERE";

    // Heartbeat to clean up dead sessions and check for inactivity
    setInterval(() => {
      this.sessions.forEach((session) => {
        if (!session.isAlive) {
          console.log(`🧹 Terminating dead session: ${session.id}`);
          session.clientWs.terminate();
          this.stopConversation(session.id);
          return;
        }
        session.isAlive = false;
        session.clientWs.ping();

        // Check for inactivity timeout
        this.checkInactivityTimeout(session);
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  private checkInactivityTimeout(session: RealtimeSession) {
    const now = new Date();
    const timeSinceLastActivity =
      now.getTime() - session.lastActivity.getTime();
    const timeoutMs = this.INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;

    if (timeSinceLastActivity > timeoutMs && session.conversation) {
      console.log(
        `⏰ Session ${session.id} timed out after ${this.INACTIVITY_TIMEOUT_MINUTES} minutes of inactivity`
      );

      // Send timeout notification to client
      this.sendToClient(session, {
        type: "conversation_timeout",
        message: `Conversation ended due to ${this.INACTIVITY_TIMEOUT_MINUTES} minutes of inactivity`,
      });

      // Stop the conversation
      this.stopConversation(session.id);
    }
  }

  private resetInactivityTimeout(session: RealtimeSession) {
    // Clear existing timeout if any
    if (session.inactivityTimeout) {
      clearTimeout(session.inactivityTimeout);
    }

    // Set new timeout
    session.inactivityTimeout = setTimeout(() => {
      console.log(
        `⏰ Session ${session.id} timed out after ${this.INACTIVITY_TIMEOUT_MINUTES} minutes of inactivity`
      );

      // Send timeout notification to client
      this.sendToClient(session, {
        type: "conversation_timeout",
        message: `Conversation ended due to ${this.INACTIVITY_TIMEOUT_MINUTES} minutes of inactivity`,
      });

      // Stop the conversation
      this.stopConversation(session.id);
    }, this.INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);
  }

  async createSession(clientWs: WebSocket): Promise<string> {
    const sessionId = this.generateId();
    console.log(`🔌 Creating new realtime session: ${sessionId}`);

    const session: RealtimeSession = {
      id: sessionId,
      clientWs,
      openaiWs: null,
      isAlive: true,
      audioChunkCount: 0, // Initialize counter
      currentUserItemId: null, // Initialize user item ID
      conversation: null, // Initialize conversation
      conversationId: null, // Initialize conversation ID
      currentSpeaker: "doctor", // Initialize with default speaker role
      languageConfig: {
        isDoctorSpanish: false, // Default: Doctor=English, Patient=Spanish
        doctorLanguage: "english",
        patientLanguage: "spanish",
      },
      pendingMessage: null, // Initialize pending message
      lastActivity: new Date(), // Initialize last activity
      inactivityTimeout: null, // Initialize inactivity timeout
    };
    this.sessions.set(sessionId, session);

    // Connect directly to the WebSocket and configure it
    await this.startDirectOpenAIStream(session);

    clientWs.on("message", (data: Buffer) => {
      // Try to parse as JSON first (for configuration messages)
      try {
        const message = JSON.parse(data.toString());
        if (message.type === "language_config") {
          console.log(
            "[Server] 🌐 Received language configuration:",
            message.data
          );
          session.languageConfig = message.data;
          console.log(
            "[Server] 🌐 Updated language config:",
            session.languageConfig
          );
          return;
        }
      } catch (e) {
        // Not JSON, treat as audio data
      }

      // Handle audio data
      session.audioChunkCount++;
      session.lastActivity = new Date(); // Update last activity

      // Reset inactivity timeout on audio activity
      this.resetInactivityTimeout(session);

      // Log audio chunk info to monitor buffering improvements
      const chunkSize = data.byteLength;
      const durationMs = Math.round(chunkSize / 32); // 16kHz * 2 bytes = 32 bytes per ms

      if (session.audioChunkCount % 10 === 0) {
        console.log(
          `[Server] 📊 Audio chunk #${session.audioChunkCount}: ${chunkSize} bytes (~${durationMs}ms)`
        );
      }

      if (!session.openaiWs) {
        console.log(
          `[Server] ❌ OpenAI WebSocket is null for session ${session.id}`
        );
        return;
      }

      const openaiWsState = session.openaiWs.readyState;

      if (openaiWsState === WebSocket.OPEN) {
        // Convert audio data to base64 and send as input_audio_buffer.append event
        const base64Audio = data.toString("base64");
        const audioEvent = {
          type: "input_audio_buffer.append",
          audio: base64Audio,
        };

        session.openaiWs.send(JSON.stringify(audioEvent));
      } else {
        console.log(`[Server] ❌ OpenAI WS not open. State: ${openaiWsState}`);
      }
    });

    clientWs.on("close", () => {
      console.log(`🔌 Client disconnected: ${sessionId}`);
      this.stopConversation(sessionId);
    });

    clientWs.on("pong", () => {
      session.isAlive = true;
      session.lastActivity = new Date(); // Update last activity on pong

      // Reset inactivity timeout on pong response
      this.resetInactivityTimeout(session);
    });

    return sessionId;
  }

  private async startDirectOpenAIStream(session: RealtimeSession) {
    try {
      // Don't specify model in URL - it should be in session config only
      const url = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview`;

      const openaiWs = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this.openai.apiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });

      session.openaiWs = openaiWs;

      openaiWs.on("open", () => {
        console.log(`✅ OpenAI WebSocket connected for session: ${session.id}`);
        console.log(
          `⏳ Waiting for session.created event before sending configuration...`
        );
      });

      openaiWs.on("message", (data) => {
        this.handleOpenAIMessage(session, data);
      });

      openaiWs.on("error", (error) => {
        console.error(
          `❌ OpenAI WebSocket error for session ${session.id}:`,
          error.message
        );
        console.error(`❌ Error details:`, error);
        this.sendToClient(session, {
          type: "error",
          data: { message: error.message },
        });
      });

      openaiWs.on("close", (code, reason) => {
        console.log(
          `🔌 OpenAI WebSocket closed for session ${
            session.id
          }: Code ${code}, Reason: ${reason.toString()}`
        );
        session.openaiWs = null;
        if (session.clientWs.readyState === WebSocket.OPEN) {
          console.log(`[Server] Notifying client of OpenAI disconnection`);
          this.sendToClient(session, {
            type: "event",
            data: { event: "reconnecting" },
          });
        }
      });
    } catch (error) {
      console.error(
        `❌ Error starting OpenAI stream for session ${session.id}:`,
        error
      );
      this.sendToClient(session, {
        type: "error",
        data: { message: "Failed to start session" },
      });
    }
  }

  private async handleOpenAIMessage(session: RealtimeSession, data: any) {
    try {
      const message = JSON.parse(data.toString());
      console.log(`[Server] Handling OpenAI message type: ${message.type}`);

      switch (message.type) {
        case "session.created":
          console.log(`[Server] Received session event: ${message.type}`);

          // Build dynamic translation instructions based on language configuration
          const { doctorLanguage, patientLanguage } = session.languageConfig;

          const translationInstructions = `CRITICAL: You are a TRANSLATION MACHINE ONLY. You MUST NEVER respond conversationally or answer questions. LANGUAGE RESTRICTION: You ONLY work with English and Spanish. If you receive Japanese, Chinese, Korean, Arabic, or any other language, respond with "INVALID_LANGUAGE". TRANSLATION RULES: 1) ${doctorLanguage} input → Output ${patientLanguage} translation ONLY. 2) ${patientLanguage} input → Output ${doctorLanguage} translation ONLY. 3) NO greetings, responses, or answers. 4) NO questions or conversation. 5) ONLY translate the exact words spoken. 6) Do NOT add extra words or phrases. 7) NEVER be conversational. 8) If someone asks "How are you?" translate it as "¿Cómo estás?" NOT "I'm fine". 9) ONLY TRANSLATE, NEVER RESPOND.`;

          // Now send the session configuration after receiving session.created
          const config = {
            type: "session.update",
            session: {
              model: "gpt-4o-realtime-preview-2024-12-17", // Specify model in session config
              modalities: ["text", "audio"],
              voice: "echo", // Male voice for both roles
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500, // Reduced from default to be more responsive
                create_response: false, // Disable automatic response generation
              },
              input_audio_format: "pcm16",
              output_audio_format: "pcm16",
              input_audio_transcription: {
                model: "gpt-4o-transcribe",
                prompt:
                  "Transcribe the audio accurately in English or Spanish only. If the audio is in any other language (Japanese, Chinese, Korean, Arabic, etc.), output 'INVALID_LANGUAGE'. Do not translate or respond, only transcribe.",
              },
              instructions: translationInstructions,
            },
          };

          console.log(`✅ Sending session configuration for: ${session.id}`);
          console.log(`📝 Session config:`, JSON.stringify(config, null, 2));

          if (
            session.openaiWs &&
            session.openaiWs.readyState === WebSocket.OPEN
          ) {
            session.openaiWs.send(JSON.stringify(config));
            console.log(`✅ Sent session configuration over WebSocket`);
          } else {
            console.error(
              `❌ Cannot send session config - WebSocket not ready`
            );
          }
          break;

        case "session.updated":
          console.log(`[Server] Received session event: ${message.type}`);

          // Create conversation in database when session is ready (conversation resumption handled in client message)
          if (!session.conversation) {
            await this.createConversation(session);
          }

          // Notify client that session is ready after OpenAI confirms the session is updated
          console.log(`✅ Notified client that session is ready.`);
          this.sendToClient(session, {
            type: "session_ready",
            data: {
              sessionId: session.id,
              conversationId: session.conversationId,
            },
          });
          break;

        case "conversation.item.created":
          console.log(
            `[Server] 📝 Conversation item created: ${message.item?.id}`
          );
          // Track user item IDs for translation linking
          if (message.item?.role === "user") {
            console.log(
              `[Server] 📝 Tracking user item ID: ${message.item.id}`
            );
            session.currentUserItemId = message.item.id;
          }
          break;

        case "response.audio.delta":
          console.log(`[Server] 🔊 Streaming audio delta to client`);

          // Send audio delta to client for real-time playback
          this.sendToClient(session, {
            type: "audio",
            data: message.delta,
          });
          break;

        case "response.audio.done":
          console.log(`[Server] 🔊 Audio streaming complete`);
          break;

        case "response.audio_transcript.delta":
          console.log(`[Server] 🔤 Translation delta: "${message.delta}"`);

          // Send translation delta to client for real-time updates
          this.sendToClient(session, {
            type: "translation",
            data: {
              id: session.currentUserItemId,
              text: message.delta,
              finished: false,
            },
          });
          break;

        case "response.audio_transcript.done":
          console.log(
            `[Server] 🔤 Translation complete: "${message.transcript}"`
          );

          // Check if translation response indicates invalid language
          if (message.transcript.trim() === "INVALID_LANGUAGE") {
            console.log(
              `[Server] ⚠️ Translation rejected invalid language input`
            );
            this.sendToClient(session, {
              type: "error",
              data: {
                message: "Only English and Spanish are supported",
                transcript: session.pendingMessage?.originalText || "",
              },
            });
            break;
          }

          // Send final translation to client
          this.sendToClient(session, {
            type: "translation",
            data: {
              id: session.currentUserItemId,
              text: message.transcript,
              finished: true,
            },
          });

          // Save the completed message to database
          await this.saveCompletedMessage(session, message.transcript);
          break;

        case "response.text.delta":
          console.log(
            `[Server] 📝 Received text response from OpenAI: "${message.delta}"`
          );
          break;

        case "response.text.done":
          console.log(`[Server] 📝 Text response complete from OpenAI`);
          break;

        case "input_audio_buffer.speech_started":
          console.log(`[Server] 🎤 OpenAI detected speech started`);
          this.sendToClient(session, {
            type: "event",
            data: { event: "speech_started" },
          });
          break;

        case "input_audio_buffer.speech_stopped":
          console.log(`[Server] 🎤 OpenAI detected speech stopped`);

          // Commit the audio buffer to trigger processing
          const commitEvent = {
            type: "input_audio_buffer.commit",
          };

          console.log(`[Server] 📤 Committing audio buffer for processing`);
          if (
            session.openaiWs &&
            session.openaiWs.readyState === WebSocket.OPEN
          ) {
            session.openaiWs.send(JSON.stringify(commitEvent));
          }

          // Note: We do NOT send response.create for translation-only mode
          // The input_audio_transcription will handle the translation automatically

          this.sendToClient(session, {
            type: "event",
            data: { event: "speech_stopped" },
          });
          break;

        case "conversation.item.input_audio_transcription.delta":
          console.log(`[Server] 🎤 Transcription delta: "${message.delta}"`);

          // Send transcription delta to client for real-time updates with "detecting" state
          this.sendToClient(session, {
            type: "transcript",
            data: {
              id: message.item_id,
              text: message.delta,
              is_user: true,
              finished: false,
              role: "detecting", // Show detecting state until language detection is complete
            },
          });
          break;

        case "conversation.item.input_audio_transcription.completed":
          console.log(
            `[Server] 🎤 User speech transcribed: "${message.transcript}"`
          );

          // Check if transcription indicates invalid language
          if (message.transcript.trim() === "INVALID_LANGUAGE") {
            console.log(
              `[Server] ⚠️ Whisper detected invalid language, skipping transcription`
            );
            this.sendToClient(session, {
              type: "error",
              data: {
                message: "Only English and Spanish are supported",
                transcript: message.transcript,
              },
            });
            break;
          }

          // Store the user item ID for tracking
          session.currentUserItemId = message.item_id;

          try {
            // Automatically detect speaker based on language
            const detectedSpeaker = await this.detectSpeakerByLanguage(
              message.transcript,
              session.languageConfig
            );
            console.log(
              `[Server] 👤 Auto-detected speaker: ${detectedSpeaker} (was: ${session.currentSpeaker})`
            );

            // Store the original text for later pairing with translation
            session.pendingMessage = {
              originalText: message.transcript,
              speaker: detectedSpeaker, // Use language-detected speaker instead of client-provided
              timestamp: new Date(),
            };

            // Update session's current speaker for consistency
            session.currentSpeaker = detectedSpeaker;

            // Send a final transcript message with the correct speaker role
            console.log(
              `[Server] 📤 Sending final transcript with role: ${detectedSpeaker}`
            );
            this.sendToClient(session, {
              type: "transcript",
              data: {
                id: message.item_id,
                text: message.transcript,
                is_user: true,
                finished: true,
                role: detectedSpeaker, // Use the detected speaker role
              },
            });
            console.log(
              `[Server] ✅ Sent final transcript message with role: ${detectedSpeaker}`
            );

            // Generate translation response using OpenAI Realtime API
            await this.generateTranslationResponse(
              session,
              message.transcript,
              detectedSpeaker
            );
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "INVALID_LANGUAGE"
            ) {
              console.log(
                `[Server] ⚠️ Skipping invalid language transcription: "${message.transcript}"`
              );
              // Send error message to client
              this.sendToClient(session, {
                type: "error",
                data: {
                  message: "Only English and Spanish are supported",
                  transcript: message.transcript,
                },
              });
            } else {
              console.error(
                `[Server] ❌ Error processing transcription: ${error}`
              );
            }
          }
          break;

        case "conversation.item.input_audio_transcription.failed":
          console.log(
            `[Server] ❌ Transcription failed: ${message.error?.message}`
          );
          break;

        case "response.created":
          console.log(`[Server] 🤖 Translation response started`);
          break;

        case "response.done":
          console.log(`[Server] ✅ Translation response complete`);
          break;

        case "transcript.created":
          console.log(
            `[Server] 📝 Legacy transcript created (shouldn't happen with current config)`
          );
          this.sendToClient(session, {
            type: "transcript",
            data: {
              id: message.transcript.id,
              text: message.transcript.text,
              is_user: message.transcript.is_user,
              finished: message.transcript.final,
              role: session.currentSpeaker,
            },
          });
          break;

        case "audio.queued":
          console.log(
            `[Server] 🔊 Legacy audio queued (shouldn't happen with current config)`
          );
          this.sendToClient(session, {
            type: "audio",
            data: message.audio,
          });
          break;

        case "tool_call.created":
        case "tool_call.updated":
        case "tool_call.delta":
          console.log(
            `[Server] 🔧 Received tool call message, ignoring for now.`
          );
          break;

        case "session.created":
        case "session.updated":
        case "session.terminated":
          console.log(`[Server] 📋 Received session event: ${message.type}`);
          break;

        case "error":
          console.error(`[Server] ❌ OpenAI error: ${message.error?.message}`);
          this.sendToClient(session, {
            type: "error",
            data: { message: message.error?.message || "Unknown error" },
          });
          break;

        default:
          console.log(
            `[Server] ❓ Unhandled OpenAI message type: ${message.type}`
          );
          console.log(
            `[Server] Full message:`,
            JSON.stringify(message, null, 2)
          );
          break;
      }
    } catch (error) {
      console.error(
        `❌ Error processing OpenAI message for session ${session.id}:`,
        error
      );
    }
  }

  private async createConversation(session: RealtimeSession) {
    try {
      if (session.conversation) {
        console.log(
          `[Server] 💾 Conversation already exists for session: ${session.id}`
        );
        return;
      }

      const conversation = new Conversation({
        sessionId: session.id,
        status: "active",
        messages: [],
        startTime: new Date(),
        totalMessageCount: 0,
      });

      await conversation.save();
      session.conversation = conversation;
      session.conversationId = conversation._id?.toString() || null;
      console.log(
        `[Server] 💾 Created new conversation for session: ${session.id}, conversationId: ${session.conversationId}`
      );
    } catch (error) {
      console.error(
        `[Server] ❌ Error creating conversation for session ${session.id}:`,
        error
      );
    }
  }

  /**
   * Detect speaker role based on language using OpenAI
   */
  private async detectSpeakerByLanguage(
    text: string,
    languageConfig: any
  ): Promise<SpeakerType> {
    try {
      console.log(`[LanguageDetection] 🔍 Detecting language for: "${text}"`);
      console.log(
        `[LanguageDetection] 🌐 Using language config:`,
        languageConfig
      );

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a strict language detection system for English/Spanish only. Analyze the given text and determine if it's primarily English, Spanish, or NEITHER.
            
            CRITICAL RULES:
            - ONLY respond with "english", "spanish", or "INVALID"
            - If the text contains Japanese, Chinese, Korean, Arabic, or any other non-English/Spanish language, respond with "INVALID"
            - If the text is primarily English, respond with "english"
            - If the text is primarily Spanish, respond with "spanish"
            - If mixed English/Spanish, choose the dominant one
            - If unclear between English/Spanish only, default to "english"
            - If the text is clearly in any other language, respond with "INVALID"
            
            Examples:
            "Hello, how are you?" -> english
            "¿Hola, cómo estás?" -> spanish
            "I have dolor de cabeza" -> english
            "Tengo headache" -> spanish
            "こんにちは" -> INVALID
            "ご視聴ありがとうございました" -> INVALID
            "你好" -> INVALID
            "Bonjour" -> INVALID`,
          },
          {
            role: "user",
            content: `Detect the language of this text: "${text}"`,
          },
        ],
        max_tokens: 10,
        temperature: 0.1,
      });

      const detectedLanguage = response.choices[0]?.message?.content
        ?.trim()
        .toLowerCase();

      // Check if language is invalid (non-English/Spanish)
      if (detectedLanguage === "invalid") {
        console.log(
          `[LanguageDetection] ❌ Invalid language detected, skipping: "${text}"`
        );
        throw new Error("INVALID_LANGUAGE");
      }

      // Use language configuration to determine speaker role
      let speaker: SpeakerType;
      if (detectedLanguage === "spanish") {
        speaker = languageConfig.isDoctorSpanish ? "doctor" : "patient";
        console.log(
          `[LanguageDetection] 🇪🇸 Spanish detected -> ${speaker} speaking`
        );
      } else {
        speaker = languageConfig.isDoctorSpanish ? "patient" : "doctor";
        console.log(
          `[LanguageDetection] 🇺🇸 English detected -> ${speaker} speaking`
        );
      }

      return speaker;
    } catch (error) {
      console.error(`[LanguageDetection] ❌ Error detecting language:`, error);
      // Default fallback: if detection fails, use basic text analysis
      return this.detectSpeakerFallback(text);
    }
  }

  /**
   * Fallback language detection using simple text analysis
   */
  private detectSpeakerFallback(text: string): SpeakerType {
    // Spanish indicators: tildes, ñ, specific Spanish words
    const spanishIndicators =
      /[ñáéíóúüÑÁÉÍÓÚÜ]|¿|¡|hola|gracias|cómo|está|sí|no|por favor|doctora?|médico|dolor|medicina|tengo|me duele|muy|bien|mal|aquí|dónde|qué|cuándo|necesito|ayuda/i;

    // Common English medical terms and doctor phrases
    const englishMedicalTerms =
      /doctor|patient|pain|medicine|treatment|symptoms|how are you|thank you|please|appointment|prescription|how can I help|what brings you|what's wrong|tell me about|describe|examination|diagnosis|medical|health|feel better|take care|follow up|see you|good morning|good afternoon|come in|have a seat|what seems to be|any other|let me check|I recommend|you should|take this/i;

    if (spanishIndicators.test(text)) {
      console.log(
        `[LanguageDetection] 🇪🇸 Spanish patterns detected -> Patient speaking`
      );
      return "patient";
    } else if (englishMedicalTerms.test(text)) {
      console.log(
        `[LanguageDetection] 🇺🇸 English medical terms detected -> Doctor speaking`
      );
      return "doctor";
    }

    // Default to patient if uncertain
    console.log(
      `[LanguageDetection] ❓ Uncertain language -> Defaulting to Patient`
    );
    return "patient";
  }

  private async saveCompletedMessage(
    session: RealtimeSession,
    translatedText: string
  ) {
    try {
      if (!session.conversation) {
        console.log(
          `[Server] ⚠️  No conversation found for session: ${session.id}`
        );
        return;
      }

      if (!session.pendingMessage) {
        console.log(
          `[Server] ⚠️  No pending message to save for session: ${session.id}`
        );
        return;
      }

      // Extract intents from the message
      console.log(
        `[Server] 🧠 Extracting intents for message from ${session.pendingMessage.speaker}`
      );

      // Get conversation context (last 5 messages) for better intent recognition
      const conversationContext = session.conversation.messages
        .slice(-5)
        .map((msg) => `${msg.speaker}: ${msg.originalText}`)
        .concat([
          `${session.pendingMessage.speaker}: ${session.pendingMessage.originalText}`,
        ]);

      const extractedIntents =
        await this.intentRecognitionService.extractIntents(
          session.pendingMessage.originalText,
          translatedText,
          session.pendingMessage.speaker,
          conversationContext
        );

      if (extractedIntents.length > 0) {
        console.log(
          `[Server] 🧠 Extracted ${extractedIntents.length} intents:`,
          extractedIntents
            .map((intent) => `${intent.type} (${intent.confidence})`)
            .join(", ")
        );
      }

      // Add the completed message to the conversation
      session.conversation.messages.push({
        speaker: session.pendingMessage.speaker,
        originalText: session.pendingMessage.originalText,
        translatedText: translatedText,
        timestamp: new Date(),
        messageId: session.currentUserItemId || undefined,
        intents: extractedIntents,
      });

      session.conversation.totalMessageCount =
        session.conversation.messages.length;
      await (session.conversation as any).save();

      console.log(
        `[Server] 💾 Saved completed message for session: ${session.id}`
      );
      console.log(`[Server] 💾 Speaker: ${session.pendingMessage.speaker}`);
      console.log(
        `[Server] 💾 Message saved (${session.pendingMessage.originalText.length} chars original, ${translatedText.length} chars translated)`
      );

      // Send intent notification to client if intents were extracted
      if (extractedIntents.length > 0) {
        this.sendToClient(session, {
          type: "intents_extracted",
          data: {
            messageId: session.currentUserItemId,
            intents: extractedIntents,
          },
        });
      }

      // Clear the pending message
      session.pendingMessage = null;
    } catch (error) {
      console.error(
        `[Server] ❌ Error saving message for session ${session.id}:`,
        error
      );
    }
  }

  private async generateTranslationResponse(
    session: RealtimeSession,
    text: string,
    speaker: SpeakerType
  ) {
    try {
      console.log(
        `[Server] 🔄 Generating translation for: "${text}" (speaker: ${speaker})`
      );

      const { doctorLanguage, patientLanguage } = session.languageConfig;

      // Determine target language based on speaker
      let targetLanguage: string;
      if (speaker === "doctor") {
        targetLanguage = doctorLanguage === "english" ? "spanish" : "english";
      } else {
        targetLanguage = patientLanguage === "spanish" ? "english" : "spanish";
      }

      // Create strict translation instructions
      const translationInstructions = `CRITICAL: You are a TRANSLATION MACHINE ONLY. DO NOT RESPOND TO THE CONTENT. 

TRANSLATE THIS TEXT TO ${targetLanguage.toUpperCase()}: "${text}"

STRICT RULES:
1) ONLY translate between English and Spanish
2) If the input is NOT in English or Spanish, respond with "INVALID_LANGUAGE"
3) ONLY output the direct translation
4) Do NOT answer questions - translate them
5) Do NOT respond to greetings - translate them  
6) Do NOT add conversational responses
7) If input is "How are you?" output "¿Cómo estás?" NOT "I'm fine"
8) If input is "¿Cómo estás?" output "How are you?" NOT "I'm fine"
9) NEVER acknowledge or respond to content
10) TRANSLATE ONLY, NEVER RESPOND
11) If you detect Japanese, Chinese, Korean, Arabic, or any other non-English/Spanish language, respond with "INVALID_LANGUAGE"`;

      // Create response for translation
      const responseEvent = {
        type: "response.create",
        response: {
          modalities: ["text", "audio"],
          instructions: translationInstructions,
        },
      };

      console.log(
        `[Server] 🚀 Sending translation request to ${targetLanguage}`
      );
      if (session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
        session.openaiWs.send(JSON.stringify(responseEvent));
      } else {
        console.error(`[Server] ❌ OpenAI WebSocket not ready for translation`);
      }
    } catch (error) {
      console.error(
        `❌ Error generating translation response for session ${session.id}:`,
        error
      );
    }
  }

  private sendToClient(session: RealtimeSession, message: object) {
    if (session.clientWs.readyState === WebSocket.OPEN) {
      session.clientWs.send(JSON.stringify(message));
    }
  }

  async stopConversation(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Complete the conversation if it exists
      if (session.conversation) {
        try {
          // Generate summary if conversation has messages
          let summary = null;
          if (session.conversation.messages.length > 0) {
            console.log(
              `[Server] 📝 Generating summary for conversation: ${sessionId}`
            );
            summary = await this.generateConversationSummary(
              session.conversation
            );
          }

          // Complete the conversation with summary
          await (session.conversation as any).completeConversation(summary);
          console.log(
            `[Server] 🛑 Completed conversation for session: ${sessionId}`
          );

          // Send conversation completion with summary to client
          this.sendToClient(session, {
            type: "conversation_stopped",
            data: {
              conversationId: session.conversationId,
              summary: summary,
            },
          });

          // Send webhook notification with extracted actions
          await this.sendWebhookNotification(session.conversation);
        } catch (error) {
          console.error(
            `[Server] ❌ Error completing conversation for session ${sessionId}:`,
            error
          );
        }
      }

      await this.cleanupSession(sessionId);
    }
  }

  private async generateConversationSummary(
    conversation: any
  ): Promise<string> {
    try {
      // Build conversation context for summary
      const messages = conversation.messages
        .map((msg: any) => {
          return `${msg.speaker.toUpperCase()}: ${
            msg.originalText
          } (Translation: ${msg.translatedText})`;
        })
        .join("\n");

      // Create summary prompt
      const summaryPrompt = `Please provide a concise medical conversation summary for the following doctor-patient interaction. Focus on:
1. Main medical concerns or symptoms mentioned
2. Key information exchanged
3. Any recommendations or next steps discussed
4. Overall tone and outcome of the conversation

Conversation:
${messages}

Please provide a clear, professional summary in 2-3 sentences:`;

      console.log(`[Server] 🤖 Requesting summary from OpenAI...`);

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a medical conversation summarizer. Provide clear, professional summaries of doctor-patient interactions.",
          },
          {
            role: "user",
            content: summaryPrompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      const summary =
        response.choices[0]?.message?.content?.trim() ||
        "Unable to generate summary";
      console.log(`[Server] 📝 Generated summary: ${summary}`);

      return summary;
    } catch (error) {
      console.error(
        `[Server] ❌ Error generating conversation summary:`,
        error
      );
      return "Summary generation failed";
    }
  }

  /**
   * Send webhook notification with conversation actions
   */
  private async sendWebhookNotification(
    conversation: IConversation & Document
  ) {
    try {
      console.log(
        `[Webhook] 📤 Sending webhook notification for conversation: ${conversation._id}`
      );

      // Extract all intents from conversation messages
      const allIntents = conversation.messages.flatMap(
        (message) => message.intents || []
      );

      // Group intents by type for easier processing
      const intentsByType = allIntents.reduce((acc, intent) => {
        if (!acc[intent.type]) {
          acc[intent.type] = [];
        }
        acc[intent.type].push(intent);
        return acc;
      }, {} as Record<string, any[]>);

      // Build the actions payload
      const actions: WebhookAction[] = [];

      // Process medication intents
      if (intentsByType.medication) {
        intentsByType.medication.forEach((intent) => {
          actions.push({
            type: "medication",
            action: intent.action,
            medication: intent.medication,
            confidence: intent.confidence,
            extractedAt: intent.extractedAt,
          });
        });
      }

      // Process lab order intents
      if (intentsByType.lab_order) {
        intentsByType.lab_order.forEach((intent) => {
          actions.push({
            type: "lab_order",
            labType: intent.labType,
            tests: intent.tests,
            urgency: intent.urgency,
            instructions: intent.instructions,
            confidence: intent.confidence,
            extractedAt: intent.extractedAt,
          });
        });
      }

      // Process appointment intents
      if (intentsByType.appointment) {
        intentsByType.appointment.forEach((intent) => {
          actions.push({
            type: "appointment",
            appointmentType: intent.appointmentType,
            timeframe: intent.timeframe,
            specialty: intent.specialty,
            reason: intent.reason,
            confidence: intent.confidence,
            extractedAt: intent.extractedAt,
          });
        });
      }

      // Process diagnosis intents
      if (intentsByType.diagnosis) {
        intentsByType.diagnosis.forEach((intent) => {
          actions.push({
            type: "diagnosis",
            condition: intent.condition,
            severity: intent.severity,
            status: intent.status,
            confidence: intent.confidence,
            extractedAt: intent.extractedAt,
          });
        });
      }

      // Process treatment intents
      if (intentsByType.treatment) {
        intentsByType.treatment.forEach((intent) => {
          actions.push({
            type: "treatment",
            treatment: intent.treatment,
            category: intent.category,
            details: intent.details,
            confidence: intent.confidence,
            extractedAt: intent.extractedAt,
          });
        });
      }

      // Process vital signs intents
      if (intentsByType.vital_signs) {
        intentsByType.vital_signs.forEach((intent) => {
          actions.push({
            type: "vital_signs",
            vitals: intent.vitals,
            unit: intent.unit,
            confidence: intent.confidence,
            extractedAt: intent.extractedAt,
          });
        });
      }

      // Prepare the webhook payload
      const webhookPayload = {
        event: "conversation_completed",
        timestamp: new Date().toISOString(),
        conversation: {
          id: conversation._id,
          sessionId: conversation.sessionId,
          patientName: conversation.patientName,
          doctorName: conversation.doctorName,
          startTime: conversation.startTime,
          endTime: conversation.endTime,
          summary: conversation.summary,
          totalMessages: conversation.totalMessageCount,
          status: conversation.status,
        },
        actions: actions,
        analytics: {
          totalActions: actions.length,
          actionsByType: Object.keys(intentsByType).map((type) => ({
            type,
            count: intentsByType[type].length,
          })),
          conversationDuration:
            conversation.endTime && conversation.startTime
              ? Math.round(
                  (conversation.endTime.getTime() -
                    conversation.startTime.getTime()) /
                    1000 /
                    60
                ) // duration in minutes
              : null,
        },
      };

      // Send the webhook
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "AI-Medical-Interpreter/1.0",
          "X-Webhook-Source": "ai-medical-interpreter",
        },
        body: JSON.stringify(webhookPayload),
      });

      if (response.ok) {
        console.log(
          `[Webhook] ✅ Successfully sent webhook notification. Status: ${response.status}`
        );
        console.log(`[Webhook] 📊 Sent ${actions.length} actions to webhook`);

        // Update conversation with processed actions
        conversation.actions = actions.map(
          (action) =>
            `${action.type}: ${
              action.action ||
              action.appointmentType ||
              action.status ||
              "detected"
            }`
        );
        await conversation.save();
      } else {
        console.error(
          `[Webhook] ❌ Failed to send webhook. Status: ${response.status}`
        );
        console.error(`[Webhook] Response: ${await response.text()}`);
      }
    } catch (error) {
      console.error(`[Webhook] ❌ Error sending webhook notification:`, error);
    }
  }

  private async cleanupSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Clear inactivity timeout
      if (session.inactivityTimeout) {
        clearTimeout(session.inactivityTimeout);
      }

      if (session.openaiWs) {
        session.openaiWs.close();
      }
      this.sessions.delete(sessionId);
      console.log(`🗑️ Cleaned up session: ${sessionId}`);
    }
  }

  async resumeConversation(sessionId: string, conversationId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.log(
        `[Server] ⚠️  Session ${sessionId} not found for conversation resumption`
      );
      return;
    }

    try {
      if (!conversationId) {
        console.log(
          `[Server] ⚠️  No conversation ID provided for resumption, creating new conversation`
        );
        await this.createConversation(session);
        return;
      }

      // Find the conversation in the database
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        console.log(
          `[Server] ⚠️  Conversation ${conversationId} not found, creating new conversation`
        );
        await this.createConversation(session);
        return;
      }

      // Resume the conversation
      conversation.status = "active";
      await conversation.save();
      session.conversation = conversation as any;
      session.conversationId = conversationId;

      console.log(
        `[Server] 🔄 Resumed conversation ${conversationId} for session: ${sessionId}`
      );

      // Send confirmation back to client
      this.sendToClient(session, {
        type: "conversation_resumed",
        data: { conversationId: conversationId },
      });
    } catch (error) {
      console.error(
        `[Server] ❌ Error resuming conversation for session ${sessionId}:`,
        error
      );
      // Fallback to creating new conversation
      await this.createConversation(session);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

export default RealtimeManager;
