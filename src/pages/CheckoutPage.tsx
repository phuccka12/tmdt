import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const formatVnd = (n: number) => n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }).replace('₫', 'đ');

export default function CheckoutPage() {
  const loc = useLocation();
  const navigate = useNavigate();
  const state: any = (loc.state as any) || {};
  const [items, setItems] = useState<any[]>(state.items || []);
  const [subtotal, setSubtotal] = useState<number>(state.subtotal || 0);
  const [discount, setDiscount] = useState<number>(state.discount || 0);
  const [coupon, setCoupon] = useState<any>(state.appliedCoupon || null);
  const [address, setAddress] = useState<string>(state.address || '');
  const [phone, setPhone] = useState<string>(state.phone || '');
  const [fullName, setFullName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<any>({});
  const [paymentMethod, setPaymentMethod] = useState<string>('paypal');

  useEffect(() => {
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (user) {
          // profiles table in this project has columns: full_name, avatar_url, email
          const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url, email').eq('id', user.id).single();
          if (profile) {
            setFullName((profile as any).full_name || '');
            // phone/address are not stored in profiles by default here; leave them for user to fill
          }
        }
      } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
        const resp = await fetch(`${backend}/payments/providers`);
        const body = await resp.json();
        if (resp.ok && body.ok) setProviders(body.providers || {});
      } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    setSubtotal(state.subtotal || items.reduce((s, it) => s + (it.unit_price || 0) * (it.quantity || 1), 0));
  }, [items]);

  // If items don't include product_name or image, fetch product/variant details from Supabase
  useEffect(() => {
    (async () => {
      try {
        // collect variant ids and product ids that need enrichment
        const missing = items.filter((it) => !it.product_name || !it.image);
        if (missing.length === 0) return;

        const variantIds = Array.from(new Set(missing.map((it) => it.variant_id).filter(Boolean)));
        const productIds = Array.from(new Set(missing.map((it) => it.product_id).filter((id) => id && !variantIds.includes(id))));

        const enrichMap: Record<string, any> = {};

        if (variantIds.length > 0) {
          const { data: variants, error: varErr } = await supabase
            .from('product_variants')
            .select('id, size, stock, price_vnd, product:products(id, name, image, price, label, rating)')
            .in('id', variantIds as any[]);
          if (!varErr && variants) {
            for (const v of variants) {
              const prod: any = (v as any).product;
              enrichMap["v:" + v.id] = {
                product_name: prod?.name,
                image: prod?.image,
                unit_price: v.price_vnd,
                size: v.size,
                stock: v.stock,
                product_label: prod?.label,
                product_rating: prod?.rating,
                product_price: prod?.price,
              };
            }
          }
        }

        if (productIds.length > 0) {
          const { data: products, error: prodErr } = await supabase.from('products').select('id, name, image, price, label, rating').in('id', productIds as any[]);
          if (!prodErr && products) {
            for (const p of products) {
              enrichMap["p:" + p.id] = { product_name: p.name, image: p.image, product_price: p.price, product_label: p.label, product_rating: p.rating };
            }
          }
        }

        // apply enrichment
        const updated = items.map((it) => {
          const keyV = it.variant_id ? "v:" + it.variant_id : null;
          const keyP = it.product_id ? "p:" + it.product_id : null;
          const info = (keyV && enrichMap[keyV]) || (keyP && enrichMap[keyP]) || null;
          if (info) {
            return { ...it, product_name: it.product_name || info.product_name, image: it.image || info.image, unit_price: it.unit_price || info.unit_price };
          }
          return it;
        });

        setItems(updated);
      } catch (e) {
        // ignore enrichment errors
        console.warn('Failed to enrich product data', e);
      }
    })();
  }, [items]);

  const total = Math.max(0, subtotal - (discount || 0));

  const handlePlaceOrder = async () => {
    if (items.length === 0) return alert('Không có sản phẩm để thanh toán');
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';

      const payload = {
        user_id: user?.id || null,
        full_name: fullName || null,
        items: items.map((it) => ({ product_id: it.product_id, variant_id: it.variant_id, quantity: it.quantity, unit_price: it.unit_price })),
        shipping: { address, phone },
        payment_method: paymentMethod,
        coupon_code: coupon?.code || null,
      };

      const resp = await fetch(`${backend}/payments/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await resp.json();
      if (!resp.ok || !body.ok) return alert('Tạo đơn hàng thất bại: ' + (body.error || JSON.stringify(body)));

      // If gateway returned a redirect URL (PayPal etc.), go there.
      if (body.payment_url) {
        window.location.href = body.payment_url;
        return;
      }

      // For simulate / cod, redirect to success
      if (paymentMethod === 'cod' || paymentMethod === 'simulate') {
        navigate('/checkout/success');
        return;
      }

      alert('Đã tạo đơn hàng. Chuyển hướng tới nhà cung cấp...');
    } catch (e: any) {
      console.error('place order error', e);
      alert('Lỗi khi tạo đơn: ' + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="container mx-auto px-4 py-10">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-3xl font-extrabold mb-6">Thanh toán — Xác nhận đơn hàng</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="p-4 border rounded-lg shadow-sm bg-gray-50">
              <h2 className="text-lg font-semibold mb-3">Thông tin giao hàng</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input className="col-span-2 border px-3 py-2 rounded" placeholder="Họ tên" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <input className="border px-3 py-2 rounded" placeholder="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <textarea className="w-full mt-3 border px-3 py-2 rounded" placeholder="Địa chỉ giao hàng" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>

            <div className="p-4 border rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold mb-3">Sản phẩm</h2>
              <div className="space-y-3">
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded hover:shadow-sm transition">
                    <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                      {it.image ? <img src={it.image} alt="product" className="w-full h-full object-cover" /> : <div className="text-sm text-gray-400">No image</div>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">{it.product_name || `Sản phẩm ${it.product_id}`}</div>
                        {it.product_label ? <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">{it.product_label}</span> : null}
                      </div>
                      <div className="text-sm text-gray-500">Số lượng: {it.quantity} {it.size ? `· Kích cỡ: ${it.size}` : ''}</div>
                      {typeof it.stock !== 'undefined' ? <div className="text-xs text-gray-400">Còn trong kho: {it.stock}</div> : null}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatVnd((it.unit_price || 0) * (it.quantity || 1))}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border rounded-lg shadow-sm bg-gray-50">
              <h2 className="text-lg font-semibold mb-3">Phương thức thanh toán</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {providers.paypal ? (
                  <button onClick={() => setPaymentMethod('paypal')} className={`p-3 rounded-lg border ${paymentMethod==='paypal' ? 'border-blue-600 bg-blue-50' : 'hover:shadow'}`}>
                    <div className="font-medium">💳 PayPal</div>
                    <div className="text-sm text-gray-500">Thanh toán qua PayPal (Sandbox)</div>
                  </button>
                ) : null}

                {providers.momo ? (
                  <button onClick={() => setPaymentMethod('momo')} className={`p-3 rounded-lg border ${paymentMethod==='momo' ? 'border-pink-600 bg-pink-50' : 'hover:shadow'}`}>
                    <div className="font-medium">📱 Momo</div>
                    <div className="text-sm text-gray-500">Ví điện tử Momo</div>
                  </button>
                ) : null}

                {providers.vnpay ? (
                  <button onClick={() => setPaymentMethod('vnpay')} className={`p-3 rounded-lg border ${paymentMethod==='vnpay' ? 'border-red-600 bg-red-50' : 'hover:shadow'}`}>
                    <div className="font-medium">🏦 VNPay</div>
                    <div className="text-sm text-gray-500">Ngân hàng nội địa</div>
                  </button>
                ) : null}

                <button onClick={() => setPaymentMethod('cod')} className={`p-3 rounded-lg border ${paymentMethod==='cod' ? 'border-green-600 bg-green-50' : 'hover:shadow'}`}>
                  <div className="font-medium">📦 COD</div>
                  <div className="text-sm text-gray-500">Thanh toán khi nhận hàng</div>
                </button>

                <button onClick={() => setPaymentMethod('simulate')} className={`p-3 rounded-lg border ${paymentMethod==='simulate' ? 'border-gray-800 bg-gray-100' : 'hover:shadow'}`}>
                  <div className="font-medium">🧪 Mock</div>
                  <div className="text-sm text-gray-500">Dùng cho kiểm thử</div>
                </button>
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4">
            <div className="sticky top-24 p-4 border rounded-lg shadow-md">
              <h3 className="font-semibold text-lg mb-4">Tóm tắt đơn hàng</h3>
              <div className="space-y-2 mb-4">
                {items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-sm text-gray-700">
                    <div className="truncate pr-2">{it.product_name || `Sản phẩm ${it.product_id}`} x{it.quantity}</div>
                    <div className="font-semibold">{formatVnd((it.unit_price || 0) * (it.quantity || 1))}</div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-gray-600 text-sm mb-1"><div>Tạm tính</div><div>{formatVnd(subtotal)}</div></div>
              <div className="flex justify-between text-gray-600 text-sm mb-3"><div>Giảm</div><div>-{formatVnd(discount || 0)}</div></div>
              <div className="flex justify-between font-black text-lg mb-4"><div>Tổng</div><div>{formatVnd(total)}</div></div>

              <button disabled={loading} onClick={handlePlaceOrder} className={`w-full py-3 rounded-lg font-bold text-white ${loading ? 'bg-gray-400' : 'bg-black hover:bg-orange-500'}`}>
                {loading ? 'Đang xử lý...' : paymentMethod === 'paypal' ? 'Thanh toán bằng PayPal' : 'Hoàn tất thanh toán'}
              </button>

              <div className="text-xs text-gray-400 mt-3">Bằng cách tiếp tục, bạn đồng ý với Điều khoản & Chính sách hoàn trả của cửa hàng.</div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
