import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, ShoppingCart, Heart, Menu, Search, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import NavBar from './NavBar';  // Import NavBar component

interface HeaderProps {
  cartCount: number;
  user?: any | null;
}

const Header: React.FC<HeaderProps> = ({ cartCount, user }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user) return;
        // Try to read role from profiles table
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        let isAdmin = false;
        const profileRole = profile?.role;
        const metadataRole = user?.user_metadata?.role;
        if (typeof profileRole === 'string') {
          isAdmin = profileRole.trim().toLowerCase() === 'admin';
        } else if (typeof metadataRole === 'string') {
          isAdmin = metadataRole.trim().toLowerCase() === 'admin';
        }
        setIsAdmin(isAdmin);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  const maskEmail = (e?: string | null) => {
    if (!e) return '';
    const parts = e.split('@');
    if (parts.length !== 2) return e;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) return `${name[0]}***@${domain}`;
    return `${name.slice(0, 2)}***@${domain}`;
  };
  const displayName = user?.user_metadata?.full_name || maskEmail(user?.email);

  return (
    <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          <div className="text-3xl font-black">
            <Link to="/" className="hover:text-orange-500">HIDAY SPORT</Link>
          </div>

          {/* Search Bar - Desktop */}
          <div className="hidden lg:flex flex-1 max-w-xl mx-8">
            <div className="w-full relative">
              <input
                type="text"
                placeholder="Tìm kiếm sản phẩm..."
                className="w-full border-2 border-gray-300 rounded-full px-6 py-2.5 pr-12 focus:border-orange-500 outline-none"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-orange-500 text-white p-2 rounded-full hover:bg-orange-600 transition">
                <Search className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Icons */}
          <div className="flex items-center gap-4">
            <Link to="/favorites" className="hidden md:flex items-center gap-2 hover:text-orange-500 transition">
              <Heart className="w-6 h-6" />
            </Link>
            <Link to="/cart" className="relative hover:text-orange-500 transition">
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Tài khoản */}
            {user ? (
              <div className="relative">
                <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 hover:text-orange-500">
                  <User className="w-6 h-6" />
                  <span className="text-sm font-medium">{displayName}</span>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 bg-white shadow-lg rounded-lg p-4 w-48 z-[9999]">
                    <Link to="/user-account" className="block py-2 text-gray-800 hover:text-orange-500">Tài khoản</Link>
                    {isAdmin && <Link to="/admin" className="block py-2 text-gray-800 hover:text-orange-500">Admin</Link>}
                    <Link to="/auth" className="block py-2 text-gray-800 hover:text-orange-500" onClick={async () => {
                      await supabase.auth.signOut();
                      setMenuOpen(false);
                    }}>Đăng xuất</Link>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/auth" className="hover:text-orange-500 transition">
                <User className="w-6 h-6" />
              </Link>
            )}
            <button className="lg:hidden" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Navigation Bar */}
        <NavBar />  {/* Render NavBar here */}

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="lg:hidden py-4 space-y-3 border-t z-[9999] relative">
            <Link to="/" className="block py-2 font-bold hover:text-orange-500 transition uppercase">Trang chủ</Link>
            <Link to="/products" className="block py-2 font-bold hover:text-orange-500 transition uppercase">Danh mục</Link>
            <Link to="/cart" className="block py-2 font-bold hover:text-orange-500 transition uppercase">Giỏ hàng</Link>
            <Link to="/auth" className="block py-2 font-bold hover:text-orange-500 transition uppercase">Đăng nhập</Link>
            <Link to="/favorites" className="block py-2 font-bold hover:text-orange-500 transition uppercase">Yêu thích</Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
