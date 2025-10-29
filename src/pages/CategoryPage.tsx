import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import ProductCard, { Product } from '../pages/ProductCard';
import Pagination from '../components/Pagination';
import { Filter, Loader2 } from 'lucide-react';

type CategoryRow = { id: number; name: string; slug: string };

const PAGE_SIZE = 12;
const LABELS = ['all', 'HOT', 'NEW', 'SALE'] as const;
type LabelFilter = typeof LABELS[number];

const CategoryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categorySlug = searchParams.get('category') || 'all';
  const labelFilter = (searchParams.get('label') || 'all') as LabelFilter;
  const page = Math.max(1, Number(searchParams.get('page') || '1'));

  const [category, setCategory] = useState<CategoryRow | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const title = useMemo(() => {
    if (categorySlug === 'all') return 'Tất cả sản phẩm';
    if (category) return `Danh mục: ${category.name}`;
    return 'Đang tải...';
  }, [categorySlug, category]);

  // 1) Lấy category theo slug (nếu có)
  useEffect(() => {
    let ignore = false;

    const loadCategory = async () => {
      setLoading(true);
      setNotFound(false);
      setCategory(null);

      if (categorySlug === 'all') {
        setCategory(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('categories')
        .select('id,name,slug')
        .eq('slug', categorySlug)
        .maybeSingle();

      if (ignore) return;

      if (error) {
        console.error('[CategoryPage] category error:', error.message);
        setNotFound(true);
      } else if (!data) {
        setNotFound(true);
      } else {
        setCategory(data);
      }
      setLoading(false);
    };

    loadCategory();
    return () => {
      ignore = true;
    };
  }, [categorySlug]);

  // 2) Lấy products theo category + label + page
  useEffect(() => {
    let ignore = false;

    const loadProducts = async () => {
      setLoading(true);

      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .order('id', { ascending: false });

      if (categorySlug !== 'all') {
        if (!category) {
          setLoading(false);
          return;
        }
        query = query.eq('category_id', category.id);
      }

      if (labelFilter !== 'all') {
        query = query.eq('label', labelFilter);
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await query.range(from, to);

      if (ignore) return;

      if (error) {
        console.error('[CategoryPage] products error:', error.message);
        setProducts([]);
        setTotal(0);
      } else {
        const mapped = (data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          oldPrice: p.oldPrice ?? null,
          image: p.image,
          label: p.label ?? null,
          rating: p.rating ?? 0,
        })) as Product[];

        setProducts(mapped);
        setTotal(count || 0);
      }
      setLoading(false);
    };

    loadProducts();
    return () => {
      ignore = true;
    };
  }, [categorySlug, category, labelFilter, page]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all' && (key === 'category' || key === 'label')) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    if (key !== 'page') next.set('page', '1'); // đổi filter thì reset page
    setSearchParams(next, { replace: true });
  };

  if (notFound) {
    return (
      <section className="container mx-auto px-4 py-16">
        <h1 className="text-2xl md:text-3xl font-bold mb-4">Danh mục không tồn tại</h1>
        <Link to="/products" className="text-orange-500 hover:underline">
          ← Quay lại tất cả sản phẩm
        </Link>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-16">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-black">{title}</h1>
        <div className="text-sm text-gray-500">{total} sản phẩm</div>
      </div>

      {/* Filter nhãn */}
      <div className="mb-8 flex items-center flex-wrap gap-2">
        <div className="flex items-center gap-2 mr-4 text-gray-600">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Lọc theo nhãn:</span>
        </div>

        {LABELS.map((lb) => (
          <button
            key={lb}
            onClick={() => setParam('label', lb)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
              labelFilter === lb
                ? 'bg-black text-white border-black'
                : 'bg-white text-gray-700 border-gray-300 hover:border-black'
            }`}
          >
            {lb === 'all' ? 'Tất cả' : lb}
          </button>
        ))}
      </div>

      {/* Grid sản phẩm */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Đang tải sản phẩm...
        </div>
      ) : products.length === 0 ? (
        <div className="text-gray-500">Không có sản phẩm nào phù hợp.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={(nextPage) => setParam('page', String(nextPage))}
          />
        </>
      )}
    </section>
  );
};

export default CategoryPage;
