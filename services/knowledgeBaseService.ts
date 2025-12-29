import express from 'express';
import multer from 'multer';
import pgClient from './supabaseService.js';
import { getAiRoles, getModels } from './supabaseService.js';
import { storageService } from './storageService.js';
import { textExtractorService } from './textExtractorService.js';
import { chunkingService } from './chunkingService.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  }
});

// GET /api/knowledge-base - Get all knowledge base documents
router.get('/knowledge-base', async (req, res) => {
  try {
    if (!pgClient) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const result = await pgClient.query(
      `SELECT id, name, type, status, upload_date, vector_count, size, content_url
       FROM knowledge_base
       ORDER BY upload_date DESC`
    );

    const documents = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      uploadDate: row.upload_date,
      vectorCount: row.vector_count,
      size: row.size
    }));

    res.json(documents);
  } catch (error) {
    console.error('Error fetching knowledge base:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge base' });
  }
});

// POST /api/knowledge-base/upload - Upload a new document with file
router.post('/knowledge-base/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { name, type } = req.body;
    const documentName = name || req.file.originalname;
    const documentType = type || getFileType(req.file.originalname);
    const size = (req.file.size / 1024 / 1024).toFixed(2) + ' MB';

    if (!pgClient) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    // Generate unique document ID (valid UUID)
    const documentId = crypto.randomUUID();

    // Insert document with PENDING status
    const result = await pgClient.query(
      `INSERT INTO knowledge_base (id, name, type, size, content_url, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING id, name, type, status, upload_date, vector_count, size, content_url`,
      [documentId, documentName, documentType, size, null]
    );

    const document = result.rows[0];

    // Start async processing (extract text, chunk, embed, store)
    processDocumentAsync(documentId, documentName, req.file).catch(err => {
      console.error('ERROR processing document:', err);
      updateDocumentStatus(documentId, 'FAILED');
    });

    res.json({
      id: document.id,
      name: document.name,
      type: document.type,
      status: document.status,
      uploadDate: document.upload_date,
      vectorCount: document.vector_count,
      size: document.size
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// POST /api/knowledge-base/crawl - Crawl a webpage
router.post('/knowledge-base/crawl', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!pgClient) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    // Generate unique document ID (valid UUID)
    const documentId = crypto.randomUUID();

    // Insert document with PENDING status
    const result = await pgClient.query(
      `INSERT INTO knowledge_base (id, name, type, size, content_url, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING id, name, type, status, upload_date, vector_count, size, content_url`,
      [documentId, url, 'WEB_CRAWL', '0 MB', url]
    );

    const document = result.rows[0];

    // Start async processing (crawl, chunk, embed, store)
    processWebPageAsync(documentId, url).catch(err => {
      console.error('Error processing webpage:', err);
      updateDocumentStatus(documentId, 'FAILED');
    });

    res.json({
      id: document.id,
      name: document.name,
      type: document.type,
      status: document.status,
      uploadDate: document.upload_date,
      vectorCount: document.vector_count,
      size: document.size
    });
  } catch (error) {
    console.error('Error crawling webpage:', error);
    res.status(500).json({ error: 'Failed to crawl webpage' });
  }
});

