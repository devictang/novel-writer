import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Feather, CheckCircle2, Loader2 } from 'lucide-react';

export function ConfirmPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'confirming' | 'confirmed' | 'error'>('confirming');
  const [message, setMessage] = useState('Verifying your email…');

  useEffect(() => {
    // Supabase automatically picks up tokens from the URL hash fragment.
    // We listen for the auth state change and redirect once confirmed.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setStatus('confirmed');
        setMessage('Email confirmed! Redirecting to workspace…');
        setTimeout(() => navigate('/workspace'), 1500);
      } else if (event === 'USER_UPDATED') {
        // Confirmation may come as USER_UPDATED when the email is confirmed
        // while the user is already partially signed in
        if (session) {
          setStatus('confirmed');
          setMessage('Email confirmed! Redirecting…');
          setTimeout(() => navigate('/workspace'), 1500);
        }
      }
    });

    // Also try to get existing session (handles case where hash was already processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus('confirmed');
        setMessage('Already signed in. Redirecting…');
        setTimeout(() => navigate('/workspace'), 1000);
      } else {
        // If no session after 8 seconds, something went wrong
        setTimeout(() => {
          setStatus('error');
          setMessage('Confirmation link may be invalid or expired.');
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
            <h1 className="font-serif text-xl font-semibold text-ink">Confirming your email…</h1>
            <p className="mt-2 text-sm text-gray-500">{message}</p>
          </>
        )}

        {status === 'confirmed' && (
          <>
            <CheckCircle2 size={48} className="mx-auto mb-3 text-green-500" />
            <h1 className="font-serif text-xl font-semibold text-ink">Email Confirmed!</h1>
            <p className="mt-2 text-sm text-gray-500">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <span className="text-xl text-red-500">!</span>
            </div>
            <h1 className="font-serif text-xl font-semibold text-ink">Confirmation Failed</h1>
            <p className="mt-2 text-sm text-gray-500">{message}</p>
            <button
              onClick={() => navigate('/auth')}
              className="mt-4 rounded-lg bg-quill px-4 py-2 text-sm font-medium text-white hover:bg-quill-dark"
            >
              Back to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}
