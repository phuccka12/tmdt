import React, { useEffect, useMemo, useState } from 'react';

// If VITE_BACKEND_URL isn't provided, warn the user and fall back to a sensible dev default
// NOTE: it's safer to explicitly set VITE_BACKEND_URL in your .env. The fallback below is only
// for local development when the backend runs on localhost:54321 (the backend used in this repo).
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
const adminApiKey = import.meta.env.VITE_ADMIN_API_KEY || '';

const headersWithKey = () => ({
  'Content-Type': 'application/json',
  ...(adminApiKey ? { 'x-admin-api-key': adminApiKey } : {}),
});

type Product = { id: number; name: string; price?: any; image?: string; label?: string };
type Profile = { id: string; full_name?: string | null; email?: string | null; role?: string | null };

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button onClick={onClick} className={`px-4 py-2 rounded-t-lg ${active ? 'bg-white border-t border-l border-r text-gray-900' : 'text-gray-500 bg-gray-100'}`}>
    {children}
  </button>
);

const AdminDashboard: React.FC = () => {
  const [tab, setTab] = useState<'overview'|'accounts'|'products'|'reports'>('overview');

  // Profiles
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profileSearch, setProfileSearch] = useState('');

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [prodSearch, setProdSearch] = useState('');

  // Reports
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());

  // Do not fetch automatically on mount unless we have a backend URL configured.
  // The tab buttons will trigger fetching when the user navigates to products/accounts.
  useEffect(() => {
    if (!import.meta.env.VITE_BACKEND_URL) {
      // don't auto-fetch when the env variable is missing (avoids fetching dev server HTML)
      console.warn('[AdminDashboard] VITE_BACKEND_URL not set; using fallback', backendUrl);
      return;
    }
    // If user explicitly configured backend URL, it's OK to auto-load products on mount.
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const resp = await fetch(`${backendUrl}/admin/products`, { headers: headersWithKey() });
      const ct = resp.headers.get('content-type') || '';
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status} - ${text.slice(0,200)}`);
      }
      if (!ct.includes('application/json')) {
        const text = await resp.text();
        throw new Error('Expected JSON from backend but received: ' + text.slice(0,200));
      }
      const body = await resp.json();
      setProducts(body.data || []);
    } catch (e: any) {
      console.error('fetchProducts', e);
      alert('Không thể tải products: ' + (e.message || e));
    } finally { setProductsLoading(false); }
  };

  const fetchProfiles = async () => {
    setProfilesLoading(true);
    try {
      const resp = await fetch(`${backendUrl}/admin/profiles`, { headers: headersWithKey() });
      const ct = resp.headers.get('content-type') || '';
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status} - ${text.slice(0,200)}`);
      }
      if (!ct.includes('application/json')) {
        const text = await resp.text();
        throw new Error('Expected JSON from backend but received: ' + text.slice(0,200));
      }
      const body = await resp.json();
      setProfiles(body.data || []);
    } catch (e: any) {
      console.error('fetchProfiles', e);
      alert('Không thể tải profiles: ' + (e.message || e));
    } finally { setProfilesLoading(false); }
  };

  const changeRole = async (userId: string, role: string) => {
    if (!confirm(`Đổi role của ${userId} -> ${role}?`)) return;
    try {
      const resp = await fetch(`${backendUrl}/admin/set-role`, { method: 'POST', headers: headersWithKey(), body: JSON.stringify({ user_id: userId, role }) });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error || JSON.stringify(body));
      // refresh profiles
      await fetchProfiles();
      alert('Đã cập nhật role');
    } catch (e: any) {
      console.error('changeRole', e);
      alert('Thất bại: ' + (e.message || e));
    }
  };

  const deleteProduct = async (id: number) => {
    if (!confirm('Xác nhận xóa sản phẩm #' + id + ' ?')) return;
    try {
      const resp = await fetch(`${backendUrl}/admin/products/${id}`, { method: 'DELETE', headers: headersWithKey() });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error || JSON.stringify(body));
      setProducts(prev => prev.filter(p => p.id !== id));
      alert('Đã xóa');
    } catch (e: any) {
      console.error('deleteProduct', e);
      alert('Xóa thất bại: ' + (e.message || e));
    }
  };

  const createProduct = async (payload: Partial<Product>) => {
    try {
      const resp = await fetch(`${backendUrl}/admin/products`, { method: 'POST', headers: headersWithKey(), body: JSON.stringify(payload) });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error || JSON.stringify(body));
      // refresh list
      await fetchProducts();
      alert('Tạo thành công');
    } catch (e: any) {
      console.error('createProduct', e);
      alert('Tạo thất bại: ' + (e.message || e));
    }
  };

  const fetchReport = async () => {
    setReportLoading(true);
    try {
      const resp = await fetch(`${backendUrl}/admin/reports/monthly?year=${reportYear}&month=${reportMonth}`, { headers: headersWithKey() });
      const ct = resp.headers.get('content-type') || '';
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status} - ${text.slice(0,200)}`);
      }
      if (!ct.includes('application/json')) {
        const text = await resp.text();
        throw new Error('Expected JSON from backend but received: ' + text.slice(0,200));
      }
      const body = await resp.json();
      setReport(body);
    } catch (e: any) {
      console.error('fetchReport', e);
      alert('Không thể tải báo cáo: ' + (e.message || e));
    } finally { setReportLoading(false); }
  };

  const filteredProfiles = useMemo(() => {
    const q = profileSearch.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(p => (p.full_name||'').toLowerCase().includes(q) || (p.email||'').toLowerCase().includes(q) || p.id.includes(q));
  }, [profiles, profileSearch]);

  const filteredProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => String(p.id).includes(q) || (p.name||'').toLowerCase().includes(q));
  }, [products, prodSearch]);

  return (
    <div className="container mx-auto py-8">
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          {!adminApiKey && <div className="text-sm text-red-600">CẢNH BÁO: VITE_ADMIN_API_KEY chưa cấu hình — một số chức năng admin sẽ không hoạt động</div>}
        </div>

        <div className="px-4 pt-4">
          <div className="flex gap-2">
            <TabButton active={tab==='overview'} onClick={()=>setTab('overview')}>Tổng quan</TabButton>
            <TabButton active={tab==='accounts'} onClick={() => { setTab('accounts'); fetchProfiles(); }}>Tài khoản</TabButton>
            <TabButton active={tab==='products'} onClick={() => { setTab('products'); fetchProducts(); }}>Sản phẩm</TabButton>
            <TabButton active={tab==='reports'} onClick={() => { setTab('reports'); fetchReport(); }}>Báo cáo</TabButton>
          </div>

          <div className="p-6 bg-gray-50">
            {tab === 'overview' && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Tổng quan hệ thống</h2>
                <p className="text-sm text-gray-600">Sử dụng thanh điều hướng để quản lý tài khoản, sản phẩm và xem báo cáo doanh thu.</p>
              </div>
            )}

            {tab === 'accounts' && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <input value={profileSearch} onChange={e=>setProfileSearch(e.target.value)} placeholder="Tìm theo tên, email hoặc id" className="border rounded px-3 py-2 w-96" />
                </div>
                {profilesLoading ? <div>Đang tải...</div> : (
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto bg-white rounded shadow">
                      <thead>
                        <tr className="text-left bg-gray-100">
                          <th className="p-2">ID</th>
                          <th className="p-2">Tên</th>
                          <th className="p-2">Email</th>
                          <th className="p-2">Role</th>
                          <th className="p-2">Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProfiles.map(p => (
                          <tr key={p.id} className="border-t">
                            <td className="p-2 text-sm">{p.id}</td>
                            <td className="p-2">{p.full_name || '-'}</td>
                            <td className="p-2">{p.email || '-'}</td>
                            <td className="p-2">{p.role || 'user'}</td>
                            <td className="p-2">
                              <div className="flex gap-2">
                                <button onClick={() => changeRole(p.id, 'admin')} className="px-3 py-1 bg-blue-600 text-white rounded">Set Admin</button>
                                <button onClick={() => changeRole(p.id, 'user')} className="px-3 py-1 bg-gray-200 rounded">Set User</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'products' && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <input value={prodSearch} onChange={e=>setProdSearch(e.target.value)} placeholder="Tìm sản phẩm" className="border rounded px-3 py-2 w-96" />
                  <ProductCreateForm onCreate={createProduct} />
                </div>

                {productsLoading ? <div>Đang tải...</div> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProducts.map(p => (
                      <div key={p.id} className="bg-white rounded shadow p-4">
                        <div className="h-36 bg-gray-100 flex items-center justify-center mb-3 overflow-hidden">
                          {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover"/> : <div className="text-gray-400">No image</div>}
                        </div>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold">{p.name}</div>
                            <div className="text-sm text-gray-500">ID: {p.id}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-orange-500">{p.price || '-'}</div>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button className="px-3 py-1 bg-yellow-400 rounded">Sửa</button>
                          <button onClick={() => deleteProduct(p.id)} className="px-3 py-1 bg-red-500 text-white rounded">Xóa</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'reports' && (
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <select value={reportMonth} onChange={e=>setReportMonth(Number(e.target.value))} className="border rounded px-3 py-2">
                    {Array.from({length:12}).map((_,i)=> <option key={i+1} value={i+1}>{i+1}</option>)}
                  </select>
                  <input type="number" value={reportYear} onChange={e=>setReportYear(Number(e.target.value))} className="border rounded px-3 py-2 w-28" />
                  <button onClick={fetchReport} className="px-4 py-2 bg-black text-white rounded">Xem báo cáo</button>
                </div>

                {reportLoading ? <div>Đang tải...</div> : report ? (
                  <div>
                    <div className="mb-3">Tổng doanh thu ước tính: <strong className="text-green-600">{report.totals?.revenue || 0}</strong></div>
                    <div className="mb-3">Tổng số mặt hàng bán: <strong>{report.totals?.items || 0}</strong></div>
                    <h4 className="font-semibold mt-4">Phân bố theo ngày</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {report.breakdown?.map((b:any) => (
                        <div key={b.day} className="p-2 bg-white rounded shadow-sm">
                          <div className="text-sm text-gray-500">{b.day}</div>
                          <div className="font-bold">Doanh thu: {b.revenue}</div>
                          <div className="text-sm">Số lượng: {b.items}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <div className="text-gray-500">Chưa có báo cáo</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProductCreateForm: React.FC<{ onCreate: (p: Partial<Product>) => void }> = ({ onCreate }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState('');

  return (
    <div>
      <button onClick={() => setOpen(v=>!v)} className="bg-green-600 text-white px-3 py-2 rounded">{open ? 'Đóng' : 'Tạo sản phẩm'}</button>
      {open && (
        <div className="mt-2 bg-white p-3 rounded shadow">
          <div className="flex gap-2">
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Tên" className="border px-2 py-1 rounded" />
            <input value={price} onChange={e=>setPrice(e.target.value)} placeholder="Giá" className="border px-2 py-1 rounded" />
            <input value={image} onChange={e=>setImage(e.target.value)} placeholder="URL ảnh" className="border px-2 py-1 rounded" />
            <button onClick={() => { onCreate({ name, price, image }); setName(''); setPrice(''); setImage(''); setOpen(false); }} className="bg-blue-600 text-white px-3 py-1 rounded">Tạo</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
