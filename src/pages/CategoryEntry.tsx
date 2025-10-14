import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import CategoryPage from './CategoryPage';

type Props = {
  category?: string;
  label?: string;
};

const CategoryEntry: React.FC<Props> = ({ category, label }) => {
  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    const p = new URLSearchParams();
    if (category) p.set('category', category);
    if (label) p.set('label', label);
    // reset to page 1 as well
    p.set('page', '1');
    setSearchParams(p, { replace: true });
  }, [category, label, setSearchParams]);

  return <CategoryPage />;
};

export default CategoryEntry;
