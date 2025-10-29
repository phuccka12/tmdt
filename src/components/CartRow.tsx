import React from 'react';
import { Minus, Plus, Trash2, AlertTriangle } from 'lucide-react';

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
  return Number(s.replace(/[^\d]/g, '')) || 0;
};

const formatVnd = (n: number) =>
  n
    .toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })
    .replace('₫', 'đ');

export default function CartRow({
  r,
  checked,
  onToggle,
  onUpdateQty,
  onRemove,
}: {
  r: Row;
  checked: boolean;
  onToggle: (id: number, next: boolean) => void;
  onUpdateQty: (id: number, next: number) => void;
  onRemove: (id: number) => void;
}) {
  const p = r.variant?.product;
  const unit = r.variant?.price_vnd ?? parseVnd(p?.price);
  const outOfStock = (r.variant?.stock ?? 0) <= 0;
  const overStock = r.quantity > (r.variant?.stock ?? 0);

  return (
    <div className="group relative flex items-center gap-4 p-4 border rounded-2xl hover:shadow-sm transition">
      <div className="flex-shrink-0">
        <input
          type="checkbox"
          aria-label={`Chọn sản phẩm ${p?.name || r.id}`}
          checked={checked}
          onChange={(e) => onToggle(r.id, e.target.checked)}
          className="w-4 h-4"
        />
      </div>

      <a
        href={p ? `/product/${p.id}` : '#'}
        className="shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-gray-50"
        aria-label={p?.name || 'Sản phẩm'}
      >
        {p?.image ? (
          <img src={p.image} alt={p?.name || ''} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center bg-gray-50 text-gray-400">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 3h18v18H3z" />
            </svg>
          </div>
        )}
      </a>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <a href={p ? `/product/${p.id}` : '#'} className="font-semibold hover:text-orange-500 line-clamp-1" title={p?.name || 'Sản phẩm'}>
            {p?.name || 'Sản phẩm'}
          </a>

          <button onClick={() => onRemove(r.id)} className="text-red-500/70 hover:text-red-600 p-2 rounded-lg hover:bg-red-50" type="button" title="Xoá" aria-label="Xoá khỏi giỏ">
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
            <span className={`font-medium ${outOfStock ? 'text-red-600' : 'text-gray-700'}`}>{r.variant?.stock ?? 0}</span>
          </span>
          {overStock ? (
            <span className="inline-flex items-center gap-1 text-red-600">
              <AlertTriangle className="w-4 h-4" /> Vượt quá tồn kho
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center border rounded-xl overflow-hidden">
            <button onClick={() => onUpdateQty(r.id, r.quantity - 1)} className="px-3 py-2 hover:bg-gray-50 disabled:opacity-40" type="button" aria-label="Giảm số lượng" disabled={r.quantity <= 1}>
              <Minus className="w-4 h-4" />
            </button>
            <span className="px-4 py-2 min-w-[40px] text-center font-medium" aria-live="polite">
              {r.quantity}
            </span>
            <button onClick={() => onUpdateQty(r.id, r.quantity + 1)} className="px-3 py-2 hover:bg-gray-50 disabled:opacity-40" type="button" aria-label="Tăng số lượng" disabled={outOfStock}>
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
}
