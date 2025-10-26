import React from 'react';
import { Link } from 'react-router-dom';

const CheckoutSuccess: React.FC = () => {
  return (
    <section className="container mx-auto px-4 py-16">
      <div className="max-w-xl mx-auto text-center">
        <h1 className="text-3xl font-black mb-4">Thanh toán thành công</h1>
        <p className="text-gray-600 mb-6">Cảm ơn bạn đã mua hàng! Đơn hàng của bạn đã được nhận và sẽ được xử lý sớm.</p>
        <Link to="/" className="inline-block bg-black text-white px-6 py-3 rounded-lg">Về trang chủ</Link>
      </div>
    </section>
  );
};

export default CheckoutSuccess;
