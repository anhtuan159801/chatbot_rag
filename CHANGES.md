
## Thêm Google Gemma-3-300m Model (Update: 26/12/2025)

### Vấn đề
User muốn sử dụng Google Gemma-3-300m model trên HuggingFace để tạo embeddings.

### Giải pháp
Đã thêm model "Google Gemma (HuggingFace)" với:
- ID: hf-2
- Provider: huggingface
- Model String: google/gemma-3-300m
- API Key: Sử dụng HUGGINGFACE_API_KEY từ environment
- is_active: false (mặc định, cần kích hoạt trong Settings)

### Thông tin về Gemma-3-300m
- Provider: HuggingFace
- Dimensions: 768 dimensions
- Padding: 768 -> 1536 để match database schema
- API Key: HUGGINGFACE_API_KEY

### Cách sử dụng

1. **Vào Settings > Mô hình AI**
   - Tìm mục "Google Gemma (HuggingFace)" trong danh sách
   - Nhấn checkbox "Đang hoạt động" (is_active) để kích hoạt
   - Nhấn nút "Lưu Cấu hình"

2. **Chuyển sang Phân vai & Prompt**
   - Tìm mục "Truy vấn Dữ liệu (RAG)"
   - Chọn "hf-2" hoặc tìm model có tên "Google Gemma (HuggingFace)"
   - Nhấn nút "Lưu Chỉ thị"

3. **Kiểm tra Server Logs**
   Khi upload tài liệu, mong đợi logs như sau:
      Found embedding model assignment: rag=hf-2
   Using assigned HuggingFace model: huggingface/google/gemma-3-300m
   Generated embedding using assigned HuggingFace model (768 dims -> padded to 1536 dims)
   Stored chunk 1/5 for: document-name.docx
   Stored chunk 2/5 for: document-name.docx
   ...
   
### Lưu ý quan trọng

1. **Padding Dimensions**
   - Gemma-3-300m: 768 dimensions
   - Database: 1536 dimensions
   - System sẽ tự động padding: [768 numbers] + [768 zeros] = 1536

2. **API Key**
   - Cần có HUGGINGFACE_API_KEY trong file .env
   - Kiểm tra: echo 
3. **Nếu vẫn gặp lỗi "Lưu cấu hình AI thất bại"**
   - Kiểm tra server logs: npm start
   - Tìm logs: "Error updating AI models"
   - Kiểm tra database connection: node check-db.js

### Troubleshooting

**Lỗi: "Lưu cấu hình AI thất bại"**

Có thể do:
1. Database connection error
2. Validation error (missing required fields)
3. Transaction rollback error

Cách kiểm tra:
1. Chạy diagnostic tool:
   ash
   node diagnose.js
   2. Kiểm tra output:
   - Database connection: ✓ SUCCESS
   - AI Models: hf-2 (Google Gemma) trong danh sách
   - AI Roles: rag=hf-2

3. Nếu database không kết nối được:
   - Kiểm tra SUPABASE_URL trong .env
   - Kiểm tra network connection

**Lỗi: Embedding không được tạo**

Sau khi upload tài liệu, nếu documents vẫn ở trạng thái PENDING:

1. Kiểm tra logs có:
   - "Using assigned HuggingFace model: huggingface/google/gemma-3-300m"
   - Nếu không, model chưa được assign cho role RAG

2. Kiểm tra role assignment:
   - Vào Settings > Phân vai & Prompt
   - Kiểm tra "Truy vấn Dữ liệu (RAG)" đã chọn model chưa
   - Nếu chưa, chọn và lưu

3. Kiểm tra API key:
   ash
   echo       - Nếu là placeholder hoặc rỗng, cần điền key thật

### So sánh các Model Embedding

| Model | Provider | Dimensions | API Key | Notes |
|-------|----------|------------|----------|-------|
| OpenAI gpt-4o | openai | 1536 | OPENAI_API_KEY | Direct match database schema |
| HuggingFace zai-org/GLM-4.7 | huggingface | 384 -> 1536 | HUGGINGFACE_API_KEY | Padding 1152 zeros |
| HuggingFace Gemma-3-300m | huggingface | 768 -> 1536 | HUGGINGFACE_API_KEY | Padding 768 zeros |
| OpenRouter xiaomi/mimo-v2-flash | openrouter | ? -> 1536 | OPENROUTER_API_KEY | Thử model string của họ |
# Phân vai AI cho Embedding (RAG)

