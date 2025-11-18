import React, { useEffect, useState } from 'react';
import { Users, Box, BarChart2, Zap, Clock } from 'lucide-react';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
const adminApiKey = import.meta.env.VITE_ADMIN_API_KEY || '';

const headersWithKey = () => ({
  'Content-Type': 'application/json',
  ...(adminApiKey ? { 'x-admin-api-key': adminApiKey } : {}),
});

const Overview: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [profilesCount, setProfilesCount] = useState<number | null>(null);
  const [productsCount, setProductsCount] = useState<number | null>(null);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      if (!adminApiKey) {
        setLoading(false);
        return;
      }

      try {
        const [profilesResp, productsResp, webhooksResp, reportResp, ordersResp] = await Promise.all([
          fetch(`${backendUrl}/admin/profiles`, { headers: headersWithKey() }),
          fetch(`${backendUrl}/admin/products`, { headers: headersWithKey() }),
          fetch(`${backendUrl}/admin/webhooks?limit=5`, { headers: headersWithKey() }),
          fetch(`${backendUrl}/admin/reports/monthly`, { headers: headersWithKey() }),
          fetch(`${backendUrl}/admin/orders?limit=5`, { headers: headersWithKey() }),
        ]);

        const profilesJson = profilesResp.ok ? await profilesResp.json() : null;
        const productsJson = productsResp.ok ? await productsResp.json() : null;
        const webhooksJson = webhooksResp.ok ? await webhooksResp.json() : null;
  const reportJson = reportResp.ok ? await reportResp.json() : null;
  const ordersJson = ordersResp.ok ? await ordersResp.json() : null;

        if (!mounted) return;
        setProfilesCount(Array.isArray(profilesJson?.data) ? profilesJson.data.length : (profilesJson?.data ? profilesJson.data.length : (Array.isArray(profilesJson) ? profilesJson.length : null)));
        setProductsCount(Array.isArray(productsJson?.data) ? productsJson.data.length : (productsJson?.data ? productsJson.data.length : (Array.isArray(productsJson) ? productsJson.length : null)));
        setWebhooks((webhooksJson && webhooksJson.data) ? webhooksJson.data : (Array.isArray(webhooksJson) ? webhooksJson : []));
        setReport(reportJson);
        // attach some recent orders for overview
        if (ordersJson && ordersJson.data) {
          // orders data shape from backend
          setRecentOrders(ordersJson.data || []);
        }
      } catch (e) {
        console.error('Error loading admin overview', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Tổng quan hệ thống</h2>
          <p className="text-sm text-gray-500 mt-1">Tóm tắt nhanh các số liệu chính và các sự kiện gần đây.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50"
          >
            Làm mới
          </button>
          <button
            disabled={!adminApiKey}
            title={!adminApiKey ? 'VITE_ADMIN_API_KEY chưa cấu hình' : ''}
            className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg shadow-sm disabled:opacity-50"
          >
            Mở quản trị
          </button>
        </div>
      </div>

      {!adminApiKey && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">VITE_ADMIN_API_KEY chưa cấu hình — nhiều chức năng admin sẽ không hoạt động trong môi trường này.</div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Đang tải dữ liệu...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="p-6 rounded-xl shadow-md bg-gradient-to-br from-indigo-600 to-indigo-500 text-white flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <Users size={28} />
              </div>
              <div>
                <div className="text-sm opacity-90">Người dùng</div>
                <div className="text-2xl font-bold mt-1">{profilesCount !== null ? profilesCount : '—'}</div>
              </div>
            </div>

            <div className="p-6 rounded-xl shadow-md bg-gradient-to-br from-green-600 to-green-500 text-white flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <Box size={28} />
              </div>
              <div>
                <div className="text-sm opacity-90">Sản phẩm</div>
                <div className="text-2xl font-bold mt-1">{productsCount !== null ? productsCount : '—'}</div>
              </div>
            </div>

            <div className="p-6 rounded-xl shadow-md bg-gradient-to-br from-yellow-500 to-yellow-400 text-white flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <BarChart2 size={28} />
              </div>
              <div>
                <div className="text-sm opacity-90">Doanh thu (tháng này)</div>
                <div className="text-2xl font-bold mt-1">{report?.totals?.revenue ? Number(report.totals.revenue).toLocaleString('vi-VN') + '₫' : '—'}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">5 webhook gần nhất</h3>
                <span className="text-xs text-gray-500">Mới nhất ở trên</span>
              </div>
              {webhooks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Không có webhook gần đây</div>
              ) : (
                <ul className="divide-y">
                  {webhooks.map((w:any) => (
                    <li key={w.id} className="py-3 flex items-start justify-between">
                      <div>
                        <div className="font-medium">{w.event_type || w.provider || 'webhook'}</div>
                        <div className="text-xs text-gray-500">{new Date(w.created_at).toLocaleString()}</div>
                      </div>
                      <div className="text-sm">
                        {w.verified ? <span className="inline-flex items-center text-green-600">✔️ Verified</span> : <span className="text-red-500">✖️ Unverified</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold mb-3">Ghi chú nhanh</h3>
              <div className="text-sm text-gray-600 mb-4">Sử dụng các tab phía trên để quản lý tài khoản, sản phẩm, xem báo cáo chi tiết hoặc xử lý webhook. Đây là nơi để đặt các thông tin vận hành nhanh.</div>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-3 p-3 border rounded-md">
                  <Zap className="text-indigo-500" />
                  <div>
                    <div className="text-sm font-medium">Kiểm tra khóa admin</div>
                    <div className="text-xs text-gray-500">VITE_ADMIN_API_KEY: {adminApiKey ? <span className="font-mono">••••••••</span> : <span className="text-red-500">chưa cấu hình</span>}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 border rounded-md">
                  <Clock className="text-indigo-500" />
                  <div>
                    <div className="text-sm font-medium">Hướng dẫn nhanh</div>
                    <div className="text-xs text-gray-500">Nếu số liệu không đúng, kiểm tra môi trường backend và khởi động lại dịch vụ.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">5 đơn hàng gần nhất</h3>
              <span className="text-xs text-gray-500">Mới nhất ở trên</span>
            </div>
            {recentOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Không có đơn hàng gần đây</div>
            ) : (
              <ul className="divide-y">
                {recentOrders.map((o: any) => (
                  <li key={o.id} className="py-3 flex items-start justify-between">
                    <div>
                      <div className="font-medium">Đơn hàng #{o.id} — {o.status || 'chưa cập nhật'}</div>
                      <div className="text-xs text-gray-500">{o.profile ? (o.profile.email || o.profile.id) : 'không có thông tin người dùng'}</div>
                    </div>
                    <div className="text-sm text-gray-600">{o.total ? Number(o.total).toLocaleString('vi-VN') + '₫' : '—'}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Overview;
 