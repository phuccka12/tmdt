import React, { useState, lazy, Suspense } from 'react';
import RequireAdmin from '../../components/RequireAdmin';
import { LogOut } from 'lucide-react';
import Overview from './Overview';
import AccountsAdmin from './AccountsAdmin';
import ProductsAdmin from './ProductsAdmin';
import ReportsAdmin from './ReportsAdmin';

// Lazy load WebhooksAdmin to avoid circular import issues
const WebhooksAdmin = lazy(() => import('./WebhooksAdmin'));

const AdminLayout: React.FC = () => {
  const [tab, setTab] = useState<'overview' | 'accounts' | 'products' | 'reports' | 'webhooks'>('overview');
  const adminApiKey = import.meta.env.VITE_ADMIN_API_KEY || '';

  const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
      onClick={onClick}
      className={`px-6 py-3 rounded-t-lg font-medium transition-colors ${
        active ? 'bg-white border-t border-l border-r text-gray-900 shadow-sm' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );

  return (
    <RequireAdmin>
      <div className="min-h-screen bg-gray-50">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
            {!adminApiKey && <div className="text-sm text-red-600 mt-1">CẢNH BÁO: VITE_ADMIN_API_KEY chưa cấu hình — một số chức năng admin sẽ không hoạt động</div>}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">Welcome, Admin</span>
            <button className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="bg-gray-100 border-b border-gray-200 px-6">
          <div className="flex gap-1">
            <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>Tổng quan</TabButton>
            <TabButton active={tab === 'accounts'} onClick={() => setTab('accounts')}>Tài khoản</TabButton>
            <TabButton active={tab === 'products'} onClick={() => setTab('products')}>Sản phẩm</TabButton>
            <TabButton active={tab === 'reports'} onClick={() => setTab('reports')}>Báo cáo</TabButton>
            <TabButton active={tab === 'webhooks'} onClick={() => setTab('webhooks')}>Webhooks</TabButton>
          </div>
        </div>

        {/* Main Content */}
        <main className="p-8">
          <div className="bg-white rounded-xl shadow-sm p-8">
            {tab === 'overview' && <Overview />}
            {tab === 'accounts' && <AccountsAdmin />}
            {tab === 'products' && <ProductsAdmin />}
            {tab === 'reports' && <ReportsAdmin />}
            {tab === 'webhooks' && (
              <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
                <WebhooksAdmin />
              </Suspense>
            )}
          </div>
        </main>
      </div>
    </RequireAdmin>
  );
};

export default AdminLayout;