// DELETE /api/knowledge-base/:id - Delete a document
router.delete('/knowledge-base/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!pgClient) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    // Get document info first to delete the file
    const docResult = await pgClient.query(
      'SELECT content_url FROM knowledge_base WHERE id = $1',
      [id]
    );

    if (docResult.rows.length > 0 && docResult.rows[0].content_url) {
      await storageService.deleteFile(docResult.rows[0].content_url);
    }

    // Delete document (this will cascade delete chunks)
    await pgClient.query(
      'DELETE FROM knowledge_base WHERE id = $1',
      [id]
    );

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Async function to process uploaded document (extract, chunk, embed, store)
async function processDocumentAsync(documentId: string, name: string, file: Express.Multer.File) {
  try {
    console.log(`[PROCESSING] Starting for document: ${name} (${documentId})`);

    if (!pgClient) {
      console.error('[PROCESSING] ERROR: pgClient is null, cannot process document');
      throw new Error('Database connection not available');
    }

    // Update status to PROCESSING
    await updateDocumentStatus(documentId, 'PROCESSING');
    console.log(`[PROCESSING] Status updated to PROCESSING for: ${name}`);

    // Save file to storage
    const storedFile = await storageService.saveFile(file, documentId);
    console.log(`[PROCESSING] File saved to storage: ${storedFile.url}`);

    // Update content_url in database
    await pgClient.query(
      'UPDATE knowledge_base SET content_url = $1 WHERE id = $2',
      [storedFile.url, documentId]
    );
    console.log(`[PROCESSING] Database updated with content_url`);

    // Get local file path for extraction
    const filePath = await storageService.getLocalFilePath(storedFile.path);
    console.log(`[PROCESSING] Getting local file path: ${filePath}`);

    // Extract text from file
    console.log(`[PROCESSING] Extracting text from file...`);
    const extractedText = await textExtractorService.extractFromFile(filePath);
    console.log(`[PROCESSING] Extracted ${extractedText.metadata.words} words from document`);

    if (extractedText.text.trim().length === 0) {
      throw new Error('No text extracted from file');
    }

    // Update status to VECTORIZING
    await updateDocumentStatus(documentId, 'VECTORIZING');
    console.log(`[PROCESSING] Status updated to VECTORIZING for: ${name}`);

    // Chunk text using chunking service
    const chunks = chunkingService.chunk(extractedText.text, {
      strategy: 'paragraph',
      maxChunkSize: 1500
    });

    // Add metadata to chunks
    const chunksWithMetadata = chunkingService.addMetadata(chunks, {
      source: name,
      type: 'DOCUMENT',
      totalPages: extractedText.metadata.totalPages,
      words: extractedText.metadata.words
    });

    console.log(`[PROCESSING] Generated ${chunksWithMetadata.length} chunks for: ${name}`);

    // Get the configured embedding model from database
    const roles = await getAiRoles();
    const ragModelId = roles.rag;
    const models = await getModels();
    const embeddingModel = models.find(m => m.id === ragModelId);

    if (!embeddingModel) {
      console.warn('[PROCESSING] No embedding model configured, using default HuggingFace model');
    } else {
      console.log(`[PROCESSING] Using embedding model: ${embeddingModel.name} (${embeddingModel.model_string})`);
    }

    // Generate and store embeddings for each chunk
    let successCount = 0;
    for (let i = 0; i < chunksWithMetadata.length; i++) {
      try {
        const embedding = await generateEmbedding(chunksWithMetadata[i].text, embeddingModel);
        if (embedding && pgClient) {
          await pgClient.query(
            `INSERT INTO knowledge_chunks (knowledge_base_id, content, embedding, chunk_index, metadata)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              documentId,
              chunksWithMetadata[i].text,
              `[${embedding.join(',')}]`,
              chunksWithMetadata[i].index,
              JSON.stringify(chunksWithMetadata[i].metadata)
            ]
          );
          successCount++;
          console.log(`[PROCESSING] ✓ Stored chunk ${i + 1}/${chunksWithMetadata.length} for: ${name}`);
        } else {
          console.warn(`[PROCESSING] ⚠ Failed to generate embedding for chunk ${i + 1}`);
        }
      } catch (chunkError) {
        console.error(`[PROCESSING] ✗ Error processing chunk ${i + 1}:`, chunkError);
      }
    }

    // Update status based on success count
    let finalStatus = 'COMPLETED';
    if (successCount === 0) {
      finalStatus = 'FAILED';
      console.error(`[PROCESSING] ✗✗✗ Document ${name} FAILED - No chunks were stored! ✗✗✗`);
    } else if (successCount < chunksWithMetadata.length) {
      finalStatus = 'PARTIAL';
      console.warn(`[PROCESSING] ⚠ Document ${name} PARTIALLY processed - ${successCount}/${chunksWithMetadata.length} chunks stored`);
    } else {
      console.log(`[PROCESSING] ✓✓✓ Document ${name} processed successfully with ${successCount} chunks ✓✓✓`);
    }
    
    await updateDocumentStatus(documentId, finalStatus, successCount);

  } catch (error) {
    console.error('[PROCESSING] ✗✗✗ ERROR in processDocumentAsync ✗✗✗');
    console.error('[PROCESSING] Error details:', error);
    console.error('[PROCESSING] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    await updateDocumentStatus(documentId, 'FAILED');
  }
}

// Async function to process crawled webpage
async function processWebPageAsync(documentId: string, url: string) {
  try {
    console.log(`Starting processing for webpage: ${url} (${documentId})`);

    // Update status to PROCESSING
    await updateDocumentStatus(documentId, 'PROCESSING');
    console.log(`Status updated to PROCESSING for: ${url}`);

    // Extract text from web
    console.log(`Extracting text from webpage...`);
    const extractedText = await textExtractorService.extractFromWeb(url);
    console.log(`Extracted ${extractedText.metadata.words} words from webpage`);

    if (extractedText.text.trim().length === 0) {
      throw new Error('No text extracted from webpage');
    }

    // Update status to VECTORIZING
    await updateDocumentStatus(documentId, 'VECTORIZING');
    console.log(`Status updated to VECTORIZING for: ${url}`);

    // Chunk text using chunking service
    const chunks = chunkingService.chunk(extractedText.text, {
      strategy: 'paragraph',
      maxChunkSize: 1500
    });

    // Add metadata to chunks
    const chunksWithMetadata = chunkingService.addMetadata(chunks, {
      source: url,
      type: 'WEB_CRAWL',
      words: extractedText.metadata.words
    });

    console.log(`Generated ${chunksWithMetadata.length} chunks for: ${url}`);

    // Get the configured embedding model from database
    const roles = await getAiRoles();
    const ragModelId = roles.rag;
    const models = await getModels();
    const embeddingModel = models.find(m => m.id === ragModelId);

    if (!embeddingModel) {
      console.warn('No embedding model configured, using default HuggingFace model');
    }

    // Generate and store embeddings for each chunk
    let successCount = 0;
    for (let i = 0; i < chunksWithMetadata.length; i++) {
      try {
        const embedding = await generateEmbedding(chunksWithMetadata[i].text, embeddingModel);
        if (embedding && pgClient) {
          await pgClient.query(
            `INSERT INTO knowledge_chunks (knowledge_base_id, content, embedding, chunk_index, metadata)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              documentId,
              chunksWithMetadata[i].text,
              `[${embedding.join(',')}]`,
              chunksWithMetadata[i].index,
              JSON.stringify(chunksWithMetadata[i].metadata)
            ]
          );
          successCount++;
          console.log(`Stored chunk ${i + 1}/${chunksWithMetadata.length} for: ${url}`);
        }
      } catch (chunkError) {
        console.error(`Error processing chunk ${i}:`, chunkError);
      }
    }

    // Update status based on success count
    let finalStatus = 'COMPLETED';
    if (successCount === 0) {
      finalStatus = 'FAILED';
      console.error(`✗✗✗ Webpage ${url} FAILED - No chunks were stored! ✗✗✗`);
    } else if (successCount < chunksWithMetadata.length) {
      finalStatus = 'PARTIAL';
      console.warn(`⚠ Webpage ${url} PARTIALLY processed - ${successCount}/${chunksWithMetadata.length} chunks stored`);
    } else {
      console.log(`Webpage ${url} processed successfully with ${successCount} chunks`);
    }
    
    await updateDocumentStatus(documentId, finalStatus, successCount);

  } catch (error) {
    console.error('Error in processWebPageAsync:', error);
    await updateDocumentStatus(documentId, 'FAILED');
  }
}