## Vấn đề
Documents luôn ở trạng thái PENDING vì model embedding không được cấu hình đúng.

## Giải pháp
Đã update code để sử dụng role assignment cho RAG từ database.

## Cách sử dụng

### 1. Truy cập Settings > Mô hình AI
- Vào tab "Cấu hình & Kết nối" > "Mô hình AI"

### 2. Kích hoạt Model cho RAG
- Chọn model OpenAI hoặc Hugging Face từ danh sách
- Chọn checkbox "Đang hoạt động" (is_active)
- Nhấn nút "Lưu Cấu hình"

### 3. Chuyển sang tab "Phân vai & Prompt"
- Tìm mục "Truy vấn Dữ liệu (RAG)"
- Chọn model bạn vừa kích hoạt ở bước 2

### 4. Lưu cấu hình
- Nhấn nút "Lưu Chỉ thị"

## Lưu ý quan trọng

1. **API Keys được lưu trong file .env** (trên server, không phải trong UI)
   - Các API keys đã được set trong .env sẽ tự động được sử dụng
   - Không cần nhập API key trong UI

2. **Model Name Mapping**
   - OpenAI (OpenRouter): gpt-4o, openai/whisper-large-v3, v0/v1/betas
   - HuggingFace: zai-org/GLM-4.7, BAAI/bge-small-en-v1.5, v0/v1/betas

3. **Embedding Dimensions**
   - Database schema: vector(1536)
   - OpenAI: 1536 dimensions (direct match)
   - HuggingFace: 384 dimensions → **padding sang 1536** bằng cách thêm zeros
   - Mock: 1536 dimensions (random values)

4. **Fallback Logic**
   - Priority 1: Sử dụng model được assign cho RAG role
   - Priority 2: Nếu model không active hoặc không có, dùng environment variables
   - OpenAI优先 (ngược lại là HuggingFace)
   - Nếu env vars không set, dùng mock embedding

## Kiểm tra hoạt động

Sau khi cấu hình, upload lại tài liệu và kiểm tra logs:

\`\`\`bash
npm start
\`\`\`

Expected logs:
\`\`\`
Found embedding model assignment: rag=openai-1
Using assigned embedding model: openai/gpt-4o
Generated embedding using assigned OpenAI model (1536 dimensions)
Stored chunk 1/5 for: your-document.docx
Stored chunk 2/5 for: your-document.docx
...
Stored chunk 5/5 for: your-document.docx
Successfully stored 5/5 chunks for: your-document.docx
Document your-document.docx processed successfully with 5 chunks
\`\`\`

## Troubleshooting

### Documents vẫn ở trạng thái PENDING

1. Kiểm tra logs:
   - Có log "Using assigned embedding model" không?
   - Có log "Generated embedding using..." không?
   - Có error "No embedding model assigned" không?

2. Kiểm tra Settings:
   - Đã kích hoạt model chưa? (checkbox "Đang hoạt động")
   - Đã lưu cấu hình chưa?

3. Kiểm tra .env file:
   - OPENAI_API_KEY có được set đúng không? (không phải [YOUR-OPENAI-API-KEY])
   - HUGGINGFACE_API_KEY có được set không?

4. Chạy diagnostic:
   - \`\`\`bash
node diagnose.js
\`\`\`

## Code Changes

**services/knowledgeBaseService.ts**
- generateEmbedding() bây sử dụng embeddingModel parameter từ role assignment
- Check embeddingModel.is_active trước khi dùng API key
- Support OpenAI, HuggingFace, OpenRouter providers
- Padding logic: 384 → 1536 dimensions
- Detailed logging: model assignment, provider, dimension

**services/supabaseService.ts**
- Default model names đã được update:
  - HuggingFace: zai-org/GLM-4.7 (thay vì xiaomi/mimo-v2-flash:free)
  - OpenRouter: xiaomi/mimo-v2-flash:free (thay vì openai/whisper-large-v3)

**server.ts**
- Added dotenv/config để auto-load .env file

**package.json**
- Added dotenv dependency

## File: CHANGES.md
- File này chứa hướng dẫn chi tiết cách sử dụng tính năng phân quyền AI cho embedding
