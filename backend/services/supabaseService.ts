/**
 * supabaseService.ts
 * -------------------------------------
 * Handles all Supabase + PostgreSQL queries for RAG
 * Supports pgvector & text search
 * -------------------------------------
 */
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;

// Initialize Supabase client only if env vars are valid
let supabase: ReturnType<typeof createClient> | null = null;
if (supabaseUrl && supabaseKey && supabaseUrl.startsWith("http")) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn(
    "[Supabase] ⚠️ SUPABASE_URL or SUPABASE_KEY not set. Keyword search will be disabled.",
  );
}

let pgClient: Client | null = null;

if (dbUrl) {
  pgClient = new Client({
    connectionString: dbUrl,
  });

  pgClient.connect().catch((err) => {
    console.error("[Supabase] ❌ Failed to connect to PostgreSQL:", err);
  });
} else {
  console.warn(
    "[Supabase] ⚠️ SUPABASE_DB_URL not set. Vector search will be disabled.",
  );
}

export interface KnowledgeChunkResult {
  id: string;
  content: string;
  metadata: any;
  similarity: number;
}

// --- Existing Config & Model Management Functions (Preserved) ---
export const getConfig = async (key: string): Promise<any | null> => {
  if (!pgClient) return null;
  try {
    const result = await pgClient.query(
      "SELECT value FROM system_configs WHERE key = $1",
      [key],
    );
    return result.rows[0]?.value ?? null;
  } catch (error) {
    console.error(`Error getting config for key '${key}':`, error);
    return null;
  }
};

export const updateConfig = async (
  key: string,
  value: any,
): Promise<boolean> => {
  if (!pgClient) return false;
  try {
    const jsonValue = JSON.stringify(value);
    const checkResult = await pgClient.query(
      "SELECT key FROM system_configs WHERE key = $1",
      [key],
    );

    if (checkResult.rows.length > 0) {
      await pgClient.query(
        "UPDATE system_configs SET value = $1::jsonb, updated_at = $2 WHERE key = $3",
        [jsonValue, new Date().toISOString(), key],
      );
    } else {
      await pgClient.query(
        "INSERT INTO system_configs (key, value, updated_at) VALUES ($1, $2::jsonb, $3)",
        [key, jsonValue, new Date().toISOString()],
      );
    }
    return true;
  } catch (error) {
    console.error(`Error updating config for key '${key}':`, error);
    return false;
  }
};

export const getModels = async (): Promise<any[]> => {
  if (!pgClient) return [];
  try {
    const result = await pgClient.query(
      "SELECT id, provider, name, model_string, api_key, is_active FROM ai_models ORDER BY name ASC",
    );
    return result.rows;
  } catch (error) {
    console.error("Error getting AI models:", error);
    return [];
  }
};

export const updateModels = async (
  models: any[],
): Promise<{ success: boolean; error?: string }> => {
  if (!pgClient)
    return { success: false, error: "PostgreSQL client not initialized" };
  const client = pgClient;
  try {
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
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    return { success: false, error: String(e) };
  }
};

export const getAiRoles = async (): Promise<Record<string, string>> => {
  if (!pgClient) return {};
  try {
    const result = await pgClient.query(
      "SELECT role_key, model_id FROM ai_role_assignments",
    );
    const roles: Record<string, string> = {};
    result.rows.forEach((item: any) => {
      roles[item.role_key] = item.model_id;
    });
    return roles;
  } catch (error) {
    console.error("Error getting AI role assignments:", error);
    return {};
  }
};

export const updateAiRoles = async (
  roles: Record<string, string>,
): Promise<boolean> => {
  if (!pgClient) return false;
  try {
    await pgClient.query("DELETE FROM ai_role_assignments");
    for (const [key, val] of Object.entries(roles)) {
      await pgClient.query(
        "INSERT INTO ai_role_assignments (role_key, model_id) VALUES ($1, $2)",
        [key, val],
      );
    }
    return true;
  } catch (error) {
    console.error("Error updating AI roles:", error);
    return false;
  }
};

export const initializeSystemData = async (): Promise<void> => {
  // Implementation preserved from original code
  if (!pgClient) return;
  try {
    const configCount = await pgClient.query(
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
      await pgClient.query(
        "INSERT INTO system_configs (key, value, updated_at) VALUES ($1, $2::jsonb, $3)",
        [c.key, JSON.stringify(c.value), new Date().toISOString()],
      );
    }
  } catch (e) {
    console.error("Error initializing system data:", e);
  }
};

// --- NEW: Vector & Keyword Search Functions ---

/** Check vector dimension for safety */
export async function checkVectorDimension(
  table: string,
  column: string,
): Promise<number | null> {
  if (!pgClient) return null;
  try {
    const res = await pgClient.query(
      `SELECT attndims FROM pg_attribute WHERE attrelid = $1::regclass AND attname = $2;`,
      [table, column],
    );
    return res.rows[0]?.attndims ?? null;
  } catch (err) {
    console.error("[Supabase] ⚠️ Error checking vector dimension:", err);
    return null;
  }
}

/** Vector search via pgvector */
export async function searchByVector(
  embedding: number[],
  topK: number = 5,
): Promise<KnowledgeChunkResult[]> {
  if (!pgClient) return [];
  try {
    const embeddingStr = embedding.join(",");
    const query = `
      SELECT id, content, metadata, 1 - (content_vector <=> cube(array[${embeddingStr}])) AS similarity
      FROM knowledge_chunks
      ORDER BY content_vector <=> cube(array[${embeddingStr}])
      LIMIT $1;
    `;
    const { rows } = await pgClient.query(query, [topK]);
    return rows || [];
  } catch (err) {
    console.error("[Supabase] ❌ Vector search failed:", err);
    return [];
  }
}

/** Keyword-based search (text index / websearch) */
export async function searchByKeywords(
  query: string,
  topK: number = 5,
): Promise<KnowledgeChunkResult[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("knowledge_chunks")
      .select("id, content, metadata")
      .textSearch("content", query, { type: "websearch" })
      .limit(topK);

    if (error) throw error;
    return (
      data?.map((row: any) => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata,
        similarity: 0.6,
      })) ?? []
    );
  } catch (err) {
    console.error("[Supabase] ❌ Keyword search error:", err);
    return [];
  }
}

export default pgClient;
