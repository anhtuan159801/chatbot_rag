# RAGBot Admin Console

## Thông tin sản phẩm

RAGBot Admin Console là một hệ thống quản trị thông minh được xây dựng để hỗ trợ các cơ quan hành chính công trong việc cung cấp thông tin và tư vấn thủ tục hành chính cho công dân. Hệ thống tích hợp công nghệ RAG (Retrieval-Augmented Generation) với trí tuệ nhân tạo để cung cấp câu trả lời chính xác dựa trên cơ sở dữ liệu pháp lý hiện hành.

### Tính năng chính
- **Tổng quan Hệ thống**: Hiển thị các số liệu và trạng thái hoạt động của hệ thống
- **Kho Dữ liệu Pháp lý**: Quản lý văn bản luật, nghị định, hướng dẫn thủ tục hành chính
- **Lịch sử Tư vấn**: Theo dõi các cuộc trò chuyện với công dân qua Facebook Messenger
- **Cấu hình & Kết nối**: Quản lý kết nối Facebook, mô hình AI và thiết lập hệ thống

### Công nghệ sử dụng
- React 19 với TypeScript
- Vite cho tốc độ phát triển nhanh
- Recharts cho biểu đồ và trực quan hóa dữ liệu
- Lucide React cho biểu tượng giao diện
- Gemini AI và các mô hình AI khác cho xử lý ngôn ngữ

## Thiết lập và Cài đặt

### Thiết lập cục bộ
1. Clone repository này:
   ```bash
   git clone https://github.com/anhtuan159801/chatbot_rag.git
   cd chatbot_rag
   ```

2. Cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ```

3. Tạo file `.env.local` và thêm các biến môi trường cần thiết:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key
   VITE_OPENAI_API_KEY=your_openai_api_key
   # Các biến môi trường khác nếu cần
   ```

4. Chạy ứng dụng ở chế độ phát triển:
   ```bash
   npm run dev
   ```

