# 🔧 Fix Embedding Model cho Hỗ trợ Tiếng Việt

## Vấn đề

Hệ thống tìm được 3 chunks từ knowledge base nhưng trả lời không có thông tin vì:
- **Embedding model hiện tại:** `BAAI/bge-small-en-v1.5` (chỉ hỗ trợ tiếng Anh)
- **Nội dung & câu hỏi:** Tiếng Việt
- **Kết quả:** Embedding không chính xác → tìm ra chunks không liên quan

## Giải pháp

Đã cập nhật embedding model sang:
- **Model mới:** `intfloat/multilingual-e5-large`
- **Hỗ trợ:** Đa ngôn ngữ (bao gồm tiếng Việt)
- **Kích thước vector:** 1024 dimensions (lớn hơn 384 của model cũ)

## ✅ Đã hoàn thành

1. ✅ Update model trong database (`ai_models` table)
2. ✅ Server sẽ tự động dùng model mới ở lần request tiếp theo

## ⚠️ Cần làm tiếp theo

### 1. Re-embed lại toàn bộ knowledge base

Cần re-upload lại tất cả documents để tạo embedding mới với model đa ngôn ngữ:

**Cách 1: Re-upload thủ công qua UI**
1. Đăng nhập admin console
2. Vào Knowledge Base
3. Xóa tất cả documents hiện tại
4. Upload lại các documents
5. Hệ thống sẽ tự động re-embed với model mới

**Cách 2: Tự động re-embed (nếu có nhiều documents)**
- Có thể tạo script để:
  - Lấy tất cả documents
  - Xóa chunks cũ
  - Re-generate embedding với model mới
  - Lưu lại chunks

### 2. Kiểm tra kết quả

Sau khi re-embed, test lại câu hỏi:
```
"Hướng dẫn đăng ký tạm trú"
```

Kết quả mong đợi:
- ✅ Tìm được chunks liên quan đến "đăng ký tạm trú"
- ✅ Trả lời chính xác với nội dung từ knowledge base

## 📊 So sánh model

| Đặc điểm | BAAI/bge-small-en-v1.5 (OLD) | intfloat/multilingual-e5-large (NEW) |
|-----------|----------------------------------|----------------------------------------|
| Ngôn ngữ | Chỉ tiếng Anh | Đa ngôn ngữ (100+ ngôn ngữ) |
| Kích thước | 33M params | 560M params |
| Dimensions | 384 | 1024 |
| Tiếng Việt | ❌ Kém | ✅ Tốt |
| MMR Benchmark | 63.8 | 64.6 |

## 🎯 Kết quả mong đợi

Với model mới:
- ✅ Tìm hiểu ngữ nghĩa tiếng Việt tốt hơn
- ✅ Tìm được chunks liên quan đến câu hỏi
- ✅ Trả lời chính xác từ knowledge base
- ✅ Tương thích với các nội dung hành chính công tiếng Việt

## 📝 Script đã tạo

1. `update-embedding-model.sql` - SQL script để update model
2. `update-embedding-model.mjs` - Node.js script để update model
