import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const banners = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1600',
    title: 'BỘ SƯU TẬP MỚI 2025',
    subtitle: 'Phong cách thể thao đỉnh cao',
    cta: 'MUA NGAY'
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1600',
    title: 'GIẢM GIÁ ĐẾN 50%',
    subtitle: 'Săn sale thả ga - Mua sắm thỏa thích',
    cta: 'XEM NGAY'
  },
  


  
];

const BannerSlider: React.FC = () => {
  const [currentBanner, setCurrentBanner] = useState(0);

  const nextBanner = () => {
    setCurrentBanner((prev) => (prev + 1) % banners.length);
  };

  const prevBanner = () => {
    setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length);
  };

  return (
    <section className="relative h-[400px] md:h-[600px] overflow-hidden">
      {banners.map((banner, index) => (
        <div
          key={banner.id}
          className={`absolute inset-0 transition-opacity duration-700 ${
            index === currentBanner ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img src={banner.image} alt={banner.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-center text-white px-4">
              <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight">{banner.title}</h1>
              <p className="text-xl md:text-2xl mb-8">{banner.subtitle}</p>
              <button className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-full text-lg font-bold transition transform hover:scale-105">
                {banner.cta}
              </button>
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={prevBanner}
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-3 transition z-10"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={nextBanner}
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-3 transition z-10"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </section>
  );
};

export default BannerSlider;
