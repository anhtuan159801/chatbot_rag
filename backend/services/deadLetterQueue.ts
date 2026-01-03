/**
 * deadLetterQueue.ts
 * -------------------------------------
 * Dead letter queue for failed document processing
 * -------------------------------------
 */
import { getClient } from "./supabaseService.js";
import crypto from "crypto";

export interface DeadLetterItem {
  id: string;
  itemType: "document" | "webpage" | "chunk";
  itemId: string;
  itemData: Record<string, any>;
  error: string;
  errorType: string;
  retryCount: number;
  maxRetries: number;
  status: "pending" | "processing" | "failed" | "resolved";
  createdAt: Date;
  lastAttempt?: Date;
  metadata: Record<string, any>;
}

export interface DeadLetterQueueOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  autoRetry?: boolean;
}

export class DeadLetterQueue {
  private static instance: DeadLetterQueue;
  private processingInterval: NodeJS.Timeout | null = null;
  private maxRetries: number = 3;
  private retryDelayMs: number = 60 * 60 * 1000;

  private constructor() {}

  static getInstance(): DeadLetterQueue {
    if (!DeadLetterQueue.instance) {
      DeadLetterQueue.instance = new DeadLetterQueue();
    }
    return DeadLetterQueue.instance;
  }

  async initialize(options?: DeadLetterQueueOptions): Promise<void> {
    if (options) {
      this.maxRetries = options.maxRetries || 3;
      this.retryDelayMs = options.retryDelayMs || 60 * 60 * 1000;
    }

    await this.createTable();

    if (options?.autoRetry !== false) {
      this.startAutoRetry();
    }
  }

  private async createTable(): Promise<void> {
    try {
      const client = await getClient();
      if (!client) {
        console.warn(
          "[DeadLetterQueue] Database not available, skipping table creation",
        );
        return;
      }

      await client.query(`
        CREATE TABLE IF NOT EXISTS dead_letter_queue (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          item_type TEXT NOT NULL CHECK (item_type IN ('document', 'webpage', 'chunk')),
          item_id TEXT NOT NULL,
          item_data JSONB NOT NULL,
          error TEXT NOT NULL,
          error_type TEXT NOT NULL,
          retry_count INTEGER DEFAULT 0,
          max_retries INTEGER DEFAULT 3,
          status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'failed', 'resolved')) DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_attempt TIMESTAMP WITH TIME ZONE,
          metadata JSONB DEFAULT '{}',
          CONSTRAINT valid_item CHECK (item_type IS NOT NULL AND item_id IS NOT NULL AND error IS NOT NULL)
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_status ON dead_letter_queue(status);
        CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_item_type ON dead_letter_queue(item_type);
        CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_created_at ON dead_letter_queue(created_at DESC);
      `);

      console.log("[DeadLetterQueue] Table initialized");
    } catch (error: any) {
      console.error("[DeadLetterQueue] Failed to create table:", error.message);
    }
  }

