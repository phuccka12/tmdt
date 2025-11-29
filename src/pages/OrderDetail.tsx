import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import SupportModal from '../components/SupportModal';

const formatVnd = (n: number) => n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }).replace('₫', 'đ');

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSupport, setShowSupport] = useState(false);

  // If the OrdersPage navigated here with state.order, use it to avoid unnecessary backend fetches
  useEffect(() => {
    const stateOrder = (location && (location as any).state && (location as any).state.order) || null;
    console.debug('[OrderDetail] location.state.order =', stateOrder);
    if (stateOrder) {
      setOrder(stateOrder);
      setLoading(false);
    }
  }, [location]);

  const fetchOrder = async () => {
    // If we already have an order from navigation state, skip fetching
    if (order) {
      console.debug('[OrderDetail] have order from state; skipping backend fetch for id', id);
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth?redirect=' + window.location.pathname);
        return;
      }
      const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
      const resp = await fetch(`${backend}/payments/orders/${id}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!resp.ok) {
        const b = await resp.json().catch(() => ({}));
        console.error('[OrderDetail] fetch order failed', b);
        return;
      }
      const body = await resp.json();
      setOrder(body.order || null);
    } catch (e) {
      console.error('OrderDetail fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrder(); }, [id]);

  if (loading) return <div className="p-6">Đang tải...</div>;
  if (!order) return <div className="p-6">Không tìm thấy đơn hàng</div>;

  return (
    <section className="container mx-auto px-4 py-8">
      <div className="bg-white border rounded p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Đơn hàng #{order.id}</h2>
          <span className={`px-3 py-1 rounded-full text-sm ${order.status === 'paid' ? 'bg-green-100 text-green-800' : order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{order.status}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            {(order.order_items || []).map((it: any) => (
              <div key={it.id} className="flex items-center gap-4 mb-4">
                <div className="w-20 h-20 bg-gray-100 rounded overflow-hidden">
                  {it.products?.image ? <img src={it.products.image} alt={it.products.name} className="w-full h-full object-cover" /> : <div className="text-xs p-2 text-gray-400">No image</div>}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{it.products?.name || 'Sản phẩm'}</div>
                  <div className="text-sm text-gray-500">Số lượng: {it.quantity}</div>
                </div>
                <div className="font-semibold">{formatVnd(Number(it.unit_price || 0) * Number(it.quantity || 1))}</div>
              </div>
            ))}
          </div>

          <aside className="md:col-span-1 border-l pl-4">
            <div className="mb-2 text-sm text-gray-600">Tổng</div>
            <div className="text-xl font-black mb-3">{formatVnd(Number(order.total || 0))}</div>
            <div className="text-sm text-gray-600 mb-2">Địa chỉ</div>
            <div className="text-sm mb-3">{order.address || '—'} • {order.phone || ''}</div>
            <div className="flex gap-2">
              <button onClick={() => setShowSupport(true)} className="px-3 py-2 rounded border">Hỗ trợ</button>
              <button onClick={() => navigate('/orders')} className="px-3 py-2 rounded bg-black text-white">Quay lại</button>
            </div>
          </aside>
        </div>
      </div>

      {showSupport && <SupportModal orderId={Number(id)} onClose={() => setShowSupport(false)} onSubmitted={fetchOrder} />}
    </section>
  );
}
