import React, { useEffect, useState } from 'react';
import { Trash2, Edit2, Plus, Check, X } from 'lucide-react';

interface Coupon {
  id: number;
  code: string;
  type: 'fixed' | 'percent';
  amount: number;
  usage_limit: number | null;
  used_count: number;
  starts_at: string;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

const CouponsAdmin: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    code: '',
    type: 'fixed' as 'fixed' | 'percent',
    amount: 0,
    usage_limit: null as number | null,
    starts_at: new Date().toISOString().slice(0, 16),
    expires_at: '',
    active: true,
  });

  const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
  const adminApiKey = import.meta.env.VITE_ADMIN_API_KEY || '';

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${backend}/admin/coupons`, {
        headers: { 'x-admin-api-key': adminApiKey },
      });
      if (resp.ok) {
        const data = await resp.json();
        setCoupons(data.coupons || []);
      } else {
        alert('Không thể tải danh sách mã giảm giá');
      }
    } catch (e) {
      console.error('Fetch coupons error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const resetForm = () => {
    setFormData({
      code: '',
      type: 'fixed',
      amount: 0,
      usage_limit: null,
      starts_at: new Date().toISOString().slice(0, 16),
      expires_at: '',
      active: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      alert('Vui lòng nhập mã giảm giá');
      return;
    }
    if (formData.amount <= 0) {
      alert('Số tiền/phần trăm giảm phải lớn hơn 0');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        usage_limit: formData.usage_limit || null,
        expires_at: formData.expires_at || null,
      };

      const url = editingId ? `${backend}/admin/coupons/${editingId}` : `${backend}/admin/coupons`;
      const method = editingId ? 'PUT' : 'POST';

      const resp = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': adminApiKey,
        },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        alert(editingId ? 'Cập nhật mã thành công' : 'Tạo mã giảm giá thành công');
        resetForm();
        fetchCoupons();
      } else {
        const body = await resp.json();
        alert('Lỗi: ' + (body.error || body.message || 'Unknown error'));
      }
    } catch (e: any) {
      console.error('Submit coupon error', e);
      alert('Lỗi: ' + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (coupon: Coupon) => {
    setFormData({
      code: coupon.code,
      type: coupon.type,
      amount: coupon.amount,
      usage_limit: coupon.usage_limit,
      starts_at: coupon.starts_at ? new Date(coupon.starts_at).toISOString().slice(0, 16) : '',
      expires_at: coupon.expires_at ? new Date(coupon.expires_at).toISOString().slice(0, 16) : '',
      active: coupon.active,
    });
    setEditingId(coupon.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa mã giảm giá này?')) return;
    try {
      const resp = await fetch(`${backend}/admin/coupons/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-api-key': adminApiKey },
      });
      if (resp.ok) {
        alert('Đã xóa mã giảm giá');
        fetchCoupons();
      } else {
        alert('Không thể xóa mã giảm giá');
      }
    } catch (e) {
      console.error('Delete coupon error', e);
    }
  };

  const toggleActive = async (id: number, currentActive: boolean) => {
    try {
      const resp = await fetch(`${backend}/admin/coupons/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': adminApiKey,
        },
        body: JSON.stringify({ active: !currentActive }),
      });
      if (resp.ok) {
        fetchCoupons();
      }
    } catch (e) {
      console.error('Toggle active error', e);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Đang tải...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Quản lý mã giảm giá</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus size={16} />
          Tạo mã mới
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-lg mb-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">{editingId ? 'Sửa mã giảm giá' : 'Tạo mã giảm giá mới'}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Mã code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="VD: GIAM50K"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Loại giảm giá *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'fixed' | 'percent' })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="fixed">Giảm cố định (VNĐ)</option>
                <option value="percent">Giảm theo % (phần trăm)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Số tiền/phần trăm giảm * {formData.type === 'percent' && '(0-100)'}
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg"
                min="0"
                max={formData.type === 'percent' ? 100 : undefined}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Giới hạn số lần dùng (để trống = không giới hạn)</label>
              <input
                type="number"
                value={formData.usage_limit || ''}
                onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-3 py-2 border rounded-lg"
                min="0"
                placeholder="VD: 100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Ngày bắt đầu *</label>
              <input
                type="datetime-local"
                value={formData.starts_at}
                onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Ngày hết hạn (để trống = không hết hạn)</label>
              <input
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="active" className="text-sm font-medium">Kích hoạt mã ngay</label>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : (editingId ? 'Cập nhật' : 'Tạo mã')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="text-left p-3">Mã code</th>
              <th className="text-left p-3">Loại</th>
              <th className="text-left p-3">Giảm</th>
              <th className="text-left p-3">Đã dùng / Giới hạn</th>
              <th className="text-left p-3">Ngày bắt đầu</th>
              <th className="text-left p-3">Ngày hết hạn</th>
              <th className="text-left p-3">Trạng thái</th>
              <th className="text-left p-3">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-500">
                  Chưa có mã giảm giá nào
                </td>
              </tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-mono font-semibold">{c.code}</td>
                  <td className="p-3">{c.type === 'fixed' ? 'Cố định' : 'Phần trăm'}</td>
                  <td className="p-3">
                    {c.type === 'fixed' ? `${c.amount.toLocaleString()} VNĐ` : `${c.amount}%`}
                  </td>
                  <td className="p-3">
                    {c.used_count} / {c.usage_limit ?? '∞'}
                  </td>
                  <td className="p-3 text-sm">{new Date(c.starts_at).toLocaleString('vi-VN')}</td>
                  <td className="p-3 text-sm">
                    {c.expires_at ? new Date(c.expires_at).toLocaleString('vi-VN') : '—'}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleActive(c.id, c.active)}
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        c.active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {c.active ? 'Đang bật' : 'Đã tắt'}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(c)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Sửa"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Xóa"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CouponsAdmin;
