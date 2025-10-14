import React from 'react';
import { Link } from 'react-router-dom'; // Import Link từ react-router-dom

const navItems = [
  { label: 'TRANG CHỦ', path: '/' },
  { label: 'NỮ', path: '/nu' },
  { label: 'NAM', path: '/nam' },
  { label: 'PHỤ KIỆN', path: '/phu-kien' },
  { label: 'BỘ SƯU TẬP', path: '/bo-suu-tap' },
  { label: 'SALE OFF', path: '/sale-off' },
];

const NavBar: React.FC = () => {
  return (
    <nav className="hidden lg:flex items-center justify-between space-x-8 py-4 border-t border-gray-300 bg-white shadow-md rounded-xl px-6 relative z-50 pointer-events-auto">
      {navItems.map((item, index) => (
        <Link
          key={index}
          to={item.path}
          className="text-sm font-bold text-gray-800 hover:text-orange-500 transition-all duration-300 transform hover:scale-105 uppercase py-2 px-4 rounded-lg hover:bg-orange-50"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
};

export default NavBar;
