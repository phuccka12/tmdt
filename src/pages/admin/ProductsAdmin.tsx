import React, { useEffect, useMemo, useState } from 'react';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
const adminApiKey = import.meta.env.VITE_ADMIN_API_KEY || '';

const headersWithKey = () => ({
  'Content-Type': 'application/json',
  ...(adminApiKey ? { 'x-admin-api-key': adminApiKey } : {}),
});

type Product = { id: number; name: string; price?: any; image?: string; label?: string };

const ProductsAdmin: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [prodSearch, setProdSearch] = useState('');

  useEffect(() => {
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

  const filteredProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => String(p.id).includes(q) || (p.name||'').toLowerCase().includes(q));
  }, [products, prodSearch]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Quản lý Sản phẩm</h2>
      <div className="mb-4 flex items-center justify-between">
        <input value={prodSearch} onChange={e=>setProdSearch(e.target.value)} placeholder="Tìm sản phẩm" className="border rounded px-3 py-2 w-full max-w-md" />
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

export default ProductsAdmin;