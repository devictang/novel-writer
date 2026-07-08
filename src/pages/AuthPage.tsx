import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Feather } from 'lucide-react';

export function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
          },
        });
        if (error) throw error;
        toast.success('帳戶已創建！請檢查電郵確認。');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('歡迎回來！');
        navigate('/workspace');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '認證失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Feather className="mx-auto mb-3 text-quill" size={48} />
          <h1 className="font-serif text-3xl font-bold text-ink">Novel Writer</h1>
          <p className="mt-1 text-sm text-ink-muted">敘事管理與寫作助手</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                mode === 'signin'
                  ? 'bg-quill text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              登入
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                mode === 'signup'
                  ? 'bg-quill text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              註冊
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">電郵</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-quill focus:outline-none focus:ring-1 focus:ring-quill"
                placeholder="author@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">密碼</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-quill focus:outline-none focus:ring-1 focus:ring-quill"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-quill py-2.5 text-sm font-medium text-white transition hover:bg-quill-dark disabled:opacity-50"
            >
              {loading ? '載入中…' : mode === 'signin' ? '登入' : '建立帳戶'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          <Link to="/read/demo" className="hover:text-quill">讀者模式？開啟分享連結 →</Link>
        </p>
      </div>
    </div>
  );
}
