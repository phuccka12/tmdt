import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay, FreeMode } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

type Category = {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  product_count: number;
};

const CategoryCarousel: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('categories_with_counts') 
        .select('*');

      if (error) {
        console.error('[CategoryCarousel] fetch error:', error.message);
      } else {
        setCategories(data || []);
      }
      setLoading(false);
    };
    fetchCategories();
  }, []);

  if (loading) {
    return (
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-3xl md:text-4xl font-black text-center mb-8 uppercase">
          Danh Mục <span className="text-orange-500">Sản Phẩm</span>
        </h2>
        <div className="text-center text-gray-500">Đang tải danh mục...</div>
      </section>
    );
  }

  if (!categories.length) {
    return (
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-3xl md:text-4xl font-black text-center mb-8 uppercase">
          Danh Mục <span className="text-orange-500">Sản Phẩm</span>
        </h2>
        <div className="text-center text-gray-500">Chưa có danh mục nào.</div>
      </section>
    );
  }

  // Chỉ loop khi đủ số slide ở breakpoint lớn nhất
  const slidesDesktop = 6;
  const canLoop = categories.length >= slidesDesktop;

  return (
    <section className="container mx-auto px-4 py-16">
      <h2 className="text-3xl md:text-4xl font-black text-center mb-8 uppercase">
        Danh Mục <span className="text-orange-500">Sản Phẩm</span>
      </h2>

      <Swiper
        modules={[Navigation, Autoplay, FreeMode]}
        navigation
        autoplay={{ delay: 3500, disableOnInteraction: false }}
        freeMode={{ enabled: true }}
        grabCursor
        spaceBetween={16}
        slidesPerView={2}
        breakpoints={{
          640: { slidesPerView: 3 },
          768: { slidesPerView: 4 },
          1024: { slidesPerView: 5 },
          1280: { slidesPerView: slidesDesktop },
        }}
        loop={canLoop}
        preventClicks
        preventClicksPropagation
      >
        {categories.map((c) => (
          <SwiperSlide key={c.id}>
            <button
              onClick={() => navigate(`/products?category=${c.slug}`)}
              className="group block relative overflow-hidden rounded-2xl shadow-lg w-full h-60 focus:outline-none"
              type="button"
              aria-label={`Xem danh mục ${c.name}`}
            >
              <img
                src={
                  c.image_url ||
                  'https://images.unsplash.com/photo-1521417531039-9629f1b45e37?w=800'
                }
                alt={c.name}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-4">
                <h3 className="text-white font-black text-xl mb-1">{c.name}</h3>
                <p className="text-white/90 text-xs">{c.product_count}+ Sản phẩm</p>
              </div>
            </button>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
};

export default CategoryCarousel;
