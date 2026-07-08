import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { Entity, EntityMetadata } from '../types';

export function EntityPanel({
  workId,
  type,
  entities,
}: {
  workId: string;
  type: Entity['type'];
  entities: Entity[];
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const filtered = entities.filter((e) => e.type === type);

  const createEntity = useMutation({
    mutationFn: async (name: string) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('未登入');
      const { data, error } = await supabase
        .from('entities')
        .insert({
          work_id: workId,
          type,
          name,
          owner_id: userData.user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities', workId] });
      toast.success('實體已創建');
      setShowCreate(false);
      setNewName('');
    },
  });

  const updateEntity = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Entity> }) => {
      const { error } = await supabase.from('entities').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entities', workId] }),
  });

  const deleteEntity = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('entities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities', workId] });
      toast.success('已刪除');
    },
  });

  const typeIcons: Record<string, string> = {
    character: '👤',
    worldbuilding: '🌍',
    foreshadow: '🔍',
    timeline_event: '📅',
  };

  const typeNames: Record<string, string> = {
    character: '角色',
    worldbuilding: '世界觀',
    foreshadow: '伏筆',
    timeline_event: '事件',
  };

  const statusLabels: Record<string, Record<string, string>> = {
    character: { alive: '存活', dead: '死亡', missing: '失蹤', '': '未設定' },
    foreshadow: { planted: '已埋設', in_progress: '推進中', resolved: '已回收', abandoned: '放棄', '': '未設定' },
  };

  return (
    <div className="max-h-full overflow-y-auto p-2">
      {showCreate && (
        <div className="mb-2 flex gap-1">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) createEntity.mutate(newName.trim());
            }}
            placeholder={`新${typeNames[type]}名稱…`}
            className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs"
          />
          <button
            onClick={() => { if (newName.trim()) createEntity.mutate(newName.trim()); }}
            className="rounded bg-quill px-2 py-1 text-xs text-white hover:bg-quill-dark"
          >
            新增
          </button>
          <button onClick={() => setShowCreate(false)} className="text-xs text-gray-400">✕</button>
        </div>
      )}
      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="mb-2 flex items-center gap-1 text-xs text-quill hover:text-quill-dark"
        >
          <Plus size={12} /> 新增{typeNames[type]}
        </button>
      )}

      {filtered.length === 0 && (
        <p className="px-2 py-4 text-center text-xs text-gray-400">尚未有{typeNames[type]}資料</p>
      )}

      {filtered.map((entity) => (
        <div key={entity.id} className="mb-1 rounded-lg border border-gray-100">
          <div
            className="flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-gray-50"
            onClick={() => setExpanded(expanded === entity.id ? null : entity.id)}
          >
            {expanded === entity.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className="text-sm">{typeIcons[type]}</span>
            <span className="flex-1 truncate text-sm font-medium text-gray-700">{entity.name}</span>
            {entity.status && (
              <span className="text-xs text-gray-400">{statusLabels[type]?.[entity.status] ?? entity.status}</span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`確定刪除「${entity.name}」？`)) deleteEntity.mutate(entity.id);
              }}
              className="text-gray-300 hover:text-red-500"
            >
              <Trash2 size={11} />
            </button>
          </div>

          {expanded === entity.id && (
            <div className="border-t border-gray-100 px-2 py-2">
              <textarea
                defaultValue={entity.description}
                onBlur={(e) => {
                  if (e.target.value !== entity.description) {
                    updateEntity.mutate({ id: entity.id, patch: { description: e.target.value } });
                  }
                }}
                placeholder="描述…"
                className="mb-2 w-full rounded border border-gray-200 px-2 py-1 text-xs"
                rows={3}
              />

              {type === 'character' && (
                <>
                  <div className="mb-1.5">
                    <label className="text-xs text-gray-500">狀態</label>
                    <select
                      defaultValue={entity.status}
                      onChange={(e) => updateEntity.mutate({ id: entity.id, patch: { status: e.target.value } })}
                      className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs"
                    >
                      <option value="">—</option>
                      <option value="alive">存活</option>
                      <option value="dead">死亡</option>
                      <option value="missing">失蹤</option>
                    </select>
                  </div>
                  <div className="mb-1.5">
                    <label className="text-xs text-gray-500">別名（以逗號分隔）</label>
                    <input
                      type="text"
                      defaultValue={entity.aliases?.join(', ') ?? ''}
                      onBlur={(e) => {
                        const aliases = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                        updateEntity.mutate({ id: entity.id, patch: { aliases } });
                      }}
                      placeholder="e.g. 小明, 阿明, 明仔"
                      className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs"
                    />
                  </div>
                  <div className="mb-1.5">
                    <label className="text-xs text-gray-500">當前心情</label>
                    <input
                      type="text"
                      defaultValue={(entity.metadata as EntityMetadata)?.current_state?.mood ?? ''}
                      onBlur={(e) => {
                        const meta = { ...entity.metadata } as EntityMetadata;
                        meta.current_state = { ...meta.current_state, mood: e.target.value };
                        updateEntity.mutate({ id: entity.id, patch: { metadata: meta } });
                      }}
                      placeholder="e.g. 好奇"
                      className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs"
                    />
                  </div>
                </>
              )}

              {type === 'foreshadow' && (
                <>
                  <div className="mb-1.5">
                    <label className="text-xs text-gray-500">狀態</label>
                    <select
                      defaultValue={entity.status}
                      onChange={(e) => updateEntity.mutate({ id: entity.id, patch: { status: e.target.value } })}
                      className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs"
                    >
                      <option value="">—</option>
                      <option value="planted">已埋設</option>
                      <option value="in_progress">推進中</option>
                      <option value="resolved">已回收</option>
                      <option value="abandoned">放棄</option>
                    </select>
                  </div>
                  <div className="mb-1.5">
                    <label className="text-xs text-gray-500">重要性（1-5）</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      defaultValue={(entity.metadata as EntityMetadata)?.importance ?? 3}
                      onBlur={(e) => {
                        const meta = { ...entity.metadata } as EntityMetadata;
                        meta.importance = parseInt(e.target.value);
                        updateEntity.mutate({ id: entity.id, patch: { metadata: meta } });
                      }}
                      className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs"
                    />
                  </div>
                </>
              )}

              {type === 'worldbuilding' && (
                <div className="mb-1.5">
                  <label className="text-xs text-gray-500">分類</label>
                  <select
                    defaultValue={(entity.metadata as EntityMetadata)?.category ?? ''}
                    onChange={(e) => {
                      const meta = { ...entity.metadata } as EntityMetadata;
                      meta.category = e.target.value;
                      updateEntity.mutate({ id: entity.id, patch: { metadata: meta } });
                    }}
                    className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs"
                  >
                    <option value="">—</option>
                    <option value="geography">地理</option>
                    <option value="magic">魔法</option>
                    <option value="society">社會</option>
                    <option value="faction">勢力</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
