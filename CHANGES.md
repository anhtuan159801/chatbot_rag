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
