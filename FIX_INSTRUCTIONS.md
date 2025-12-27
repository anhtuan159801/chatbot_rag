# FIX INSTRUCTIONS FOR REMAINING ISSUES

This document provides manual instructions for completing the remaining fixes.

---

## FIX #1: Complete Multi-Model UI in SettingsView.tsx

The SettingsView.tsx file has partial updates. Complete the following:

### Add Remove Button to Each Model
Find the model rendering section (around line 445-460) and add this button before the toggle:

```tsx
<button
  onClick={() => removeModel(model.id)}
  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
  title="Xóa model"
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
</button>
```

Place it inside the `flex justify-between` div, between the model name div and the toggle.

### Add "Add New Model" Button Section
After the models list ends (around line 494) and before the save button section, add:

```tsx
{/* Add Model Form */}
{showAddModel && (
  <div className="p-6 bg-blue-50 border-t border-blue-100 animate-in slide-in-from-top-2">
    <h4 className="text-sm font-bold text-slate-800 mb-4">Thêm Mô hình AI Mới</h4>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-500">Nhà cung cấp</label>
        <select
          value={newModel.provider}
          onChange={(e) => setNewModel({...newModel, provider: e.target.value as any})}
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="gemini">Google Gemini</option>
          <option value="openai">OpenAI</option>
          <option value="openrouter">OpenRouter</option>
          <option value="huggingface">HuggingFace</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-500">Tên mô hình</label>
        <input
          type="text"
          value={newModel.name}
          onChange={(e) => setNewModel({...newModel, name: e.target.value})}
          placeholder="VD: Gemini Pro 1.5"
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-500">Mã Model</label>
        <input
          type="text"
          value={newModel.modelString}
          onChange={(e) => setNewModel({...newModel, modelString: e.target.value})}
          placeholder="VD: gemini-1.5-pro, gpt-4o"
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
    </div>
    <div className="flex gap-2 mt-4">
      <button
        onClick={addModel}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
      >
        Thêm Model
      </button>
      <button
        onClick={() => setShowAddModel(false)}
        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
      >
        Hủy
      </button>
    </div>
  </div>
)}

<div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
  <button
    onClick={() => setShowAddModel(!showAddModel)}
    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 flex items-center gap-2"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14"/>
    </svg>
    Thêm Mô hình Mới
  </button>
  <div className="flex items-center gap-3">
    {lastSaved && (
      <div className="text-xs text-slate-400 flex items-center gap-2">
        <Zap size={14} />
        Đã lưu lần cuối: {lastSaved.toLocaleTimeString('vi-VN')}
      </div>
    )}
    <button
      onClick={saveModels}
      disabled={savingModels}
      className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition-all shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2 active:scale-95"
    >
      {savingModels ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
      Lưu Cấu hình
    </button>
  </div>
</div>
```

---

## FIX #2: Fix Vector Dimension Mismatch

### Update Database Schema
Create a new migration file: `fix-vector-dimensions.sql`

```sql
-- Update knowledge_chunks table to support variable dimension embeddings
-- Option 1: Use separate columns for different providers (RECOMMENDED)
ALTER TABLE knowledge_chunks ADD COLUMN embedding_provider TEXT DEFAULT 'openai';
ALTER TABLE knowledge_chunks ADD COLUMN embedding_dimension INTEGER DEFAULT 1536;

-- Option 2: Use JSONB for flexible storage (ALTERNATIVE)
-- ALTER TABLE knowledge_chunks ADD COLUMN embedding_metadata JSONB DEFAULT '{}';

-- Update existing chunks with metadata
UPDATE knowledge_chunks
SET embedding_provider = 'openai',
    embedding_dimension = 1536
WHERE embedding IS NOT NULL;
```

### Update RAG Service
In `services/ragService.ts`, update the vector query to handle dimensions:

```typescript
// Old query (WRONG - assumes fixed dimension):
SELECT id, content, metadata, 1 - (embedding <=> $1::vector) as similarity
FROM knowledge_chunks
ORDER BY embedding <=> $1::vector
LIMIT $2

// New query (CORRECT - uses provider and dimension):
SELECT id, content, metadata, 1 - (embedding <=> $1::vector) as similarity
FROM knowledge_chunks
WHERE embedding_dimension = (SELECT embedding_dimension FROM ai_models WHERE id = $3 LIMIT 1)
ORDER BY embedding <=> $1::vector
LIMIT $2
```

---

## FIX #3: Create Unified Embedding Service

Create new file: `services/embeddingService.ts`