5. Mở trình duyệt và truy cập [http://localhost:5173](http://localhost:5173)

## Triển khai lên nền tảng

### Triển khai lên Vercel

1. Tạo tài khoản tại [Vercel](https://vercel.com)

2. Cài đặt CLI (tùy chọn):
   ```bash
   npm i -g vercel
   ```

3. Đăng nhập vào Vercel:
   ```bash
   vercel login
   ```

4. Triển khai:
   ```bash
   vercel
   ```

5. Hoặc import trực tiếp từ GitHub:
   - Truy cập [Vercel Dashboard](https://vercel.com/dashboard)
   - Chọn "New Project"
   - Import repository `chatbot_rag`
   - Thêm các biến môi trường cần thiết trong phần Settings
   - Bấm "Deploy"

### Triển khai lên Render

1. Tạo tài khoản tại [Render](https://render.com)

2. Tạo mới Static Site từ repository GitHub:
   - Truy cập [Render Dashboard](https://dashboard.render.com)
   - Chọn "New +" → "Static Site"
   - Kết nối với repository GitHub `chatbot_rag`
   - Đặt tên cho dịch vụ
   - Cấu hình:
     - Build Command: `npm run build`
     - Publish Directory: `dist`
   - Thêm biến môi trường trong "Advanced" nếu cần
   - Bấm "Create Static Site"

3. Render sẽ tự động xây dựng và triển khai ứng dụng từ mã nguồn

### Triển khai lên Koyeb

1. Tạo tài khoản tại [Koyeb](https://www.koyeb.com)

2. Cài đặt CLI (tùy chọn):
   ```bash
   curl -sL https://run.koyeb.app/install | sh
   ```

3. Đăng nhập:
   ```bash
   koyeb login
   ```

4. Tạo deployment từ GitHub:
   ```bash
   koyeb app init ragbot-admin --git github.com/anhtuan159801/chatbot_rag --git-branch main
   ```

5. Hoặc deploy trực tiếp từ dashboard:
   - Truy cập [Koyeb Dashboard](https://app.koyeb.com)
   - Chọn "Create App"
   - Chọn "GitHub" và kết nối với repository
   - Chọn repository `chatbot_rag`
   - Cấu hình build:
     - Build Command: `npm install && npm run build`
     - Run Command: `npx serve -s dist` (hoặc `npm run serve-dist`)
     - Environment: Node.js
     - Build Directory: `dist`
   - Thêm biến môi trường nếu cần (VITE_GEMINI_API_KEY, etc.)
   - Bấm "Deploy"

6. Cấu hình đặc biệt cho ứng dụng này:
   - Repository này đã được cấu hình sẵn với:
     - File `Procfile` trong thư mục gốc với nội dung: `web: npm run serve-dist`
     - Package `serve` đã được thêm vào `dependencies` trong `package.json` (không phải devDependencies)
     - Script `serve-dist` trong `package.json` để serve thư mục `dist`
   - Điều này đảm bảo ứng dụng có thể chạy thành công trên Koyeb
   - Nếu gặp lỗi "no command to run your application", kiểm tra lại các cấu hình trên

7. Khắc phục sự cố thường gặp:
   - Nếu gặp lỗi "stat /.../dist: no such file or directory": Đây là lỗi cấu hình trên Koyeb dashboard, không phải lỗi trong mã nguồn. Kiểm tra các cài đặt sau:
     - Trong Koyeb dashboard → App → Settings → "Source code repository", đảm bảo "Root directory" được để trống hoặc là dấu chấm (.)
     - Không đặt "Root directory" thành "dist" hoặc bất kỳ thư mục con nào
     - Không cấu hình "Build path" thành "dist" nếu đang dùng GitHub integration
   - Nếu ứng dụng vẫn không chạy sau build:
     - Thử cập nhật "Run command" trong Koyeb dashboard thành: `npx serve -s dist` (thay vì `npm run serve-dist`)
     - Hoặc đảm bảo script "start" trong package.json được cấu hình đúng để Koyeb có thể sử dụng
   - Nếu gặp lỗi build khác, hãy kiểm tra rằng Node.js version >= 20.0.0 như đã khai báo trong package.json

8. Sau khi deploy thành công:
   - Koyeb sẽ cung cấp URL cho ứng dụng (ví dụ: `https://your-app-name-koyeb.app`)
   - Bạn có thể đặt tên miền riêng trong phần "Domains" của Koyeb Dashboard

## Cấu hình môi trường

### Biến môi trường cần thiết

Dưới đây là các biến môi trường cần thiết cho ứng dụng:

- `VITE_GEMINI_API_KEY`: API key cho Google Gemini
- `VITE_OPENAI_API_KEY`: API key cho OpenAI (tùy chọn)
- `VITE_FACEBOOK_PAGE_ID`: ID của Fanpage Facebook
- `VITE_FACEBOOK_ACCESS_TOKEN`: Access token của Fanpage Facebook

## Cấu trúc thư mục

```
ragbot-admin-console/
├── components/           # Các thành phần UI
│   ├── ChatHistoryView.tsx
│   ├── DashboardView.tsx
│   ├── KnowledgeBaseView.tsx
│   ├── Layout.tsx
│   ├── SettingsView.tsx
│   └── Toast.tsx
├── services/             # Các dịch vụ API
├── types.ts              # Định nghĩa kiểu dữ liệu
├── App.tsx               # Thành phần chính
├── index.html            # File HTML gốc
├── index.tsx             # Entry point
├── package.json          # Dependencies
└── README.md             # Tài liệu này
```

## Đóng góp

Chúng tôi hoan nghênh các đóng góp để cải thiện sản phẩm. Xin vui lòng:

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/amazing-feature`)
3. Commit thay đổi (`git commit -m 'Add amazing feature'`)
4. Push lên branch (`git push origin feature/amazing-feature`)
5. Tạo Pull Request

## Giấy phép

Dự án này được cấp phép theo Giấy phép MIT - xem file [LICENSE](LICENSE) để biết thêm chi tiết.
