import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Eye, EyeOff } from 'lucide-react';
const Auth: React.FC = () => {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); // Trường họ và tên
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false); // Trạng thái ẩn/hiện mật khẩu
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotNote, setForgotNote] = useState<string | null>(null);

  const navigate = useNavigate();

  const onSignUp = async () => {
    setLoading(true);
    setNote(null);
        try {
          const { data, error } = await supabase.auth.signUp({ email, password });
          console.log('[Auth] signUp result', { data, error });

      if (error) {
            console.error('[Auth] signUp error full', error);
            setNote(error.message || 'Đăng ký thất bại');
            return;
      }
      try {
        const user = data?.user;
        if (user) {
          const profile = {
            id: user.id,
            full_name: fullName || user.user_metadata?.full_name || null,
            email: user.email || null,
            updated_at: new Date().toISOString(),
          } as any;
          const { error: upsertErr } = await supabase.from('profiles').upsert(profile);
          if (upsertErr) console.warn('[Auth] profiles upsert warning', upsertErr.message || upsertErr);
        }
      } catch (pe) {
        console.warn('[Auth] profiles upsert failed', pe);
      }

      setNote('Đăng ký thành công! Vui lòng kiểm tra email xác minh.');
      setTab('signin');
    } finally {
      setLoading(false);
    }
  };

  const onSignIn = async () => {
    setLoading(true);
    setNote(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setNote(error.message);
    } else {
      navigate('/user-account');
    }
  };

  const onForgotPassword = async () => {
    setLoading(true);
    setNote(null);

    // Validate email
    if (!email || !email.includes('@')) {
      setLoading(false);
      setNote('Vui lòng nhập email hợp lệ để nhận hướng dẫn đổi mật khẩu.');
      return;
    }

      try {
        const redirectTo = `${window.location.origin}/auth/reset-password`;
        const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        console.log('[Auth] resetPasswordForEmail result', result);
        setLoading(false);
        if (result?.error) setNote(result.error.message || String(result.error));
        else setNote('Đã gửi email hướng dẫn thay đổi mật khẩu. Vui lòng kiểm tra email của bạn.');
      } catch (e: any) {
        setLoading(false);
        console.error('[Auth] forgot password error', e);
        setNote(e?.message || 'Có lỗi xảy ra. Vui lòng thử lại sau.');
      }
  };

  const togglePassword = () => {
    setShowPassword(!showPassword);  
  };

  return (
    <section className="container mx-auto px-4 py-16 max-w-md">
      <h1 className="text-2xl md:text-3xl font-black text-center mb-8">Tài khoản</h1>

      <div className="flex justify-center gap-2 mb-6">
        <button
          onClick={() => setTab('signin')}
          className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
            tab === 'signin' ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:border-black'
          }`}
        >
          Đăng nhập
        </button>
        <button
          onClick={() => setTab('signup')}
          className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
            tab === 'signup' ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:border-black'
          }`}
        >
          Đăng ký
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 border">
        {tab === 'signup' && (
          <>
            <label className="block text-sm font-medium mb-1">Họ và tên</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4"
              placeholder="Họ và tên"
            />
          </>
        )}

        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-4"
          placeholder="you@example.com"
        />

        <label className="block text-sm font-medium mb-1">Mật khẩu</label>
<div className="relative">
  <input
    type={showPassword ? 'text' : 'password'}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    className="w-full border rounded-lg px-3 py-2 mb-6"
    placeholder="••••••••"
  />
  <button
    onClick={togglePassword}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600"
  >
    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
  </button>
</div>


        {note && <div className="text-sm text-emerald-800 mb-4">{note}</div>}

        <button
          onClick={tab === 'signin' ? onSignIn : onSignUp}
          disabled={loading}
          className="w-full bg-black hover:bg-orange-500 text-white py-2.5 rounded-lg font-bold flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {tab === 'signin' ? 'Đăng nhập' : 'Đăng ký'}
        </button>

        <button
          type="button"
          onClick={() => { setShowForgot(true); setForgotEmail(email || ''); setForgotNote(null); }}
          className={`text-sm text-blue-500 hover:underline`}
        >
          Quên mật khẩu?
        </button>

        {showForgot ? (
          <div className="fixed inset-0 z-50 grid place-items-center px-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowForgot(false)} />
            <div className="relative bg-white rounded-2xl shadow-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-2">Quên mật khẩu</h3>
              <p className="text-sm text-gray-600 mb-4">Nhập email để nhận đường link đặt lại mật khẩu.</p>
              {forgotNote && <div className="text-sm text-red-600 mb-2">{forgotNote}</div>}
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 mb-4"
                placeholder="you@example.com"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForgot(false)} className="px-4 py-2 rounded-lg border">Hủy</button>
                <button
                  type="button"
                  onClick={async () => {
                    setForgotNote(null);
                    if (!forgotEmail || !forgotEmail.includes('@')) return setForgotNote('Vui lòng nhập email hợp lệ');
                    setForgotLoading(true);
                    try {
                      const redirectTo = `${window.location.origin}/auth/reset-password`;
                      const result = await supabase.auth.resetPasswordForEmail(forgotEmail, { redirectTo });
                      console.log('[Auth] resetPasswordForEmail (modal) result', result);
                      // @ts-ignore
                      if (result?.error) setForgotNote(result.error.message || String(result.error));
                      else setForgotNote('Đã gửi email hướng dẫn thay đổi mật khẩu. Vui lòng kiểm tra email của bạn.');
                    } catch (e: any) {
                      console.error('[Auth] forgot modal error', e);
                      setForgotNote(e?.message || 'Có lỗi xảy ra');
                    } finally {
                      setForgotLoading(false);
                    }
                  }}
                  disabled={forgotLoading}
                  className={`px-4 py-2 rounded-lg bg-black text-white ${forgotLoading ? 'opacity-60' : 'hover:bg-orange-500'}`}                
                >
                  {forgotLoading ? 'Đang gửi...' : 'Gửi'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <button
          onClick={() => setTab(tab === 'signin' ? 'signup' : 'signin')}
          className="mt-4 w-full border hover:border-black py-2.5 rounded-lg font-semibold"
        >
          {tab === 'signin' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
        </button>
      </div>
    </section>
  );
};
export default Auth; 