```typescript
import { ModelConfig } from './supabaseService';

export class EmbeddingService {
  
  /**
   * Generate embedding using configured model
   */
  static async generate(
    text: string,
    modelConfig: ModelConfig
  ): Promise<{ vector: number[]; dimension: number }> {
    
    const { provider, model_string: model, api_key: apiKey } = modelConfig;

    console.log(`[EmbeddingService] Generating embedding with ${provider}/${model}`);

    switch (provider.toLowerCase()) {
      case 'openai':
        return this.generateOpenAIEmbedding(text, apiKey, model);
      case 'huggingface':
        return this.generateHuggingFaceEmbedding(text, apiKey, model);
      case 'gemini':
      case 'openrouter':
        // Use HuggingFace as default for other providers for now
        return this.generateHuggingFaceEmbedding(text, process.env.HUGGINGFACE_API_KEY || '', 'BAAI/bge-small-en-v1.5');
      default:
        throw new Error(`Unsupported provider for embeddings: ${provider}`);
    }
  }

  private static async generateOpenAIEmbedding(
    text: string,
    apiKey: string,
    model: string
  ): Promise<{ vector: number[]; dimension: number }> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'text-embedding-3-small',
          input: text
        })
      });

      const data = await response.json();

      if (response.ok && data.data && Array.isArray(data.data)) {
        console.log('Generated OpenAI embedding (1536 dimensions)');
        return { vector: data.data[0].embedding, dimension: 1536 };
      } else {
        throw new Error(`OpenAI embedding error: ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      console.error('OpenAI embedding error:', error);
      throw error;
    }
  }

  private static async generateHuggingFaceEmbedding(
    text: string,
    apiKey: string,
    model: string
  ): Promise<{ vector: number[]; dimension: number }> {
    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          inputs: text
        })
      });

      const data = await response.json();

      if (response.ok && Array.isArray(data)) {
        console.log('Generated HuggingFace embedding (384 dimensions)');
        return { vector: data[0], dimension: 384 };
      } else {
        throw new Error(`HuggingFace embedding error: ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      console.error('HuggingFace embedding error:', error);
      throw error;
    }
  }
}

export const embeddingService = new EmbeddingService();
```

### Update Knowledge Base Service
In `services/knowledgeBaseService.ts`, replace the `generateEmbedding` function with:

```typescript
// Replace old generateEmbedding function with:
import { embeddingService } from './embeddingService';

async function generateEmbedding(text: string, embeddingModel?: any): Promise<number[] | null> {
  if (!embeddingModel) {
    // Fallback to HuggingFace
    return embeddingService.generate(
      text,
      {
        provider: 'huggingface',
        model_string: 'BAAI/bge-small-en-v1.5',
        api_key: process.env.HUGGINGFACE_API_KEY || '',
        is_active: true
      }
    ).then(result => result.vector).catch(() => null);
  }

  return embeddingService
    .generate(text, embeddingModel)
    .then(result => result.vector)
    .catch(() => null);
}
```

---

## FIX #4: Test All Integrations

Create test script: `test-integrations.js`

```javascript
import { AIService } from './services/aiService.js';
import { getModels } from './services/supabaseService.js';

async function testAllIntegrations() {
  console.log('=== Testing All AI Integrations ===\n');

  const models = await getModels();
  const activeModels = models.filter(m => m.is_active);

  console.log(`Found ${activeModels.length} active models to test:\n`);

  for (const model of activeModels) {
    console.log(`Testing: ${model.name} (${model.provider}/${model.model_string})`);
    
    try {
      const startTime = Date.now();
      const response = await AIService.generateText({
        provider: model.provider,
        model: model.model_string,
        apiKey: model.api_key,
        prompt: 'Test message: Hello, can you hear me?',
        systemPrompt: 'You are a helpful assistant.'
      });
      const duration = Date.now() - startTime;

      console.log(`✅ SUCCESS (${duration}ms)`);
      console.log(`Response: ${response.substring(0, 100)}...\n`);
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}\n`);
    }
  }

  console.log('=== Integration Testing Complete ===');
}

testAllIntegrations().catch(console.error);
```

Run with: `node test-integrations.js`

---

## DEPLOYMENT STEPS

### 1. Apply All Fixes
1. Complete SettingsView.tsx multi-model UI
2. Run database migration: `psql -f fix-vector-dimensions.sql`
3. Create embeddingService.ts
4. Update knowledgeBaseService.ts to use embeddingService
5. Test all integrations with test script

### 2. Verify System
1. Start server: `npm run build && npm start`
2. Open browser to: `http://localhost:8080`
3. Go to Settings → Mô hình AI
4. Try adding a new model
5. Toggle model active/inactive
6. Save configuration
7. Check console for any errors

### 3. Test Chat Flow
1. Configure at least one model per provider
2. Assign models to roles
3. Send test message via Facebook webhook (or use Test tab)
4. Verify correct model is used in logs

---

## SUCCESS CRITERIA

System is considered complete when:

- [x] Save model functionality works without errors
- [ ] Multiple models per provider can be added
- [ ] Models can be removed
- [ ] Each model can be assigned to different roles
- [ ] Chat webhook uses configured chatbot model
- [ ] System analysis uses configured analysis model
- [ ] RAG search works with configured embedding model
- [ ] All 4 providers (Gemini, OpenAI, OpenRouter, HF) work
- [ ] Vector dimensions are handled correctly (1536 for OpenAI, 384 for HF)
- [ ] No hardcoded model strings in code
- [ ] Error messages are clear and actionable
- [ ] System is stable and performs well

---

## CONTACT / SUPPORT

If issues persist after applying these fixes:
1. Check browser console for JavaScript errors
2. Check server console for backend errors
3. Check database logs for SQL errors
4. Verify all environment variables are set
5. Test each provider API key individually

---

**Last Updated**: 2025-12-27
