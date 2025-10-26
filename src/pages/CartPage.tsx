import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Minus, Plus, Trash2, TicketPercent, ShoppingCart, X, AlertTriangle } from 'lucide-react';

/**
 * =============================
 * CartPage (UI Enhanced)
 * =============================
 * - Giữ nguyên luồng/logic xử lý dữ liệu và thanh toán
 * - Nâng cấp UI/UX: layout, trạng thái, khả dụng, hiển thị giá, sticky summary, micro-interactions
 * - Không thêm dependency mới
 */

type Row = {
  id: number;
  quantity: number;
  variant: {
    id: number;
    size: string;
    stock: number;
    price_vnd: number | null;
    product: {
      id: number;
      name: string;
      price: string; // chuỗi "299.000đ"
      oldPrice: string | null;
      image: string;
    } | null;
  } | null;
};

const parseVnd = (s?: string | null): number => {
  if (!s) return 0;
  // "1.299.000đ" -> 1299000
  return Number(s.replace(/[^\d]/g, '')) || 0;
};

const formatVnd = (n: number) =>
  n
    .toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })
    .replace('₫', 'đ');

const Divider: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`h-px bg-gray-100 ${className || ''}`} />
);

const PlaceholderImg: React.FC = () => (
  <div className="w-full h-full grid place-items-center bg-gray-50 text-gray-400">
    <ShoppingCart className="w-6 h-6" />
  </div>
);

