import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) {
        navigate('/auth?redirect=/admin');
        return;
      }

      // Prefer checking profiles.role if exists
      const { data: profiles, error } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      let role = profiles?.role || user.user_metadata?.role || 'user';
      if (typeof role === 'string') role = role.trim().toLowerCase();
      if (!mounted) return;
      if (role !== 'admin') {
        navigate('/');
        return;
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div>Đang kiểm tra quyền...</div>;
  return <>{children}</>;
};

export default RequireAdmin;
