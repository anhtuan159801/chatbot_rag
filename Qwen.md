# BÁO CÁO PHÂN TÍCH VÀ KHẮC PHỤC LỖI (QWEN.MD)

## 1. Lỗi chính: `MODULE_NOT_FOUND` cho `/app/dist-server/server.js`

### Nguyên nhân:
- Trong file `Dockerfile` cũ, có lệnh `RUN cp -r dist-server/services/* services/ && rm -rf dist-server`.
- Lệnh này xóa sạch thư mục `dist-server` ngay sau khi biên dịch TypeScript.
- Tuy nhiên, script `start` trong `package.json` lại được cấu hình là `node dist-server/server.js`.
- Khi Docker container khởi động, Node.js không tìm thấy file `server.js` trong thư mục `dist-server` đã bị xóa.

### Cách khắc phục:
- Cập nhật `Dockerfile`: Loại bỏ lệnh xóa thư mục `dist-server` và cải thiện quy trình cài đặt dependencies.
- Thay đổi thứ tự build: Build frontend (`npm run build`) trước, sau đó mới biên dịch server TypeScript để đảm bảo các thư mục output được giữ nguyên và đúng vị trí.

---

## 2. Các nguyên nhân lỗi tiềm ẩn khác

### A. Xung đột đường dẫn import (ES Modules)
- **Hiện trạng**: File `server.ts` sử dụng `import ... from './services/apiProxy.js'`.
- **Phân tích**: Khi dùng `ts-node` hoặc trong môi trường dev, TS có thể hiểu nhưng khi compile sang JS với `module: ES2020`, đường dẫn phải chính xác tuyệt đối.
- **Lưu ý**: Đã kiểm tra `tsconfig.server.json`, cấu hình `outDir: "./dist-server"` và `moduleResolution: "node"` là hợp lý cho môi trường Node hiện đại.

### B. Phục vụ file tĩnh (Static Files)
- **Vấn đề**: `server.ts` phục vụ file từ thư mục `dist` (`app.use(express.static(path.join(__dirname, '..', 'dist')))`).
- **Rủi ro**: Nếu cấu trúc thư mục sau khi build không khớp (ví dụ `dist` nằm ngoài thư mục làm việc của server), frontend sẽ không tải được (Lỗi 404).
- **Giải pháp**: Đảm bảo `npm run build` tạo ra thư mục `dist` tại root của project trước khi chạy server.

### C. Dependencies trong Docker
- **Vấn đề**: `Dockerfile` cài đặt `typescript` toàn cục và `@types/express` thủ công.
- **Giải pháp**: Đã cập nhật Dockerfile để sử dụng `npm ci` thay vì cài đặt riêng lẻ các dependencies, giúp đảm bảo tất cả dependencies được cài đặt chính xác theo package-lock.json.

---

## 3. Kế hoạch triển khai & Kiểm tra (Checklist)

- [x] **Bước 1**: Sửa `Dockerfile` để giữ lại thư mục build server.
- [x] **Bước 2**: Đồng bộ hóa quy trình build trong Docker (Build UI trước, Server sau).
- [x] **Bước 3**: Kiểm tra lại file `server.ts` để đảm bảo các đường dẫn static khớp với thực tế.
- [x] **Bước 4**: Kiểm tra script `start` trong `package.json` (Đã xác nhận là `node dist-server/server.js`).
- [x] **Bước 5**: Viết tài liệu hướng dẫn vận hành vào `Qwen.md`.

## 4. Ghi chú bổ sung (Take notes)
- Luôn giữ thư mục `dist-server` sau khi build nếu đó là entry point của ứng dụng.
- Khi làm việc với TypeScript và ES Modules trong Node.js, việc thêm đuôi `.js` vào đường dẫn import trong file `.ts` là cần thiết và đúng tiêu chuẩn của ESM.
- Cần kiểm tra biến môi trường `PORT` trên Koyeb (mặc định nên là 8080 để khớp với `EXPOSE` trong Dockerfile).
- Dockerfile đã được tối ưu hóa bằng cách sử dụng `npm ci` để đảm bảo quá trình cài đặt dependencies ổn định và nhanh hơn.

