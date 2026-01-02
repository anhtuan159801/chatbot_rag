import express from "express";
import multer from "multer";
import { InferenceClient } from "@huggingface/inference";
import crypto from "crypto";
import { getClient } from "./supabaseService.js";
import { getAiRoles, getModels } from "./supabaseService.js";
import { storageService } from "./storageService.js";
import { textExtractorService } from "./textExtractorService.js";
import { chunkingService } from "./chunkingService.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

async function getDbClient() {
  try {
    const client = await getClient();
    return client;
  } catch (error) {
    console.error("Failed to get database client:", error);
    return null;
  }
}

async function safeQuery(query: string, params: any[] = []) {
  const pg = await getDbClient();
  if (!pg) {
    throw new Error("Database not connected");
  }
  return pg.query(query, params);
}

async function safeQueryNoReturn(query: string, params: any[] = []) {
  const pg = await getDbClient();
  if (!pg) {
    throw new Error("Database not connected");
  }
  return pg.query(query, params);
}

// GET /api/knowledge-base - Get all knowledge base documents
router.get("/knowledge-base", async (req, res) => {
  try {
    const pg = await getDbClient();
    if (!pg) {
      return res.status(500).json({ error: "Database not connected" });
    }

    const result = await pg.query(
      `SELECT id, name, type, status, upload_date, vector_count, size, content_url
       FROM knowledge_base
       ORDER BY upload_date DESC`,
    );

    const documents = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      uploadDate: row.upload_date,
      vectorCount: row.vector_count,
      size: row.size,
    }));

    res.json(documents);
  } catch (error: any) {
    console.error("Error fetching knowledge base:", error.message);
    res.status(500).json({ error: "Failed to fetch knowledge base" });
  }
});

// POST /api/knowledge-base/upload - Upload a new document with file
router.post(
  "/knowledge-base/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { name, type } = req.body;
      const documentName = name || req.file.originalname;
      const documentType = type || getFileType(req.file.originalname);
      const size = (req.file.size / 1024 / 1024).toFixed(2) + " MB";

      const pg = await getDbClient();
      if (!pg) {
        return res.status(500).json({ error: "Database not connected" });
      }

      const documentId = crypto.randomUUID();

      const result = await pg.query(
        `INSERT INTO knowledge_base (id, name, type, size, content_url, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')
         RETURNING id, name, type, status, upload_date, vector_count, size, content_url`,
        [documentId, documentName, documentType, size, null],
      );

      const document = result.rows[0];

      processDocumentAsync(documentId, documentName, req.file).catch((err) => {
        console.error("ERROR processing document:", err);
        updateDocumentStatus(documentId, "FAILED");
      });

      res.json({
        id: document.id,
        name: document.name,
        type: document.type,
        status: document.status,
        uploadDate: document.upload_date,
        vectorCount: document.vector_count,
        size: document.size,
      });
    } catch (error: any) {
      console.error("Error uploading document:", error.message);
      res.status(500).json({ error: "Failed to upload document" });
    }
  },
);

// POST /api/knowledge-base/crawl - Crawl a webpage
router.post("/knowledge-base/crawl", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const pg = await getDbClient();
    if (!pg) {
      return res.status(500).json({ error: "Database not connected" });
    }

    const documentId = crypto.randomUUID();

    const result = await pg.query(
      `INSERT INTO knowledge_base (id, name, type, size, content_url, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING id, name, type, status, upload_date, vector_count, size, content_url`,
      [documentId, url, "WEB_CRAWL", "0 MB", url],
    );

    const document = result.rows[0];

    processWebPageAsync(documentId, url).catch((err) => {
      console.error("Error processing webpage:", err);
      updateDocumentStatus(documentId, "FAILED");
    });

    res.json({
      id: document.id,
      name: document.name,
      type: document.type,
      status: document.status,
      uploadDate: document.upload_date,
      vectorCount: document.vector_count,
      size: document.size,
    });
  } catch (error: any) {
    console.error("Error crawling webpage:", error.message);
    res.status(500).json({ error: "Failed to crawl webpage" });
  }
});

