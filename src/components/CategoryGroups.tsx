import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

type Category = {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  product_count: number;
};

const GROUPS = [
  { key: 'female', label: 'Nữ' },
  { key: 'male', label: 'Nam' },
  { key: 'accessories', label: 'Phụ kiện' },
  { key: 'collections', label: 'Bộ sưu tập' },
  { key: 'other', label: 'Khác' },
];

const guessGroupFor = (c: Category) => {
  const s = `${c.slug || ''} ${c.name || ''}`.toLowerCase();
  if (s.includes('nữ') || s.includes('nu') || s.includes('women') || s.includes('female')) return 'female';
  if (s.includes('nam') || s.includes('men') || s.includes('male')) return 'male';
  if (s.includes('phụ kiện') || s.includes('phukien') || s.includes('phu-kien') || s.includes('accessory') || s.includes('accessories')) return 'accessories';
  if (s.includes('bộ sưu tập') || s.includes('bo suu tap') || s.includes('bosuutap') || s.includes('collection')) return 'collections';
  return 'other';
};

const CategoryCard: React.FC<{ c: Category; onClick: (slug: string) => void }> = ({ c, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(c.slug)}
    className="group rounded-xl overflow-hidden shadow-md hover:shadow-xl transition bg-white"
  >
    <div className="w-full h-36 bg-gray-100 overflow-hidden">
      <img
        src={c.image_url || 'https://images.unsplash.com/photo-1521417531039-9629f1b45e37?w=800'}
        alt={c.name}
        className="w-full h-full object-cover group-hover:scale-105 transition duration-400"
      />
    </div>
    <div className="p-3">
      <div className="font-semibold text-gray-900 line-clamp-1">{c.name}</div>
      <div className="text-xs text-gray-500">{c.product_count} sản phẩm</div>
    </div>
  </button>
);

const CategoryGroups: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('categories_with_counts').select('*');
      if (!ignore) {
        if (error) {
          console.error('[CategoryGroups] fetch error', error.message);
          setCategories([]);
        } else {
          setCategories((data || []) as Category[]);
        }
        setLoading(false);
      }
    };
    load();
    return () => { ignore = true; };
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, Category[]> = { female: [], male: [], accessories: [], collections: [], other: [] };
    for (const c of categories) {
      const g = guessGroupFor(c);
      (map[g] ||= []).push(c);
    }
    return map;
  }, [categories]);

  const onClick = (slug: string) => navigate(`/products?category=${slug}`);

  if (loading) return (
    <section className="container mx-auto px-4 py-12">
      <h2 className="text-3xl md:text-4xl font-black text-center mb-8 uppercase">Danh Mục Sản Phẩm</h2>
      <div className="text-center text-gray-500">Đang tải danh mục...</div>
    </section>
  );

  return (
    <section className="container mx-auto px-4 py-12">
      <h2 className="text-3xl md:text-4xl font-black text-center mb-8 uppercase">Danh Mục Sản Phẩm</h2>

      {GROUPS.map((group) => (
        <div key={group.key} className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">{group.label}</h3>
            <div className="text-sm text-gray-500">{(grouped as any)[group.key]?.length || 0} mục</div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {((grouped as any)[group.key] || []).slice(0, 6).map((c: Category) => (
              <CategoryCard key={c.id} c={c} onClick={onClick} />
            ))}
            {((grouped as any)[group.key] || []).length === 0 && (
              <div className="text-sm text-gray-500">Chưa có mục nào trong nhóm này.</div>
            )}
          </div>
        </div>
      ))}
    </section>
  );
};

export default CategoryGroups;
