import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import CharacterCount from '@tiptap/extension-character-count';
import toast from 'react-hot-toast';
import {
  BookOpen, Plus, FileText, ChevronRight, ChevronDown,
  Users, Globe, Lightbulb, Sparkles, Save, Eye, Clock,
} from 'lucide-react';
import type { Work, Chapter, Entity, ChapterStatus } from '../types';
import { EntityPanel } from '../components/EntityPanel';
import { SceneCardEditor } from '../components/SceneCardEditor';

export function WorkspacePage() {
  const { workId, chapterId } = useParams();
  const navigate = useNavigate();

  if (!workId) return <WorksListPage />;

  return <WorkEditor workId={workId} chapterId={chapterId} />;
}

// ============================================================
// Works List — Dashboard
// ============================================================
function WorksListPage() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const { data: works } = useQuery({
    queryKey: ['works'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('works')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Work[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('未登入');
      const { data, error } = await supabase
        .from('works')
        .insert({ title, owner_id: userData.user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (work) => {
      toast.success(`已創建「${work.title}」`);
      navigate(`/workspace/${work.id}`);
    },
  });

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-2xl font-bold text-ink">我的作品</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-quill px-3 py-2 text-sm font-medium text-white hover:bg-quill-dark"
          >
            <Plus size={16} /> 新作品
          </button>
        </div>

        {showCreate && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTitle.trim()) {
                    createMutation.mutate(newTitle.trim());
                    setShowCreate(false);
                    setNewTitle('');
                  }
                }}
                placeholder="作品名稱…"
                className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-quill focus:outline-none"
              />
              <button
                onClick={() => {
                  if (newTitle.trim()) {
                    createMutation.mutate(newTitle.trim());
                    setShowCreate(false);
                    setNewTitle('');
                  }
                }}
                className="rounded-lg bg-quill px-4 py-2 text-sm font-medium text-white hover:bg-quill-dark"
              >
                新增
              </button>
              <button onClick={() => { setShowCreate(false); setNewTitle(''); }} className="text-sm text-gray-400">✕</button>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {works?.map((w) => (
            <button
              key={w.id}
              onClick={() => navigate(`/workspace/${w.id}`)}
              className="rounded-lg border border-gray-200 bg-white p-4 text-left transition hover:border-quill hover:shadow-sm"
            >
              <BookOpen size={20} className="mb-2 text-quill" />
              <h3 className="font-serif text-lg font-semibold text-ink">{w.title}</h3>
              <p className="mt-1 text-xs text-gray-400">
                {new Date(w.updated_at).toLocaleDateString('zh-HK')}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Work Editor — Tree + Editor + Entity Panel
// ============================================================
function WorkEditor({ workId, chapterId }: { workId: string; chapterId?: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'tree' | 'entities' | 'scene'>('tree');
  const [entityType, setEntityType] = useState<Entity['type']>('character');

  const { data: work } = useQuery({
    queryKey: ['work', workId],
    queryFn: async () => {
      const { data, error } = await supabase.from('works').select('*').eq('id', workId).single();
      if (error) throw error;
      return data as Work;
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ['chapters', workId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('work_id', workId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as Chapter[];
    },
  });

  const { data: entities } = useQuery({
    queryKey: ['entities', workId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('work_id', workId)
        .order('name', { ascending: true });
      if (error) throw error;
      return data as Entity[];
    },
  });

  const activeChapter = chapters?.find((c) => c.id === chapterId) ?? null;

  const createChapter = useMutation({
    mutationFn: async (parentId: string | null) => {
      const maxOrder = chapters
        ?.filter((c) => c.parent_id === parentId)
        .reduce((max, c) => Math.max(max, c.sort_order), 0) ?? 0;
      const { data, error } = await supabase
        .from('chapters')
        .insert({
          work_id: workId,
          parent_id: parentId,
          sort_order: maxOrder + 1,
          title: '新章節',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', workId] });
      toast.success('章節已創建');
    },
  });

  return (
    <div className="flex h-full">
      {/* Left: Tree View */}
      <div className="flex w-72 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
          <span className="truncate font-serif text-sm font-semibold text-ink">{work?.title}</span>
          <button
            onClick={() => createChapter.mutate(null)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-quill"
            title="新增頂層章節"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {chapters?.map((ch) => (
            <ChapterNode key={ch.id} chapter={ch} allChapters={chapters ?? []} workId={workId} activeId={chapterId} />
          ))}
          {(!chapters || chapters.length === 0) && (
            <p className="px-2 py-4 text-center text-xs text-gray-400">
              尚未有章節，按 + 創建第一個章節。
            </p>
          )}
        </div>
      </div>

      {/* Center: Editor / Scene Card */}
      <div className="flex-1 overflow-y-auto">
        {activeChapter ? (
          <ChapterEditor chapter={activeChapter} entities={entities ?? []} workId={workId} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <FileText size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">選擇一個章節開始寫作</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Entity Panel */}
      <div className="w-72 shrink-0 border-l border-gray-200 bg-white">
        <div className="flex border-b border-gray-100">
          {(['character', 'worldbuilding', 'foreshadow'] as Entity['type'][]).map((t) => (
            <button
              key={t}
              onClick={() => { setEntityType(t); setActiveTab('entities'); }}
              className={`flex-1 py-2 text-xs font-medium capitalize transition ${
                activeTab === 'entities' && entityType === t
                  ? 'border-b-2 border-quill text-quill'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'character' ? '👤' : t === 'worldbuilding' ? '🌍' : '🔍'} {t === 'character' ? '角色' : t === 'worldbuilding' ? '世界觀' : '伏筆'}
            </button>
          ))}
        </div>
        <EntityPanel workId={workId} type={entityType} entities={entities ?? []} />
      </div>
    </div>
  );
}

// ============================================================
// Chapter Tree Node (recursive)
// ============================================================
function ChapterNode({
  chapter,
  allChapters,
  workId,
  activeId,
  depth = 0,
}: {
  chapter: Chapter;
  allChapters: Chapter[];
  workId: string;
  activeId?: string;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const children = allChapters.filter((c) => c.parent_id === chapter.id);

  const addChild = useMutation({
    mutationFn: async () => {
      const maxOrder = children.reduce((max, c) => Math.max(max, c.sort_order), 0);
      const { data, error } = await supabase
        .from('chapters')
        .insert({
          work_id: workId,
          parent_id: chapter.id,
          sort_order: maxOrder + 1,
          title: '新場景',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', workId] });
      setExpanded(true);
    },
  });

  const rename = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await supabase.from('chapters').update({ title }).eq('id', chapter.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chapters', workId] }),
  });

  const statusLabels: Record<ChapterStatus, string> = {
    scene_card: '場景卡',
    draft: '草稿',
    review: '審閱',
    final: '定稿',
  };

  const statusColors: Record<ChapterStatus, string> = {
    scene_card: 'bg-gray-300',
    draft: 'bg-blue-300',
    review: 'bg-yellow-300',
    final: 'bg-green-400',
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded px-1 py-1 text-sm hover:bg-gray-100 ${
          activeId === chapter.id ? 'bg-quill-light/30 font-medium' : ''
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {children.length > 0 ? (
          <button onClick={() => setExpanded(!expanded)} className="shrink-0">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusColors[chapter.status]}`} />
        <span
          className="flex-1 cursor-pointer truncate"
          onClick={() => navigate(`/workspace/${workId}/${chapter.id}`)}
          onDoubleClick={() => {
            const newTitle = prompt('重新命名章節：', chapter.title);
            if (newTitle && newTitle !== chapter.title) rename.mutate(newTitle);
          }}
        >
          {chapter.title}
        </span>
        <span className="text-[10px] text-gray-400">{statusLabels[chapter.status]}</span>
        <button
          onClick={() => addChild.mutate()}
          className="hidden shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 group-hover:block"
        >
          <Plus size={10} />
        </button>
      </div>
      {expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <ChapterNode
              key={child.id}
              chapter={child}
              allChapters={allChapters}
              workId={workId}
              activeId={activeId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Chapter Editor (TipTap + Scene Card + AI Generate)
// ============================================================
function ChapterEditor({
  chapter,
  entities,
  workId,
}: {
  chapter: Chapter;
  entities: Entity[];
  workId: string;
}) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [showSceneCard, setShowSceneCard] = useState(chapter.status === 'scene_card');
  const [showWritingBrief, setShowWritingBrief] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '開始寫作，或使用 AI 從場景卡生成…' }),
      Highlight,
      CharacterCount.configure({ limit: 100000 }),
    ],
    content: chapter.content,
    onUpdate: ({ editor }) => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveContent(editor.getJSON());
      }, 1000);
    },
  });

  let saveTimer: ReturnType<typeof setTimeout>;

  useEffect(() => {
    if (editor && chapter.content) {
      editor.commands.setContent(chapter.content);
    }
  }, [chapter.id]);

  const saveContent = useCallback(
    async (content: unknown) => {
      const wordCount = editor?.storage.characterCount.words() ?? 0;
      const { error } = await supabase
        .from('chapters')
        .update({
          content,
          word_count: wordCount,
          revision: chapter.revision + 1,
          status: chapter.status === 'scene_card' ? 'draft' : chapter.status,
        })
        .eq('id', chapter.id);
      if (error) {
        toast.error('自動儲存失敗');
      } else {
        queryClient.invalidateQueries({ queryKey: ['chapters', workId] });
      }
    },
    [chapter, editor, queryClient, workId]
  );

  const handleGenerate = async () => {
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
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '生成失敗');
      }

      const result = await response.json();

      if (result.prose && editor) {
        editor.commands.setContent(result.prose);
        saveContent(result.prose);
      }

      if (result.entity_updates && result.entity_updates.length > 0) {
        toast.success(`已生成！偵測到 ${result.entity_updates.length} 項實體變化。`);
        queryClient.invalidateQueries({ queryKey: ['entities', workId] });
      } else {
        toast.success('已生成！');
      }

      if (result.quota) {
        toast(`配額：${result.quota.used}/${result.quota.limit}`, { icon: '⚡' });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI 生成失敗');
    } finally {
      setGenerating(false);
    }
  };

  const words = editor?.storage.characterCount.words() ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-4">
      {/* Chapter Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-serif text-xl font-bold text-ink">{chapter.title}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSceneCard(!showSceneCard)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              showSceneCard ? 'bg-quill text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            場景卡
          </button>
          <button
            onClick={() => setShowWritingBrief(!showWritingBrief)}
            className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
          >
            寫作設定
          </button>
        </div>
      </div>

      {/* Scene Card Panel */}
      {showSceneCard && (
        <SceneCardEditor chapter={chapter} entities={entities} workId={workId} />
      )}

      {/* Writing Brief */}
      {showWritingBrief && (
        <WritingBriefPanel chapter={chapter} workId={workId} />
      )}

      {/* AI Generate Button */}
      <div className="mb-3 flex items-center gap-2 border-y border-gray-100 py-2">
        <button
          onClick={handleGenerate}
          disabled={generating || chapter.status === 'final'}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-quill to-quill-dark px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles size={14} />
          {generating ? '生成中…' : 'AI 生成'}
        </button>
        <span className="text-xs text-gray-400">
          使用場景卡 + 實體資料生成章節
        </span>
      </div>

      {/* TipTap Editor */}
      <div className="prose-sm min-h-[400px]">
        <EditorContent editor={editor} />
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-2 text-xs text-gray-400">
        <span>{words} 字</span>
        <span>修訂 {chapter.revision} · {chapter.status === 'scene_card' ? '場景卡' : chapter.status === 'draft' ? '草稿' : chapter.status === 'review' ? '審閱' : '定稿'}</span>
      </div>
    </div>
  );
}

// ============================================================
// Writing Brief Panel
// ============================================================
function WritingBriefPanel({ chapter, workId }: { chapter: Chapter; workId: string }) {
  const queryClient = useQueryClient();
  const brief = chapter.writing_brief;

  const update = async (field: string, value: string) => {
    const newBrief = { ...brief, [field]: value };
    await supabase.from('chapters').update({ writing_brief: newBrief }).eq('id', chapter.id);
    queryClient.invalidateQueries({ queryKey: ['chapters', workId] });
  };

  const fields = [
    { key: 'pov', label: '敘述視角', placeholder: 'e.g. 小明第三人稱有限視角' },
    { key: 'tone', label: '語調/氛圍', placeholder: 'e.g. 神秘 + 些少不安' },
    { key: 'pacing', label: '節奏', placeholder: 'e.g. 開頭平靜→中段緊張→結尾 cliffhanger' },
    { key: 'target_word_count', label: '目標字數', placeholder: 'e.g. 1500' },
    { key: 'author_notes', label: '作者補充筆記', placeholder: '呢場係全書轉捩點…' },
  ];

  return (
    <div className="mb-4 rounded-lg border border-quill-light bg-quill-light/10 p-3">
      <div className="mb-2 text-xs font-semibold text-quill-dark">📝 寫作設定</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-xs text-gray-500">{f.label}</label>
            <input
              type="text"
              defaultValue={(brief as Record<string, string>)?.[f.key] ?? ''}
              onBlur={(e) => update(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