// DELETE /api/knowledge-base/:id - Delete a document
router.delete("/knowledge-base/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const pg = await getDbClient();
    if (!pg) {
      return res.status(500).json({ error: "Database not connected" });
    }

    const docResult = await pg.query(
      "SELECT content_url FROM knowledge_base WHERE id = $1",
      [id],
    );

    if (docResult.rows.length > 0 && docResult.rows[0].content_url) {
      try {
        await storageService.deleteFile(docResult.rows[0].content_url);
      } catch (e) {
        console.warn(`Failed to delete file: ${docResult.rows[0].content_url}`);
      }
    }

    await pg.query("DELETE FROM knowledge_base WHERE id = $1", [id]);

    res.json({ success: true, message: "Document deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting document:", error.message);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// DELETE /api/knowledge-base/delete-all - Delete all knowledge base data
router.delete("/knowledge-base/delete-all", async (req, res) => {
  try {
    const pg = await getDbClient();
    if (!pg) {
      return res.status(500).json({ error: "Database not connected" });
    }

    const docsResult = await pg.query(
      "SELECT id, content_url FROM knowledge_base",
    );

    for (const row of docsResult.rows) {
      if (row.content_url) {
        try {
          await storageService.deleteFile(row.content_url);
        } catch (e) {
          console.warn(`Failed to delete file: ${row.content_url}`);
        }
      }
    }

    await pg.query("TRUNCATE knowledge_base CASCADE");

    res.json({
      success: true,
      message: "All knowledge base data deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting all knowledge base:", error.message);
    res.status(500).json({ error: "Failed to delete all knowledge base" });
  }
});

async function processDocumentAsync(
  documentId: string,
  name: string,
  file: Express.Multer.File,
) {
  let pg = null;
  try {
    console.log(`[PROCESSING] Starting for document: ${name} (${documentId})`);

    pg = await getDbClient();
    if (!pg) {
      console.error("[PROCESSING] ERROR: pg is null, cannot process document");
      throw new Error("Database connection not available");
    }

    await updateDocumentStatus(documentId, "PROCESSING");
    console.log(`[PROCESSING] Status updated to PROCESSING for: ${name}`);

    let storedFile: any = { url: null, path: null };
    try {
      storedFile = await storageService.saveFile(file, documentId);
      console.log(`[PROCESSING] File saved to storage: ${storedFile.url}`);
    } catch (storageError: any) {
      console.warn(
        `[PROCESSING] ⚠ Storage error: ${storageError.message}. Continuing without file storage.`,
      );
      storedFile = { url: null, path: null };
    }

    if (storedFile.url) {
      await safeQuery(
        "UPDATE knowledge_base SET content_url = $1 WHERE id = $2",
        [storedFile.url, documentId],
      );
      console.log(`[PROCESSING] Database updated with content_url`);
    }

    let filePath: string | null = null;
    try {
      if (storedFile.path) {
        filePath = await storageService.getLocalFilePath(storedFile.path);
      } else {
        filePath = null;
      }
      console.log(`[PROCESSING] Getting local file path: ${filePath}`);
    } catch (pathError: any) {
      console.warn(
        `[PROCESSING] ⚠ Could not get local file path: ${pathError.message}`,
      );
      filePath = null;
    }

    let extractedText: any = {
      text: "",
      metadata: { words: 0, totalPages: 1 },
    };
    try {
      if (filePath) {
        extractedText = await textExtractorService.extractFromFile(filePath);
        console.log(
          `[PROCESSING] Extracted ${extractedText.metadata.words} words from file path`,
        );
      } else {
        console.warn(
          `[PROCESSING] ⚠ No file path, extracting directly from buffer`,
        );
        extractedText = await textExtractorService.extractFromBuffer(
          file.buffer,
          file.originalname,
        );
        console.log(
          `[PROCESSING] Extracted ${extractedText.metadata.words} words from buffer`,
        );
      }
    } catch (extractError: any) {
      console.warn(
        `[PROCESSING] ⚠ Text extraction failed: ${extractError.message}`,
      );
      throw new Error("Text extraction failed");
    }

    if (!extractedText.text || extractedText.text.trim().length === 0) {
      throw new Error("No text extracted from file");
    }

    await updateDocumentStatus(documentId, "VECTORIZING");
    console.log(`[PROCESSING] Status updated to VECTORIZING for: ${name}`);

    const chunks = chunkingService.chunk(extractedText.text, {
      strategy: "paragraph",
      maxChunkSize: 1500,
    });

    const chunksWithMetadata = chunkingService.addMetadata(chunks, {
      source: name,
      type: "DOCUMENT",
      totalPages: extractedText.metadata.totalPages,
      words: extractedText.metadata.words,
      content_url: storedFile.url,
    });

    console.log(
      `[PROCESSING] Generated ${chunksWithMetadata.length} chunks for: ${name}`,
    );

    let embeddingModel: any = null;
    try {
      const roles = await getAiRoles();
      const ragModelId = roles.rag;
      const models = await getModels();
      embeddingModel = models.find((m) => m.id === ragModelId);

      if (!embeddingModel) {
        console.warn(
          "[PROCESSING] No embedding model configured, using default HuggingFace model",
        );
      } else {
        console.log(
          `[PROCESSING] Using embedding model: ${embeddingModel.name} (${embeddingModel.model_string})`,
        );
      }
    } catch (modelError: any) {
      console.warn(
        `[PROCESSING] ⚠ Could not load embedding model: ${modelError.message}`,
      );
    }

    let successCount = 0;
    let hasVectorSupport = true;

    for (let i = 0; i < chunksWithMetadata.length; i++) {
      try {
        const embedding = await generateEmbedding(
          chunksWithMetadata[i].text,
          embeddingModel,
        );

        if (embedding && pg && hasVectorSupport) {
          try {
            const embeddingArrayLiteral = `{${embedding.join(',')}}`;
            await pg.query(
              `INSERT INTO knowledge_chunks (knowledge_base_id, content, embedding, chunk_index, metadata)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                documentId,
                chunksWithMetadata[i].text,
                embeddingArrayLiteral,
                chunksWithMetadata[i].index,
                JSON.stringify(chunksWithMetadata[i].metadata),
              ],
            );
            successCount++;
          } catch (vectorError: any) {
            if (
              vectorError.code === "42703" ||
              vectorError.message?.includes("embedding")
            ) {
              console.warn(
                "[PROCESSING] ⚠ embedding column not found, storing text without vector",
              );
              hasVectorSupport = false;
            } else if (
              vectorError.code === "22P02" ||
              vectorError.message?.includes(
                "invalid input syntax for type vector"
              )
            ) {
              console.warn(
                "[PROCESSING] ⚠ Invalid vector format, storing text without vector",
              );
              hasVectorSupport = false;
            } else {
              console.error(
                `[PROCESSING] ✗ Vector insert error for chunk ${i + 1}:`,
                vectorError.message,
              );
            }
          }
        } else if (!hasVectorSupport && pg) {
          await pg.query(
            `INSERT INTO knowledge_chunks (knowledge_base_id, content, chunk_index, metadata)
             VALUES ($1, $2, $3, $4)`,
            [
              documentId,
              chunksWithMetadata[i].text,
              chunksWithMetadata[i].index,
              JSON.stringify(chunksWithMetadata[i].metadata),
            ],
          );
          successCount++;
        } else {
          console.warn(
            `[PROCESSING] ⚠ Failed to generate embedding for chunk ${i + 1}`,
          );
        }
      } catch (chunkError: any) {
        console.error(
          `[PROCESSING] ✗ Error processing chunk ${i + 1}:`,
          chunkError.message,
        );
      }
    }

    let finalStatus = "COMPLETED";
    if (successCount === 0) {
      finalStatus = "FAILED";
      console.error(
        `[PROCESSING] ✗✗✗ Document ${name} FAILED - No chunks were stored! ✗✗✗`,
      );
    } else if (successCount < chunksWithMetadata.length) {
      finalStatus = "PARTIAL";
      console.warn(
        `[PROCESSING] ⚠ Document ${name} PARTIALLY processed - ${successCount}/${chunksWithMetadata.length} chunks stored`,
      );
    } else {
      console.log(
        `[PROCESSING] ✓✓✓ Document ${name} processed successfully with ${successCount} chunks ✓✓✓`,
      );
    }

    await updateDocumentStatus(documentId, finalStatus, successCount);
  } catch (error: any) {
    console.error("[PROCESSING] ✗✗✗ ERROR in processDocumentAsync ✗✗✗");
    console.error("[PROCESSING] Error details:", error.message);
    console.error(
      "[PROCESSING] Error stack:",
      error instanceof Error ? error.stack : "No stack trace",
    );
    await updateDocumentStatus(documentId, "FAILED");
  }
}

async function processWebPageAsync(documentId: string, url: string) {
  let pg = null;
  try {
    console.log(`Starting processing for webpage: ${url} (${documentId})`);

    pg = await getDbClient();
    if (!pg) {
      console.error("ERROR: pg is null, cannot process webpage");
      throw new Error("Database connection not available");
    }

    await updateDocumentStatus(documentId, "PROCESSING");
    console.log(`Status updated to PROCESSING for: ${url}`);

    let extractedText: any = { text: "", metadata: { words: 0 } };
    try {
      extractedText = await textExtractorService.extractFromWeb(url);
      console.log(
        `Extracted ${extractedText.metadata.words} words from webpage`,
      );
    } catch (extractError: any) {
      console.warn(`Webpage extraction failed: ${extractError.message}`);
      throw new Error("Webpage extraction failed");
    }

    if (!extractedText.text || extractedText.text.trim().length === 0) {
      throw new Error("No text extracted from webpage");
    }

    await updateDocumentStatus(documentId, "VECTORIZING");
    console.log(`Status updated to VECTORIZING for: ${url}`);

    const chunks = chunkingService.chunk(extractedText.text, {
      strategy: "paragraph",
      maxChunkSize: 1500,
    });

    const chunksWithMetadata = chunkingService.addMetadata(chunks, {
      source: url,
      type: "WEB_CRAWL",
      words: extractedText.metadata.words,
    });

    console.log(`Generated ${chunksWithMetadata.length} chunks for: ${url}`);

    let embeddingModel: any = null;
    try {
      const roles = await getAiRoles();
      const ragModelId = roles.rag;
      const models = await getModels();
      embeddingModel = models.find((m) => m.id === ragModelId);

      if (!embeddingModel) {
        console.warn(
          "No embedding model configured, using default HuggingFace model",
        );
      }
    } catch (modelError: any) {
      console.warn(`Could not load embedding model: ${modelError.message}`);
    }

    let successCount = 0;
    let hasVectorSupport = true;
    for (let i = 0; i < chunksWithMetadata.length; i++) {
      try {
        const embedding = await generateEmbedding(
          chunksWithMetadata[i].text,
          embeddingModel,
        );

        if (embedding && pg && hasVectorSupport) {
          try {
            const embeddingArrayLiteral = `{${embedding.join(',')}}`;
            await pg.query(
              `INSERT INTO knowledge_chunks (knowledge_base_id, content, embedding, chunk_index, metadata)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                documentId,
                chunksWithMetadata[i].text,
                embeddingArrayLiteral,
                chunksWithMetadata[i].index,
                JSON.stringify(chunksWithMetadata[i].metadata),
              ],
            );
            successCount++;
          } catch (vectorError: any) {
            if (
              vectorError.code === "42703" ||
              vectorError.message?.includes("embedding")
            ) {
              console.warn(
                "[PROCESSING] ⚠ embedding column not found, storing text without vector",
              );
              hasVectorSupport = false;
            } else if (
              vectorError.code === "22P02" ||
              vectorError.message?.includes(
                "invalid input syntax for type vector"
              )
            ) {
              console.warn(
                "[PROCESSING] ⚠ Invalid vector format, storing text without vector",
              );
              hasVectorSupport = false;
            } else {
              console.error(
                `Vector insert error for chunk ${i + 1}:`,
                vectorError.message,
              );
            }
          }
        } else if (!hasVectorSupport && pg) {
          await pg.query(
            `INSERT INTO knowledge_chunks (knowledge_base_id, content, chunk_index, metadata)
             VALUES ($1, $2, $3, $4)`,
            [
              documentId,
              chunksWithMetadata[i].text,
              chunksWithMetadata[i].index,
              JSON.stringify(chunksWithMetadata[i].metadata),
            ],
          );
          successCount++;
        } else {
          console.warn(
            `[PROCESSING] ⚠ Failed to generate embedding for chunk ${i + 1}`,
          );
        }
      } catch (chunkError: any) {
        console.error(
          `[PROCESSING] ✗ Error processing chunk ${i + 1}:`,
          chunkError.message,
        );
      }
    }

    let finalStatus = "COMPLETED";
    if (successCount === 0) {
      finalStatus = "FAILED";
      console.error(`✗✗✗ Webpage ${url} FAILED - No chunks were stored! ✗✗✗`);
    } else if (successCount < chunksWithMetadata.length) {
      finalStatus = "PARTIAL";
      console.warn(
        `⚠ Webpage ${url} PARTIALLY processed - ${successCount}/${chunksWithMetadata.length} chunks stored`,
      );
    } else {
      console.log(
        `Webpage ${url} processed successfully with ${successCount} chunks`,
      );
    }

    await updateDocumentStatus(documentId, finalStatus, successCount);
  } catch (error: any) {
    console.error("Error in processWebPageAsync:", error.message);
    await updateDocumentStatus(documentId, "FAILED");
  }
}

async function updateDocumentStatus(
  documentId: string,
  status: string,
  vectorCount: number | null = null,
) {
  try {
    const pg = await getDbClient();
    if (!pg) {
      console.error("[UPDATE STATUS] ERROR: pg is null, cannot update status");
      return;
    }

    const query =
      vectorCount !== null
        ? "UPDATE knowledge_base SET status = $1, vector_count = CAST($2 AS integer) WHERE id = $3"
        : "UPDATE knowledge_base SET status = $1 WHERE id = $2";

    const params =
      vectorCount !== null
        ? [status, vectorCount, documentId]
        : [status, documentId];

    await pg.query(query, params);
    console.log(
      `[UPDATE STATUS] ${documentId} -> ${status} ${vectorCount !== null ? `(vectors: ${vectorCount})` : ""}`,
    );
  } catch (error: any) {
    console.error("[UPDATE STATUS] ERROR updating status:", error.message);
  }
}

async function generateEmbedding(
  text: string,
  embeddingModel?: any,
): Promise<number[] | null> {
  try {
    let apiKey = "";
    let modelName = "BAAI/bge-small-en-v1.5";

    if (embeddingModel && embeddingModel.api_key) {
      apiKey = embeddingModel.api_key;
    } else {
      apiKey = process.env.HUGGINGFACE_API_KEY || "";
    }

    if (!apiKey) {
      console.error(
        "[EMBEDDING] ERROR: No HUGGINGFACE_API_KEY found in environment variables",
      );
      return null;
    }

    if (embeddingModel && embeddingModel.model_string) {
      modelName = embeddingModel.model_string;
    }

    console.log(`[EMBEDDING] Using model: ${modelName}`);

    const client = new InferenceClient(apiKey);
    const result = await client.featureExtraction({
      model: modelName,
      inputs: text,
    });

    let embedding: number[] | null = null;

    if (typeof result === "number") {
      embedding = [result];
    } else if (Array.isArray(result) && result.length > 0) {
      if (typeof result[0] === "number") {
        embedding = result as number[];
      } else if (Array.isArray(result[0])) {
        embedding = result[0] as number[];
      }
    }

    if (!embedding) {
      console.error("[EMBEDDING] ✗ Invalid response format - expected array");
      return null;
    }

    console.log(
      `[EMBEDDING] ✓ Success - embedding dimension: ${embedding.length}`,
    );
    return embedding.map((v) => Number(v));
  } catch (error: any) {
    console.error("[EMBEDDING] ✗ Exception:", error.message);
    return null;
  }
}

function getFileType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  const typeMap: Record<string, string> = {
    pdf: "PDF",
    docx: "DOCX",
    doc: "DOCX",
    csv: "CSV",
    txt: "TXT",
  };
  return ext && typeMap[ext] ? typeMap[ext] : "UNKNOWN";
}

export default router;
