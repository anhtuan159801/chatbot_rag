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

### 2. Sửa lỗi document luôn ở trạng thái PENDING (Fixed documents stuck in PENDING status)

**Vị trí:** `services/knowledgeBaseService.ts` - Hàm `processDocumentAsync()` và `generateEmbedding()`

**Mô tả lỗi:**
- Sau khi upload file, document luôn ở trạng thái PENDING và không chuyển sang PROCESSING
- Hàm `generateEmbedding()` chỉ nhận 1 tham số nhưng được gọi với 2 tham số (embeddingModel)
- Hệ thống không sử dụng embedding model được cấu hình trong Settings

**Giải pháp:**
- Cập nhật hàm `generateEmbedding()` để nhận tham số `embeddingModel` tùy chọn
- Hỗ trợ nhiều embedding provider (OpenAI, HuggingFace)
- Lấy API key từ environment variable thay vì từ database
- Thêm fallback logic (OpenAI -> HuggingFace -> Mock)
- Log chi tiết trong quá trình processing

### 3. Thêm extension UUID vào database (Added UUID extension to database)

**Vị trí:** `supabase_tables.sql`

**Mô tả:**
- PostgreSQL cần extension `uuid-ossp` để tạo UUID cho document ID
- Thiếu extension có thể gây lỗi khi insert document mới

**Giải pháp:**
- Thêm `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` vào SQL script

### 4. Cải thiện RAG Service với fallback embedding (Improved RAG Service)

**Vị trí:** `services/ragService.ts`

**Mô tả:**
- RAG service chỉ sử dụng HuggingFace API, không có fallback
- Khi HuggingFace API không hoạt động, system không thể generate embedding

**Giải pháp:**
- Thêm fallback từ OpenAI sang HuggingFace
- Log chi tiết về provider đang được sử dụng và dimension của embedding
- Cải thiện error handling

### 5. Cải thiện Settings UI - Model configuration (Improved Settings UI)

**Vị trí:** `components/SettingsView.tsx`

**Mô tả:**
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
   - Cải thiện `generateEmbedding()` để hỗ trợ multiple providers
   - Import `getAiRoles()` và `getModels()` từ supabaseService
   - Cải thiện `processDocumentAsync()` với detailed logging

3. **`services/ragService.ts`**
   - Thêm fallback logic (OpenAI -> HuggingFace)
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
OPENAI_API_KEY=your_openai_key  # Cho embedding (1536 dimensions)
OPENROUTER_API_KEY=your_openrouter_key
HUGGINGFACE_API_KEY=your_hf_key  # Cho embedding (384 dimensions) hoặc fallback

# Facebook
FACEBOOK_PAGE_ID=your_page_id
FACEBOOK_ACCESS_TOKEN=your_access_token
FACEBOOK_PAGE_NAME=Your Page Name
FB_VERIFY_TOKEN=dvc_verify_token_2024_secure
```

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
   - **VECTORIZING:** Đang tạo embeddings
   - **COMPLETED:** Hoàn tất
   - **FAILED:** Lỗi (xem console log)

## Troubleshooting

### Documents vẫn ở trạng thái PENDING

1. **Check console logs:**
   ```bash
   # Nếu chạy local
   npm start

   # Check log lines có chứa:
   # - "Status updated to PROCESSING"
   # - "Generated embedding using..."
   # - "Stored chunk X/Y"
   ```

2. **Kiểm tra API keys:**
   - OpenAI API key: Dành cho embedding (1536 dimensions)
   - HuggingFace API key: Fallback (384 dimensions)

3. **Check database connection:**
   ```bash
   # Kiểm tra SUPABASE_URL trong .env
   # Test connection:
   psql $SUPABASE_URL
   ```

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
- **OpenAI (text-embedding-3-small):** 1536 dimensions
- **HuggingFace (BAAI/bge-small-en-v1.5):** 384 dimensions

Lưu ý: Knowledge base có thể chứa embeddings với dimensions khác nhau. Khi search, cosine similarity vẫn hoạt động đúng.

### Database Tables

1. **knowledge_base:** Lưu thông tin documents
2. **knowledge_chunks:** Lưu text chunks và embeddings
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
