import React from 'react';
import SupportModal from './SupportModal';

type Props = {
  order: any;
  onClose: () => void;
};

export default function OrderSummaryModal({ order, onClose }: Props) {
  const [showSupport, setShowSupport] = React.useState(false);

  if (!order) return null;

  const formatVnd = (n: number) => n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }).replace('₫', 'đ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black opacity-40" onClick={onClose}></div>
      <div className="bg-white rounded shadow-lg max-w-xl w-full p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Chi tiết đơn #{order.id}</h3>
          <button onClick={onClose} className="text-gray-500">Đóng</button>
        </div>

        <div className="space-y-3">
          <div className="text-sm text-gray-600">Trạng thái: <strong>{order.status}</strong></div>
          <div className="text-sm text-gray-600">Tổng: <strong>{formatVnd(Number(order.total || 0))}</strong></div>
          <div className="text-sm text-gray-600">Địa chỉ: {order.address || '—'} • {order.phone || ''}</div>

          <div>
            <div className="text-sm text-gray-600 mb-2">Sản phẩm</div>
            <div className="divide-y">
              {(order.order_items || []).map((it: any) => (
                <div key={it.id} className="py-2 flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden">
                    {it.product?.image ? <img src={it.product.image} className="w-full h-full object-cover" alt="" /> : <div className="text-xs p-2 text-gray-400">No image</div>}
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{it.product?.name || it.products?.name || 'Sản phẩm'}</div>
                    <div className="text-xs text-gray-500">Số lượng: {it.quantity}</div>
                  </div>
                  <div className="text-sm font-semibold">{formatVnd(Number(it.unit_price || 0) * Number(it.quantity || 1))}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setShowSupport(true)} className="px-3 py-2 rounded border">Hỗ trợ</button>
          <button onClick={onClose} className="px-3 py-2 rounded bg-black text-white">Đóng</button>
        </div>

        {showSupport && <SupportModal orderId={order.id} onClose={() => setShowSupport(false)} onSubmitted={() => setShowSupport(false)} />}
      </div>
    </div>
  );
}
