import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface WebhookLog {
  id: number;
  provider: string;
  event_type: string;
  provider_event_id?: string;
  verified: boolean;
  processed: boolean;
  processing_error?: string;
  created_at: string;
}

const WebhooksAdmin: React.FC = () => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      // Get ADMIN_API_KEY from localStorage or prompt
      const adminKey = localStorage.getItem('admin_api_key') || prompt('Enter ADMIN_API_KEY:');
      if (!adminKey) return;
      localStorage.setItem('admin_api_key', adminKey);

      const res = await fetch('http://localhost:54321/admin/webhooks', {
        headers: { 'x-admin-api-key': adminKey },
      });
  const payload = await res.json();
  // support multiple response shapes: { logs: [...] } or { data: [...] } or raw array
  const logsArr = payload?.logs || payload?.data || (Array.isArray(payload) ? payload : null) || [];
  setLogs(Array.isArray(logsArr) ? logsArr : []);
    } catch (err) {
      console.error('Failed to fetch webhook logs', err);
    } finally {
      setLoading(false);
    }
  };

  const reprocess = async (id: number) => {
    if (!confirm('Reprocess webhook log #' + id + '?')) return;
    try {
      const adminKey = localStorage.getItem('admin_api_key');
      const res = await fetch(`http://localhost:54321/admin/webhooks/${id}/reprocess`, {
        method: 'POST',
        headers: { 'x-admin-api-key': adminKey || '' },
      });
      const data = await res.json();
      alert(data.message || 'Reprocessed');
      fetchLogs();
    } catch (err) {
      alert('Reprocess failed');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Loading webhook logs...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-black">Nhật ký Webhook</h1>
        <button onClick={fetchLogs} className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800">
          Làm mới
        </button>
      </div>

      {logs.length === 0 ? (
        <p className="text-gray-600">Chưa có nhật ký webhook.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Nhà cung cấp</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Loại sự kiện</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Mã sự kiện</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Đã xác minh</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Đã xử lý</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Tạo lúc</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{log.id}</td>
                  <td className="px-4 py-3 capitalize">{log.provider}</td>
                  <td className="px-4 py-3 text-sm">{log.event_type}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{log.provider_event_id || '-'}</td>
                  <td className="px-4 py-3">
                    {log.verified ? (
                      <span className="text-green-600 font-semibold">✓ Có</span>
                    ) : (
                      <span className="text-red-600 font-semibold">✗ Không</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {log.processed ? (
                      <span className="text-green-600 font-semibold">✓ Đã xử lý</span>
                    ) : (
                      <span className="text-yellow-600 font-semibold">⏳ Chưa xử lý</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                  <td className="px-4 py-3 space-x-2">
                    <Link
                      to={`/admin/webhooks/${log.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Xem
                    </Link>
                    {!log.processed && (
                      <button
                        onClick={() => reprocess(log.id)}
                        className="text-orange-600 hover:underline text-sm"
                      >
                        Xử lý lại
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default WebhooksAdmin;
