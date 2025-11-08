import React from 'react';
import { TicketPercent } from 'lucide-react';

const Divider: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`h-px bg-gray-100 ${className || ''}`} />
);

const formatVnd = (n: number) =>
  n
    .toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })
    .replace('₫', 'đ');

export default function CartSummary({
  selectedSubtotal,
  discount,
  couponCode,
  setCouponCode,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  total,
  providers,
  paymentMethod,
  setPaymentMethod,
  onCheckout,
  selectedCount,
}: any) {
  return (
    <div className="lg:col-span-1">
      <div className="p-6 border rounded-2xl sticky top-24">
        <h2 className="font-bold mb-4">Tóm tắt đơn hàng</h2>

        <div className="flex justify-between mb-2 text-sm">
          <span className="text-gray-600">Tạm tính (đã chọn)</span>
          <span className="font-semibold">{formatVnd(selectedSubtotal)}</span>
        </div>

        <div className="mb-3">
          <label className="text-sm font-medium">Mã giảm giá</label>
          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <TicketPercent className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="w-full border px-9 py-2 rounded-xl focus:ring-2 focus:ring-orange-200 focus:outline-none"
                placeholder="Nhập mã giảm giá"
                aria-label="Nhập mã giảm giá"
              />
            </div>
            <button onClick={onApplyCoupon} className="px-4 py-2 bg-black text-white rounded-xl hover:bg-orange-500 transition">
              Áp dụng
            </button>
          </div>

          {appliedCoupon ? (
            <div className="flex items-center justify-between mt-2 text-sm bg-green-50 border border-green-100 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2 text-green-700">
                <TicketPercent className="w-4 h-4" />
                Đã áp dụng: <span className="font-semibold">{appliedCoupon.code}</span>
              </div>
              <button onClick={onRemoveCoupon} className="text-green-700/70 hover:text-green-800 p-1" aria-label="Gỡ mã giảm giá">
                ✕
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex justify-between mb-4 text-gray-500 text-sm">
          <span>Phí vận chuyển</span>
          <span>Sẽ tính ở bước sau</span>
        </div>

        <div className="mb-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Giảm</span>
            <span>-{formatVnd(discount)}</span>
          </div>
        </div>

        <Divider className="my-4" />

        <div className="flex justify-between text-lg font-black mb-6">
          <span>Tổng</span>
          <span>{formatVnd(total)}</span>
        </div>

        <div className="mb-4">
          <div className="text-sm font-medium mb-2">Phương thức thanh toán</div>
          <div className="text-gray-500 text-sm mb-3">Chọn phương thức để tiếp tục. Các nhà cung cấp không cấu hình sẽ bị ẩn.</div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="payment" value="simulate" checked={paymentMethod === 'simulate'} onChange={() => setPaymentMethod('simulate')} />
              <span className="text-sm">Mock / Simulate</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
              <span className="text-sm">Thanh toán khi nhận hàng (COD)</span>
            </label>

            {providers.momo ? (
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="payment" value="momo" checked={paymentMethod === 'momo'} onChange={() => setPaymentMethod('momo')} />
                <span className="text-sm">Momo</span>
              </label>
            ) : null}

            {providers.vnpay ? (
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="payment" value="vnpay" checked={paymentMethod === 'vnpay'} onChange={() => setPaymentMethod('vnpay')} />
                <span className="text-sm">VNPay</span>
              </label>
            ) : null}

            {providers.paypal ? (
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="payment" value="paypal" checked={paymentMethod === 'paypal'} onChange={() => setPaymentMethod('paypal')} />
                <span className="text-sm">PayPal</span>
              </label>
            ) : null}
          </div>
        </div>

        {/* If PayPal is configured, show a dedicated PayPal button that triggers checkout with PayPal */}
        {providers.paypal ? (
          <div className="space-y-3">
            <button
              onClick={() => {
                setPaymentMethod('paypal');
                onCheckout();
              }}
              disabled={selectedCount === 0}
              className={`w-full text-white py-3 rounded-xl font-bold transition ${selectedCount === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#003087] hover:opacity-90'}`}>
              Thanh toán bằng PayPal
            </button>
            <div className="text-center text-sm text-gray-500">Hoặc chọn phương thức khác và nhấn <strong>Thanh toán</strong></div>
            <button onClick={onCheckout} disabled={selectedCount === 0} className={`w-full text-white py-3 rounded-xl font-bold transition ${selectedCount === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-black hover:bg-orange-500'}`}>
              Thanh toán
            </button>
          </div>
        ) : (
          <button onClick={onCheckout} disabled={selectedCount === 0} className={`w-full text-white py-3 rounded-xl font-bold transition ${selectedCount === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-black hover:bg-orange-500'}`}>
            Thanh toán
          </button>
        )}

      </div>
    </div>
  );
}
