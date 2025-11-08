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
      const data = await res.json();
      if (data.log) setLog(data.log);
    } catch (err) {
      console.error('Failed to fetch webhook detail', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="container mx-auto px-4 py-8">Loading...</div>;
  if (!log) return <div className="container mx-auto px-4 py-8">Webhook log not found.</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to="/admin/webhooks" className="text-blue-600 hover:underline">← Back to Webhooks</Link>
      </div>

      <h1 className="text-3xl font-black mb-6">Webhook Log #{log.id}</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Provider</p>
            <p className="font-semibold capitalize">{log.provider}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Event Type</p>
            <p className="font-semibold">{log.event_type}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Provider Event ID</p>
            <p className="font-semibold">{log.provider_event_id || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Created At</p>
            <p className="font-semibold">{new Date(log.created_at).toLocaleString('vi-VN')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Verified</p>
            <p className={`font-semibold ${log.verified ? 'text-green-600' : 'text-red-600'}`}>
              {log.verified ? '✓ Yes' : '✗ No'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Processed</p>
            <p className={`font-semibold ${log.processed ? 'text-green-600' : 'text-yellow-600'}`}>
              {log.processed ? '✓ Yes' : '⏳ Pending'}
            </p>
          </div>
        </div>

        {log.processing_error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-gray-600 mb-1">Processing Error</p>
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
        <h2 className="text-xl font-bold mb-4">Raw Payload</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
          {JSON.stringify(log.raw_payload, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default WebhookDetail;
