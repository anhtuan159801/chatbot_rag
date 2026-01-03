/**
 * databaseClient.ts
 * -------------------------------------
 * Single shared database client service
 * -------------------------------------
 */
import { Client, ClientConfig } from "pg";

export interface DatabaseConfig {
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

export class DatabaseClient {
  private static instance: DatabaseClient;
  private client: Client | null = null;
  private connectionPromise: Promise<void> | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelayMs: number = 5000;

  private constructor() {}

  static getInstance(): DatabaseClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new DatabaseClient();
    }
    return DatabaseClient.instance;
  }

  async connect(config?: DatabaseConfig): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.initializeConnection(config);
    return this.connectionPromise;
  }

  private async initializeConnection(config?: DatabaseConfig): Promise<void> {
    const dbUrl =
      config?.url || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

    if (!dbUrl) {
      console.warn("[DatabaseClient] No database URL configured");
      this.isConnected = false;
      this.connectionPromise = null;
      return;
    }

    try {
      const clientConfig: ClientConfig = {
        connectionString: dbUrl,
        connectionTimeoutMillis: 30000,
        keepAlive: true,
      };

      this.client = new Client(clientConfig);

      this.client.on("error", (err) => {
        console.error("[DatabaseClient] Connection error:", err.message);
        this.isConnected = false;
        this.scheduleReconnect();
      });

      await this.client.connect();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log("[DatabaseClient] Connected to database");
    } catch (error: any) {
      console.error("[DatabaseClient] Failed to connect:", error.message);
      this.isConnected = false;
      this.connectionPromise = null;
      this.scheduleReconnect();
      throw error;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[DatabaseClient] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `[DatabaseClient] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelayMs}ms`,
    );

    setTimeout(() => {
      this.initializeConnection().catch((err) => {
        console.error("[DatabaseClient] Reconnect failed:", err.message);
      });
    }, this.reconnectDelayMs);
  }

  async query(
    text: string,
    params?: any[],
  ): Promise<{ rows: any[]; rowCount: number }> {
    if (!this.client || !this.isConnected) {
      try {
        await this.connect();
      } catch {
        throw new Error("Database connection not available");
      }
    }

    if (!this.client) {
      throw new Error("Database client not initialized");
    }

    try {
      const result = await this.client.query(text, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
      };
    } catch (error: any) {
      console.error("[DatabaseClient] Query error:", error.message);
      throw error;
    }
  }

  async transaction<T>(callback: (client: Client) => Promise<T>): Promise<T> {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }

    if (!this.client) {
      throw new Error("Database client not initialized");
    }

    try {
      await this.client.query("BEGIN");
      const result = await callback(this.client);
      await this.client.query("COMMIT");
      return result;
    } catch (error) {
      await this.client.query("ROLLBACK");
      throw error;
    }
  }

  isConnectedNow(): boolean {
    return this.isConnected && this.client !== null;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
      this.isConnected = false;
      this.connectionPromise = null;
      console.log("[DatabaseClient] Disconnected from database");
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query("SELECT 1");
      return result.rowCount > 0;
    } catch {
      return false;
    }
  }

  getClient(): Client | null {
    return this.client;
  }
}

export const dbClient = DatabaseClient.getInstance();
