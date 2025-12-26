# Thay đổi và bản cập nhật - 26/12/2025

## Các lỗi đã được sửa (Bug Fixes)

### 1. Sửa lỗi "Lưu cấu hình AI thất bại" (Fixed "Lưu cấu hình AI thất bại")

**Vị trí:** `services/supabaseService.ts` - Hàm `updateModels()`

**Mô tả lỗi:**
- Khi lưu cấu hình AI trong Settings, hệ thống báo lỗi "Lưu cấu hình AI thất bại"
- Transaction rollback không được thực hiện đúng cách

**Giải pháp:**
- Thêm validation cho model data trước khi insert
- Thêm logging chi tiết để debug dễ dàng hơn
- Cải thiện error handling trong transaction
- Đảm bảo rollback được thực hiện đúng khi có lỗi

### 2. Sửa lỗi embedding dimension mismatch (CRITICAL FIX)

**Vị trí:** `services/knowledgeBaseService.ts` - Hàm `generateEmbedding()`

**Mô tả lỗi:**
- Database schema `knowledge_chunks.embedding` được khai báo là `vector(1536)` (OpenAI dimension)
- HuggingFace model trả về 384 dimensions
- Khi INSERT vector 384 dim vào column expect 1536 dim → **DATABASE ERROR**
- Kết quả: Knowledge chunks không được lưu, document luôn ở trạng thái PENDING

**Giải pháp:**
- Cập nhật `generateEmbedding()` để **luôn trả về 1536 dimensions**
- OpenAI API: 1536 dimensions (match schema)
- HuggingFace API: 384 dimensions → **padding sang 1536** bằng cách thêm 1152 zeros
- Mock embedding: 1536 dimensions (random values)
- Thêm detailed logging để debug provider đang dùng

### 3. Thêm extension UUID vào database (Added UUID extension to database)

**Vị trí:** `supabase_tables.sql`

**Mô tả lỗi:**
- PostgreSQL cần extension `uuid-ossp` để tạo UUID cho document ID
- Thiếu extension có thể gây lỗi khi insert document mới

**Giải pháp:**
- Thêm `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` vào SQL script

### 4. Cải thiện RAG Service với fallback embedding (Improved RAG Service)

**Vị trí:** `services/ragService.ts`

**Mô tả lỗi:**
- RAG service chỉ sử dụng HuggingFace API, không có fallback
- Khi HuggingFace API không hoạt động, system không thể generate embedding

**Giải pháp:**
- Thêm fallback từ OpenAI sang HuggingFace
- Log chi tiết về provider đang được sử dụng và dimension của embedding
- Cải thiện error handling

### 5. Cải thiện Settings UI - Model configuration (Improved Settings UI)

**Vị trí:** `components/SettingsView.tsx`

**Mô tả lỗi:**
- API key field được disabled nhưng vẫn hiển thị thông tin không rõ ràng
- User không biết API key được lấy từ đâu

**Giải pháp:**
- Hiển thị text "Đã cấu hình từ biến môi trường" thay vì input field
- Thêm helper text: "Khóa API được lấy từ biến môi trường trên hệ thống"

## Các thay đổi cấu trúc (Structure Changes)

### Database Schema (`supabase_tables.sql`)
- Thêm extension `uuid-ossp` để hỗ trợ UUID generation

### Services Layer
1. **`services/supabaseService.ts`**
   - Cải thiện `updateModels()` với validation và logging
   - Thêm detailed error handling

2. **`services/knowledgeBaseService.ts`**
   - Cải thiện `generateEmbedding()` để **luôn trả về 1536 dimensions**
   - Import `getAiRoles()` và `getModels()` từ supabaseService
   - Cải thiện `processDocumentAsync()` với detailed logging
   - Thêm tracking chunks stored count để đảm bảo dữ liệu được lưu
   - Support multiple embedding providers (OpenAI: 1536 dims, HuggingFace: 384 → 1536 dims via padding)

3. **`services/ragService.ts`**
   - Thêm fallback logic (OpenAI → HuggingFace)
   - Cải thiện error handling và logging

## Cách sử dụng (Usage Instructions)

### 1. Setup Database

Chạy SQL script trong `supabase_tables.sql` để tạo các bảng cần thiết:

