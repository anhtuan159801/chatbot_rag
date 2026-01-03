/**
 * configService.ts
 * -------------------------------------
 * Unified configuration management service
 * -------------------------------------
 */
import { getClient } from "./supabaseService.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

export interface SystemConfig {
  key: string;
  value: any;
  updatedAt: Date;
}

export class ConfigService {
  private static instance: ConfigService;
  private configCache: Map<string, any> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.loadEnvironmentConfig();
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadEnvironmentConfig(): void {
    const envVars: Record<string, string> = {
      PORT: process.env.PORT || "8080",
      NODE_ENV: process.env.NODE_ENV || "development",
      SUPABASE_URL: process.env.SUPABASE_URL || "",
      SUPABASE_KEY: process.env.SUPABASE_KEY || "",
      SUPABASE_DB_URL: process.env.SUPABASE_DB_URL || "",
      HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY || "",
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
      EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || "BAAI/bge-small-en-v1.5",
      EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER || "huggingface",
      FACEBOOK_PAGE_ID: process.env.FACEBOOK_PAGE_ID || "",
      FACEBOOK_ACCESS_TOKEN: process.env.FACEBOOK_ACCESS_TOKEN || "",
      FACEBOOK_PAGE_NAME: process.env.FACEBOOK_PAGE_NAME || "",
      FB_VERIFY_TOKEN: process.env.FB_VERIFY_TOKEN || "default-token",
      APP_URL: process.env.APP_URL || "http://localhost:8080",
      CACHE_TTL: process.env.CACHE_TTL || "3600000",
      QUERY_CACHE_TTL: process.env.QUERY_CACHE_TTL || "300000",
      RAG_CACHE_TTL: process.env.RAG_CACHE_TTL || "600000",
      RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW || "900000",
      RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX || "100",
    };

    for (const [key, value] of Object.entries(envVars)) {
      this.configCache.set(key, value);
    }

    console.log("[ConfigService] Environment configuration loaded");
  }

  async get(key: string, useCache: boolean = true): Promise<any | null> {
    if (useCache && this.configCache.has(key)) {
      return this.configCache.get(key);
    }

    try {
      const client = await getClient();
      if (!client) {
        return this.configCache.get(key) || null;
      }

      const result = await client.query(
        "SELECT value, updated_at FROM system_configs WHERE key = $1",
        [key],
      );

      if (result.rows.length > 0) {
        const value = result.rows[0].value;
        this.configCache.set(key, value);
        return value;
      }

      return this.configCache.get(key) || null;
    } catch (error: any) {
      console.error(
        `[ConfigService] Error getting config for key '${key}':`,
        error.message,
      );
      return this.configCache.get(key) || null;
    }
  }

  async set(key: string, value: any): Promise<boolean> {
    try {
      const client = await getClient();
      if (!client) {
        this.configCache.set(key, value);
        return true;
      }

      const jsonValue = JSON.stringify(value);
      const checkResult = await client.query(
        "SELECT key FROM system_configs WHERE key = $1",
        [key],
      );

      if (checkResult.rows.length > 0) {
        await client.query(
          "UPDATE system_configs SET value = $1::jsonb, updated_at = $2 WHERE key = $3",
          [jsonValue, new Date().toISOString(), key],
        );
      } else {
        await client.query(
          "INSERT INTO system_configs (key, value, updated_at) VALUES ($1, $2::jsonb, $3)",
          [key, jsonValue, new Date().toISOString()],
        );
      }

      this.configCache.set(key, value);
      return true;
    } catch (error: any) {
      console.error(
        `[ConfigService] Error setting config for key '${key}':`,
        error.message,
      );
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const client = await getClient();
      if (!client) {
        this.configCache.delete(key);
        return true;
      }

      await client.query("DELETE FROM system_configs WHERE key = $1", [key]);
      this.configCache.delete(key);
      return true;
    } catch (error: any) {
      console.error(
        `[ConfigService] Error deleting config for key '${key}':`,
        error.message,
      );
      return false;
    }
  }

  async getAll(): Promise<Record<string, any>> {
    try {
      const client = await getClient();
      if (!client) {
        const result: Record<string, any> = {};
        for (const [key, value] of this.configCache.entries()) {
          result[key] = value;
        }
        return result;
      }

      const result = await client.query(
        "SELECT key, value FROM system_configs",
      );
      const config: Record<string, any> = {};

      result.rows.forEach((row: any) => {
        config[row.key] = row.value;
        this.configCache.set(row.key, row.value);
      });

      return config;
    } catch (error: any) {
      console.error("[ConfigService] Error getting all config:", error.message);
      const result: Record<string, any> = {};
      for (const [key, value] of this.configCache.entries()) {
        result[key] = value;
      }
      return result;
    }
  }

  async invalidateCache(key?: string): Promise<void> {
    if (key) {
      this.configCache.delete(key);
    } else {
      this.configCache.clear();
    }
  }

  getEnv(key: string): string | undefined {
    return process.env[key];
  }

  getEnvNumber(key: string, defaultValue: number = 0): number {
    const value = process.env[key];
    return value ? parseInt(value, 10) : defaultValue;
  }

  getEnvBoolean(key: string, defaultValue: boolean = false): boolean {
    const value = process.env[key];
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
    return defaultValue;
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.getEnv("SUPABASE_URL") && !this.getEnv("SUPABASE_DB_URL")) {
      errors.push("SUPABASE_URL or SUPABASE_DB_URL is required");
    }

    if (
      !this.getEnv("HUGGINGFACE_API_KEY") &&
      !this.getEnv("OPENAI_API_KEY") &&
      !this.getEnv("GEMINI_API_KEY")
    ) {
      errors.push("At least one AI API key is required");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const configService = ConfigService.getInstance();