const CartPage: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string>('');
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setErrorText('');
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      // chưa đăng nhập → chuyển qua auth, quay lại sau
      navigate('/auth?redirect=/cart');
      return;
    }

    // join: cart -> product_variants -> products
    const { data, error } = await supabase
      .from('cart')
      .select(`
        id, quantity,
        variant:product_variants (
          id, size, stock, price_vnd,
          product:products ( id, name, price, oldPrice, image )
        )
      `)
      .eq('user_id', user.id)
      .order('id', { ascending: false });

    if (error) {
      console.error('[CartPage] fetch error:', error.message);
      setErrorText('Không thể tải giỏ hàng. Vui lòng thử lại.');
      setRows([]);
    } else {
      setRows((data || []) as unknown as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lấy providers cấu hình (giữ nguyên logic)
  useEffect(() => {
    (async () => {
      try {
        const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
        const resp = await fetch(`${backend}/payments/providers`);
        const body = await resp.json();
        if (resp.ok && body.ok) setProviders(body.providers || {});
      } catch (e) {
        // ignore provider fetch errors
      }
    })();
  }, []);

  const subtotal = useMemo(() => {
    return rows.reduce((sum, r) => {
      const base = r.variant?.price_vnd ?? parseVnd(r.variant?.product?.price);
      return sum + base * (r.quantity || 0);
    }, 0);
  }, [rows]);

  const [couponCode, setCouponCode] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: number; code: string } | null>(null);
  const [providers, setProviders] = useState<{ momo?: boolean; vnpay?: boolean }>({});
  const [paymentMethod, setPaymentMethod] = useState<string>('simulate');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // simplified: single mock payment flow (giữ nguyên logic)

  const updateQty = async (rowId: number, next: number) => {
    if (next <= 0) return removeRow(rowId);
    const { error } = await supabase.from('cart').update({ quantity: next }).eq('id', rowId);
    if (error) return alert('Cập nhật số lượng thất bại: ' + error.message);
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, quantity: next } : r)));
  };

  const removeRow = async (rowId: number) => {
    const { error } = await supabase.from('cart').delete().eq('id', rowId);
    if (error) return alert('Xoá sản phẩm thất bại: ' + error.message);
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Selected items subtotal (only these will be included in checkout)
  const selectedRows = rows.filter((r) => selectedIds.includes(r.id));
  const selectedSubtotal = selectedRows.reduce((sum, r) => {
    const base = r.variant?.price_vnd ?? parseVnd(r.variant?.product?.price);
    return sum + base * (r.quantity || 0);
  }, 0);

  // Default: no items selected to avoid accidental "buy all" behavior.
  // Provide helper counts and totals for the UI.
  const selectedCount = selectedIds.length;
  const total = Math.max(0, selectedSubtotal - discount);

  // Keep selectedIds in sync when rows change (remove ids that no longer exist)
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => rows.some((r) => r.id === id)));
  }, [rows]);

  // ================= UI =================
  if (loading) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
          <span>Đang tải giỏ hàng...</span>
        </div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border rounded-2xl p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-24 h-24 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                  <div className="h-8 bg-gray-100 rounded w-2/3 mt-2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-orange-50 text-orange-600 text-sm font-medium">
          <ShoppingCart className="w-4 h-4" />
          Giỏ hàng trống
        </div>
        <h1 className="text-2xl md:text-3xl font-black mt-4">Giỏ hàng</h1>
        <p className="text-gray-600 mt-2">Có vẻ bạn chưa thêm sản phẩm nào.</p>
        <Link
          to="/products"
          className="inline-flex items-center justify-center gap-2 mt-6 border px-5 py-3 rounded-xl hover:border-black transition"
        >
          Mua sắm ngay
        </Link>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-black">Giỏ hàng</h1>
        {errorText ? (
          <div className="inline-flex items-center gap-2 text-red-600 text-sm">
            <AlertTriangle className="w-4 h-4" />
            {errorText}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedIds(rows.map((x) => x.id))}
                className="text-sm px-3 py-1 rounded-lg border bg-gray-50 hover:bg-gray-100"
              >
                Chọn tất cả
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-sm px-3 py-1 rounded-lg border bg-gray-50 hover:bg-gray-100"
              >
                Bỏ chọn tất cả
              </button>
              <div className="text-sm text-gray-600">Đã chọn: <span className="font-semibold">{selectedCount}</span></div>
              <div className="text-sm text-gray-600">Tạm tính (đã chọn): <span className="font-semibold">{formatVnd(selectedSubtotal)}</span></div>
            </div>
          </div>

          {rows.map((r) => {
            const p = r.variant?.product;
            const unit = r.variant?.price_vnd ?? parseVnd(p?.price);
            const outOfStock = (r.variant?.stock ?? 0) <= 0;
            const overStock = r.quantity > (r.variant?.stock ?? 0);
            const checked = selectedIds.includes(r.id);
            return (
              <div key={r.id} className="group relative flex items-center gap-4 p-4 border rounded-2xl hover:shadow-sm transition">
                <div className="flex-shrink-0">
                  <input
                    type="checkbox"
                    aria-label={`Chọn sản phẩm ${p?.name || r.id}`}
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds((s) => Array.from(new Set([...s, r.id])));
                      else setSelectedIds((s) => s.filter((id) => id !== r.id));
                    }}
                    className="w-4 h-4"
                  />
                </div>
                <Link
                  to={p ? `/product/${p.id}` : '#'}
                  className="shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-gray-50"
                  aria-label={p?.name || 'Sản phẩm'}
                >
                  {p?.image ? (
                    <img src={p.image} alt={p?.name || ''} className="w-full h-full object-cover" />
                  ) : (
                    <PlaceholderImg />
                  )}
                </Link>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={p ? `/product/${p.id}` : '#'}
                      className="font-semibold hover:text-orange-500 line-clamp-1"
                      title={p?.name || 'Sản phẩm'}
                    >
                      {p?.name || 'Sản phẩm'}
                    </Link>

                    <button
                      onClick={() => removeRow(r.id)}
                      className="text-red-500/70 hover:text-red-600 p-2 rounded-lg hover:bg-red-50"
                      type="button"
                      title="Xoá"
                      aria-label="Xoá khỏi giỏ"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <span className="text-gray-400">Size:</span>
                      <span className="font-medium text-gray-700">{r.variant?.size}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="text-gray-400">Kho:</span>
                      <span className={`font-medium ${outOfStock ? 'text-red-600' : 'text-gray-700'}`}>
                        {r.variant?.stock ?? 0}
                      </span>
                    </span>
                    {overStock ? (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <AlertTriangle className="w-4 h-4" /> Vượt quá tồn kho
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex items-center border rounded-xl overflow-hidden">
                      <button
                        onClick={() => updateQty(r.id, r.quantity - 1)}
                        className="px-3 py-2 hover:bg-gray-50 disabled:opacity-40"
                        type="button"
                        aria-label="Giảm số lượng"
                        disabled={r.quantity <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="px-4 py-2 min-w-[40px] text-center font-medium" aria-live="polite">
                        {r.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(r.id, r.quantity + 1)}
                        className="px-3 py-2 hover:bg-gray-50 disabled:opacity-40"
                        type="button"
                        aria-label="Tăng số lượng"
                        disabled={outOfStock}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-lg">{formatVnd(unit * r.quantity)}</div>
                  <div className="text-sm text-gray-500">đơn giá: {formatVnd(unit)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
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
                  <button
                  onClick={async () => {
                    try {
                      const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
                      if (!couponCode) return alert('Nhập mã giảm giá');
                      const q = new URLSearchParams({ code: couponCode, subtotal: String(Math.round(selectedSubtotal)) });
                      const resp = await fetch(`${backend}/payments/coupons/validate?${q.toString()}`);
                      const body = await resp.json();
                      if (!resp.ok) return alert('Mã không hợp lệ: ' + (body.error || JSON.stringify(body)));
                      setDiscount(Number(body.discount || 0));
                      setAppliedCoupon({ id: body.coupon.id, code: body.coupon.code });
                      alert('Áp mã thành công! Giảm ' + formatVnd(Number(body.discount || 0)));
                    } catch (e) {
                      console.error('Apply coupon error', e);
                      alert('Lỗi khi áp mã: ' + String(e));
                    }
                  }}
                  className="px-4 py-2 bg-black text-white rounded-xl hover:bg-orange-500 transition"
                >
                  Áp dụng
                </button>
              </div>

              {appliedCoupon ? (
                <div className="flex items-center justify-between mt-2 text-sm bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 text-green-700">
                    <TicketPercent className="w-4 h-4" />
                    Đã áp dụng: <span className="font-semibold">{appliedCoupon.code}</span>
                  </div>
                  <button
                    onClick={() => {
                      setAppliedCoupon(null);
                      setDiscount(0);
                    }}
                    className="text-green-700/70 hover:text-green-800 p-1"
                    aria-label="Gỡ mã giảm giá"
                  >
                    <X className="w-4 h-4" />
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
              <div className="text-gray-500 text-sm mb-3">
                Chọn phương thức để tiếp tục. Các nhà cung cấp không cấu hình sẽ bị ẩn.
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="payment"
                    value="simulate"
                    checked={paymentMethod === 'simulate'}
                    onChange={() => setPaymentMethod('simulate')}
                  />
                  <span className="text-sm">Mock / Simulate</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="payment"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                  />
                  <span className="text-sm">Thanh toán khi nhận hàng (COD)</span>
                </label>

                {providers.momo ? (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="payment"
                      value="momo"
                      checked={paymentMethod === 'momo'}
                      onChange={() => setPaymentMethod('momo')}
                    />
                    <span className="text-sm">Momo</span>
                  </label>
                ) : null}

                {providers.vnpay ? (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="payment"
                      value="vnpay"
                      checked={paymentMethod === 'vnpay'}
                      onChange={() => setPaymentMethod('vnpay')}
                    />
                    <span className="text-sm">VNPay</span>
                  </label>
                ) : null}
              </div>
            </div>

            <button
              onClick={async () => {
                try {
                  const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';

                  const { data: userRes } = await supabase.auth.getUser();
                  const user = userRes?.user;

                  const items = selectedRows
                    .map((r) => ({
                      product_id: r.variant?.product?.id ?? null,
                      variant_id: r.variant?.id ?? null,
                      quantity: r.quantity,
                      unit_price: r.variant?.price_vnd ?? parseVnd(r.variant?.product?.price),
                    }))
                    .filter((i) => i.variant_id != null);

                  if (items.length === 0) return alert('Vui lòng chọn ít nhất 1 sản phẩm để thanh toán');

                  // Use selected payment method from UI
                  const method = (paymentMethod || 'simulate').toLowerCase();

                  const resp = await fetch(`${backend}/payments/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      items,
                      user_id: user?.id || null,
                      payment_method: method,
                      coupon_code: appliedCoupon?.code || null,
                    }),
                  });

                  const body = await resp.json();
                  if (!resp.ok || !body.ok) {
                    console.error('create order failed', resp.status, body);
                    return alert('Không thể tạo đơn hàng: ' + (body.error || resp.statusText || JSON.stringify(body)));
                  }

                  const order = body.order;
                  const payment = body.payment;

                  // Handle by method
                  if (method === 'cod') {
                    // clear user's cart locally and in DB
                    try {
                      const { data: user2 } = await supabase.auth.getUser();
                      if (user2?.user?.id) {
                        await supabase.from('cart').delete().eq('user_id', user2.user.id);
                      }
                    } catch (e) {
                      /* ignore */
                    }
                    navigate('/checkout/success');
                    return;
                  }

                  if (method === 'simulate') {
                    // call redirect-simulate with order_id and payment_id
                    const pid = payment?.id;
                    if (!order?.id || !pid) return alert('Không có payment id để simulate');
                    window.location.href = `${backend}/payments/redirect-simulate?order_id=${order.id}&payment_id=${pid}`;
                    return;
                  }

                  if (method === 'momo') {
                    const amountToPay = Math.round(Math.max(0, selectedSubtotal - discount));
                    const momoResp = await fetch(`${backend}/payments/momo`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ orderId: order.id, amount: amountToPay, orderInfo: `Đơn hàng ${order.id}` }),
                    });
                    const momoBody = await momoResp.json();
                    if (momoResp.ok && momoBody.payment_url) {
                      window.location.href = momoBody.payment_url;
                      return;
                    }
                    console.error('momo create failed', momoResp.status, momoBody);
                    return alert('Tạo payment Momo thất bại');
                  }

                  if (method === 'vnpay') {
                    const amountToPay = Math.round(Math.max(0, selectedSubtotal - discount));
                    const q = new URLSearchParams({ orderId: String(order.id), amount: String(amountToPay) });
                    const vnpResp = await fetch(`${backend}/payments/vnpay-create?${q.toString()}`);
                    const vnpBody = await vnpResp.json();
                    if (vnpResp.ok && vnpBody.payment_url) {
                      window.location.href = vnpBody.payment_url;
                      return;
                    }
                    console.error('vnpay create failed', vnpResp.status, vnpBody);
                    return alert('Tạo payment VNPay thất bại');
                  }

                  alert('Phương thức thanh toán không được hỗ trợ');
                } catch (e) {
                  console.error('Checkout error', e);
                  alert('Lỗi khi tạo thanh toán: ' + String(e));
                }
              }}
              disabled={selectedCount === 0}
              className={`w-full text-white py-3 rounded-xl font-bold transition ${selectedCount === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-black hover:bg-orange-500'}`}
            >
              Thanh toán
            </button>

            <Link to="/products" className="block text-center mt-4 text-orange-600 hover:underline">
              ← Tiếp tục mua sắm
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CartPage;