```sql
-- Chạy file này trong PostgreSQL/Supabase SQL Editor
-- Hoặc sử dụng command line:
psql -h <host> -U <user> -d <database> -f supabase_tables.sql
```

### 2. Cấu hình Environment Variables

Tạo file `.env` từ `.env.example` và điền các giá trị:

```bash
# Database
SUPABASE_URL=postgresql://postgres:PASSWORD@host:port/postgres

# AI API Keys
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key  # Cho embedding (1536 dimensions) - PREFERRED
OPENROUTER_API_KEY=your_openrouter_key
HUGGINGFACE_API_KEY=your_hf_key  # Fallback (384 -> 1536 padding)
```

**Quan trọng:**
- **OPENAI_API_KEY** được ưu tiên dùng cho embedding vì trả về 1536 dimensions (match database schema)
- HUGGINGFACE_API_KEY** được dùng làm fallback nếu OpenAI không available
- Không cần phải config trong Settings UI, tất cả được tự động lấy từ environment

### 3. Cấu hình AI Models trong UI

1. Mở trang **Cấu hình & Kết nối** > **Mô hình AI**
2. Kích hoạt các model bạn muốn sử dụng
3. Chỉ định model ID cho từng model (ví dụ: `gemini-3-flash-preview`, `gpt-4o`)
4. Nhấn **Lưu Cấu hình**

**Lưu ý:** API keys được tự động lấy từ environment variables, không cần nhập trong UI.

### 4. Phân vai AI (AI Roles)

1. Mở tab **Phân vai & Prompt**
2. Chọn model cho từng vai trò:
   - **Chatbot (Văn bản):** Model xử lý tin nhắn văn bản
   - **Xử lý Hình ảnh:** Model xử lý ảnh
   - **Xử lý Giọng nói:** Model xử lý âm thanh
   - **Truy vấn Dữ liệu (RAG):** Model tạo embedding cho knowledge base
   - **Phân tích Hệ thống:** Model phân tích metrics
   - **Phân tích Cảm xúc:** Model phân tích sentiment
3. Tùy chỉnh System Prompt
4. Nhấn **Lưu Chỉ thị**

### 5. Upload và Xử lý Documents

1. Mở trang **Kho Dữ liệu Pháp lý**
2. Nhấn **Tải Văn bản Luật** để upload file PDF/DOCX
3. Hoặc nhấn **Thu thập Web** để crawl dữ liệu từ URL
4. Documents sẽ đi qua các trạng thái:
   - **PENDING:** Đang chờ xử lý
   - **PROCESSING:** Đang đọc và phân tích file
   - **VECTORIZING:** Đang tạo embeddings (OpenAI: 1536 dims hoặc HuggingFace: 384→1536 dims)
   - **COMPLETED:** Hoàn tất
   - **FAILED:** Lỗi (xem console log)

### 6. Kiểm tra dữ liệu knowledge_chunks

Chạy script test:
```bash
node check-db.js
```

Kết quả mong đợi:
```
knowledge_chunks table exists: true
Documents in knowledge_base: X
Chunks in knowledge_chunks: Y
```

## Troubleshooting

### Documents vẫn ở trạng thái PENDING

1. **Check console logs:**
   ```bash
   # Nếu chạy local
   npm start
   # Check log lines có chứa:
   # - "Status updated to PROCESSING"
   # - "Generated embedding using OpenAI (1536 dimensions)"
   # - "Stored chunk 1/5 for: document-name.pdf"
   ```

2. **Kiểm tra API keys:**
   ```bash
   # OPENAI_API_KEY được ưu tiên dùng cho embedding
   # HUGGINGFACE_API_KEY là fallback
   echo $OPENAI_API_KEY
   echo $HUGGINGFACE_API_KEY
   ```

3. **Check database connection:**
   ```bash
   # Kiểm tra SUPABASE_URL trong .env
   psql $SUPABASE_URL
   # Hoặc chạy:
   node check-db.js
   ```

4. **Kiểm tra knowledge_chunks table:**
   ```sql
   SELECT COUNT(*) FROM knowledge_chunks;
   SELECT COUNT(*) FROM knowledge_base WHERE status = 'COMPLETED';
   ```

### knowledge_chunks table trống (Root Cause)

**Vấn đề:** Embedding dimension mismatch!

