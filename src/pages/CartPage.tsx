import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, ShoppingCart, AlertTriangle } from 'lucide-react';
import CartList from '../components/CartList';
import CartSummary from '../components/CartSummary';

type Row = any;

const parseVnd = (s?: string | null): number => {
  if (!s) return 0;
  return Number(s.replace(/[^\d]/g, '')) || 0;
};

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
      navigate('/auth?redirect=/cart');
      return;
    }

    const { data, error } = await supabase
      .from('cart')
      .select(`
        id, quantity,
        variant:product_variants ( id, size, stock, price_vnd, product:products ( id, name, price, oldPrice, image ) )
      `)
      .eq('user_id', user.id)
      .order('id', { ascending: false });

    if (error) {
      console.error('[CartPage] fetch error:', error.message);
      setErrorText('Không thể tải giỏ hàng. Vui lòng thử lại.');
      setRows([]);
    } else {
      setRows((data || []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const [couponCode, setCouponCode] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [providers, setProviders] = useState<{ momo?: boolean; vnpay?: boolean }>({});
  const [paymentMethod, setPaymentMethod] = useState<string>('simulate');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
        const resp = await fetch(`${backend}/payments/providers`);
        const body = await resp.json();
        if (resp.ok && body.ok) setProviders(body.providers || {});
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const subtotal = useMemo(() => {
    return rows.reduce((sum, r) => {
      const base = r.variant?.price_vnd ?? parseVnd(r.variant?.product?.price);
      return sum + base * (r.quantity || 0);
    }, 0);
  }, [rows]);

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

  const selectedRows = rows.filter((r) => selectedIds.includes(r.id));
  const selectedSubtotal = selectedRows.reduce((sum, r) => {
    const base = r.variant?.price_vnd ?? parseVnd(r.variant?.product?.price);
    return sum + base * (r.quantity || 0);
  }, 0);

  const selectedCount = selectedIds.length;
  const total = Math.max(0, selectedSubtotal - discount);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => rows.some((r) => r.id === id)));
  }, [rows]);

  const onApplyCoupon = async () => {
    try {
      const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
      if (!couponCode) return alert('Nhập mã giảm giá');
      const q = new URLSearchParams({ code: couponCode, subtotal: String(Math.round(selectedSubtotal)) });
      const resp = await fetch(`${backend}/payments/coupons/validate?${q.toString()}`);
      const body = await resp.json();
      if (!resp.ok) return alert('Mã không hợp lệ: ' + (body.error || JSON.stringify(body)));
      setDiscount(Number(body.discount || 0));
      setAppliedCoupon(body.coupon);
      alert('Áp mã thành công! Giảm ' + Number(body.discount || 0).toLocaleString('vi-VN') + 'đ');
    } catch (e) {
      console.error('Apply coupon error', e);
      alert('Lỗi khi áp mã: ' + String(e));
    }
  };

  const onRemoveCoupon = () => {
    setAppliedCoupon(null);
    setDiscount(0);
  };

  const onCheckout = async () => {
    try {
      const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;

      const items = selectedRows
        .map((r) => ({ product_id: r.variant?.product?.id ?? null, variant_id: r.variant?.id ?? null, quantity: r.quantity, unit_price: r.variant?.price_vnd ?? parseVnd(r.variant?.product?.price) }))
        .filter((i) => i.variant_id != null);

      if (items.length === 0) return alert('Vui lòng chọn ít nhất 1 sản phẩm để thanh toán');

      const method = (paymentMethod || 'simulate').toLowerCase();

      const resp = await fetch(`${backend}/payments/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, user_id: user?.id || null, payment_method: method, coupon_code: appliedCoupon?.code || null }),
      });

      const body = await resp.json();
      if (!resp.ok || !body.ok) return alert('Không thể tạo đơn hàng: ' + (body.error || resp.statusText || JSON.stringify(body)));

      const order = body.order;
      const payment = body.payment;

      if (method === 'cod') {
        try {
          const { data: user2 } = await supabase.auth.getUser();
          if (user2?.user?.id) await supabase.from('cart').delete().eq('user_id', user2.user.id);
        } catch (e) {}
        navigate('/checkout/success');
        return;
      }

      if (method === 'simulate') {
        const pid = payment?.id;
        if (!order?.id || !pid) return alert('Không có payment id để simulate');
        window.location.href = `${backend}/payments/redirect-simulate?order_id=${order.id}&payment_id=${pid}`;
        return;
      }

      if (method === 'momo') {
        const amountToPay = Math.round(Math.max(0, selectedSubtotal - discount));
        const momoResp = await fetch(`${backend}/payments/momo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id, amount: amountToPay, orderInfo: `Đơn hàng ${order.id}` }) });
        const momoBody = await momoResp.json();
        if (momoResp.ok && momoBody.payment_url) { window.location.href = momoBody.payment_url; return; }
        return alert('Tạo payment Momo thất bại');
      }

      if (method === 'vnpay') {
        const amountToPay = Math.round(Math.max(0, selectedSubtotal - discount));
        const q = new URLSearchParams({ orderId: String(order.id), amount: String(amountToPay) });
        const vnpResp = await fetch(`${backend}/payments/vnpay-create?${q.toString()}`);
        const vnpBody = await vnpResp.json();
        if (vnpResp.ok && vnpBody.payment_url) { window.location.href = vnpBody.payment_url; return; }
        return alert('Tạo payment VNPay thất bại');
      }

      alert('Phương thức thanh toán không được hỗ trợ');
    } catch (e) {
      console.error('Checkout error', e);
      alert('Lỗi khi tạo thanh toán: ' + String(e));
    }
  };

  if (loading) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
          <span>Đang tải giỏ hàng...</span>
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
        <Link to="/products" className="inline-flex items-center justify-center gap-2 mt-6 border px-5 py-3 rounded-xl hover:border-black transition">Mua sắm ngay</Link>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-black">Giỏ hàng</h1>
        {errorText ? <div className="inline-flex items-center gap-2 text-red-600 text-sm"><AlertTriangle className="w-4 h-4" />{errorText}</div> : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <CartList
          rows={rows}
          selectedIds={selectedIds}
          onToggleSelect={(id: number, next: boolean) => {
            if (next) setSelectedIds((s) => Array.from(new Set([...s, id])));
            else setSelectedIds((s) => s.filter((x) => x !== id));
          }}
          onUpdateQty={updateQty}
          onRemove={removeRow}
          onSelectAll={() => setSelectedIds(rows.map((x) => x.id))}
          onClearSelection={() => setSelectedIds([])}
        />

        <CartSummary
          selectedSubtotal={selectedSubtotal}
          discount={discount}
          couponCode={couponCode}
          setCouponCode={setCouponCode}
          appliedCoupon={appliedCoupon}
          onApplyCoupon={onApplyCoupon}
          onRemoveCoupon={onRemoveCoupon}
          total={total}
          providers={providers}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          onCheckout={onCheckout}
          selectedCount={selectedCount}
        />
      </div>
    </section>
  );
};

export default CartPage;
