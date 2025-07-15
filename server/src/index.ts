import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import OpenAI from "openai";
import dotenv from "dotenv";
import path from "path";
import RealtimeManager from "./realtime";
import DatabaseService from "./services/database";
import { Conversation } from "./models";

// Load environment variables
dotenv.config();

// Initialize services
const databaseService = DatabaseService.getInstance();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create Express app
const app = express();
const server = createServer(app);

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for development, configure properly for production
  })
);

// CORS configuration
const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? process.env.CLIENT_URL || true
      : process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

// Keep track of alive connections
const aliveConnections = new WeakMap<WebSocket, boolean>();

// Handle WebSocket ping/pong for keeping connections alive
const heartbeat = (ws: WebSocket) => {
  aliveConnections.set(ws, true);
};

// Initialize Realtime Manager
const realtimeManager = new RealtimeManager(openai);

// API routes (must come before catch-all route)
app.get("/api/health", (req, res) => {
  const dbStatus = databaseService.isHealthy();
  res.json({
    status: dbStatus ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    database: {
      connected: dbStatus,
      state: databaseService.getConnectionState(),
    },
  });
});

app.get("/api/connections", (req, res) => {
  res.json({ activeConnections: wss.clients.size });
});

// Helper function to generate a unique key for an intent
const getIntentKey = (intent: any): string => {
  switch (intent.type) {
    case "medication":
      return `${intent.type}:${intent.medication?.name || ""}:${
        intent.action || ""
      }`;
    case "lab_order":
      const sortedTests = intent.tests
        ? [...intent.tests].sort().join(",")
        : "";
      return `${intent.type}:${intent.labType || ""}:${sortedTests}`;
    case "appointment":
      return `${intent.type}:${intent.appointmentType || ""}:${
        intent.timeframe || ""
      }:${intent.specialty || ""}`;
    case "diagnosis":
      return `${intent.type}:${intent.condition || ""}:${intent.status || ""}`;
    case "treatment":
      return `${intent.type}:${intent.treatment || ""}:${
        intent.category || ""
      }`;
    case "vital_signs":
      const vitalsKey = intent.vitals ? JSON.stringify(intent.vitals) : "";
      return `${intent.type}:${vitalsKey}`;
    default:
      return `${intent.type}:${JSON.stringify(intent)}`;
  }
};

// Helper function to deduplicate intents
const deduplicateIntents = (intents: any[]): any[] => {
  const intentMap = new Map<string, any>();

  intents.forEach((intent) => {
    const key = getIntentKey(intent);
    const existing = intentMap.get(key);

    // If we don't have this intent yet, or if this one has higher confidence, use it
    if (!existing || intent.confidence > existing.confidence) {
      intentMap.set(key, intent);
    }
  });

  return Array.from(intentMap.values());
};

// Get all conversations
app.get("/api/conversations", async (req, res) => {
  try {
    const conversations = await Conversation.find({})
      .sort({ startTime: -1 }) // Sort by most recent first
      .limit(100); // Limit to last 100 conversations

    // For the conversation list, we don't need to modify the messages
    // The deduplication will happen on the client side when displaying all intents

    res.json({
      success: true,
      conversations: conversations,
      total: conversations.length,
    });
  } catch (error) {
    console.error("[API] Error fetching conversations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch conversations",
    });
  }
});

// Get conversation intents
app.get("/api/conversations/:id/intents", async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id).exec();

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    // Extract all intents from all messages
    const allIntents = conversation.messages.flatMap(
      (message) => message.intents || []
    );

    // Deduplicate intents across all messages in the conversation
    const deduplicatedIntents = deduplicateIntents(allIntents);

    // Group intents by type
    const intentsByType = deduplicatedIntents.reduce((acc, intent) => {
      if (!acc[intent.type]) {
        acc[intent.type] = [];
      }
      acc[intent.type].push(intent);
      return acc;
    }, {} as Record<string, any[]>);

    res.json({
      success: true,
      conversationId: conversation._id,
      sessionId: conversation.sessionId,
      totalIntents: deduplicatedIntents.length,
      originalIntentCount: allIntents.length,
      intentsByType,
      intents: deduplicatedIntents,
    });
  } catch (error) {
    console.error("[API] Error fetching conversation intents:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch conversation intents",
    });
  }
});

// Conversation management endpoints
app.post("/api/conversations/:sessionId/stop", async (req, res) => {
  try {
    await realtimeManager.stopConversation(req.params.sessionId);
    res.json({ success: true, message: "Conversation stopped" });
  } catch (error) {
    console.error("Error stopping conversation:", error);
    res.status(500).json({ error: "Failed to stop conversation" });
  }
});

app.post("/api/conversations/:sessionId/resume", async (req, res) => {
  try {
    const { conversationId } = req.body;
    await realtimeManager.resumeConversation(
      req.params.sessionId,
      conversationId
    );
    res.json({ success: true, message: "Conversation resumed" });
  } catch (error) {
    console.error("Error resuming conversation:", error);
    res.status(500).json({ error: "Failed to resume conversation" });
  }
});

// Serve static files from client build in production
if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientBuildPath));

  // Handle client-side routing - this must come AFTER all API routes
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("New WebSocket connection received.");

  // Initialize heartbeat for this connection
  aliveConnections.set(ws, true);

  // Handle pong messages
  ws.on("pong", () => {
    heartbeat(ws);
  });

  realtimeManager.createSession(ws);
});

// Start the server
const port = process.env.PORT || 3001;

// Initialize database connection and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      console.error("❌ MONGODB_URI environment variable is required");
      process.exit(1);
    }

    await databaseService.connect({ uri: mongoUri });

    // Start the server
    server.listen(port, () => {
      console.log(`🚀 Server is listening on port ${port}`);
      console.log(`📁 NODE_ENV: ${process.env.NODE_ENV}`);
      if (process.env.NODE_ENV === "production") {
        console.log(`🌐 Serving client files from static directory`);
      }
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("🔌 Shutting down server...");

  // Close WebSocket connections
  wss.close(() => {
    server.close(async () => {
      try {
        // Disconnect from database
        await databaseService.disconnect();
        console.log("✅ Server shut down gracefully.");
        process.exit(0);
      } catch (error) {
        console.error("❌ Error during graceful shutdown:", error);
        process.exit(1);
      }
    });
  });
});

// Keep WebSocket connections alive
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (aliveConnections.get(ws) === false) return ws.terminate();

    aliveConnections.set(ws, false);
    ws.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(interval);
});