Nếu bạn vẫn thấy knowledge_chunks table trống:
1. Kiểm tra database schema:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'knowledge_chunks';
   ```
   
   Expected output:
   ```
   embedding | vector(1536)
   ```

2. Nếu dimension không phải 1536:
   ```sql
   -- Drop và recreate column với đúng dimension
   ALTER TABLE knowledge_chunks DROP COLUMN embedding;
   ALTER TABLE knowledge_chunks ADD COLUMN embedding vector(1536);
   ```

3. Kiểm tra logs để xem embedding provider nào được dùng:
   - `Generated embedding using OpenAI (1536 dimensions)` ✅
   - `Generated embedding using HuggingFace (384 dims) -> padded to 1536 dims` ✅
   - `Using mock embedding` ⚠️ (không có API keys)

### "Lưu cấu hình AI thất bại"

1. **Check server logs** để xem detailed error
2. **Verify database tables** tồn tại và có cấu trúc đúng:
   ```sql
   SELECT * FROM ai_models;
   SELECT * FROM ai_role_assignments;
   ```
3. **Check API keys** trong environment variables

### Webhook Facebook không hoạt động

1. **Verify Verify Token:** Cùng giá trị trong `.env` và Meta App Dashboard
2. **Check Webhook URL:** `https://your-domain.com/webhooks/facebook`
3. **Test Webhook** trong Meta App Dashboard
4. **Check server logs** để xem incoming requests

## Kỹ thuật (Technical Details)

### Vector Dimensions

**PostgreSQL/pgvector Constraint:**
- Vector column có fixed dimension khi CREATE TABLE
- Không thể lưu vector với dimension khác nhau sau khi tạo
- Giải pháp: Pad smaller vectors đến target dimension

**Database Schema:**
```sql
embedding vector(1536)  -- FIXED DIMENSION - cannot change after creation
```

**Embedding Providers:**
- **OpenAI (text-embedding-3-small):** 1536 dimensions - DIRECT MATCH
- **HuggingFace (BAAI/bge-small-en-v1.5):** 384 dimensions - PADDED TO 1536
- **Mock fallback:** 1536 dimensions (random values)

**Padding Logic:**
```typescript
const hfEmbedding = data[0];  // 384 dims
const embedding = [...hfEmbedding, ...Array(1536 - 384).fill(0)];  // 1536 dims
```

### Database Tables

1. **knowledge_base:** Lưu thông tin documents
2. **knowledge_chunks:** Lưu text chunks và embeddings (1536 dims)
3. **ai_models:** Cấu hình AI models
4. **ai_role_assignments:** Phân vai model cho từng task
5. **system_configs:** Lưu cấu hình (Facebook, System Prompt)

### Polling Mechanism

Frontend polling mỗi 5 giây để update trạng thái documents:
```typescript
// KnowledgeBaseView.tsx
useEffect(() => {
  fetchDocuments();
  const interval = setInterval(fetchDocuments, 5000);
  return () => clearInterval(interval);
}, []);
```

### Async Processing

Documents được xử lý async để không block API:
```typescript
// knowledgeBaseService.ts
processDocumentAsync(documentId, name).catch(err => {
  console.error('Error processing document:', err);
  updateDocumentStatus(documentId, 'FAILED');
});
```

### Chunks Tracking

System track số chunks được lưu thành công:
```typescript
let chunksStored = 0;
for (let i = 0; i < mockChunks.length; i++) {
  const embedding = await generateEmbedding(mockChunks[i]);
  if (embedding && pgClient) {
    await pgClient.query(/* INSERT query */);
    chunksStored++;
    console.log(`Stored chunk ${chunksStored}/${mockChunks.length}`);
  }
}
// Update status với số chunks thực tế được lưu
await updateDocumentStatus(documentId, 'COMPLETED', chunksStored);
```

## Tương lai (Future Improvements)

- [ ] Implement real file parsing (PDF/DOCX) thay vì mock data
- [ ] Add retry logic cho embedding API calls
- [ ] Implement chunking strategies (sliding window, semantic chunking)
- [ ] Add web crawling với BeautifulSoup/cheerio
- [ ] Implement rate limiting cho API calls
- [ ] Add caching cho embeddings
- [ ] Improve error messages để user-friendly
- [ ] Add progress bar cho document processing
- [ ] Implement batch processing cho multiple files
- [ ] Add UI để xem chi tiết lỗi processing
- [ ] Implement ability để retry failed chunks
