import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

type Props = {
  orderId: number;
  onClose: () => void;
  onSubmitted?: () => void;
};

export default function SupportModal({ orderId, onClose, onSubmitted }: Props) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!note || note.trim().length === 0) return alert('Vui lòng nhập nội dung hỗ trợ');
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Vui lòng đăng nhập để gửi hỗ trợ');
        return;
      }
      const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
      const resp = await fetch(`${backend}/payments/orders/${orderId}/support`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ note }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        alert('Gửi hỗ trợ thất bại: ' + (body.error || JSON.stringify(body)));
        return;
      }
      alert('Gửi hỗ trợ thành công. Chúng tôi sẽ phản hồi sớm.');
      setNote('');
      onSubmitted && onSubmitted();
      onClose();
    } catch (e: any) {
      console.error('support submit error', e);
      alert('Lỗi gửi hỗ trợ: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-lg rounded shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Hỗ trợ cho đơn #{orderId}</h3>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} className="w-full border p-2 rounded mb-3" placeholder="Mô tả vấn đề hoặc yêu cầu hỗ trợ..." />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded border">Đóng</button>
          <button onClick={submit} disabled={loading} className="px-3 py-2 rounded bg-black text-white">{loading ? 'Đang gửi...' : 'Gửi yêu cầu'}</button>
        </div>
      </div>
    </div>
  );
}
