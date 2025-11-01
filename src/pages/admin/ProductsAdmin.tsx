import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:54321';
const adminApiKey = import.meta.env.VITE_ADMIN_API_KEY || '';

const headersWithKey = () => ({
  'Content-Type': 'application/json',
  ...(adminApiKey ? { 'x-admin-api-key': adminApiKey } : {}),
});

type Product = { id: number; name: string; price?: any; image?: string; label?: string };

const formatPrice = (v: any) => {
  if (v == null || v === '') return '-';
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
  if (isNaN(n)) return String(v);
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
};

// storage bucket name for product images
const PRODUCT_BUCKET = 'product-images';

// helper: convert File to base64 (without data:* prefix)
const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result as string;
    // data:<mime>;base64,XXXXX
    const idx = result.indexOf('base64,');
    if (idx >= 0) resolve(result.slice(idx + 7));
    else resolve(result);
  };
  reader.onerror = (err) => reject(err);
  reader.readAsDataURL(file);
});

// ProductEditForm component (used by ProductsAdmin)
const ProductEditForm: React.FC<{ product: Product; onCancel: () => void; onSave: (p: Partial<Product> & { id: number }) => void; loading: boolean }> = ({ product, onCancel, onSave, loading }) => {
  const [name, setName] = useState(product.name || '');
  const [price, setPrice] = useState(String(product.price || ''));
  const [image, setImage] = useState(product.image || '');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const submit = async () => {
    if (!name.trim()) return alert('Tên sản phẩm là bắt buộc');
    const parsedPrice = price ? (isNaN(Number(String(price).replace(/[^\d.-]/g, '')) ) ? null : Number(String(price).replace(/[^\d.-]/g, '')) ) : undefined;
    if (price && parsedPrice === null) return alert('Giá không hợp lệ');
    try {
      let imageUrl = image;
      if (file) {
        setUploading(true);
        // upload via backend to use service_role key and bypass RLS/storage policies
        const b64 = await fileToBase64(file);
        const resp = await fetch(`${backendUrl}/admin/upload-image`, { method: 'POST', headers: headersWithKey(), body: JSON.stringify({ fileName: file.name, fileBase64: b64 }) });
        const respBody = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          // If payload too large (413) or server rejects, try binary upload fallback
          if (resp.status === 413) {
            // try binary fallback
            const ab = await file.arrayBuffer();
            const binResp = await fetch(`${backendUrl}/admin/upload-image?fileName=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { ...(adminApiKey ? { 'x-admin-api-key': adminApiKey } : {}), 'Content-Type': 'application/octet-stream', 'x-file-name': file.name }, body: ab });
            const binBody = await binResp.json().catch(() => ({}));
            if (!binResp.ok) throw new Error(binBody.error || JSON.stringify(binBody) || 'Binary upload failed');
            imageUrl = binBody.publicUrl || imageUrl;
          } else {
            throw new Error(respBody.error || JSON.stringify(respBody) || 'Upload failed');
          }
        } else {
          imageUrl = respBody.publicUrl || imageUrl;
        }
      }
      await onSave({ id: product.id, name: name.trim(), price: parsedPrice ?? price, image: imageUrl });
    } catch (e: any) {
      console.error('edit upload', e);
      const errMsg = e?.message || String(e);
      if (errMsg.toLowerCase().includes('bucket not found')) {
        // Fallback: update product without uploading image so admin can continue
        alert(`Upload ảnh thất bại: bucket "${PRODUCT_BUCKET}" không tồn tại. Cập nhật sản phẩm không thay đổi ảnh (fallback). Vui lòng tạo bucket trên Supabase Storage để bật upload.`);
        try {
          await onSave({ id: product.id, name: name.trim(), price: parsedPrice ?? price, image: image || product.image || '' });
        } catch (inner: any) {
          console.error('edit fallback failed', inner);
          alert('Cập nhật sản phẩm thất bại sau khi fallback: ' + (inner?.message || String(inner)));
        }
      } else {
        alert('Upload ảnh thất bại: ' + errMsg);
      }
    } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">Chỉnh sửa sản phẩm #{product.id}</h3>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1 text-gray-700">Tên</label>
          <input value={name} onChange={e => setName(e.target.value)} className="border-gray-300 border rounded px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1 text-gray-700">Giá</label>
          <input value={price} onChange={e => setPrice(e.target.value)} className="border-gray-300 border rounded px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1 text-gray-700">URL ảnh</label>
          <input value={image} onChange={e => setImage(e.target.value)} className="border-gray-300 border rounded px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500 mb-2" />
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} className="w-full" />
          {file && (
            <div className="mt-2">
              <img src={URL.createObjectURL(file)} alt="preview" className="h-24 object-contain" />
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={submit} disabled={loading || uploading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50">
            {uploading ? 'Đang tải...' : (loading ? 'Đang lưu...' : 'Lưu')}
          </button>
          <button onClick={onCancel} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md font-medium">Hủy</button>
        </div>
      </div>
    </div>
  );
};

const ProductsAdmin: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [prodSearch, setProdSearch] = useState('');
  const [creating, setCreating] = useState(false); // Vẫn được dùng bởi createProduct, (mặc dù form con ko biết)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null);

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
        throw new Error(`HTTP ${resp.status} - ${text.slice(0, 200)}`);
      }
      if (!ct.includes('application/json')) {
        const text = await resp.text();
        throw new Error('Expected JSON from backend but received: ' + text.slice(0, 200));

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
      setDeleteLoadingId(id);
      const resp = await fetch(`${backendUrl}/admin/products/${id}`, { method: 'DELETE', headers: headersWithKey() });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error || JSON.stringify(body));
      setProducts(prev => prev.filter(p => p.id !== id));
      alert('Đã xóa');
    } catch (e: any) {
      console.error('deleteProduct', e);
      alert('Xóa thất bại: ' + (e.message || e));
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const createProduct = async (payload: Partial<Product>) => {
    try {
      setCreating(true);
      const resp = await fetch(`${backendUrl}/admin/products`, { method: 'POST', headers: headersWithKey(), body: JSON.stringify(payload) });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error || JSON.stringify(body));
      // refresh list
      await fetchProducts();
      alert('Tạo thành công');
    } catch (e: any) {
      console.error('createProduct', e);
      alert('Tạo thất bại: ' + (e.message || e));
    } finally { setCreating(false); }
  };

  const startEdit = (p: Product) => {
    setEditingProduct(p);
  };

  const saveEdit = async (payload: Partial<Product> & { id: number }) => {
    try {
      setEditLoading(true);
      // reuse existing POST upsert endpoint
      const resp = await fetch(`${backendUrl}/admin/products`, { method: 'POST', headers: headersWithKey(), body: JSON.stringify(payload) });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error || JSON.stringify(body));
      await fetchProducts();
      setEditingProduct(null);
      alert('Cập nhật thành công');
    } catch (e: any)
{
      console.error('saveEdit', e);
      alert('Cập nhật thất bại: ' + (e.message || e));
    } finally { setEditLoading(false); }
  };

  const filteredProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => String(p.id).includes(q) || (p.name || '').toLowerCase().includes(q));
  }, [products, prodSearch]);

  const renderLoadingSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-lg shadow overflow-hidden">
          <div className="h-44 bg-gray-200 animate-pulse" />
          <div className="p-4">
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-2 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4 animate-pulse" />
            <div className="flex gap-2">
              <div className="h-9 bg-gray-200 rounded-md flex-1 animate-pulse" />
              <div className="h-9 bg-gray-200 rounded-md w-1/4 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderEmptyState = () => (
    <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <h3 className="text-lg font-semibold">Không có sản phẩm</h3>
      <p className="mt-1 text-sm">Thêm sản phẩm mới bằng nút "Tạo sản phẩm".</p>
    </div>
  );

  return (
    <div className="p-6 md:p-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Quản lý Sản phẩm</h2>
      <div className="mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <input value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder="Tìm sản phẩm theo tên hoặc ID..." className="border border-gray-300 rounded-md px-3 py-2 w-full md:max-w-md focus:ring-indigo-500 focus:border-indigo-500" />
        {/* `creating` state được truyền vào để form con có thể hiển thị loading (nếu muốn) */}
        {/* Trong code gốc, logic `creating` không được dùng ở form, ta giữ nguyên logic đó */}
        <ProductCreateForm onCreate={createProduct} />
      </div>

      {productsLoading ? (
        renderLoadingSkeleton()
      ) : (
        filteredProducts.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(p => (
              <div key={p.id} className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden">
                <div className="h-44 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M7 7V4a2 2 0 012-2h6a2 2 0 012 2v3" />
                      </svg>
                      <div className="text-sm mt-2">No image</div>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 truncate">{p.name}</div>
                      <div className="text-sm text-gray-500 truncate">ID: {p.id}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-lg text-orange-600">{formatPrice(p.price)}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => startEdit(p)} className="flex-1 px-3 py-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-md shadow-sm text-sm font-medium transition-colors">Sửa</button>
                    <button onClick={() => deleteProduct(p.id)} disabled={deleteLoadingId === p.id} className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md shadow-sm text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {deleteLoadingId === p.id ? 'Đang xóa...' : 'Xóa'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* **PHẦN ĐƯỢC THÊM VÀO ĐỂ SỬA LỖI LOGIC HIỂN THỊ** */}
      {editingProduct && (
        <ProductEditForm
          product={editingProduct}
          onCancel={() => setEditingProduct(null)}
          onSave={saveEdit}
          loading={editLoading}
        />
      )}
    </div>
  );
};

// --- Nâng cấp ProductCreateForm thành Modal ---
const ProductCreateForm: React.FC<{ onCreate: (p: Partial<Product>) => void }> = ({ onCreate }) => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Logic submit được giữ nguyên: gọi onCreate và reset form
  // Ta chỉ thêm validation cơ bản cho nhất quán với form Sửa
  const submit = async () => {
    if (!name.trim()) return alert('Tên sản phẩm là bắt buộc');
    const parsedPrice = price ? (isNaN(Number(String(price).replace(/[^\d.-]/g, '')) ) ? null : Number(String(price).replace(/[^\d.-]/g, '')) ) : undefined;
    if (price && parsedPrice === null) return alert('Giá không hợp lệ');

    try {
      let imageUrl = image;
      if (file) {
        setUploading(true);
        // upload via backend to use service_role key and bypass RLS/storage policies
        const b64 = await fileToBase64(file);
        const resp = await fetch(`${backendUrl}/admin/upload-image`, { method: 'POST', headers: headersWithKey(), body: JSON.stringify({ fileName: file.name, fileBase64: b64 }) });
        const respBody = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          if (resp.status === 413) {
            // binary fallback
            const ab = await file.arrayBuffer();
            const binResp = await fetch(`${backendUrl}/admin/upload-image?fileName=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { ...(adminApiKey ? { 'x-admin-api-key': adminApiKey } : {}), 'Content-Type': 'application/octet-stream', 'x-file-name': file.name }, body: ab });
            const binBody = await binResp.json().catch(() => ({}));
            if (!binResp.ok) throw new Error(binBody.error || JSON.stringify(binBody) || 'Binary upload failed');
            imageUrl = binBody.publicUrl || imageUrl;
          } else {
            throw new Error(respBody.error || JSON.stringify(respBody) || 'Upload failed');
          }
        } else {
          imageUrl = respBody.publicUrl || imageUrl;
        }
      }
      await onCreate({ name: name.trim(), price: parsedPrice ?? price, image: imageUrl });
      setName('');
      setPrice('');
      setImage('');
      setFile(null);
      setOpen(false);
    } catch (e: any) {
      console.error('createProduct upload', e);
      const errMsg = e?.message || String(e);
      if (errMsg.toLowerCase().includes('bucket not found')) {
        // Inform user but fallback to create product without image so admin can continue
        alert(`Upload ảnh thất bại: bucket "${PRODUCT_BUCKET}" không tồn tại. Tạo sản phẩm không có ảnh (fallback). Vui lòng tạo bucket trên Supabase Storage để bật upload.`);
        try {
          await onCreate({ name: name.trim(), price: parsedPrice ?? price, image: '' });
          setName('');
          setPrice('');
          setImage('');
          setFile(null);
          setOpen(false);
        } catch (innerErr: any) {
          console.error('create fallback failed', innerErr);
          alert('Tạo sản phẩm thất bại sau khi fallback: ' + (innerErr?.message || String(innerErr)));
        }
      } else {
        alert('Upload ảnh thất bại: ' + errMsg);
      }
    } finally { setUploading(false); }
  };

  return (
    <div>
      <button onClick={() => setOpen(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium shadow-sm transition-colors">
        Tạo sản phẩm
      </button>
      
      {/* Thay vì dropdown, ta render Modal */}
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Tạo sản phẩm mới</h3>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1 text-gray-700">Tên</label>
              <input value={name} onChange={e => setName(e.target.value)} className="border-gray-300 border rounded px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1 text-gray-700">Giá</label>
              <input value={price} onChange={e => setPrice(e.target.value)} className="border-gray-300 border rounded px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1 text-gray-700">URL ảnh</label>
              <input value={image} onChange={e => setImage(e.target.value)} className="border-gray-300 border rounded px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500 mb-2" />
              <input type="file" accept="image/*" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} className="w-full" />
              {file && (
                <div className="mt-2">
                  <img src={URL.createObjectURL(file)} alt="preview" className="h-24 object-contain" />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              {/* Nút này không có loading state, vì logic gốc không hỗ trợ */}
              <button onClick={submit} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium">{uploading ? 'Đang tải...' : 'Tạo'}</button>
              <button onClick={() => setOpen(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md font-medium">Hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsAdmin;
