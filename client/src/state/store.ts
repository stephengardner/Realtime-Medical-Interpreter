import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// Intent types (matching server-side)
export interface Intent {
  type:
    | "medication"
    | "lab_order"
    | "appointment"
    | "diagnosis"
    | "treatment"
    | "vital_signs";
  confidence: number;
  extractedAt: string;
  metadata?: Record<string, any>;
  // Type-specific data
  medication?: {
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    route?: string;
  };
  action?: "prescribe" | "discontinue" | "modify" | "refill";
  labType?: string;
  tests?: string[];
  urgency?: "routine" | "urgent" | "stat";
  instructions?: string;
  appointmentType?: "schedule" | "reschedule" | "cancel";
  timeframe?: string;
  specialty?: string;
  reason?: string;
  condition?: string;
  severity?: "mild" | "moderate" | "severe";
  status?: "suspected" | "confirmed" | "ruled_out";
  treatment?: string;
  category?: "procedure" | "therapy" | "referral" | "lifestyle";
  details?: string;
  vitals?: {
    bloodPressure?: { systolic: number; diastolic: number };
    heartRate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };
  unit?: "metric" | "imperial";
}

export type Transcript = {
  id: string;
  text: string;
  translation: string;
  isUser: boolean;
  role: "doctor" | "patient" | "detecting";
  timestamp: number;
  intents?: Intent[];
};

type State = {
  transcripts: Transcript[];
  currentRole: "doctor" | "patient";
  isDoctorSpanish: boolean; // true = doctor speaks Spanish, false = doctor speaks English
  isRecording: boolean;
  isPlaying: boolean;
  isSpeaking: boolean;
  isLoading: boolean;
  conversationId: string | null;
  sessionId: string | null;
  conversationSummary: string | null;
  conversationEnded: boolean;
};

type Actions = {
  addTranscript: (transcript: Omit<Transcript, "timestamp">) => void;
  updateTranscript: (id: string, newText: string, finished: boolean) => void;
  updateTranscriptRole: (
    id: string,
    newRole: "doctor" | "patient" | "detecting"
  ) => void;
  updateTranslation: (
    id: string,
    translation: string,
    finished: boolean
  ) => void;

  updateIntents: (id: string, intents: Intent[]) => void;
  setCurrentRole: (role: "doctor" | "patient") => void;
  setIsDoctorSpanish: (isDoctorSpanish: boolean) => void;
  setIsRecording: (isRecording: boolean) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setIsSpeaking: (isSpeaking: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setConversationId: (conversationId: string | null) => void;
  setSessionId: (sessionId: string | null) => void;
  setConversationSummary: (summary: string | null) => void;
  setConversationEnded: (ended: boolean) => void;
  reset: () => void;
};

const initialState: State = {
  transcripts: [],
  currentRole: "doctor",
  isDoctorSpanish: false, // Default: Doctor=English, Patient=Spanish
  isRecording: false,
  isPlaying: false,
  isSpeaking: false,
  isLoading: false,
  conversationId: null,
  sessionId: null,
  conversationSummary: null,
  conversationEnded: false,
};

export const useStore = create<State & Actions>()(
  immer((set) => ({
    ...initialState,
    addTranscript: (transcript) =>
      set((state) => {
        console.log(
          `📝 [store] addTranscript called with:`,
          JSON.stringify(transcript, null, 2)
        );
        const newTranscript = { ...transcript, timestamp: Date.now() };
        state.transcripts.push(newTranscript);
        console.log(
          `📝 [store] Added transcript with id: ${newTranscript.id}, total transcripts: ${state.transcripts.length}`
        );
      }),
    updateTranscript: (id, newText, finished) =>
      set((state) => {
        console.log(
          `📝 [store] updateTranscript called with id: ${id}, text: "${newText}", finished: ${finished}`
        );
        const transcript = state.transcripts.find(
          (t: Transcript) => t.id === id
        );
        if (transcript) {
          if (finished) {
            // Final transcript - replace entirely
            console.log(
              `📝 [store] Found transcript for id ${id}, replacing text with final result: "${newText}"`
            );
            transcript.text = newText;
          } else {
            // Streaming delta - append to existing text
            const currentText = transcript.text || "";
            const newCompleteText = currentText + newText;
            console.log(
              `📝 [store] Found transcript for id ${id}, appending delta. Current: "${currentText}", Delta: "${newText}", New: "${newCompleteText}"`
            );
            transcript.text = newCompleteText;
          }
          console.log(
            `📝 [store] Transcript updated successfully for id ${id}`
          );
        } else {
          console.log(`❌ [store] No transcript found for id ${id}`);
        }
      }),
    updateTranscriptRole: (id, newRole) =>
      set((state) => {
        const transcript = state.transcripts.find(
          (t: Transcript) => t.id === id
        );
        if (transcript) {
          console.log(
            `🔄 [store] Updating transcript role from "${transcript.role}" to "${newRole}" for id: ${id}`
          );
          transcript.role = newRole;
        }
      }),
    updateTranslation: (id, translation, finished) =>
      set((state) => {
        console.log(
          `🔤 [store] updateTranslation called with id: ${id}, translation: "${translation}", finished: ${finished}`
        );
        const transcript = state.transcripts.find(
          (t: Transcript) => t.id === id
        );
        if (transcript) {
          if (finished) {
            // Final translation - replace entirely
            console.log(
              `🔤 [store] Found transcript for id ${id}, replacing translation with final result: "${translation}"`
            );
            transcript.translation = translation;
          } else {
            // Streaming delta - append to existing translation
            const currentTranslation = transcript.translation || "";
            const newTranslation = currentTranslation + translation;
            console.log(
              `🔤 [store] Found transcript for id ${id}, appending delta. Current: "${currentTranslation}", Delta: "${translation}", New: "${newTranslation}"`
            );
            transcript.translation = newTranslation;
          }
          console.log(
            `🔤 [store] Translation updated successfully for id ${id}`
          );
        } else {
          console.log(`❌ [store] No transcript found for id ${id}`);
          console.log(
            `🔤 [store] Available transcript IDs:`,
            state.transcripts.map((t) => t.id)
          );
        }
      }),
    updateIntents: (id, intents) =>
      set((state) => {
        console.log(
          `🧠 [store] updateIntents called with id: ${id}, intents:`,
          intents
        );
        const transcript = state.transcripts.find(
          (t: Transcript) => t.id === id
        );
        if (transcript) {
          transcript.intents = intents;
          console.log(
            `🧠 [store] Intents updated for id ${id}:`,
            intents.map((i) => `${i.type} (${i.confidence})`).join(", ")
          );
        } else {
          console.log(
            `❌ [store] No transcript found for id ${id} to update intents`
          );
          console.log(
            `🧠 [store] Available transcript IDs:`,
            state.transcripts.map((t) => t.id)
          );
        }
      }),
    setCurrentRole: (role) => set({ currentRole: role }),
    setIsDoctorSpanish: (isDoctorSpanish) => set({ isDoctorSpanish }),
    setIsRecording: (isRecording) => set({ isRecording }),
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    setIsSpeaking: (isSpeaking) => set({ isSpeaking }),
    setIsLoading: (isLoading) => set({ isLoading }),
    setConversationId: (conversationId) => set({ conversationId }),
    setSessionId: (sessionId) => set({ sessionId }),
    setConversationSummary: (conversationSummary) =>
      set({ conversationSummary }),
    setConversationEnded: (conversationEnded) => set({ conversationEnded }),
    reset: () => set(initialState),
  }))
);
