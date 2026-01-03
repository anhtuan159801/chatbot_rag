/**
 * supabaseService.ts
 * -------------------------------------
 * Handles all Supabase + PostgreSQL queries for RAG
 * Supports pgvector & text search
 * -------------------------------------
 */
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const envSupabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
let dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl && envSupabaseUrl && envSupabaseUrl.startsWith("postgresql://")) {
  dbUrl = envSupabaseUrl;
  console.log("[Supabase] Detected database URL from SUPABASE_URL");
}

let supabase: ReturnType<typeof createClient> | null = null;
if (envSupabaseUrl && envSupabaseUrl.startsWith("http") && supabaseKey) {
  try {
    supabase = createClient(envSupabaseUrl, supabaseKey);
    console.log("[Supabase] ✅ Supabase client initialized");
  } catch (err) {
    console.warn("[Supabase] ⚠️ Failed to create Supabase client:", err);
    supabase = null;
  }
} else if (envSupabaseUrl && !envSupabaseUrl.startsWith("http")) {
  console.warn(
    "[Supabase] ⚠️ SUPABASE_URL format invalid. Expected https://xxx.supabase.co",
  );
}

let pgClient: Client | null = null;
let connectionPromise: Promise<void> | null = null;

function initDatabase(): Promise<void> {
  if (connectionPromise) return connectionPromise;

  if (!dbUrl) {
    console.warn(
      "[Supabase] ⚠️ SUPABASE_DB_URL not set. Vector search disabled.",
    );
    connectionPromise = Promise.resolve();
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      const client = new Client({
        connectionString: dbUrl,
        connectionTimeoutMillis: 30000,
        keepAlive: true,
      });

      client.on("error", (err) => {
        console.error("[Supabase] Database connection error:", err.message);
        pgClient = null;
        connectionPromise = null;
      });

      await client.connect();
      console.log("[Supabase] ✅ Connected to PostgreSQL database");
      pgClient = client;
    } catch (err: any) {
      console.error(
        "[Supabase] ❌ Failed to connect to PostgreSQL:",
        err.message,
      );
      pgClient = null;
      connectionPromise = null;
      throw err;
    }
  })();

  return connectionPromise;
}

initDatabase().catch(() => {});

export interface KnowledgeChunkResult {
  id: string;
  content: string;
  metadata: any;
  similarity: number;
  knowledge_base_id?: string;
}

async function getDbClient(): Promise<Client | null> {
  if (!pgClient) {
    console.log("[Supabase] Waiting for database connection...");
    try {
      await initDatabase();
    } catch (e: any) {
      console.error("[Supabase] Failed to connect:", e.message);
      return null;
    }
  }

  if (!pgClient) {
    console.error(
      "[Supabase] pgClient is still null after initialization attempt",
    );
    return null;
  }

  try {
    await pgClient.query("SELECT 1");
    return pgClient;
  } catch (err: any) {
    console.error("[Supabase] Database connection test failed:", err.message);
    pgClient = null;
    connectionPromise = null;
    return null;
  }
}

export const getConfig = async (key: string): Promise<any | null> => {
  try {
    const client = await getClient();
    if (!client) return null;
    const result = await client.query(
      "SELECT value FROM system_configs WHERE key = $1",
      [key],
    );
    return result.rows[0]?.value ?? null;
  } catch (error: any) {
    console.error(`Error getting config for key '${key}':`, error.message);
    return null;
  }
};

export const updateConfig = async (
  key: string,
  value: any,
): Promise<boolean> => {
  try {
    const client = await getClient();
    if (!client) return false;
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
    return true;
  } catch (error: any) {
    console.error(`Error updating config for key '${key}':`, error.message);
    return false;
  }
};

export const getModels = async (): Promise<any[]> => {
  try {
    const client = await getClient();
    if (!client) return [];
    // SECURITY: Removed api_key from SELECT to prevent API key exposure
    const result = await client.query(
      "SELECT id, provider, name, model_string, is_active FROM ai_models ORDER BY name ASC",
    );
    return result.rows;
  } catch (error: any) {
    console.error("Error getting AI models:", error.message);
    return [];
  }
};

export const updateModels = async (
  models: any[],
): Promise<{ success: boolean; error?: string }> => {
  try {
    const client = await getClient();
    if (!client)
      return {
        success: false,
        error: "Database not connected. Please wait a moment and try again.",
      };
    await client.query("BEGIN");
    for (const model of models) {
      const apiKey =
        process.env[`${model.provider.toUpperCase()}_API_KEY`] || "";
      await client.query(
        `INSERT INTO ai_models (id, provider, name, model_string, api_key, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
            provider = EXCLUDED.provider,
            name = EXCLUDED.name,
            model_string = EXCLUDED.model_string,
            api_key = EXCLUDED.api_key,
            is_active = EXCLUDED.is_active`,
        [
          model.id,
          model.provider,
          model.name,
          model.model_string,
          apiKey,
          model.is_active,
        ],
      );
    }
    await client.query("COMMIT");
    return { success: true };
  } catch (e: any) {
    try {
      await (await getClient())?.query("ROLLBACK");
    } catch {}
    return { success: false, error: String(e) };
  }
};

