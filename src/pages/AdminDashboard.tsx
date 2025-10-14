import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AdminDashboard: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.from('products').select('*').order('id', { ascending: true }).limit(200);
      if (!mounted) return;
      setProducts(data || []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      {loading ? <div>Loading...</div> : (
        <div>
          <h2 className="text-lg font-semibold">Products</h2>
          <table className="w-full mt-2 table-auto">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="p-2">{p.id}</td>
                  <td className="p-2">{p.name}</td>
                  <td className="p-2">{p.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