// Helper function to update document status
async function updateDocumentStatus(documentId: string, status: string, vectorCount: number | null = null) {
  if (!pgClient) {
    console.error('[UPDATE STATUS] ERROR: pgClient is null, cannot update status');
    return;
  }

  const query = vectorCount !== null
    ? 'UPDATE knowledge_base SET status = $1, vector_count = CAST($2 AS integer) WHERE id = $3'
    : 'UPDATE knowledge_base SET status = $1 WHERE id = $2';

  const params = vectorCount !== null ? [status, vectorCount, documentId] : [status, documentId];

  try {
    await pgClient.query(query, params);
    console.log(`[UPDATE STATUS] ${documentId} -> ${status} ${vectorCount !== null ? `(vectors: ${vectorCount})` : ''}`);
  } catch (error) {
    console.error('[UPDATE STATUS] ERROR updating status:', error);
  }
}

// Helper function to generate embedding using configured model
async function generateEmbedding(text: string, embeddingModel?: any): Promise<number[] | null> {
  try {
    let apiKey = '';
    let apiUrl = '';

    if (embeddingModel && embeddingModel.api_key) {
      apiKey = embeddingModel.api_key;
    } else {
      apiKey = process.env.HUGGINGFACE_API_KEY || '';
    }

    if (!apiKey) {
      console.error('[EMBEDDING] ERROR: No HUGGINGFACE_API_KEY found in environment variables');
      return null;
    }

    if (embeddingModel && embeddingModel.model_string) {
      apiUrl = `https://router.huggingface.co/hf-inference/models/${embeddingModel.model_string}/pipeline/feature-extraction`;
    } else {
      // Use a working default model
      apiUrl = 'https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5/pipeline/feature-extraction';
    }

    console.log(`[EMBEDDING] Requesting embedding from: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        inputs: text
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[EMBEDDING] ✗ API Error:', response.status, response.statusText);
      console.error('[EMBEDDING] ✗ API Response Body:', errorText);

      if (response.status === 404) {
        console.error('[EMBEDDING] ✗ CRITICAL: Model not found on HuggingFace!');
        console.error('[EMBEDDING] ✗ Please check model_string in database or use correct model ID');
      }

      return null;
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      const embedding = Array.isArray(data[0]) ? data[0] : data;
      console.log(`[EMBEDDING] ✓ Success - embedding dimension: ${embedding.length}`);
      return embedding.map(v => Number(v));
    } else {
      console.error('[EMBEDDING] ✗ Invalid response format - expected array');
      console.error('[EMBEDDING] ✗ API Response:', data);
      return null;
    }
  } catch (error) {
    console.error('[EMBEDDING] ✗ Exception:', error);
    return null;
  }
}

// Helper function to get file type from extension
function getFileType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const typeMap: Record<string, string> = {
    'pdf': 'PDF',
    'docx': 'DOCX',
    'doc': 'DOCX',
    'csv': 'CSV',
    'txt': 'TXT'
  };
  return ext && typeMap[ext] ? typeMap[ext] : 'UNKNOWN';
}

export default router;
