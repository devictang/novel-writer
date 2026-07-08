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
      if (!session.data.session) throw new Error('未登入');

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

      if (!res.ok) throw new Error('儲存金鑰失敗');
      toast.success('API 金鑰已安全儲存');
      setHasKey(true);
      setKeyInput('');
      setShowKey(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const deleteKey = async () => {
    if (!confirm('確定移除你的 Gemini API 金鑰？')) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.data.session) throw new Error('未登入');

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
      toast.success('API 金鑰已移除');
      setHasKey(false);
    } catch {
      toast.error('移除金鑰失敗');
    }
  };

  const totalToday = usage?.reduce((sum, u) => sum + u.request_count, 0) ?? 0;
  const LIMIT = 1500;
  const remaining = LIMIT - totalToday;
  const pct = Math.min(100, (totalToday / LIMIT) * 100);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 font-serif text-2xl font-bold text-ink">設定</h1>

      {/* API Key Section */}
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <Key size={18} className="text-quill" />
          <h2 className="text-sm font-semibold text-ink">Gemini API 金鑰</h2>
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
                  移除
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              ✅ 金鑰已安全儲存於 Supabase Vault（加密儲存，永不會暴露於前端）
            </p>
          </div>
        ) : (
          <div>
            <input
              type={showKey ? 'text' : 'password'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="貼上你的 Gemini API 金鑰…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-quill focus:outline-none"
            />
            <button
              onClick={saveKey}
              disabled={saving || !keyInput.trim()}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-quill px-3 py-2 text-sm font-medium text-white hover:bg-quill-dark disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
              安全儲存
            </button>
            <p className="mt-2 text-xs text-gray-400">
              免費金鑰可於{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-quill underline">
                Google AI Studio
              </a>{' '}
              取得。免費額度：每日 1500 次請求（Gemini 3.5 Flash）。
            </p>
          </div>
        )}
      </section>

      {/* Quota Section */}
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <Zap size={18} className="text-quill" />
          <h2 className="text-sm font-semibold text-ink">今日 AI 用量</h2>
        </div>

        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-600">{totalToday} / {LIMIT} 次請求</span>
          <span className="font-medium text-quill">剩餘 {remaining} 次</span>
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
                <span>{u.request_count} 次請求</span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-gray-400">
          配額每日於 00:00 UTC 重置。每次 AI 生成 = 1 次請求。
        </p>
      </section>

      {/* Tips */}
      <section className="rounded-xl border border-quill-light bg-quill-light/10 p-5">
        <h2 className="mb-2 text-sm font-semibold text-quill-dark">💡 慳配額貼士</h2>
        <ul className="space-y-1 text-xs text-gray-600">
          <li>• 每次「AI 生成」已合併 prose 生成 + 實體更新，只需 1 次請求</li>
          <li>• 場景卡內容有快取 — 未改動的場景不需任何請求</li>
          <li>• 一致性檢查為手動觸發（需要時才使用）</li>
          <li>• 實體名稱偵測使用規則比對（不需 API 請求）</li>
        </ul>
      </section>
    </div>
  );
}
