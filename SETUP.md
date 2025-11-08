# 🚀 Hướng dẫn Setup Project

## 1️⃣ Clone Repository

```bash
git clone <your-repo-url>
cd tmdt
```

## 2️⃣ Install Dependencies

### Frontend
```bash
npm install
```

### Backend
```bash
cd backend
npm install
```

## 3️⃣ Setup Environment Variables

### Backend (.env)

Copy file `.env.example` thành `.env`:

```bash
cd backend
cp .env.example .env
```

Sau đó điền các credentials cần thiết:

#### **Supabase** (Bắt buộc)
1. Vào [supabase.com](https://supabase.com/)
2. Tạo project hoặc dùng project có sẵn
3. Settings → API → Copy:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

#### **PayPal Sandbox** (Để test thanh toán)
1. Vào [developer.paypal.com](https://developer.paypal.com/)
2. Login hoặc tạo tài khoản
3. My Apps & Credentials → Create App (Sandbox)
4. Copy:
   - `PAYPAL_CLIENT_ID`
   - `PAYPAL_CLIENT_SECRET`

#### **Email SMTP** (Optional - để gửi email xác nhận)
1. Dùng Gmail:
   - Bật 2FA: [Google 2FA](https://myaccount.google.com/security)
   - Tạo App Password: [App Passwords](https://myaccount.google.com/apppasswords)
   - Chọn "Mail" và device
   - Copy password được tạo
2. Điền vào `.env`:
   ```
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

#### **Admin API Key** (Tùy chọn)
Generate random key 64 characters:
```bash
# PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})
```

## 4️⃣ Run Database Migrations

1. Vào Supabase Dashboard → SQL Editor
2. Chạy lần lượt các file trong thư mục `migrations/`:
   - `001_create_profiles.sql`
   - `002_profiles_triggers.sql`
   - `004_seed_sample_products.sql`
   - `005_add_timestamps_to_cart.sql`
   - `006_add_role_to_profiles.sql`
   - `007_normalize_roles.sql`
   - `008_create_orders_and_payments.sql`
   - `009_create_coupons.sql`
   - `010_add_coupon_columns_to_orders.sql`
   - `011_create_webhook_logs.sql`

## 5️⃣ Start Development Servers

### Backend
```bash
cd backend
node index.js
```
Backend sẽ chạy tại: `http://localhost:54321`

### Frontend
```bash
npm run dev
```
Frontend sẽ chạy tại: `http://localhost:5173`

## 6️⃣ Test PayPal

1. Vào [sandbox.paypal.com](https://www.sandbox.paypal.com/)
2. Login bằng Sandbox Personal Account (tạo trong PayPal Developer Dashboard)
3. Test thanh toán trong app

---

## ⚠️ Lưu ý

- ❌ **KHÔNG commit file `.env`** (đã được gitignore)
- ✅ **Luôn update `.env.example`** khi thêm biến mới
- 🔒 **Không share credentials** lên public repo
- 📧 **SMTP_PASS phải là App Password**, không dùng mật khẩu Gmail thường

---

## 🐛 Troubleshooting

### Backend không start
- Kiểm tra port 54321 có bị chiếm không
- Verify `.env` có đầy đủ SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY

### PayPal không hoạt động
- Kiểm tra PAYPAL_CLIENT_ID và PAYPAL_CLIENT_SECRET
- Đảm bảo đang dùng Sandbox mode
- Login sandbox.paypal.com bằng Sandbox account

### Email không gửi được
- Verify SMTP_USER và SMTP_PASS
- Đảm bảo dùng App Password, không phải mật khẩu Gmail thường
- Kiểm tra 2FA đã bật chưa

---

## 📚 Tech Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **Payment**: PayPal Sandbox
- **Email**: Nodemailer (SMTP)
