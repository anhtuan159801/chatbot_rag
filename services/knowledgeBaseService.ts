import express from 'express';
import pgClient from './supabaseService.js';

const router = express.Router();

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

// POST /api/knowledge-base/upload - Upload a new document
router.post('/knowledge-base/upload', async (req, res) => {
  try {
    const { name, type, size } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Missing required fields: name, type' });
    }

    if (!pgClient) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    // Insert document with PENDING status
    const result = await pgClient.query(
      `INSERT INTO knowledge_base (name, type, size, content_url, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING id, name, type, status, upload_date, vector_count, size, content_url`,
      [name, type, size, null]
    );

    const document = result.rows[0];

    // Start async processing (chunking, embedding, storing)
    processDocumentAsync(document.id, name).catch(err => {
      console.error('Error processing document:', err);
      updateDocumentStatus(document.id, 'FAILED');
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

// DELETE /api/knowledge-base/:id - Delete a document
router.delete('/knowledge-base/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!pgClient) {
      return res.status(500).json({ error: 'Database not connected' });
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

// Async function to process document (chunk, embed, store)
async function processDocumentAsync(documentId: string, name: string) {
  try {
    // Update status to PROCESSING
    await updateDocumentStatus(documentId, 'PROCESSING');

    // Simulate document processing (in real implementation, you would:
    // 1. Download the file from contentUrl
    // 2. Extract text from PDF/DOCX
    // 3. Chunk the text into smaller pieces
    // 4. Generate embeddings for each chunk
    // 5. Store chunks with embeddings in knowledge_chunks table)

    // For demo purposes, we'll just simulate the delay
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Update status to VECTORIZING
    await updateDocumentStatus(documentId, 'VECTORIZING');

    // Generate some mock chunks with embeddings
    const mockChunks = [
      'Đây là đoạn văn bản mẫu 1 từ tài liệu ' + name,
      'Đây là đoạn văn bản mẫu 2 từ tài liệu ' + name,
      'Đây là đoạn văn bản mẫu 3 từ tài liệu ' + name,
    ];

    const vectorCount = mockChunks.length;

    for (let i = 0; i < mockChunks.length; i++) {
      const embedding = await generateEmbedding(mockChunks[i]);
      if (embedding && pgClient) {
        await pgClient.query(
          `INSERT INTO knowledge_chunks (knowledge_base_id, content, embedding, chunk_index, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [documentId, mockChunks[i], `[${embedding.join(',')}]`, i, { source: name }]
        );
      }
    }

    // Update status to COMPLETED
    await updateDocumentStatus(documentId, 'COMPLETED', vectorCount);

    console.log(`Document ${name} processed successfully with ${vectorCount} chunks`);
  } catch (error) {
    console.error('Error in processDocumentAsync:', error);
    await updateDocumentStatus(documentId, 'FAILED');
  }
}

// Helper function to update document status
async function updateDocumentStatus(documentId: string, status: string, vectorCount: number | null = null) {
  if (!pgClient) return;

  const query = vectorCount !== null
    ? 'UPDATE knowledge_base SET status = $1, vector_count = $2 WHERE id = $3'
    : 'UPDATE knowledge_base SET status = $1 WHERE id = $3';

  const params = vectorCount !== null ? [status, vectorCount, documentId] : [status, documentId];

  await pgClient.query(query, params);
}

// Helper function to generate embedding using OpenAI
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not set, using mock embedding');
      return Array(1536).fill(0).map(() => Math.random());
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    });

    const data = await response.json();

    if (response.ok && data.data && data.data[0]) {
      return data.data[0].embedding;
    } else {
      console.error('OpenAI API error:', data);
      // Fallback to mock embedding
      return Array(1536).fill(0).map(() => Math.random());
    }
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Fallback to mock embedding
    return Array(1536).fill(0).map(() => Math.random());
  }
}

export default router;
