import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Key, Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import type { ApiUsage } from '../types';

export function SettingsPage() {
  const { user } = useAuthStore();
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Check if user has a key stored
  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.data.session) return;
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-api-key`,
          {
            headers: { Authorization: `Bearer ${session.data.session.access_token}` },
          }
        );
        const data = await res.json();
        setHasKey(data.has_key === true);
      } catch { /* ignore */ }
    })();
  }, [user]);

  // Today's API usage
  const { data: usage } = useQuery({
    queryKey: ['api-usage'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('api_usage')
        .select('*')
        .eq('user_id', user?.id ?? '')
        .eq('date', today)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ApiUsage[];
    },
    enabled: !!user,
  });

  const saveKey = async () => {
    if (!keyInput.trim()) return;
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.data.session) throw new Error('Not authenticated');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-api-key`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.data.session.access_token}`,
          },
          body: JSON.stringify({ action: 'save', key: keyInput.trim() }),
        }
      );

      if (!res.ok) throw new Error('Failed to save key');
      toast.success('API key saved securely');
      setHasKey(true);
      setKeyInput('');
      setShowKey(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteKey = async () => {
    if (!confirm('Remove your Gemini API key?')) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.data.session) throw new Error('Not authenticated');

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-api-key`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.data.session.access_token}`,
          },
          body: JSON.stringify({ action: 'delete' }),
        }
      );
      toast.success('API key removed');
      setHasKey(false);
    } catch {
      toast.error('Failed to remove key');
    }
  };

  const totalToday = usage?.reduce((sum, u) => sum + u.request_count, 0) ?? 0;
  const LIMIT = 1500;
  const remaining = LIMIT - totalToday;
  const pct = Math.min(100, (totalToday / LIMIT) * 100);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 font-serif text-2xl font-bold text-ink">Settings</h1>

      {/* API Key Section */}
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <Key size={18} className="text-quill" />
          <h2 className="text-sm font-semibold text-ink">Gemini API Key</h2>
        </div>

        {hasKey ? (
          <div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <span className="font-mono text-sm text-gray-500">
                {showKey ? keyInput || '••••••••••••••' : '••••••••••••••••••'}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setShowKey(!showKey)} className="rounded p-1 text-gray-400 hover:bg-gray-200">
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={deleteKey} className="rounded px-2 py-0.5 text-xs text-red-500 hover:bg-red-50">
                  Remove
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              ✅ Key stored securely in Supabase Vault (encrypted, never exposed to client)
            </p>
          </div>
        ) : (
          <div>
            <input
              type={showKey ? 'text' : 'password'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Paste your Gemini API key…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-quill focus:outline-none"
            />
            <button
              onClick={saveKey}
              disabled={saving || !keyInput.trim()}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-quill px-3 py-2 text-sm font-medium text-white hover:bg-quill-dark disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
              Save Securely
            </button>
            <p className="mt-2 text-xs text-gray-400">
              Get a free key at{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-quill underline">
                Google AI Studio
              </a>
              . Free tier: 1500 requests/day (Gemini 3.5 Flash).
            </p>
          </div>
        )}
      </section>

      {/* Quota Section */}
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <Zap size={18} className="text-quill" />
          <h2 className="text-sm font-semibold text-ink">AI Usage Today</h2>
        </div>

        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-600">{totalToday} / {LIMIT} requests</span>
          <span className="font-medium text-quill">{remaining} remaining</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-quill to-quill-dark transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        {usage && usage.length > 0 && (
          <div className="mt-3 space-y-1">
            {usage.map((u) => (
              <div key={u.id} className="flex justify-between text-xs text-gray-500">
                <span>{u.model}</span>
                <span>{u.request_count} requests</span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-gray-400">
          Quota resets daily at 00:00 UTC. Each AI generation = 1 request.
        </p>
      </section>

      {/* Tips */}
      <section className="rounded-xl border border-quill-light bg-quill-light/10 p-5">
        <h2 className="mb-2 text-sm font-semibold text-quill-dark">💡 Quota-Saving Tips</h2>
        <ul className="space-y-1 text-xs text-gray-600">
          <li>• Each "AI Generate" combines prose + entity update in 1 call</li>
          <li>• Scene card edits are cached — unchanged scenes cost 0 requests</li>
          <li>• Consistency check is manual (only run when you need it)</li>
          <li>• Entity name detection is rule-based (0 API calls)</li>
        </ul>
      </section>
    </div>
  );
}
