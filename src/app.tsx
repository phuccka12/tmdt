import { Routes, Route } from 'react-router-dom';
import RootLayout from './Layout/RootLayout';
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';
import CategoryRedirect from './pages/CategoryRedirect';
import CategoryEntry from './pages/CategoryEntry';
import ProductDetail from './pages/ProductDetail';
import Auth from './pages/Auth';
import ResetPassword from './pages/ResetPassword';
import CartPage from './pages/CartPage';
import CheckoutSuccess from './pages/CheckoutSuccess';
import UserAccountPage from './pages/UserAccountPage'
import FavoritesPage from './pages/Favorites';
import RequireAdmin from './components/RequireAdmin';
import AdminLayout from './pages/admin/AdminLayout';
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<CategoryPage />} />
  <Route path="nu" element={<CategoryEntry category="nu"/>} />
  <Route path="nam" element={<CategoryEntry category="nam"/>} />
  <Route path="phu-kien" element={<CategoryEntry category="phu-kien"/>} />
  <Route path="bo-suu-tap" element={<CategoryEntry category="bo-suu-tap"/>} />
  <Route path="sale-off" element={<CategoryEntry label="SALE"/>} />
        <Route path="product/:id" element={<ProductDetail />} />
        <Route path="auth" element={<Auth />} />
  <Route path="auth/reset-password" element={<ResetPassword />} />
        <Route path="cart" element={<CartPage />} />
  <Route path="checkout/success" element={<CheckoutSuccess />} />
        <Route path="favorites" element={<FavoritesPage />} />
  <Route path="*" element={<Home />} />
  <Route path="/user-account" element={<UserAccountPage />} />
  <Route path="admin" element={<AdminLayout />} />
       
      </Route>
    </Routes>
  );  
}
