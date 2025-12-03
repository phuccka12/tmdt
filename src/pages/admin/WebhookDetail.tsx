import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

interface WebhookDetail {
  id: number;
  provider: string;
  event_type: string;
  provider_event_id?: string;
  headers: any;
  raw_payload: any;
  verified: boolean;
  processed: boolean;
  processing_error?: string;
  created_at: string;
}

const WebhookDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [log, setLog] = useState<WebhookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const adminKey = localStorage.getItem('admin_api_key') || prompt('Enter ADMIN_API_KEY:');
      if (!adminKey) return;
      localStorage.setItem('admin_api_key', adminKey);

      const res = await fetch(`http://localhost:54321/admin/webhooks/${id}`, {
        headers: { 'x-admin-api-key': adminKey },
      });
  const payload = await res.json();
  // support { log: {...} } or { data: {...} } or { data: [...] }
  let logObj = payload?.log || payload?.data || null;
  if (Array.isArray(logObj)) logObj = logObj[0] || null;
  // if payload itself is the log object
  if (!logObj && payload && payload.id) logObj = payload;
  if (logObj) setLog(logObj as any);
    } catch (err) {
      console.error('Failed to fetch webhook detail', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="container mx-auto px-4 py-8">Đang tải...</div>;
  if (!log) return <div className="container mx-auto px-4 py-8">Không tìm thấy bản ghi webhook.</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to="/admin" className="text-blue-600 hover:underline">← Quay lại danh sách webhook</Link>
      </div>

      <h1 className="text-3xl font-black mb-6">Webhook Log #{log.id}</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Nhà cung cấp</p>
            <p className="font-semibold capitalize">{log.provider}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Loại sự kiện</p>
            <p className="font-semibold">{log.event_type}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Mã sự kiện</p>
            <p className="font-semibold">{log.provider_event_id || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Tạo lúc</p>
            <p className="font-semibold">{new Date(log.created_at).toLocaleString('vi-VN')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Đã xác minh</p>
            <div className="flex items-center gap-3">
              <p className={`font-semibold ${log.verified ? 'text-green-600' : 'text-red-600'}`}>
                {log.verified ? '✓ Có' : '✗ Không'}
              </p>
              {!log.verified && (
                <button
                  className="bg-blue-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50"
                  onClick={async () => {
                    if (!id) return;
                    const confirmOk = window.confirm('Đánh dấu bản ghi này là đã xác minh?');
                    if (!confirmOk) return;
                    try {
                      setVerifying(true);
                      const adminKey = localStorage.getItem('admin_api_key') || prompt('Enter ADMIN_API_KEY:');
                      if (!adminKey) return;
                      localStorage.setItem('admin_api_key', adminKey);
                      const res = await fetch(`http://localhost:54321/admin/webhooks/${id}/verify`, {
                        method: 'POST',
                        headers: { 'x-admin-api-key': adminKey, 'content-type': 'application/json' },
                      });
                      const body = await res.json();
                      if (!res.ok) {
                        alert('Không thể đánh dấu đã xác minh: ' + (body && body.error ? body.error : res.statusText));
                      } else {
                        // update UI with returned updated object when available
                        const updated = body?.updated || body?.log || body?.data || null;
                        if (updated && updated.id) setLog(updated as any);
                        else {
                          // fallback: refetch
                          fetchDetail();
                        }
                      }
                    } catch (err) {
                      console.error('verify failed', err);
                      alert('Lỗi khi gửi yêu cầu xác minh');
                    } finally {
                      setVerifying(false);
                    }
                  }}
                  disabled={verifying}
                >
                  {verifying ? 'Đang xác minh...' : 'Đánh dấu đã xác minh'}
                </button>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600">Đã xử lý</p>
            <p className={`font-semibold ${log.processed ? 'text-green-600' : 'text-yellow-600'}`}>
              {log.processed ? '✓ Đã xử lý' : '⏳ Chưa xử lý'}
            </p>
          </div>
          {/* inferred user info (from backend enrichment) */}
          <div>
            <p className="text-sm text-gray-600">Người gửi</p>
            <p className="font-semibold">
              {(() => {
                const inferred = (log as any)._inferred;
                const user = inferred && inferred.user ? inferred.user : null;
                if (user) return user.email || user.full_name || user.id;
                try {
                  let raw: any = (log as any).raw_payload || {};
                  if (typeof raw === 'string') {
                    try { raw = JSON.parse(raw); } catch (e) { /* keep as string */ }
                  }
                  // support: raw may include sender object (newly added) - prefer email
                  if (raw && raw.sender && (raw.sender.email || raw.sender.full_name)) return raw.sender.email || raw.sender.full_name;
                  if (raw && raw.user && (raw.user.email || raw.user.full_name)) return raw.user.email || raw.user.full_name;
                  if (raw && raw.resource && raw.resource.payer && raw.resource.payer.email_address) return raw.resource.payer.email_address;
                  if (raw && raw.user_id) return raw.user_id;
                } catch (e) {}
                return '-';
              })()}
            </p>
          </div>
        </div>

        {log.processing_error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-gray-600 mb-1">Lỗi xử lý</p>
            <p className="text-red-700 font-mono text-sm">{log.processing_error}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Headers</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
          {JSON.stringify(log.headers, null, 2)}
        </pre>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Payload thô</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
          {JSON.stringify(log.raw_payload, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default WebhookDetail;
