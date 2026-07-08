import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Feather, CheckCircle2, Loader2 } from 'lucide-react';

export function ConfirmPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'confirming' | 'confirmed' | 'error'>('confirming');
  const [message, setMessage] = useState('正在驗證你的電郵…');

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setStatus('confirmed');
        setMessage('電郵已確認！即將跳轉到工作區…');
        setTimeout(() => navigate('/workspace'), 1500);
      } else if (event === 'USER_UPDATED') {
        if (session) {
          setStatus('confirmed');
          setMessage('電郵已確認！即將跳轉…');
          setTimeout(() => navigate('/workspace'), 1500);
        }
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus('confirmed');
        setMessage('已經登入。即將跳轉…');
        setTimeout(() => navigate('/workspace'), 1000);
      } else {
        setTimeout(() => {
          setStatus('error');
          setMessage('確認連結可能無效或已過期。');
        }, 8000);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
      <div className="w-full max-w-md text-center">
        <Feather className="mx-auto mb-4 text-quill" size={48} />

        {status === 'confirming' && (
          <>
            <Loader2 size={32} className="mx-auto mb-3 animate-spin text-quill" />
            <h1 className="font-serif text-xl font-semibold text-ink">正在確認你的電郵…</h1>
            <p className="mt-2 text-sm text-gray-500">{message}</p>
          </>
        )}

        {status === 'confirmed' && (
          <>
            <CheckCircle2 size={48} className="mx-auto mb-3 text-green-500" />
            <h1 className="font-serif text-xl font-semibold text-ink">電郵已確認！</h1>
            <p className="mt-2 text-sm text-gray-500">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <span className="text-xl text-red-500">!</span>
            </div>
            <h1 className="font-serif text-xl font-semibold text-ink">確認失敗</h1>
            <p className="mt-2 text-sm text-gray-500">{message}</p>
            <button
              onClick={() => navigate('/auth')}
              className="mt-4 rounded-lg bg-quill px-4 py-2 text-sm font-medium text-white hover:bg-quill-dark"
            >
              返回登入
            </button>
          </>
        )}
      </div>
    </div>
  );
}
