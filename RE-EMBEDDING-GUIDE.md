# 🔧 FIX Embedding Dimension Mismatch

## Vấn đề

Database schema đang fix cứng embedding ở 384 dimensions (từ model cũ), nhưng model mới `intfloat/multilingual-e5-large` tạo ra 1024 dimensions → không thể update chunks cũ.

**Giải pháp nhanh nhất:** Re-upload lại tất cả documents

### Cách 1: Delete & Re-upload (Nhanh nhất)

1. Xóa tất cả documents cũ:
```sql
-- Xóa toàn bộ documents và chunks
DELETE FROM knowledge_chunks;
DELETE FROM knowledge_base;
```

2. Upload lại tất cả documents qua UI
- Hệ thống sẽ tự động tạo embedding mới với 1024 dimensions

### Cách 2: Manual Re-embed (Cho nhiều documents)

Tạo script để:
- Giữ nguyên documents
- Xóa chunks cũ
- Re-generate embedding với model mới
- Lưu lại chunks

## Script Fix Embedding Dimension

File: `fix-embedding-dimension-simple.sql`
Câu lệnh đơn giản để fix schema:

```sql
-- Drop old constraint
ALTER TABLE knowledge_chunks DROP CONSTRAINT IF EXISTS knowledge_chunks_embedding_dim_check;

-- Add new flexible constraint
ALTER TABLE knowledge_chunks
ADD CONSTRAINT knowledge_chunks_embedding_dim_check
CHECK (array_length(string_to_array(regexp_replace(unnest(string_to_array(regexp_replace(embedding, '[\]\]', ''), ','), '\d+')::integer[]) IN (384, 1024));
```

## Script Re-embed Tất cả Documents

File: `re-embed-all-documents.mjs`
Script để tự động re-embed lại toàn bộ knowledge base:
- Xóa chunks cũ
- Lấy documents
- Re-generate embedding với model mới
- Lưu lại chunks

## Chạy Scripts

### Cách 1: Chạy SQL trực tiếp
```bash
psql $DATABASE_URL -f fix-embedding-dimension-simple.sql
```

### Cách 2: Chạy Node.js script
```bash
node re-embed-all-documents.mjs
```

### Cách 3: Sử dụng UI (Khuyên nghị)
1. Truy cập admin console
2. Xóa tất cả documents trong Knowledge Base
3. Upload lại documents
4. Hệ thống sẽ tự động tạo embedding mới

## Sau khi hoàn thành

Test lại câu hỏi:
```
"Hướng dẫn đăng ký tạm trú"
```

Kết quả mong đợi:
- ✅ Tìm được chunks liên quan
- ✅ Trả lời chính xác từ knowledge base
- ✅ Embedding dimensions: 1024
