import mongoose, { Schema, Document } from "mongoose";
import { TimestampedDocument } from "../types";
import { Intent } from "../../services/intent-recognition";

// Speaker types
export type SpeakerType = "patient" | "doctor";

// Individual conversation message interface
export interface ConversationMessage {
  speaker: SpeakerType;
  originalText: string;
  translatedText: string;
  timestamp: Date;
  messageId?: string; // Optional unique ID for each message
  intents?: Intent[]; // Extracted intents from the message
}

// Main conversation document interface
export interface IConversation extends TimestampedDocument {
  sessionId: string; // Unique session identifier
  patientName?: string; // Optional patient identifier
  doctorName?: string; // Optional doctor identifier
  messages: ConversationMessage[];
  status: "active" | "completed" | "cancelled";
  summary?: string; // Optional conversation summary
  actions?: string[]; // Optional detected actions (e.g., "schedule_followup", "send_lab_order")
  startTime: Date;
  endTime?: Date;
  totalMessageCount: number;
}

// Mongoose schema for conversation messages
const conversationMessageSchema = new Schema<ConversationMessage>({
  speaker: {
    type: String,
    enum: ["patient", "doctor"],
    required: true,
  },
  originalText: {
    type: String,
    // required: true,
  },
  translatedText: {
    type: String,
    // required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
  },
  messageId: {
    type: String,
    required: false,
  },
  intents: {
    type: [Schema.Types.Mixed],
    required: false,
    default: [],
  },
});

// Main conversation schema
const conversationSchema = new Schema<IConversation>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    patientName: {
      type: String,
      required: false,
    },
    doctorName: {
      type: String,
      required: false,
    },
    messages: [conversationMessageSchema],
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
      required: true,
    },
    summary: {
      type: String,
      required: false,
    },
    actions: [
      {
        type: String,
        required: false,
      },
    ],
    startTime: {
      type: Date,
      default: Date.now,
      required: true,
    },
    endTime: {
      type: Date,
      required: false,
    },
    totalMessageCount: {
      type: Number,
      default: 0,
      required: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: "conversations",
  }
);

// Indexes for better query performance
conversationSchema.index({ sessionId: 1 });
conversationSchema.index({ status: 1 });
conversationSchema.index({ startTime: -1 });
conversationSchema.index({ "messages.timestamp": -1 });

// Pre-save middleware to update totalMessages
conversationSchema.pre("save", function (next) {
  this.totalMessageCount = this.messages.length;
  next();
});

// Instance methods
conversationSchema.methods.addMessage = function (
  message: Omit<ConversationMessage, "timestamp">
) {
  const newMessage: ConversationMessage = {
    ...message,
    timestamp: new Date(),
    messageId: new mongoose.Types.ObjectId().toString(),
    intents: message.intents || [],
  };

  this.messages.push(newMessage);
  this.totalMessageCount = this.messages.length;

  return this.save();
};

conversationSchema.methods.completeConversation = function (
  summary?: string,
  actions?: string[]
) {
  this.status = "completed";
  this.endTime = new Date();
  if (summary) this.summary = summary;
  if (actions) this.actions = actions;

  return this.save();
};

// Static methods
conversationSchema.statics.findBySessionId = function (sessionId: string) {
  return this.findOne({ sessionId });
};

conversationSchema.statics.findActiveConversations = function () {
  return this.find({ status: "active" }).sort({ startTime: -1 });
};

conversationSchema.statics.findRecentConversations = function (
  limit: number = 10
) {
  return this.find({ status: "completed" }).sort({ endTime: -1 }).limit(limit);
};

// Export the model
export default mongoose.model<IConversation>(
  "Conversation",
  conversationSchema
);
