import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

function parseHash(hash: string) {
  // hash like #access_token=...&refresh_token=...&type=recovery
  if (!hash) return {} as Record<string,string>;
  return Object.fromEntries(new URLSearchParams(hash.replace(/^#/, '')));
}

function parseQuery(q: string) {
  if (!q) return {} as Record<string,string>;
  return Object.fromEntries(new URLSearchParams(q.replace(/^\?/, '')));
}

const ResetPassword: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);
      setNote(null);

      try {
        const query = parseQuery(window.location.search);
        const hash = parseHash(window.location.hash);

        const access_token = query['access_token'] || hash['access_token'] || query['token'] || hash['token'];
        const refresh_token = query['refresh_token'] || hash['refresh_token'];
        const type = query['type'] || hash['type'];

        // Log presence of tokens for debugging (do not print token values in production)
        console.log('[ResetPassword] parsed tokens present?', {
          has_access_token: !!access_token,
          has_refresh_token: !!refresh_token,
          type,
        });

        if (!access_token) {
          setNote('Không tìm thấy token đặt lại mật khẩu. Vui lòng mở link từ email hoặc gửi lại yêu cầu quên mật khẩu.');
          setLoading(false);
          return;
        }

        // Set session so we can call updateUser
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) {
          console.error('[ResetPassword] setSession error', error);
          setNote('Không thể thiết lập phiên đăng nhập tự động. Vui lòng thử lại hoặc liên hệ quản trị viên.');
          setLoading(false);
          return;
        }

        // OK - user is authenticated via temporary session, allow password set
        setReady(true);
      } catch (e: any) {
        console.error('[ResetPassword] error', e);
        setNote('Có lỗi xảy ra. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNote(null);
    if (!password || password.length < 6) return setNote('Mật khẩu cần ít nhất 6 ký tự');
    if (password !== confirm) return setNote('Mật khẩu nhập lại không khớp');

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        console.error('[ResetPassword] updateUser error', error);
        setNote(error.message || 'Không thể cập nhật mật khẩu');
        setLoading(false);
        return;
      }

      setNote('Đổi mật khẩu thành công. Bạn sẽ được chuyển tới trang đăng nhập.');
      // Small delay then redirect to auth/signin
      setTimeout(() => navigate('/auth'), 1500);
    } catch (e: any) {
      console.error('[ResetPassword] submit error', e);
      setNote(e?.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="container mx-auto px-4 py-16 max-w-md">
      <h1 className="text-2xl md:text-3xl font-black text-center mb-8">Đặt lại mật khẩu</h1>

      {loading ? (
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          <div className="mt-3 text-gray-600">Đang xử lý...</div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow p-6 border">
          {note && <div className="text-sm text-red-600 mb-4">{note}</div>}

          {ready ? (
            <form onSubmit={onSubmit}>
              <label className="block text-sm font-medium mb-1">Mật khẩu mới</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded-lg px-3 py-2 mb-4" />

              <label className="block text-sm font-medium mb-1">Xác nhận mật khẩu</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full border rounded-lg px-3 py-2 mb-4" />

              <button type="submit" disabled={loading} className="w-full bg-black text-white py-2.5 rounded-lg font-bold">
                {loading ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
              </button>
            </form>
          ) : (
            <div>
              <p className="text-gray-700 mb-4">Không thể xác thực token đặt lại mật khẩu. Vui lòng mở link từ email hoặc thực hiện quên mật khẩu lại.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default ResetPassword;