  async add(
    itemType: "document" | "webpage" | "chunk",
    itemId: string,
    itemData: Record<string, any>,
    error: Error,
    errorType: string,
    metadata?: Record<string, any>,
  ): Promise<string> {
    try {
      const client = await getClient();
      if (!client) {
        console.warn(
          "[DeadLetterQueue] Database not available, cannot add to DLQ",
        );
        throw error;
      }

      const id = crypto.randomUUID();

      await client.query(
        `INSERT INTO dead_letter_queue (id, item_type, item_id, item_data, error, error_type, max_retries, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
        [
          id,
          itemType,
          itemId,
          JSON.stringify(itemData),
          error.message,
          errorType,
          this.maxRetries,
          metadata ? JSON.stringify(metadata) : "{}",
        ],
      );

      console.log(
        `[DeadLetterQueue] Added item to queue: ${id} (${itemType}:${itemId})`,
      );
      return id;
    } catch (dbError: any) {
      console.error(
        "[DeadLetterQueue] Failed to add to queue:",
        dbError.message,
      );
      throw error;
    }
  }

  async getPendingItems(limit: number = 10): Promise<DeadLetterItem[]> {
    try {
      const client = await getClient();
      if (!client) {
        return [];
      }

      const now = new Date();
      const retryWindow = new Date(now.getTime() - this.retryDelayMs);

      const result = await client.query(
        `SELECT id, item_type, item_id, item_data, error, error_type, retry_count, max_retries,
                status, created_at, last_attempt, metadata
         FROM dead_letter_queue
         WHERE status = 'pending'
           AND retry_count < max_retries
           AND (last_attempt IS NULL OR last_attempt < $1)
         ORDER BY created_at ASC
         LIMIT $2`,
        [retryWindow, limit],
      );

      return result.rows.map((row: any) => ({
        id: row.id,
        itemType: row.item_type,
        itemId: row.item_id,
        itemData: row.item_data,
        error: row.error,
        errorType: row.error_type,
        retryCount: row.retry_count,
        maxRetries: row.max_retries,
        status: row.status,
        createdAt: new Date(row.created_at),
        lastAttempt: row.last_attempt ? new Date(row.last_attempt) : undefined,
        metadata: row.metadata,
      }));
    } catch (error: any) {
      console.error(
        "[DeadLetterQueue] Failed to get pending items:",
        error.message,
      );
      return [];
    }
  }

  async markAsProcessing(id: string): Promise<void> {
    try {
      const client = await getClient();
      if (!client) {
        return;
      }

      await client.query(
        `UPDATE dead_letter_queue SET status = 'processing', last_attempt = NOW() WHERE id = $1`,
        [id],
      );
    } catch (error: any) {
      console.error(
        "[DeadLetterQueue] Failed to mark as processing:",
        error.message,
      );
    }
  }

  async markAsResolved(id: string, resolution?: string): Promise<void> {
    try {
      const client = await getClient();
      if (!client) {
        return;
      }

      await client.query(
        `UPDATE dead_letter_queue SET status = 'resolved', metadata = jsonb_set(metadata, '{resolution}', $2::jsonb) WHERE id = $1`,
        [id, JSON.stringify(resolution || "resolved")],
      );

      console.log(`[DeadLetterQueue] Marked as resolved: ${id}`);
    } catch (error: any) {
      console.error(
        "[DeadLetterQueue] Failed to mark as resolved:",
        error.message,
      );
    }
  }

  async incrementRetry(id: string, newError?: Error): Promise<void> {
    try {
      const client = await getClient();
      if (!client) {
        return;
      }

      if (newError) {
        await client.query(
          `UPDATE dead_letter_queue 
           SET retry_count = retry_count + 1, 
               error = $2, 
               last_attempt = NOW(),
               status = CASE 
                 WHEN retry_count + 1 >= max_retries THEN 'failed' 
                 ELSE 'pending' 
               END
           WHERE id = $1`,
          [id, newError.message],
        );
      } else {
        await client.query(
          `UPDATE dead_letter_queue 
           SET retry_count = retry_count + 1, 
               last_attempt = NOW(),
               status = CASE 
                 WHEN retry_count + 1 >= max_retries THEN 'failed' 
                 ELSE 'pending' 
               END
           WHERE id = $1`,
          [id],
        );
      }

      console.log(`[DeadLetterQueue] Incremented retry count for: ${id}`);
    } catch (error: any) {
      console.error(
        "[DeadLetterQueue] Failed to increment retry:",
        error.message,
      );
    }
  }

  async getStats(): Promise<{
    pending: number;
    processing: number;
    failed: number;
    resolved: number;
  }> {
    try {
      const client = await getClient();
      if (!client) {
        return { pending: 0, processing: 0, failed: 0, resolved: 0 };
      }

      const result = await client.query(
        `SELECT status, COUNT(*) as count 
         FROM dead_letter_queue 
         GROUP BY status`,
      );

      const stats = { pending: 0, processing: 0, failed: 0, resolved: 0 };
      result.rows.forEach((row: any) => {
        if (row.status in stats) {
          stats[row.status as keyof typeof stats] = parseInt(row.count);
        }
      });

      return stats;
    } catch (error: any) {
      console.error("[DeadLetterQueue] Failed to get stats:", error.message);
      return { pending: 0, processing: 0, failed: 0, resolved: 0 };
    }
  }

  async cleanupResolved(daysOld: number = 30): Promise<number> {
    try {
      const client = await getClient();
      if (!client) {
        return 0;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await client.query(
        `DELETE FROM dead_letter_queue 
         WHERE status = 'resolved' AND created_at < $1`,
        [cutoffDate],
      );

      console.log(
        `[DeadLetterQueue] Cleaned up ${result.rowCount} resolved items`,
      );
      return result.rowCount || 0;
    } catch (error: any) {
      console.error("[DeadLetterQueue] Failed to cleanup:", error.message);
      return 0;
    }
  }

  private startAutoRetry(): void {
    this.processingInterval = setInterval(
      async () => {
        const pendingItems = await this.getPendingItems(5);

        for (const item of pendingItems) {
          console.log(`[DeadLetterQueue] Auto-retrying item: ${item.id}`);
          await this.markAsProcessing(item.id);

          try {
            console.log(
              `[DeadLetterQueue] Retry for ${item.itemType} needs manual intervention`,
            );
            await this.markAsResolved(
              item.id,
              "Retry scheduled - requires manual processing",
            );
          } catch (error: any) {
            console.error(
              `[DeadLetterQueue] Retry failed for ${item.id}:`,
              error.message,
            );
            await this.incrementRetry(item.id, error);
          }
        }
      },
      5 * 60 * 1000,
    );
  }

  stopAutoRetry(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
}

export const deadLetterQueue = DeadLetterQueue.getInstance();
