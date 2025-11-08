# Hướng dẫn cấu hình thanh toán (PayPal, webhooks, testing)

Tài liệu ngắn này mô tả cách cấu hình PayPal sandbox, webhook và cách test luồng thanh toán local sử dụng backend trong repository.

1) Biến môi trường
- Tạo file `backend/.env` (không commit). Dùng `.env.example` làm mẫu.
- Quan trọng (backend):
  - `SUPABASE_URL` - URL Supabase project
  - `SUPABASE_SERVICE_ROLE_KEY` - secret service_role (phải để server-only)
  - `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` - sandbox/live credentials
  - `PAYPAL_WEBHOOK_ID` - ID webhook do PayPal cung cấp khi bạn đăng ký webhook
  - `PAYPAL_RETURN_URL` - URL PayPal sẽ redirect người dùng về sau khi thanh toán

2) Tạo webhook trong PayPal (sandbox)
- Vào PayPal Developer Dashboard → Sandbox → Webhooks → Create Webhook.
- URL webhook: dùng public URL (ví dụ ngrok) trỏ tới backend route `/api/paypal-webhook` hoặc `/api/webhook/paypal`.
  - Ví dụ: `https://xxxxxx.ngrok.app/api/paypal-webhook`
- Chọn events cần nhận (ví dụ: PAYMENT.CAPTURE.COMPLETED, CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.DENIED).
- Sau khi tạo, PayPal sẽ cho một `Webhook ID` (WH-...), copy vào `PAYPAL_WEBHOOK_ID` trong `backend/.env`.

3) Dùng ngrok để expose backend (local testing)
- Cài ngrok và chạy (Windows PowerShell):
  ngrok http 54321
- Lấy URL public từ ngrok (ví dụ `https://abcd-1234.ngrok.io`) và dùng để tạo webhook URL trong PayPal.

4) Kiểm tra flow local
- Start backend:
  - cd backend
  - npm start
- Start frontend (Vite):
  - cd project root
  - npm run dev
- Tạo một user/sing-in, thêm sản phẩm vào giỏ, vào Cart → Thanh toán → chọn PayPal → bấm Thanh toán.
- Frontend sẽ nhận `payment_url` từ backend và redirect tới PayPal sandbox.
- Sau khi seller/buyer approve trong sandbox, PayPal gửi webhook tới backend — backend sẽ verify signature (dựa vào `PAYPAL_WEBHOOK_ID`) và cập nhật `payments`/`orders`.

5) Lưu ý tiền tệ
- PayPal sandbox đôi khi không hỗ trợ VND. Backend repo này có conversion tạm `VND_USD_RATE` để convert VND->USD trước khi gọi PayPal. Cho production, dùng một chiến lược tiền tệ rõ ràng (gửi currency supported hoặc show conversion to user).

6) Các lỗi phổ biến
- 400 Bad Request when querying profiles: đảm bảo bạn chỉ `select()` các cột tồn tại (ví dụ `full_name, avatar_url, email`).
- Webhook signature verification fails: kiểm tra `PAYPAL_WEBHOOK_ID` đúng, và webhook URL khớp với URL đăng ký ở PayPal.

7) Smoke test (tay)
- Gửi POST /payments/orders với payload (ví dụ qua Postman) và kiểm tra response trả `payment_url`.
- Mở `payment_url` để simulate checkout.

8) Nâng cao
- Thêm script automated smoke test (mình có thể giúp viết). 
- Trong production, dùng secure secrets store (Azure KeyVault/Hashicorp/Env vars in CI/CD) và chạy backend dưới process manager (pm2/systemd).