export const getAiRoles = async (): Promise<Record<string, string>> => {
  try {
    const client = await getClient();
    if (!client) return {};
    const result = await client.query(
      "SELECT role_key, model_id FROM ai_role_assignments",
    );
    const roles: Record<string, string> = {};
    result.rows.forEach((item: any) => {
      roles[item.role_key] = item.model_id;
    });
    return roles;
  } catch (error: any) {
    console.error("Error getting AI role assignments:", error.message);
    return {};
  }
};

export const updateAiRoles = async (
  roles: Record<string, string>,
): Promise<boolean> => {
  try {
    const client = await getClient();
    if (!client) return false;
    await client.query("DELETE FROM ai_role_assignments");
    for (const [key, val] of Object.entries(roles)) {
      await client.query(
        "INSERT INTO ai_role_assignments (role_key, model_id) VALUES ($1, $2)",
        [key, val],
      );
    }
    return true;
  } catch (error: any) {
    console.error("Error updating AI roles:", error.message);
    return false;
  }
};

// RAG Configuration functions
export interface RagConfig {
  vectorWeight: number;
  keywordWeight: number;
  defaultTopK: number;
  minSimilarity: number;
  embeddingProvider: string;
  embeddingModel: string;
}

export const getRagConfig = async (): Promise<RagConfig> => {
  try {
    const client = await getClient();
    if (!client)
      return {
        vectorWeight: 0.7,
        keywordWeight: 0.3,
        defaultTopK: 3,
        minSimilarity: 0.3,
        embeddingProvider: "huggingface",
        embeddingModel: "BAAI/bge-small-en-v1.5",
      };

    // Get RAG-specific settings from system_configs
    const vectorWeight = await getConfig("rag_vector_weight");
    const keywordWeight = await getConfig("rag_keyword_weight");
    const defaultTopK = await getConfig("rag_default_top_k");
    const minSimilarity = await getConfig("rag_min_similarity");
    const embeddingProvider = await getConfig("embedding_provider");
    const embeddingModel = await getConfig("embedding_model");

    return {
      vectorWeight: vectorWeight !== null ? parseFloat(vectorWeight) : 0.7,
      keywordWeight: keywordWeight !== null ? parseFloat(keywordWeight) : 0.3,
      defaultTopK: defaultTopK !== null ? parseInt(defaultTopK) : 3,
      minSimilarity: minSimilarity !== null ? parseFloat(minSimilarity) : 0.3,
      embeddingProvider:
        embeddingProvider !== null ? embeddingProvider : "huggingface",
      embeddingModel:
        embeddingModel !== null ? embeddingModel : "BAAI/bge-small-en-v1.5",
    };
  } catch (error: any) {
    console.error("Error getting RAG config:", error.message);
    return {
      vectorWeight: 0.7,
      keywordWeight: 0.3,
      defaultTopK: 3,
      minSimilarity: 0.3,
      embeddingProvider: "huggingface",
      embeddingModel: "BAAI/bge-small-en-v1.5",
    };
  }
};

export const updateRagConfig = async (config: RagConfig): Promise<boolean> => {
  try {
    const client = await getClient();
    if (!client) return false;

    // Update each RAG setting individually
    const updates = [
      updateConfig("rag_vector_weight", config.vectorWeight.toString()),
      updateConfig("rag_keyword_weight", config.keywordWeight.toString()),
      updateConfig("rag_default_top_k", config.defaultTopK.toString()),
      updateConfig("rag_min_similarity", config.minSimilarity.toString()),
      updateConfig("embedding_provider", config.embeddingProvider),
      updateConfig("embedding_model", config.embeddingModel),
    ];

    const results = await Promise.all(updates);
    return results.every((result) => result);
  } catch (error: any) {
    console.error("Error updating RAG config:", error.message);
    return false;
  }
};

