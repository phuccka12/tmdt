import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const CheckoutSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Đang xử lý thanh toán...');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Thiếu thông tin thanh toán. Vui lòng thử lại.');
      return;
    }

    // Call backend capture endpoint
    fetch('http://localhost:54321/payments/paypal/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setStatus('success');
          setMessage('Thanh toán thành công! Đơn hàng của bạn đã được xác nhận.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Không thể xác nhận thanh toán. Vui lòng liên hệ hỗ trợ.');
        }
      })
      .catch(err => {
        console.error('Capture error', err);
        setStatus('error');
        setMessage('Lỗi kết nối. Vui lòng kiểm tra lại đơn hàng của bạn.');
      });
  }, [searchParams]);

  return (
    <section className="container mx-auto px-4 py-16 min-h-screen flex items-center justify-center">
      <div className="max-w-xl mx-auto text-center">
        {status === 'loading' && (
          <div className="animate-fadeIn">
            <div className="inline-block relative mb-6">
              {/* Spinning circle loader */}
              <div className="w-20 h-20 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
            </div>
            <h1 className="text-3xl font-black mb-4">Đang xử lý thanh toán...</h1>
            <p className="text-gray-600 mb-2">{message}</p>
            <p className="text-sm text-gray-500">Vui lòng không đóng trang này</p>
          </div>
        )}
        {status === 'success' && (
          <div className="animate-fadeIn">
            {/* Success checkmark animation */}
            <div className="inline-block mb-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-green-600 animate-scaleIn" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-3xl font-black mb-4 text-green-600">Thanh toán thành công!</h1>
            <p className="text-gray-600 mb-8">{message}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/orders" className="inline-block bg-black text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition-colors font-semibold">
                Xem đơn hàng
              </Link>
              <Link to="/" className="inline-block bg-gray-200 text-black px-8 py-3 rounded-lg hover:bg-gray-300 transition-colors font-semibold">
                Về trang chủ
              </Link>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="animate-fadeIn">
            {/* Error icon */}
            <div className="inline-block mb-6">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h1 className="text-3xl font-black mb-4 text-red-600">Có lỗi xảy ra</h1>
            <p className="text-gray-600 mb-8">{message}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/cart" className="inline-block bg-black text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition-colors font-semibold">
                Quay lại giỏ hàng
              </Link>
              <Link to="/" className="inline-block bg-gray-200 text-black px-8 py-3 rounded-lg hover:bg-gray-300 transition-colors font-semibold">
                Về trang chủ
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default CheckoutSuccess;
