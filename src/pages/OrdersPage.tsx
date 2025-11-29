import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import SupportModal from '../components/SupportModal';
import OrderSummaryModal from '../components/OrderSummaryModal';

const formatVnd = (n: number) => n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }).replace('₫', 'đ');

export default function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [supportOrderId, setSupportOrderId] = useState<number | null>(null);
  const [summaryOrder, setSummaryOrder] = useState<any | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        navigate('/auth?redirect=/orders');
        return;
      }

      // Fetch orders and nested order_items with product info
      const { data, error } = await supabase
        .from('orders')
        .select(`id, total, status, address, phone, created_at, processed, cancelled_at, order_items(id, quantity, unit_price, product:products(id, name, image)), payments(id, provider, amount, status, created_at)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch orders', error);
      } else {
        setOrders(data || []);
      }
    } catch (e) {
      console.error('orders page error', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
    setCancelling(orderId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Vui lòng đăng nhập lại');
        return;
      }

      const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
      const resp = await fetch(`${backend}/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reason: 'Khách hàng yêu cầu hủy' }),
      });

      const body = await resp.json();
      if (!resp.ok) {
        alert('Hủy đơn thất bại: ' + (body.error || body.reason || 'Unknown error'));
        return;
      }

      alert('Đã hủy đơn hàng thành công');
      fetchOrders();
    } catch (e: any) {
      console.error('Cancel order error', e);
      alert('Lỗi: ' + (e?.message || String(e)));
    } finally {
      setCancelling(null);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <>
    <section className="container mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Đơn hàng của tôi</h1>

      {loading ? (
        <div>Đang tải đơn hàng...</div>
      ) : orders.length === 0 ? (
        <div className="p-6 bg-white border rounded">Bạn chưa có đơn hàng nào.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="bg-white border rounded p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">Mã đơn #{o.id} • {new Date(o.created_at).toLocaleString()}</div>
                <div>
                  <span className={`px-3 py-1 rounded-full text-sm ${o.status === 'paid' ? 'bg-green-100 text-green-800' : o.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{o.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <div className="space-y-2">
                    {(o.order_items || []).map((it: any) => (
                      <div key={it.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
                        <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden">
                          {it.product?.image ? <img src={it.product.image} alt={it.product.name} className="w-full h-full object-cover" /> : <div className="text-xs text-gray-400 p-2">No image</div>}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{it.product?.name || 'Sản phẩm'}</div>
                          <div className="text-sm text-gray-500">Số lượng: {it.quantity}</div>
                        </div>
                        <div className="text-right font-semibold">{formatVnd(Number(it.unit_price || 0) * Number(it.quantity || 1))}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <aside className="md:col-span-1 border-l pl-4">
                  <div className="mb-2 text-sm text-gray-600">Tổng</div>
                  <div className="text-xl font-black mb-3">{formatVnd(Number(o.total || 0))}</div>
                  <div className="text-sm text-gray-600 mb-2">Địa chỉ</div>
                  <div className="text-sm mb-3">{o.address || '—'} • {o.phone || ''}</div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button onClick={() => setSummaryOrder(o)} className="px-3 py-2 rounded bg-black text-white text-sm">Chi tiết</button>
                      <button onClick={() => setSupportOrderId(o.id)} className="px-3 py-2 rounded border text-sm">Hỗ trợ</button>
                    </div>
                    {/* Show cancel button only if order is cancelable (pending and not processed) */}
                    {o.status === 'pending' && !o.processed && !o.cancelled_at && (
                      <button
                        onClick={() => handleCancelOrder(o.id)}
                        disabled={cancelling === o.id}
                        className="px-3 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
                      >
                        {cancelling === o.id ? 'Đang hủy...' : 'Hủy đơn'}
                      </button>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
    {supportOrderId && (
      <SupportModal orderId={supportOrderId as number} onClose={() => setSupportOrderId(null)} onSubmitted={() => fetchOrders()} />
    )}
    {summaryOrder && (
      <OrderSummaryModal order={summaryOrder} onClose={() => setSummaryOrder(null)} />
    )}
    </>
  );
}
