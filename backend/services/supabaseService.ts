/**
 * supabaseService.ts
 * ------------------------------------
 * Handles all Supabase + PostgreSQL queries for RAG
 * Supports pgvector & text search
 * ------------------------------------
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

export interface RagConfig {
  vectorWeight: number;
  keywordWeight: number;
  defaultTopK: number;
  minSimilarity: number;
  embeddingProvider: string;
  embeddingModel: string;
}

// ** REFACTORED to prioritize DB-configured embedding model **
export const getRagConfig = async (): Promise<RagConfig> => {
  const defaultConfig = {
      vectorWeight: 0.7,
      keywordWeight: 0.3,
      defaultTopK: 5,
      minSimilarity: 0.2,
      embeddingProvider: "huggingface",
      embeddingModel: process.env.EMBEDDING_MODEL || "BAAI/bge-small-en-v1.5",
  };

  try {
    const client = await getClient();
    if (!client) return defaultConfig;

    // 1. Get embedding model from AI Roles and Models first
    let dbEmbeddingModel: string | null = null;
    try {
        const roles = await getAiRoles();
        const ragModelId = roles.rag;
        if (ragModelId) {
            const models = await getModels();
            const embeddingModel = models.find((m) => m.id === ragModelId);
            if (embeddingModel?.model_string) {
                dbEmbeddingModel = embeddingModel.model_string;
                console.log(`[Supabase] ✅ Found embedding model from DB roles: ${dbEmbeddingModel}`);
            }
        }
    } catch (e) {
        console.warn("[Supabase] ⚠️ Could not fetch embedding model from roles, checking system_configs.", e);
    }

    // 2. Fallback to system_configs
    const vectorWeight = await getConfig("rag_vector_weight");
    const keywordWeight = await getConfig("rag_keyword_weight");
    const defaultTopK = await getConfig("rag_default_top_k");
    const minSimilarity = await getConfig("rag_min_similarity");
    const embeddingProvider = await getConfig("embedding_provider");
    const configEmbeddingModel = await getConfig("embedding_model");

     const finalEmbeddingModel = dbEmbeddingModel || configEmbeddingModel || defaultConfig.embeddingModel;

    return {
      vectorWeight: vectorWeight !== null ? parseFloat(vectorWeight) : defaultConfig.vectorWeight,
      keywordWeight: keywordWeight !== null ? parseFloat(keywordWeight) : defaultConfig.keywordWeight,
      defaultTopK: defaultTopK !== null ? parseInt(defaultTopK) : defaultConfig.defaultTopK,
      minSimilarity: minSimilarity !== null ? parseFloat(minSimilarity) : defaultConfig.minSimilarity,
      embeddingProvider: embeddingProvider || defaultConfig.embeddingProvider,
      embeddingModel: finalEmbeddingModel,
    };
  } catch (error: any) {
    console.error("[Supabase] ❌ Error getting RAG config, returning defaults:", error.message);
    return defaultConfig;
  }
};


export const updateRagConfig = async (config: RagConfig): Promise<boolean> => {
  try {
    const client = await getClient();
    if (!client) return false;
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

    // 1) Read the dimension from an existing stored vector to avoid atttypmod discrepancies
    const sampleDim = await client.query(
      `SELECT vector_dims(${column}) AS dimension
       FROM ${table}
       WHERE ${column} IS NOT NULL
       LIMIT 1;`,
    );
    if (sampleDim.rows[0]?.dimension) {
      return sampleDim.rows[0].dimension;
    }

    // 2) Fallback: derive from atttypmod (dimension + 4)
    const res = await client.query(
      `SELECT CASE WHEN a.atttypmod > 4 THEN a.atttypmod - 4 ELSE NULL END AS dimension
       FROM pg_attribute a
       WHERE a.attrelid = $1::regclass
         AND a.attname = $2
       LIMIT 1;`,
      [table, column],
    );
    return res.rows[0]?.dimension ?? null;
  } catch (err: any) {
    console.error(
      "[Supabase] ⚠️ Error checking vector dimension:",
      err.message,
    );
    return null;
  }
}

// ** REFACTORED to pass vector array directly **
export async function searchByVector(
  embedding: number[],
  topK: number = 5,
): Promise<KnowledgeChunkResult[]> {
  try {
    const client = await getClient();
    if (!client) return [];

    // Ensure embedding length matches column dimension to avoid pgvector errors
    const expectedDim = await checkVectorDimension();
    let adjustedEmbedding = embedding;

    if (expectedDim && embedding.length !== expectedDim) {
      console.warn(
        `[Supabase] Vector dimension mismatch: got ${embedding.length}, expected ${expectedDim}. Adjusting embedding to match column.`,
      );

      if (embedding.length > expectedDim) {
        adjustedEmbedding = embedding.slice(0, expectedDim);
      } else {
        const padding = new Array(expectedDim - embedding.length).fill(0);
        adjustedEmbedding = [...embedding, ...padding];
      }
    }

    // Convert the number array to a string format that PostgreSQL's vector type accepts: '[1,2,3]'
    const embeddingStr = `[${adjustedEmbedding.join(",")}]`;

    const query = `
      SELECT id, content, metadata, knowledge_base_id, (1 - (embedding <=> $1::vector)) AS similarity
      FROM knowledge_chunks
      ORDER BY embedding <=> $1::vector
      LIMIT $2;`;

    const { rows } = await client.query(query, [embeddingStr, topK]);
    return rows || [];
  } catch (err: any) {
    console.error("[Supabase] ❌ Vector search failed:", err.message);
    // Propagate the error to be handled by the RAG service
    throw err;
  }
}


export async function searchByKeywords(
  query: string,
  topK: number = 5,
): Promise<KnowledgeChunkResult[]> {
  if (!supabase) return [];
  try {
    let { data, error } = await supabase
      .from("knowledge_chunks")
      .select("id, content, metadata, knowledge_base_id")
      .textSearch("content", query, { type: "websearch" })
      .limit(topK);

    if (!error && (!data || data.length === 0)) {
      const { data: fuzzyData, error: fuzzyError } = await supabase
        .from("knowledge_chunks")
        .select("id, content, metadata, knowledge_base_id")
        .ilike("content", `%${query}%`)
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
        // This similarity is a placeholder, RRF merger in ragService handles it
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
      similarity: 0.8, // This is a placeholder
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
