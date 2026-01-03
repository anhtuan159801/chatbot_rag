/**
 * sessionService.ts
 * -------------------------------------
 * Session and context management for conversations
 * -------------------------------------
 */
import { getClient } from "./supabaseService.js";
import crypto from "crypto";

export interface ChatSession {
  id: string;
  userId?: string;
  platform: "facebook" | "web" | "api";
  platformUserId?: string;
  status: "active" | "closed" | "archived";
  context: Record<string, any>;
  metadata: Record<string, any>;
  startedAt: Date;
  lastActivity: Date;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  messageOrder: number;
  sender: "user" | "bot";
  content: string;
  metadata?: Record<string, any>;
  retrievedChunks?: string[];
  createdAt: Date;
}

export interface SessionContext {
  userId?: string;
  userName?: string;
  conversationHistory: ChatMessage[];
  preferences?: Record<string, any>;
  customData?: Record<string, any>;
}

export class SessionService {
  private static instance: SessionService;
  private contextCache: Map<string, SessionContext> = new Map();
  private cacheTTL: number = 30 * 60 * 1000; // 30 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startCleanup();
  }

  static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  async createSession(
    platform: "facebook" | "web" | "api",
    platformUserId?: string,
    userId?: string,
  ): Promise<string> {
    const sessionId = crypto.randomUUID();

    try {
      const client = await getClient();
      if (!client) {
        throw new Error("Database not available");
      }

      await client.query(
        `INSERT INTO chat_sessions (id, user_id, platform, platform_user_id, status)
         VALUES ($1, $2, $3, $4, 'active')`,
        [sessionId, userId || null, platform, platformUserId || null],
      );

      this.contextCache.set(sessionId, {
        userId,
        conversationHistory: [],
      });

      console.log(
        `[Session] Created session: ${sessionId} for ${platform} user ${platformUserId}`,
      );
      return sessionId;
    } catch (error: any) {
      console.error("[Session] Failed to create session:", error.message);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const client = await getClient();
      if (!client) {
        return this.getContextFromCache(sessionId) as any;
      }

      const result = await client.query(
        `SELECT id, user_id, platform, platform_user_id, status, context, metadata,
                started_at, last_activity, message_count
         FROM chat_sessions
         WHERE id = $1 AND status != 'deleted'`,
        [sessionId],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        platform: row.platform,
        platformUserId: row.platform_user_id,
        status: row.status,
        context: row.context || {},
        metadata: row.metadata || {},
        startedAt: new Date(row.started_at),
        lastActivity: new Date(row.last_activity),
        messageCount: row.message_count,
      };
    } catch (error: any) {
      console.error("[Session] Failed to get session:", error.message);
      return null;
    }
  }

  async getOrCreateSession(
    platform: "facebook" | "web" | "api",
    platformUserId?: string,
    userId?: string,
  ): Promise<string> {
    if (!platformUserId) {
      return this.createSession(platform, platformUserId, userId);
    }

    try {
      const client = await getClient();
      if (!client) {
        return this.createSession(platform, platformUserId, userId);
      }

      const result = await client.query(
        `SELECT id FROM chat_sessions
         WHERE platform = $1 AND platform_user_id = $2 AND status = 'active'
         ORDER BY last_activity DESC
         LIMIT 1`,
        [platform, platformUserId],
      );

      if (result.rows.length > 0) {
        const sessionId = result.rows[0].id;
        console.log(`[Session] Found existing session: ${sessionId}`);
        return sessionId;
      }

      return this.createSession(platform, platformUserId, userId);
    } catch (error: any) {
      console.error("[Session] Failed to get/create session:", error.message);
      return this.createSession(platform, platformUserId, userId);
    }
  }

  async saveMessage(
    sessionId: string,
    sender: "user" | "bot",
    content: string,
    metadata?: Record<string, any>,
    retrievedChunks?: string[],
  ): Promise<void> {
    try {
      const client = await getClient();
      if (!client) {
        this.addToContextCache(sessionId, {
          sender,
          content,
          metadata,
          retrievedChunks,
        });
        return;
      }

      const messageOrder = await this.getNextMessageOrder(sessionId);

      await client.query(
        `INSERT INTO chat_history (session_id, message_order, sender, content, metadata, retrieved_chunks)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          sessionId,
          messageOrder,
          sender,
          content.substring(0, 10000),
          metadata ? JSON.stringify(metadata) : null,
          retrievedChunks || null,
        ],
      );

      this.addToContextCache(sessionId, {
        sender,
        content,
        metadata,
        retrievedChunks,
      });
    } catch (error: any) {
      console.error("[Session] Failed to save message:", error.message);
      this.addToContextCache(sessionId, {
        sender,
        content,
        metadata,
        retrievedChunks,
      });
    }
  }

  async getConversationHistory(
    sessionId: string,
    limit: number = 10,
  ): Promise<ChatMessage[]> {
    try {
      const client = await getClient();
      if (!client) {
        return this.getContextFromCache(sessionId)?.conversationHistory || [];
      }

      const result = await client.query(
        `SELECT id, session_id, message_order, sender, content, metadata, retrieved_chunks, created_at
         FROM chat_history
         WHERE session_id = $1 AND is_deleted = false
         ORDER BY message_order DESC
         LIMIT $2`,
        [sessionId, limit],
      );

      return result.rows
        .map((row: any) => ({
          id: row.id,
          sessionId: row.session_id,
          messageOrder: row.message_order,
          sender: row.sender,
          content: row.content,
          metadata: row.metadata || undefined,
          retrievedChunks: row.retrieved_chunks || undefined,
          createdAt: new Date(row.created_at),
        }))
        .reverse();
    } catch (error: any) {
      console.error(
        "[Session] Failed to get conversation history:",
        error.message,
      );
      return this.getContextFromCache(sessionId)?.conversationHistory || [];
    }
  }

  async updateContext(
    sessionId: string,
    context: Record<string, any>,
  ): Promise<void> {
    try {
      const client = await getClient();
      if (!client) {
        const cached = this.contextCache.get(sessionId);
        if (cached) {
          cached.customData = { ...cached.customData, ...context };
        }
        return;
      }

      await client.query(
        `UPDATE chat_sessions SET context = $1 WHERE id = $2`,
        [JSON.stringify(context), sessionId],
      );
    } catch (error: any) {
      console.error("[Session] Failed to update context:", error.message);
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    try {
      const client = await getClient();
      if (!client) {
        this.contextCache.delete(sessionId);
        return;
      }

      await client.query(
        `UPDATE chat_sessions SET status = 'closed' WHERE id = $1`,
        [sessionId],
      );

      this.contextCache.delete(sessionId);
      console.log(`[Session] Closed session: ${sessionId}`);
    } catch (error: any) {
      console.error("[Session] Failed to close session:", error.message);
    }
  }

  private async getNextMessageOrder(sessionId: string): Promise<number> {
    try {
      const client = await getClient();
      if (!client) {
        return 1;
      }

      const result = await client.query(
        `SELECT COALESCE(MAX(message_order), 0) + 1 as next_order
         FROM chat_history
         WHERE session_id = $1`,
        [sessionId],
      );

      return result.rows[0].next_order;
    } catch {
      return 1;
    }
  }

  private addToContextCache(
    sessionId: string,
    message: Partial<ChatMessage>,
  ): void {
    const cached = this.contextCache.get(sessionId);
    if (!cached) {
      this.contextCache.set(sessionId, {
        conversationHistory: [
          {
            id: crypto.randomUUID(),
            sessionId,
            messageOrder: 1,
            sender: message.sender || "user",
            content: message.content || "",
            metadata: message.metadata,
            retrievedChunks: message.retrievedChunks,
            createdAt: new Date(),
          },
        ],
      });
    } else {
      cached.conversationHistory.push({
        id: crypto.randomUUID(),
        sessionId,
        messageOrder: cached.conversationHistory.length + 1,
        sender: message.sender || "user",
        content: message.content || "",
        metadata: message.metadata,
        retrievedChunks: message.retrievedChunks,
        createdAt: new Date(),
      });
    }
  }

  private getContextFromCache(sessionId: string): SessionContext | null {
    const cached = this.contextCache.get(sessionId);
    return cached || null;
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(
      () => {
        const now = Date.now();
        for (const [sessionId, context] of this.contextCache.entries()) {
          const lastActivity =
            context.conversationHistory[context.conversationHistory.length - 1]
              ?.createdAt;
          if (lastActivity && now - lastActivity.getTime() > this.cacheTTL) {
            this.contextCache.delete(sessionId);
          }
        }
      },
      5 * 60 * 1000,
    ); // Cleanup every 5 minutes
  }

  async cleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.contextCache.clear();
  }
}

export const sessionService = SessionService.getInstance();
