import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import type { Entity, EntityMetadata, SceneCard } from '../types';

export function SceneCardEditor({
  chapter,
  entities,
  workId,
}: {
  chapter: import('../types').Chapter;
  entities: Entity[];
  workId: string;
}) {
  const queryClient = useQueryClient();
  const card = chapter.scene_card || { summary: '', characters: [], locations: [], foreshadows: [], notes: '' };

  const update = async (field: keyof SceneCard, value: unknown) => {
    const newCard = { ...card, [field]: value };
    await supabase.from('chapters').update({ scene_card: newCard }).eq('id', chapter.id);
    queryClient.invalidateQueries({ queryKey: ['chapters', workId] });
  };

  const characters = entities.filter((e) => card.characters?.includes(e.id));
  const locations = entities.filter((e) => card.locations?.includes(e.id));
  const foreshadows = entities.filter((e) => card.foreshadows?.includes(e.id));

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 text-xs font-semibold text-gray-600">📋 Scene Card</div>

      {/* Summary */}
      <textarea
        defaultValue={card.summary ?? ''}
        onBlur={(e) => update('summary', e.target.value)}
        placeholder="Scene summary: what happens in this scene?"
        className="mb-3 w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
        rows={2}
      />

      {/* Entity selectors */}
      <div className="grid gap-2 sm:grid-cols-3">
        <EntitySelector
          label="👤 Characters"
          type="character"
          entities={entities}
          selected={card.characters ?? []}
          onChange={(ids) => update('characters', ids)}
          workId={workId}
        />
        <EntitySelector
          label="🌍 Locations"
          type="worldbuilding"
          entities={entities}
          selected={card.locations ?? []}
          onChange={(ids) => update('locations', ids)}
          workId={workId}
        />
        <EntitySelector
          label="🔍 Foreshadows"
          type="foreshadow"
          entities={entities}
          selected={card.foreshadows ?? []}
          onChange={(ids) => update('foreshadows', ids)}
          workId={workId}
        />
      </div>

      {/* Notes */}
      <input
        defaultValue={card.notes ?? ''}
        onBlur={(e) => update('notes', e.target.value)}
        placeholder="Scene notes (optional)…"
        className="mt-2 w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs"
      />
    </div>
  );
}

function EntitySelector({
  label,
  type,
  entities,
  selected,
  onChange,
  workId,
}: {
  label: string;
  type: Entity['type'];
  entities: Entity[];
  selected: string[];
  onChange: (ids: string[]) => void;
  workId: string;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const queryClient = useQueryClient();

  const available = entities.filter((e) => e.type === type && !selected.includes(e.id));
  const chosen = entities.filter((e) => selected.includes(e.id));

  const createEntity = useMutation({
    mutationFn: async (name: string) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');
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
    onSuccess: (entity) => {
      queryClient.invalidateQueries({ queryKey: ['entities', workId] });
      onChange([...selected, entity.id]);
      setShowPicker(false);
    },
  });

  return (
    <div className="rounded border border-gray-200 bg-white p-2">
      <div className="mb-1 text-xs font-medium text-gray-500">{label}</div>
      <div className="space-y-1">
        {chosen.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded bg-gray-50 px-1.5 py-0.5 text-xs">
            <span className="truncate">{e.name}</span>
            <button
              onClick={() => onChange(selected.filter((id) => id !== e.id))}
              className="text-gray-400 hover:text-red-500"
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
      {showPicker ? (
        <div className="mt-1">
          {available.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                onChange([...selected, e.id]);
              }}
              className="block w-full rounded px-1.5 py-0.5 text-left text-xs hover:bg-gray-100"
            >
              {e.name}
            </button>
          ))}
          <div className="mt-1 flex gap-1">
            <input
              type="text"
              placeholder="New name…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const name = (e.target as HTMLInputElement).value.trim();
                  if (name) createEntity.mutate(name);
                }
              }}
              className="flex-1 rounded border border-gray-200 px-1 py-0.5 text-xs"
            />
            <button onClick={() => setShowPicker(false)} className="text-xs text-gray-400">✕</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowPicker(true)}
          className="mt-1 flex items-center gap-0.5 text-xs text-quill hover:text-quill-dark"
        >
          <Plus size={10} /> Add
        </button>
      )}
    </div>
  );
}
