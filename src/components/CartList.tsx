import React from 'react';
import CartRow from './CartRow';

type Row = {
  id: number;
  quantity: number;
  variant: any;
};

export default function CartList({
  rows,
  selectedIds,
  onToggleSelect,
  onUpdateQty,
  onRemove,
  onSelectAll,
  onClearSelection,
}: {
  rows: Row[];
  selectedIds: number[];
  onToggleSelect: (id: number, next: boolean) => void;
  onUpdateQty: (id: number, next: number) => void;
  onRemove: (id: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}) {
  return (
    <div className="lg:col-span-2 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onSelectAll} className="text-sm px-3 py-1 rounded-lg border bg-gray-50 hover:bg-gray-100">
            Chọn tất cả
          </button>
          <button type="button" onClick={onClearSelection} className="text-sm px-3 py-1 rounded-lg border bg-gray-50 hover:bg-gray-100">
            Bỏ chọn tất cả
          </button>
          <div className="text-sm text-gray-600">Đã chọn: <span className="font-semibold">{selectedIds.length}</span></div>
        </div>
      </div>

      {rows.map((r) => (
        <CartRow
          key={r.id}
          r={r}
          checked={selectedIds.includes(r.id)}
          onToggle={onToggleSelect}
          onUpdateQty={onUpdateQty}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
