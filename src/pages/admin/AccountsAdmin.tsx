import React, { useEffect, useMemo, useState } from 'react';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
const adminApiKey = import.meta.env.VITE_ADMIN_API_KEY || '';

const headersWithKey = () => ({
  'Content-Type': 'application/json',
  ...(adminApiKey ? { 'x-admin-api-key': adminApiKey } : {}),
});

type Profile = { 
  id: string; 
  full_name?: string | null; 
  email?: string | null; 
  updated_at?: string;
};

const AccountsAdmin: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profileSearch, setProfileSearch] = useState('');
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', password: '' });
  const [addingProfile, setAddingProfile] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', full_name: '', password: '' });

  useEffect(() => {
    fetchProfiles();
  }, []);

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
      const url = `${backendUrl}/admin/set-role`;
      console.log('[AccountsAdmin] POST', url, { user_id: userId, role });
      const resp = await fetch(url, { method: 'POST', headers: headersWithKey(), body: JSON.stringify({ user_id: userId, role }) });
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

  const deleteProfile = async (userId: string) => {
    if (!confirm(`Xác nhận xóa tài khoản ${userId}?`)) return;
    const url = `${backendUrl}/admin/profiles/${userId}`;
    try {
      console.log('[AccountsAdmin] DELETE', url);
      const resp = await fetch(url, { method: 'DELETE', headers: headersWithKey() });
      const text = await resp.text();
      if (!resp.ok) {
        // show server response body when available
        throw new Error(`HTTP ${resp.status} - ${text}`);
      }
      setProfiles(prev => prev.filter(p => p.id !== userId));
      alert('Đã xóa tài khoản');
    } catch (e: any) {
      console.error('deleteProfile', e);
      alert('Xóa thất bại: ' + (e.message || e));
    }
  };

  const startEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setEditForm({ full_name: profile.full_name || '', email: profile.email || '', password: '' });
  };

  const saveEdit = async () => {
    if (!editingProfile) return;
    try {
      const url = `${backendUrl}/admin/profiles/${editingProfile.id}`;
      console.log('[AccountsAdmin] PUT', url, editForm);
      const resp = await fetch(url, { 
        method: 'PUT', 
        headers: headersWithKey(), 
        body: JSON.stringify(editForm) 
      });
      const text = await resp.text();
      if (!resp.ok) throw new Error(`HTTP ${resp.status} - ${text}`);
      await fetchProfiles();
      setEditingProfile(null);
      alert('Đã cập nhật thông tin');
    } catch (e: any) {
      console.error('saveEdit', e);
      alert('Cập nhật thất bại: ' + (e.message || e));
    }
  };

  const saveAdd = async () => {
    try {
      const url = `${backendUrl}/admin/profiles`;
      console.log('[AccountsAdmin] POST', url, addForm);
      const resp = await fetch(url, { 
        method: 'POST', 
        headers: headersWithKey(), 
        body: JSON.stringify(addForm) 
      });
      const text = await resp.text();
      if (!resp.ok) throw new Error(`HTTP ${resp.status} - ${text}`);
      await fetchProfiles();
      setAddingProfile(false);
      setAddForm({ email: '', full_name: '', password: '' });
      alert('Đã thêm người dùng');
    } catch (e: any) {
      console.error('saveAdd', e);
      alert('Thêm thất bại: ' + (e.message || e));
    }
  };

  const filteredProfiles = useMemo(() => {
    const q = profileSearch.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(p => (p.full_name||'').toLowerCase().includes(q) || (p.email||'').toLowerCase().includes(q) || p.id.includes(q));
  }, [profiles, profileSearch]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Quản lý Tài khoản</h2>
      <div className="mb-4">
        <input value={profileSearch} onChange={e=>setProfileSearch(e.target.value)} placeholder="Tìm theo tên, email hoặc id" className="border rounded px-3 py-2 w-full max-w-md" />
        <button onClick={() => setAddingProfile(true)} className="ml-4 px-4 py-2 bg-green-600 text-white rounded">Thêm người dùng</button>
      </div>
      {profilesLoading ? <div>Đang tải...</div> : (
        <div className="overflow-x-auto">
          <table className="w-full table-auto bg-white rounded shadow">
            <thead>
              <tr className="text-left bg-gray-100">
                <th className="p-2">ID</th>
                <th className="p-2">Tên</th>
                <th className="p-2">Email</th>
                <th className="p-2">Cập nhật</th>
                <th className="p-2">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="p-2 text-sm">{p.id}</td>
                  <td className="p-2">{p.full_name || '-'}</td>
                  <td className="p-2">{p.email || '-'}</td>
                  <td className="p-2 text-sm">{p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '-'}</td>
                  <td className="p-2">
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => startEdit(p)} className="px-3 py-1 bg-yellow-500 text-white rounded text-sm">Sửa</button>
                      <button onClick={() => changeRole(p.id, 'admin')} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Set Admin</button>
                      <button onClick={() => changeRole(p.id, 'user')} className="px-3 py-1 bg-gray-200 rounded text-sm">Set User</button>
                      <button onClick={() => deleteProfile(p.id)} className="px-3 py-1 bg-red-500 text-white rounded text-sm">Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Chỉnh sửa tài khoản</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Tên</label>
              <input 
                value={editForm.full_name} 
                onChange={e => setEditForm(prev => ({ ...prev, full_name: e.target.value }))} 
                className="border rounded px-3 py-2 w-full" 
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Email</label>
              <input 
                value={editForm.email} 
                onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))} 
                className="border rounded px-3 py-2 w-full" 
                type="email"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Mật khẩu (để trống nếu không đổi)</label>
              <input 
                type="password"
                value={editForm.password} 
                onChange={e => setEditForm(prev => ({ ...prev, password: e.target.value }))} 
                className="border rounded px-3 py-2 w-full" 
                placeholder="Mật khẩu mới"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded">Lưu</button>
              <button onClick={() => setEditingProfile(null)} className="px-4 py-2 bg-gray-300 rounded">Hủy</button>
            </div>
          </div>
        </div>
      )}

      {addingProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Thêm người dùng</h3>
            <div className="mb-4">
                <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Tên</label>
              <input 
                value={addForm.full_name} 
                onChange={e => setAddForm(prev => ({ ...prev, full_name: e.target.value }))} 
                className="border rounded px-3 py-2 w-full" 
              />
            </div>
             <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Email</label>
              <input 
                value={addForm.email} 
                onChange={e => setAddForm(prev => ({ ...prev, email: e.target.value }))} 
                className="border rounded px-3 py-2 w-full" 
                type="email"
              />
            </div>
              <label className="block text-sm font-medium mb-1">Mật khẩu</label>
              <input 
                type="password"
                value={addForm.password} 
                onChange={e => setAddForm(prev => ({ ...prev, password: e.target.value }))} 
                className="border rounded px-3 py-2 w-full" 
                placeholder="Mật khẩu"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={saveAdd} className="px-4 py-2 bg-green-600 text-white rounded">Thêm</button>
              <button onClick={() => setAddingProfile(false)} className="px-4 py-2 bg-gray-300 rounded">Hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsAdmin;