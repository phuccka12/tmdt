const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, 
  auth: {
    user: process.env.SMTP_USER, 
    pass: process.env.SMTP_PASS, 
  },
});

/**
 * Send order confirmation email
 * @param {Object} options
 * @param {string} options.to - recipient email
 * @param {string} options.customerName - customer name
 * @param {number} options.orderId - order ID
 * @param {number} options.total - order total
 * @param {Array} options.items - order items [{name, quantity, price}]
 */
async function sendOrderConfirmation({ to, customerName, orderId, total, items = [] }) {
  try {
    // Skip if email not configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('[email] SMTP not configured, skipping email send');
      return { success: false, error: 'SMTP not configured' };
    }

    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name || 'Sản phẩm'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${Number(item.price || 0).toLocaleString('vi-VN')}₫</td>
      </tr>
    `).join('');

    const mailOptions = {
      from: `"${process.env.SHOP_NAME || 'Shop'}" <${process.env.SMTP_USER}>`,
      to: to,
      subject: `Xác nhận đơn hàng #${orderId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #000; color: #fff; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
            th { background: #f0f0f0; padding: 10px; text-align: left; }
            .total { font-size: 18px; font-weight: bold; text-align: right; padding: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Cảm ơn bạn đã đặt hàng!</h1>
            </div>
            <div class="content">
              <p>Xin chào <strong>${customerName}</strong>,</p>
              <p>Đơn hàng #${orderId} của bạn đã được xác nhận và đang được xử lý.</p>
              
              <h3>Chi tiết đơn hàng:</h3>
              <table>
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th style="text-align: center;">Số lượng</th>
                    <th style="text-align: right;">Giá</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
              
              <div class="total">
                Tổng cộng: <span style="color: #e74c3c;">${Number(total).toLocaleString('vi-VN')}₫</span>
              </div>
              
              <p>Chúng tôi sẽ liên hệ với bạn sớm nhất để xác nhận và giao hàng.</p>
              <p>Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${process.env.SHOP_NAME || 'Shop'}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[email] Order confirmation sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[email] Failed to send order confirmation:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendOrderConfirmation };
