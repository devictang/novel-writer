import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Plus, Sparkles, ChevronUp, ChevronDown, FileText, Eye, Edit3 } from 'lucide-react';
import type { Chapter, Entity } from '../types';
import { SceneCardEditor } from '../components/SceneCardEditor';

interface ChapterOverviewProps {
  chapter: Chapter;
  scenes: Chapter[];
  entities: Entity[];
  workId: string;
}

export function ChapterOverview({ chapter, scenes, entities, workId }: ChapterOverviewProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [expandedScene, setExpandedScene] = useState<string | null>(null);

  // Edit scene title
  const renameScene = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from('chapters').update({ title }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chapters', workId] }),
  });

  // Reorder scene
  const moveScene = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      const idx = scenes.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= scenes.length) return;

      const current = scenes[idx];
      const swap = scenes[swapIdx];
      const tempOrder = current.sort_order;

      await supabase.from('chapters').update({ sort_order: swap.sort_order }).eq('id', current.id);
      await supabase.from('chapters').update({ sort_order: tempOrder }).eq('id', swap.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chapters', workId] }),
  });

  // Add new scene
  const addScene = useMutation({
    mutationFn: async () => {
      const maxOrder = scenes.reduce((max, s) => Math.max(max, s.sort_order), 0);
      const { data, error } = await supabase
        .from('chapters')
        .insert({
          work_id: workId,
          parent_id: chapter.id,
          sort_order: maxOrder + 1,
          title: `場景 ${scenes.length + 1}`,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chapters', workId] });
      toast.success('場景已新增');
      navigate(`/workspace/${workId}/${data.id}`);
    },
  });

  // Generate full chapter (combine all scenes)
  const handleGenerateFullChapter = async () => {
    if (scenes.length === 0) {
      toast.error('請先新增場景');
      return;
    }
    setGenerating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.data.session?.access_token) throw new Error('未登入');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-prose`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.data.session.access_token}`,
          },
          body: JSON.stringify({
            chapter_id: chapter.id,
            work_id: workId,
            mode: 'combine_scenes',
            scene_ids: scenes.map((s) => s.id),
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '生成失敗');
      }

      const result = await response.json();

      if (result.prose) {
        // Save combined prose to the parent chapter
        await supabase
          .from('chapters')
          .update({ content: result.prose, word_count: 0, revision: chapter.revision + 1 })
          .eq('id', chapter.id);
      }

      if (result.entity_updates?.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['entities', workId] });
      }

      toast.success(`全章生成完成！${result.entity_updates?.length || 0} 項實體更新。`);
      queryClient.invalidateQueries({ queryKey: ['chapters', workId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI 生成失敗');
    } finally {
      setGenerating(false);
    }
  };

  const statusLabels: Record<string, string> = {
    scene_card: '場景卡',
    draft: '草稿',
    review: '審閱',
    final: '定稿',
  };

  const statusColors: Record<string, string> = {
    scene_card: 'bg-gray-300',
    draft: 'bg-blue-400',
    review: 'bg-yellow-400',
    final: 'bg-green-500',
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-4">
      {/* Chapter header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl font-bold text-ink">{chapter.title}</h1>
          <p className="text-xs text-gray-400">{scenes.length} 個場景</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => addScene.mutate()}
            className="flex items-center gap-1 rounded-lg border border-quill px-2.5 py-1 text-xs font-medium text-quill hover:bg-quill-light/10"
          >
            <Plus size={12} /> 新增場景
          </button>
          <button
            onClick={handleGenerateFullChapter}
            disabled={generating || scenes.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-quill to-quill-dark px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Sparkles size={14} />
            {generating ? '生成中…' : '生成全章'}
          </button>
        </div>
      </div>

      {/* AI context note */}
      <div className="mb-4 rounded-lg bg-quill-light/10 px-3 py-2 text-xs text-gray-600">
        💡 AI 會依次生成每個場景 prose，自動加入轉場標記（根據 writing brief 嘅 transition_hint），合成一個完整章節。
      </div>

      {/* Scene list */}
      {scenes.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200">
          <FileText size={32} className="mb-2 text-gray-300" />
          <p className="text-sm text-gray-400">尚未有場景</p>
          <button
            onClick={() => addScene.mutate()}
            className="mt-2 text-xs text-quill hover:underline"
          >
            + 新增第一個場景
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {scenes.map((scene, i) => {
            const card = (scene.scene_card || {}) as { summary?: string };
            return (
              <div
                key={scene.id}
                className="rounded-lg border border-gray-200 bg-white transition hover:border-quill"
              >
                {/* Scene header */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="flex shrink-0 flex-col">
                    <button
                      onClick={() => moveScene.mutate({ id: scene.id, direction: 'up' })}
                      disabled={i === 0}
                      className="text-gray-300 hover:text-gray-500 disabled:opacity-30"
                    >
                      <ChevronUp size={10} />
                    </button>
                    <button
                      onClick={() => moveScene.mutate({ id: scene.id, direction: 'down' })}
                      disabled={i === scenes.length - 1}
                      className="text-gray-300 hover:text-gray-500 disabled:opacity-30"
                    >
                      <ChevronDown size={10} />
                    </button>
                  </div>

                  <div className={`h-2 w-2 shrink-0 rounded-full ${statusColors[scene.status]}`} />

                  <span
                    className="flex-1 cursor-pointer truncate text-sm font-medium text-gray-700 hover:text-quill"
                    onDoubleClick={() => {
                      const newTitle = prompt('重新命名場景：', scene.title);
                      if (newTitle && newTitle !== scene.title) renameScene.mutate({ id: scene.id, title: newTitle });
                    }}
                  >
                    {scene.title}
                  </span>

                  <span className="text-[10px] text-gray-400">{statusLabels[scene.status]}</span>

                  <div className="flex gap-0.5">
                    <button
                      onClick={() => navigate(`/workspace/${workId}/${scene.id}`)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-quill"
                      title="編輯場景"
                    >
                      <Edit3 size={12} />
                    </button>
                  </div>
                </div>

                {/* Scene card quick view */}
                <div className="border-t border-gray-100 px-3 pb-2 pt-1">
                  <button
                    onClick={() => setExpandedScene(expandedScene === scene.id ? null : scene.id)}
                    className="w-full text-left"
                  >
                    <p className="text-xs text-gray-500 line-clamp-1">
                      {card.summary || <span className="italic">未有場景摘要</span>}
                    </p>
                  </button>

                  {expandedScene === scene.id && (
                    <div className="mt-2">
                      <SceneCardEditor chapter={scene} entities={entities} workId={workId} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
