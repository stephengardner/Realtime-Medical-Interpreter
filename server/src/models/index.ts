// Models index file
// Export all models here for easy importing

export { default as Conversation } from "./conversation/conversation.model";
export type {
  IConversation,
  ConversationMessage,
  SpeakerType,
} from "./conversation/conversation.model";

// Export common types
export * from "./types";