export const initializeSystemData = async (): Promise<void> => {
  try {
    const client = await getClient();
    if (!client) return;
    const configCount = await client.query(
      "SELECT COUNT(*) FROM system_configs",
    );
    if (parseInt(configCount.rows[0].count) > 0) return;

    const defaults = [
      {
        key: "facebook_config",
        value: {
          pageId: process.env.FACEBOOK_PAGE_ID || "",
          accessToken: process.env.FACEBOOK_ACCESS_TOKEN || "",
          pageName: process.env.FACEBOOK_PAGE_NAME || "",
        },
      },
      {
        key: "system_prompt",
        value: "Bạn là Trợ lý ảo Hỗ trợ Thủ tục Hành chính công...",
      },
    ];
    for (const c of defaults) {
      await client.query(
        "INSERT INTO system_configs (key, value, updated_at) VALUES ($1, $2::jsonb, $3)",
        [c.key, JSON.stringify(c.value), new Date().toISOString()],
      );
    }
  } catch (e: any) {
    console.error("Error initializing system data:", e.message);
  }
};

export async function checkVectorDimension(
  table: string = "knowledge_chunks",
  column: string = "embedding",
): Promise<number | null> {
  try {
    const client = await getClient();
    if (!client) return null;
    const res = await client.query(
      `SELECT attndims FROM pg_attribute WHERE attrelid = $1::regclass AND attname = $2;`,
      [table, column],
    );
    return res.rows[0]?.attndims ?? null;
  } catch (err: any) {
    console.error(
      "[Supabase] ⚠️ Error checking vector dimension:",
      err.message,
    );
    return null;
  }
}

export async function searchByVector(
  embedding: number[],
  topK: number = 5,
): Promise<KnowledgeChunkResult[]> {
  try {
    const client = await getClient();
    if (!client) return [];
    // Convert embedding array to comma-separated string and use PostgreSQL's string_to_array function
    // Use proper similarity calculation: 1 - cosine_distance, which gives 1 for identical vectors and approaches 0 for dissimilar
    const embeddingStr = embedding.join(",");
    const query = `
      SELECT id, content, metadata, knowledge_base_id, (1 - (embedding <=> string_to_array($1, ',')::float4[]::vector)) AS similarity
      FROM knowledge_chunks
      ORDER BY embedding <=> string_to_array($1, ',')::float4[]::vector
      LIMIT $2;`;
    const { rows } = await client.query(query, [embeddingStr, topK]);
    return rows || [];
  } catch (err: any) {
    console.error("[Supabase] ❌ Vector search failed:", err.message);
    return [];
  }
}

export async function searchByKeywords(
  query: string,
  topK: number = 5,
): Promise<KnowledgeChunkResult[]> {
  if (!supabase) return [];
  try {
    // First try standard websearch
    let { data, error } = await supabase
      .from("knowledge_chunks")
      .select("id, content, metadata, knowledge_base_id")
      .textSearch("content", query, { type: "websearch" })
      .limit(topK);

    // If no results from websearch, try a more flexible search for Vietnamese content
    if (!error && (!data || data.length === 0)) {
      // Try a more flexible search that handles Vietnamese text better
      const { data: fuzzyData, error: fuzzyError } = await supabase
        .from("knowledge_chunks")
        .select("id, content, metadata, knowledge_base_id")
        .ilike("content", `%${query}%`) // Case-insensitive partial match
        .limit(topK);

      if (!fuzzyError && fuzzyData && fuzzyData.length > 0) {
        data = fuzzyData;
      } else if (fuzzyError) {
        console.warn(
          "[Supabase] Fallback keyword search error:",
          fuzzyError.message,
        );
      }
    }

    if (error) throw error;

    return (
      data?.map((row: any) => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata,
        knowledge_base_id: row.knowledge_base_id,
        similarity: 0.6,
      })) ?? []
    );
  } catch (err: any) {
    console.error("[Supabase] ❌ Keyword search error:", err.message);
    return [];
  }
}

export async function getChunksByKnowledgeBaseId(
  knowledgeBaseIds: string[],
): Promise<KnowledgeChunkResult[]> {
  try {
    const client = await getClient();
    if (!client) return [];

    const query = `
      SELECT id, content, metadata, knowledge_base_id, chunk_index
      FROM knowledge_chunks
      WHERE knowledge_base_id = ANY($1)
      ORDER BY knowledge_base_id, chunk_index;
    `;
    const { rows } = await client.query(query, [knowledgeBaseIds]);
    return rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      metadata: row.metadata,
      knowledge_base_id: row.knowledge_base_id,
      similarity: 0.8,
    }));
  } catch (err: any) {
    console.error(
      "[Supabase] ❌ Error getting chunks by knowledge_base_id:",
      err.message,
    );
    return [];
  }
}

export async function getClient(): Promise<Client | null> {
  return getDbClient();
}

export function isConnected(): boolean {
  return pgClient !== null && typeof pgClient.query === "function";
}

export default {
  initDatabase,
  getClient,
  isConnected,
  initializeSystemData,
};