---

## 5. Kế hoạch tích hợp Supabase để lưu trữ cấu hình và dữ liệu (MỚI)

### A. Mục tiêu:
- Thay thế toàn bộ lưu trữ tạm thời (in-memory) trong `server.ts` bằng cơ sở dữ liệu Supabase (PostgreSQL).
- Đảm bảo cấu hình (Facebook API, AI Models, Roles) và Kho dữ liệu pháp lý (Knowledge Base) được lưu trữ vĩnh viễn và đồng bộ.

### B. Cấu trúc bảng dự kiến trên Supabase:
1.  **`system_configs`**: Lưu trữ cấu hình chung (Facebook Page ID, Access Token, System Prompt).
    - Cấu trúc: `key` (string, primary), `value` (jsonb), `updated_at` (timestamp).
2.  **`ai_models`**: Lưu trữ danh sách và trạng thái các model AI.
    - Cấu trúc: `id`, `provider`, `name`, `model_string`, `api_key` (mã hóa), `is_active`.
3.  **`knowledge_base`**: Lưu trữ thông tin về các tài liệu pháp lý.
    - Cấu trúc: `id`, `name`, `type`, `status`, `upload_date`, `vector_count`, `size`, `content_url`.
4.  **`ai_role_assignments`**: Lưu trữ phân vai của các model.
    - Cấu trúc: `role_key` (chatbotText, rag, ...), `model_id` (foreign key to ai_models).

### C. Các bước thực hiện chi tiết:

#### 1. Thiết lập môi trường & Thư viện
- Cài đặt thư viện `@supabase/supabase-js`.
- Cấu hình biến môi trường `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` trong file `.env` và trên dashboard của Koyeb.

#### 2. Xây dựng lớp dịch vụ (Database Service)
- Tạo file `services/supabaseService.ts` để quản lý việc kết nối và các truy vấn CRUD (Create, Read, Update, Delete).
- Viết các hàm helper: `getConfig()`, `updateConfig()`, `getModels()`, `syncKnowledgeBase()`.

#### 3. Chỉnh sửa Server Backend (`server.ts`)
- Thay thế các biến `fbConfig`, `modelConfigs`, `aiRoles` bằng các lệnh gọi hàm từ `supabaseService.ts`.
- Cập nhật các endpoint POST (như `/api/models`, `/api/roles`) để ghi dữ liệu trực tiếp vào Supabase thay vì chỉ cập nhật biến cục bộ.
- Triển khai cơ chế Cache đơn giản (ví dụ dùng `stale-while-revalidate`) để giảm tải cho database nếu cần.

#### 4. Chỉnh sửa Frontend (Đồng bộ hóa)
- Cập nhật các View (`SettingsView.tsx`, `KnowledgeBaseView.tsx`) để hiển thị trạng thái thực từ database.
- Thêm thông báo (Toast) khi quá trình lưu dữ liệu vào Supabase thành công hoặc thất bại.

#### 5. Di chuyển dữ liệu (Data Migration)
- Viết một script nhỏ để đẩy dữ liệu "mock" hiện tại lên Supabase trong lần đầu tiên chạy hệ thống để đảm bảo có dữ liệu mẫu.

### D. Checklist thực hiện cho Supabase:
- [ ] Khởi tạo Project trên Supabase Dashboard.
- [ ] Tạo các bảng (Tables) theo cấu trúc đã đề xuất.
- [ ] Cài đặt `@supabase/supabase-js`.
- [ ] Viết `services/supabaseService.ts`.
- [ ] Refactor `server.ts` để kết nối DB.
- [ ] Test việc lưu trữ: Thay đổi config trên UI -> Refresh trang -> Kiểm tra dữ liệu vẫn còn.
