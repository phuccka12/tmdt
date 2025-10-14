import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Mapping can redirect either to a category slug or to a label filter.
// For example: '/nu' => /products?category=nu, '/sale-off' => /products?label=SALE
const mapping: Record<string, { type: 'category' | 'label'; value: string }> = {
  '/nu': { type: 'category', value: 'nu' },
  '/nam': { type: 'category', value: 'nam' },
  '/phu-kien': { type: 'category', value: 'phu-kien' },
  '/bo-suu-tap': { type: 'category', value: 'bo-suu-tap' },
  '/sale-off': { type: 'label', value: 'SALE' },
};

const CategoryRedirect: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const path = window.location.pathname;
    const entry = mapping[path];

    if (!entry) {
      // default to all products
      navigate('/products');
      return;
    }

    if (entry.type === 'category') {
      navigate(`/products?category=${encodeURIComponent(entry.value)}`);
    } else {
      navigate(`/products?label=${encodeURIComponent(entry.value)}`);
    }
  }, [navigate]);

  return null;
};

export default CategoryRedirect;
