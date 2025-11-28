import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { ArrowRight, RefreshCw } from 'lucide-react';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
const adminApiKey = import.meta.env.VITE_ADMIN_API_KEY || '';

const headersWithKey = () => ({
  'Content-Type': 'application/json',
  ...(adminApiKey ? { 'x-admin-api-key': adminApiKey } : {}),
});

const statusOptions = ['pending', 'paid', 'processing', 'shipped', 'cancelled', 'refunded'];

const OrdersAdmin: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // when opening an order, enrich its items with product image/name if available
  useEffect(() => {
    (async () => {
      if (!selectedOrder) return;
      const items = selectedOrder.order_items || [];
      const productIds = Array.from(new Set(items.map((it:any) => it.product_id).filter(Boolean)));
      if (productIds.length === 0) return;
      try {
        const { data: products, error } = await supabase.from('products').select('id, name, image').in('id', productIds as any[]);
        if (error) return;
        const map: Record<number, any> = {};
        for (const p of products || []) map[p.id] = p;
        const updatedItems = items.map((it:any) => ({ ...it, product_name: map[it.product_id]?.name || it.product_name, image: map[it.product_id]?.image || it.image }));
        setSelectedOrder((s:any) => s ? { ...s, order_items: updatedItems } : s);
      } catch (e) {
        // ignore enrichment errors
      }
    })();
  }, [selectedOrder]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchOrders = async () => {
    if (!adminApiKey) {
      setError('VITE_ADMIN_API_KEY chưa cấu hình');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/admin/orders?limit=200`, { headers: headersWithKey() });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setOrders(Array.isArray(json.data) ? json.data : []);
    } catch (e:any) {
      setError(e && e.message ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const updateOrder = async (id: number, patch: any) => {
    if (!adminApiKey) return setError('Admin key missing');
    setSavingId(id);
    try {
      const res = await fetch(`${backendUrl}/admin/orders/${id}`, {
        method: 'PUT',
        headers: headersWithKey(),
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      // merge returned data (supabase returns updated rows array in data)
      const updated = Array.isArray(json.data) && json.data[0] ? json.data[0] : null;
      setOrders(prev => prev.map(o => (o.id === id && updated ? updated : o)));
    } catch (e:any) {
      setError(e && e.message ? e.message : String(e));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Quản lý đơn hàng</h2>
        <div className="flex items-center gap-3">
          <button onClick={fetchOrders} className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded-md">
            <RefreshCw size={16} /> Làm mới
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">Lỗi: {error}</div>}

      <div className="overflow-x-auto bg-white rounded-md shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Người mua</th>
              <th className="p-3 text-left">Trạng thái</th>
              <th className="p-3 text-right">Tổng</th>
              <th className="p-3 text-left">Ngày đặt</th>
              <th className="p-3 text-left">Hành động</th>
            </tr>
          </thead>
          <tbody>
              {loading ? (
              <tr><td colSpan={6} className="p-6 text-center">Đang tải...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">Không có đơn hàng</td></tr>
            ) : (
              orders.map(o => (
                <tr key={o.id} className="border-t">
                  <td className="p-3">#{o.id}</td>
                  <td className="p-3">{o.profile ? (o.profile.email || o.profile.full_name || o.user_id) : (o.user_id || '—')}</td>
                  <td className="p-3">
                    <select
                      value={o.status || 'pending'}
                      onChange={(e) => setOrders(prev => prev.map(p => p.id === o.id ? { ...p, status: e.target.value } : p))}
                      className="border px-2 py-1 rounded"
                    >
                      {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-right">{o.total ? Number(o.total).toLocaleString('vi-VN') + '₫' : '—'}</td>
                  <td className="p-3">{o.created_at ? new Date(o.created_at).toLocaleString() : '—'}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => updateOrder(o.id, { status: o.status })}
                        disabled={savingId === o.id}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white rounded disabled:opacity-60"
                      >
                        Lưu
                      </button>
                      <button
                        onClick={() => updateOrder(o.id, { processed: !o.processed })}
                        disabled={savingId === o.id}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded"
                      >
                        {o.processed ? 'Đã xử lý' : 'Đánh dấu đã xử lý'}
                      </button>
                      {/* COD delivery confirmation button - marks order as paid */}
                      {o.status === 'pending' && (
                        <button
                          onClick={() => {
                            if (confirm('Xác nhận đã giao hàng và thu tiền COD?')) {
                              updateOrder(o.id, { status: 'paid', processed: true });
                            }
                          }}
                          disabled={savingId === o.id}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded disabled:opacity-60 text-sm"
                        >
                          ✓ Giao hàng COD
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedOrder(o)}
                        className="text-gray-500 hover:text-gray-700 inline-flex items-center gap-2"
                      >
                        <ArrowRight size={14} /> Xem
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedOrder(null)} />
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 z-10">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold">Đơn hàng #{selectedOrder.id}</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-500">Đóng</button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Khách hàng</div>
                <div className="font-medium">{selectedOrder.profile ? (selectedOrder.profile.full_name || selectedOrder.profile.email) : (selectedOrder.user_id || '—')}</div>
                {selectedOrder.profile?.email && <div className="text-xs text-gray-500">{selectedOrder.profile.email}</div>}
                {selectedOrder.phone && <div className="text-xs text-gray-500 mt-1">SĐT: {selectedOrder.phone}</div>}
                {selectedOrder.address && <div className="text-xs text-gray-500 mt-1 break-words">Địa chỉ: {selectedOrder.address}</div>}
              </div>
              <div>
                <div className="text-sm text-gray-600">Tổng</div>
                <div className="font-medium">{selectedOrder.total ? Number(selectedOrder.total).toLocaleString('vi-VN') + '₫' : '—'}</div>
                <div className="text-xs text-gray-500">{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString() : '—'}</div>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="font-semibold">Sản phẩm</h4>
              <ul className="mt-2 divide-y">
                {(selectedOrder.order_items || []).map((it:any) => (
                  <li key={it.id} className="py-2 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                        {it.image ? <img src={it.image} alt={it.product_name || `#${it.product_id}`} className="w-full h-full object-cover" /> : <div className="text-xs text-gray-400">No image</div>}
                      </div>
                      <div>
                        <div className="font-medium">{it.product_name || `Sản phẩm ${it.product_id}`}</div>
                        <div className="text-xs text-gray-500">Số lượng: {it.quantity}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-700">{it.unit_price ? Number(it.unit_price).toLocaleString('vi-VN') + '₫' : '—'}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersAdmin;
