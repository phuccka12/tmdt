import React from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// This component receives a mapping via props in route config, but for simplicity
// it maps a path like /nu to a category slug and redirects to /products?category=slug
const mapping: Record<string,string> = {
  '/nu': 'nu',
  '/nam': 'nam',
  '/phu-kien': 'phu-kien',
  '/bo-suu-tap': 'bo-suu-tap',
  '/sale-off': 'sale',
};

const CategoryRedirect: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const path = window.location.pathname;
    const slug = mapping[path] || 'all';
    navigate(`/products?category=${slug}`);
  }, [navigate]);

  return null;
};

export default CategoryRedirect;
