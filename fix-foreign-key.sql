-- Migration script để fix foreign key constraint
-- Chạy script này trong Supabase SQL Editor hoặc psql
-- Vấn đề: ai_role_assignments.model_id REFERENCES ai_models(id) thiếu ON DELETE CASCADE

-- Bước 1: Xóa foreign key cũ
ALTER TABLE ai_role_assignments DROP CONSTRAINT IF EXISTS ai_role_assignments_model_id_fkey;

-- Bước 2: Tạo lại foreign key với ON DELETE CASCADE
ALTER TABLE ai_role_assignments 
ADD CONSTRAINT ai_role_assignments_model_id_fkey 
FOREIGN KEY (model_id) REFERENCES ai_models(id) ON DELETE CASCADE;

-- Verify foreign key đã được update
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule AS on_delete
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN' 
AND tc.table_name = 'ai_role_assignments'
AND kcu.column_name = 'model_id';

-- Expected result:
-- foreign_table_name | foreign_column_name | on_delete
-- ai_models         | model_id         | CASCADE
