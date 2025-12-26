# RAGBot Admin Console - Hướng dẫn Deploy Koyeb

## Tổng quan
Đây là một ứng dụng chatbot Facebook với backend Node.js/Express và frontend React/TypeScript.

## Các thay đổi quan trọng

### 1. Sửa lỗi Facebook Webhook
- **File:** `services/facebookService.ts`
- **Vấn đề:** Format API sai (dùng query string thay vì JSON body)
- **Sửa:** Chuyển sang dùng JSON body đúng chuẩn Facebook Graph API

### 2. Sửa Webhook Handler
- **File:** `server.ts`
- **Vấn đề:** `forEach` với `async` callback làm chậm response
- **Sửa:** Dùng fire-and-forget pattern với hàm `processMessageAsync()` riêng biệt
- **Thêm:** AI response thực sự với Gemini API

### 3. Cải thiện Keep-alive
- **File:** `server.ts:350-376`
- **Vấn đề:** Keep-alive chỉ console.log, không gửi HTTP request
- **Sửa:** Ping thực sự đến `/health` endpoint mỗi 4 phút
- **Thêm:** SIGTERM handler cho graceful shutdown

## Cài đặt Environment Variables

Trên Koyeb, vào **Settings → Environment Variables** và thêm:

```bash
PORT=8000

# Database
SUPABASE_URL=postgresql://postgres:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres

# AI API Keys
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# Facebook
FACEBOOK_PAGE_ID=your_facebook_page_id_here
FACEBOOK_ACCESS_TOKEN=your_facebook_page_access_token_here
FACEBOOK_PAGE_NAME=Your Page Name
FB_VERIFY_TOKEN=dvc_verify_token_2024_secure
```

## Thiết lập Database (Supabase)

Chạy SQL sau trong Supabase SQL Editor:

```sql
-- System configurations
CREATE TABLE IF NOT EXISTS system_configs (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI models
CREATE TABLE IF NOT EXISTS ai_models (
    id VARCHAR(255) PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    model_string VARCHAR(255) NOT NULL,
    api_key TEXT,
    is_active BOOLEAN DEFAULT true
);

-- AI role assignments
CREATE TABLE IF NOT EXISTS ai_role_assignments (
    role_key VARCHAR(255) PRIMARY KEY,
    model_id VARCHAR(255) NOT NULL,
    FOREIGN KEY (model_id) REFERENCES ai_models(id) ON DELETE CASCADE
);
```

## Thiết lập Facebook Webhook

1. Vào [Facebook Developers Portal](https://developers.facebook.com/)
2. Tạo App hoặc chọn App có sẵn
3. Vào **Webhooks** → **New Subscription**
4. **Callback URL:** `https://your-app.koyeb.app/webhooks/facebook`
5. **Verify Token:** `dvc_verify_token_2024_secure`
6. **Subscription Fields:** `messages`, `messaging_postbacks`
7. Lưu và Verify

## Deploy trên Koyeb

### Cách 1: Sử dụng GitHub

1. Push code lên GitHub repository
2. Vào [Koyeb Dashboard](https://app.koyeb.com/)
3. Click **Create Service**
4. Chọn **GitHub** → Chọn repository
5. Chọn branch (thường là `main`)
6. **Build Type:** Dockerfile
7. **Dockerfile:** `./Dockerfile`
8. **Instance Type:** Nano hoặc Micro (để tiết kiệm chi phí)
9. **Regions:** Chọn region gần Việt Nam (Singapore)
10. Click **Deploy**

### Cách 2: Sử dụng Docker image

1. Build Docker image:
```bash
docker build -t your-username/ragbot-admin-console .
```

2. Push lên Docker Hub:
```bash
docker push your-username/ragbot-admin-console
```

3. Vào Koyeb → Create Service → Chọn image

## Ngăn chặn App Sleep (QUAN TRỌNG)

Koyeb sẽ sleep app nếu không có traffic. Để tránh这种情况:

### 1. Bật External Monitoring Service

Dùng một trong các service miễn phí sau:

#### UptimeRobot (Khuyên dùng)
- Đăng ký: https://uptimerobot.com/
- Add Monitor → Type: HTTP
- URL: `https://your-app.koyeb.app/ping`
- Check Interval: 3-5 phút
- Save

#### Better Uptime
- Đăng ký: https://betteruptime.com/
- Add Monitor → Type: HTTP
- URL: `https://your-app.koyeb.app/ping`
- Check Interval: 3 phút

### 2. Internal Keep-alive

App đã có internal keep-alive tự ping mỗi 4 phút, nhưng external monitoring vẫn được khuyến nghị để đảm bảo tính ổn định.

## Test sau khi Deploy

1. **Health Check:**
```bash
curl https://your-app.koyeb.app/health
```

2. **Ping Endpoint:**
```bash
curl https://your-app.koyeb.app/ping
```

3. **Test Facebook Webhook:**
   - Gửi tin nhắn đến Facebook Page
   - Kiểm tra logs trên Koyeb
   - Xem có phản hồi không

## Troubleshooting

### App không phản hồi Facebook message

**Kiểm tra:**
1. `FACEBOOK_ACCESS_TOKEN` có đúng không
2. `FACEBOOK_PAGE_ID` có đúng không
3. Webhook đã được verify chưa
4. App có sleep không (check logs)

### App bị sleep

**Giải pháp:**
1. Thiết lập external monitoring service (UptimeRobot)
2. Check logs xem keep-alive có chạy không
3. Tăng frequency của monitoring service

### Database lỗi

**Kiểm tra:**
1. `SUPABASE_URL` có đúng không
2. Database connection string có đúng format không
3. Tables đã được tạo chưa

### Build lỗi trên Koyeb

**Kiểm tra:**
1. `package.json` có đầy đủ dependencies không
2. `tsconfig.server.json` có đúng không
3. Node version trong `package.json` có match với Dockerfile không

## Logs và Monitoring

Trên Koyeb Dashboard:
- Vào Service → Logs để xem real-time logs
- Vào Service → Metrics để xem performance
- Kiểm tra logs thường xuyên để phát hiện lỗi sớm

## Backup và Restore

### Backup Database
```bash
# Export data
pg_dump $SUPABASE_URL > backup.sql
```

### Restore Database
```bash
# Restore data
psql $SUPABASE_URL < backup.sql
```

## Hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra logs trên Koyeb
2. Kiểm tra this document
3. Kiểm tra DEPLOYMENT_FIXES.md

## Tài liệu tham khảo

- [Koyeb Documentation](https://www.koyeb.com/docs)
- [Facebook Messenger Platform](https://developers.facebook.com/docs/messenger-platform/)
- [Supabase Documentation](https://supabase.com/docs)
