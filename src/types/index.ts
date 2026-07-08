// ============================================================
// Core Type Definitions
// ============================================================

export type EntityType = 'character' | 'worldbuilding' | 'foreshadow' | 'timeline_event';
export type ChapterStatus = 'scene_card' | 'draft' | 'review' | 'final';

export interface Work {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  default_writing_brief: WritingBrief;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  work_id: string;
  parent_id: string | null;
  sort_order: number;
  title: string;
  content: unknown[]; // TipTap JSON
  status: ChapterStatus;
  scene_card: SceneCard;
  writing_brief: WritingBrief;
  word_count: number;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface SceneCard {
  summary: string;
  characters: string[];   // entity IDs
  locations: string[];    // entity IDs
  foreshadows: string[];  // entity IDs
  notes: string;
}

export interface WritingBrief {
  pov?: string;
  tone?: string;
  dialogue_ratio?: string;
  pacing?: string;
  target_word_count?: number;
  author_notes?: string;
}

export interface Entity {
  id: string;
  work_id: string;
  type: EntityType;
  name: string;
  description: string;
  aliases: string[];
  status: string;
  metadata: EntityMetadata;
  created_at: string;
  updated_at: string;
}

export interface EntityMetadata {
  // character
  age?: number | string;
  occupation?: string;
  traits?: string[];
  current_state?: {
    location?: string;
    mood?: string;
    carrying?: string[];
    custom?: Record<string, unknown>;
  };
  relationships?: Array<{
    target_id: string;
    target_name?: string;
    type: string;
    description?: string;
  }>;
  // worldbuilding
  category?: string;
  tags?: string[];
  // foreshadow
  expected_resolve_range?: [number, number];
  importance?: number;
  // timeline_event
  story_date?: string;
  event_type?: string;
}

export interface Anchor {
  id: string;
  entity_id: string;
  chapter_id: string;
  relation_type: string;
  summary: string;
  character_state?: Record<string, unknown>;
  foreshadow_progress?: number;
  created_at: string;
}

export interface ReadingLink {
  id: string;
  work_id: string;
  slug: string;
  title: string;
  included_chapters: string[];
  is_published: boolean;
  created_at: string;
}

export interface Comment {
  id: string;
  chapter_id: string;
  block_index: number;
  start_offset: number;
  end_offset: number;
  comment: string;
  resolved: boolean;
  created_by: string;
  created_at: string;
}

export interface ApiUsage {
  id: string;
  user_id: string;
  provider: string;
  model: string;
  date: string;
  request_count: number;
}
