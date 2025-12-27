# Cách Fix Lỗi "Lưu cấu hình AI thất bại" do Foreign Key Constraint

## Vấn đề
```
Error: violates foreign key constraint "ai_role_assignments_model_id_fkey" 
on table "ai_role_assignments"
Key (id)=(gemini-1) is still referenced from table "ai_role_assignments"
```

**Nguyên nhân:** Khi bạn xóa model trong Settings và lưu, PostgreSQL không cho phép xóa model đang được reference bởi bảng `ai_role_assignments` (phân quyền AI).

## Giải pháp

Có 3 cách để fix vấn đề này:

---

## 🟢 Cách 1: Chạy Migration Script (Khuyên nghị)

### Bước 1: Vào Supabase SQL Editor

1. Truy cập [Supabase Dashboard](https://supabase.com/dashboard)
2. Chọn project của bạn
3. Nhấn nút "SQL Editor"

### Bước 2: Copy Migration Script

Copy nội dung từ file `fix-foreign-key.sql`:

\`\`\`sql
-- Migration script để fix foreign key constraint
-- Chạy script này trong Supabase SQL Editor hoặc psql

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
\`\`\`

### Bước 3: Chạy Script

1. Paste script vào SQL Editor
2. Nhấn nút **Run**
3. Kiểm tra kết quả - Mong đợi:
   ```
   Success. No rows returned (column on_delete)
   ```
   Nếu `on_delete` = `CASCADE`, thành công!

### Bước 4: Thử Lưu Cấu hình

1. Vào **Settings > Mô hình AI**
2. Kích hoạt model (ví dụ: Google Gemma)
3. Nhấn **Lưu Cấu hình**
4. Mong đợi: "Đã lưu cấu hình AI." ✅

---

## 🟡 Cách 2: Cập nhật Schema Manual (Nếu cách 1 thất bại)

### Bước 1: Re-create Tables

Nếu migration script không hoạt động, chạy script này:

\`\`\`sql
-- Xóa bảng cũ (CAUTION: sẽ mất dữ liệu)
DROP TABLE IF EXISTS ai_role_assignments CASCADE;
DROP TABLE IF EXISTS ai_models CASCADE;
DROP TABLE IF EXISTS knowledge_chunks CASCADE;
DROP TABLE IF EXISTS knowledge_base CASCADE;
DROP TABLE IF EXISTS system_configs CASCADE;

-- Tạo lại bảng với schema mới
CREATE TABLE IF NOT EXISTS ai_models (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    name TEXT NOT NULL,
    model_string TEXT NOT NULL,
    api_key TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_role_assignments (
    role_key TEXT PRIMARY KEY,
    model_id TEXT REFERENCES ai_models(id) ON DELETE CASCADE,  -- CÓ CASCADE
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('PDF', 'DOCX', 'WEB_CRAWL', 'CSV')) NOT NULL,
    status TEXT CHECK (status IN ('PENDING', 'PROCESSING', 'VECTORIZING', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING',
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    vector_count INTEGER DEFAULT 0,
    size TEXT,
    content_url TEXT
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    knowledge_base_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
    metadata JSONB DEFAULT '{}',
    chunk_index INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tạo indexes
CREATE INDEX IF NOT EXISTS idx_ai_models_is_active ON ai_models(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_status ON knowledge_base(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_knowledge_base_id ON knowledge_chunks(knowledge_base_id);
\`\`\`

---

## 🟠 Cách 3: Chạy psql từ Command Line (Nếu không có Supabase Dashboard)

\`\`\`bash
# Kết nối database (thay thông tin)
psql "postgresql://postgres.smtqevkyhttclmpwsmvc:gZGCA6mCgl5GQvH7@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"

# Hoặc chạy file fix-foreign-key.sql
psql -f "postgresql://postgres.smtqevkyhttclmpwsmvc:gZGCA6mCgl5GQvH7@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres" -f fix-foreign-key.sql

# Hoặc chạy migration script trực tiếp
psql -f "postgresql://postgres.smtqevkyhttclmpwsmvc:gZGCA6mCgl5GQvH7@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres" << 'EOF'
ALTER TABLE ai_role_assignments DROP CONSTRAINT IF EXISTS ai_role_assignments_model_id_fkey;
ALTER TABLE ai_role_assignments ADD CONSTRAINT ai_role_assignments_model_id_fkey FOREIGN KEY (model_id) REFERENCES ai_models(id) ON DELETE CASCADE;
EOF
\`\`\`

---

## ✅ Kiểm tra Foreign Key đã được Update

Sau khi chạy migration, verify bằng query sau:

\`\`\`sql
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
\`\`\`

**Kết quả mong đợi:**
```
table_name        | column_name | foreign_table_name | foreign_column_name | on_delete
------------------|-------------|------------------|------------------|----------
ai_role_assignments | model_id    | ai_models         | id              | CASCADE
```

Nếu `on_delete` = `CASCADE` → **Thành công!** ✅

---

## 🔄 Sau khi Migration

### 1. Thử Lưu Cấu hình AI
1. Vào **Settings > Mô hình AI**
2. Kích hoạt model "Google Gemma (HuggingFace)" hoặc model khác
3. Nhấn **Lưu Cấu hình**
4. Mong đợi message: "Đã lưu cấu hình AI." ✅

### 2. Phân vai cho RAG
1. Chuyển sang tab **Phân vai & Prompt**
2. Tìm mục "Truy vấn Dữ liệu (RAG)"
3. Chọn model đã kích hoạt ở bước 1
4. Nhấn **Lưu Chỉ thị**

### 3. Upload và Test
1. Vào **Kho Dữ liệu Pháp lý**
2. Tải lên tài liệu (PDF/DOCX)
3. Kiểm tra server logs:
   \`\`\`bash
   npm start
   \`\`\`

Mong đợi logs:
\`\`\`
Found embedding model assignment: rag=hf-2
Using assigned HuggingFace model: huggingface/google/gemma-3-300m
Generated embedding using assigned HuggingFace model (768 dims -> padded to 1536 dims)
Stored chunk 1/5 for: your-document.docx
Stored chunk 2/5 for: your-document.docx
...
Successfully stored 5/5 chunks for: your-document.docx
\`\`\`

---

## 🐛 Troubleshooting

### Vấn đề 1: SQL Editor không chạy migration

**Nguyên nhân:** Script có syntax error

**Giải pháp:** Chạy từng command riêng:
1. Copy đoạn DROP CONSTRAINT
2. Chạy → Copy kết quả
3. Copy đoạn ADD CONSTRAINT
4. Chạy → Copy kết quả

### Vấn đề 2: Vẫn gặp lỗi sau khi migration

**Kiểm tra:** Chạy verify query ở trên

**Nếu on_delete != CASCADE:**
- Migration thất bại
- Kiểm tra lại script
- Đảm bảo không có syntax error

### Vấn đề 3: Không thể truy cập Supabase

**Giải pháp:** Sử dụng psql từ command line:
\`\`\`bash
psql "postgresql://postgres.smtqevkyhttclmpwsmvc:gZGCA6mCgl5GQvH7@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres" < commands.sql
\`\`\`

### Vấn đề 4: Database credentials

**Lấy credentials:**
1. Vào Supabase Dashboard
2. Settings > Database
3. Connection string
4. Copy URI: `postgresql://postgres.smtqevkyhttclmpwsmvc:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres`

**Thay YOUR_PASS
