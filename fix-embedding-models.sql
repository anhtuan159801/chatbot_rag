-- ============================================
-- FIX EMBEDDING MODEL IN DATABASE
-- ============================================
-- Chạy script này trong Supabase SQL Editor
-- để cập nhật model embedding thành model hoạt động

-- Cập nhật model embedding thành model hoạt động
UPDATE ai_models
SET model_string = 'BAAI/bge-small-en-v1.5',
    name = 'BGE Small Embedding v1.5'
WHERE id = 'hf-embed-1';

-- Kiểm tra kết quả
SELECT id, name, model_string, is_active
FROM ai_models
WHERE provider = 'huggingface';

-- ============================================
-- OPTIONAL: Xóa model cũ không cần thiết
-- ============================================
-- Nếu muốn xóa các model embedding cũ không dùng:

-- DELETE FROM ai_models
-- WHERE id IN (
--   'hf-1',
--   'hf-2',
--   'embeddinggemma-300m'
-- );

-- ============================================
-- OPTIONAL: Reset tất cả roles về model mặc định
-- ============================================
-- UPDATE ai_role_assignments
-- SET model_id = 'hf-embed-1'
-- WHERE role_key = 'rag';

-- Lưu ý: Sau khi chạy SQL này, cần REBUILD SERVER!
