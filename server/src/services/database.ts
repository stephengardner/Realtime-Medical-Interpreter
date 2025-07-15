import mongoose from "mongoose";

interface DatabaseConfig {
  uri: string;
  options?: mongoose.ConnectOptions;
}

class DatabaseService {
  private static instance: DatabaseService;
  private isConnected: boolean = false;

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async connect(config: DatabaseConfig): Promise<void> {
    try {
      if (this.isConnected) {
        console.log("Database already connected");
        return;
      }

      const options: mongoose.ConnectOptions = {
        ...config.options,
      };

      await mongoose.connect(config.uri, options);
      this.isConnected = true;

      console.log("✅ Connected to MongoDB successfully");

      // Handle connection events
      mongoose.connection.on("error", (error) => {
        console.error("❌ MongoDB connection error:", error);
        this.isConnected = false;
      });

      mongoose.connection.on("disconnected", () => {
        console.log("📡 MongoDB disconnected");
        this.isConnected = false;
      });

      mongoose.connection.on("reconnected", () => {
        console.log("🔄 MongoDB reconnected");
        this.isConnected = true;
      });
    } catch (error) {
      console.error("❌ Failed to connect to MongoDB:", error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (!this.isConnected) {
        console.log("Database not connected");
        return;
      }

      await mongoose.disconnect();
      this.isConnected = false;
      console.log("📡 Disconnected from MongoDB");
    } catch (error) {
      console.error("❌ Error disconnecting from MongoDB:", error);
      throw error;
    }
  }

  isHealthy(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  getConnectionState(): string {
    const states = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };
    return (
      states[mongoose.connection.readyState as keyof typeof states] || "unknown"
    );
  }
}

export default DatabaseService;
