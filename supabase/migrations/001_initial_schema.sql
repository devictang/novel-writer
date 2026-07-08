-- ============================================================
-- Golden Quill — Supabase Migration
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- WORKS (作品)
-- ============================================================
CREATE TABLE works (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  default_writing_brief JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE works ENABLE ROW LEVEL SECURITY;

CREATE POLICY "works_owner_all" ON works
  FOR ALL USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- CHAPTERS (章節 — 文本樹節點)
-- ============================================================
CREATE TABLE chapters (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_id         UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES chapters(id) ON DELETE CASCADE,
  sort_order      FLOAT NOT NULL DEFAULT 0,
  title           VARCHAR(255) NOT NULL DEFAULT 'Untitled',
  content         JSONB DEFAULT '[]',        -- TipTap block JSON
  status          VARCHAR(20) NOT NULL DEFAULT 'scene_card'
    CHECK (status IN ('scene_card','draft','review','final')),
  scene_card      JSONB DEFAULT '{}',        -- {summary, characters[], locations[], foreshadows[], notes}
  writing_brief   JSONB DEFAULT '{}',        -- {pov, tone, pacing, target_word_count, author_notes}
  word_count      INT DEFAULT 0,
  revision        INT DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chapters_work ON chapters(work_id);
CREATE INDEX idx_chapters_parent ON chapters(parent_id);
CREATE INDEX idx_chapters_sort ON chapters(work_id, sort_order);

ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chapters_owner_all" ON chapters
  FOR ALL USING (
    work_id IN (SELECT id FROM works WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    work_id IN (SELECT id FROM works WHERE owner_id = auth.uid())
  );

-- ============================================================
-- ENTITIES (實體 — 角色/世界觀/伏筆/事件)
-- ============================================================
CREATE TABLE entities (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_id     UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL CHECK (type IN ('character','worldbuilding','foreshadow','timeline_event')),
  name        VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  aliases     TEXT[] DEFAULT '{}',
  status      VARCHAR(50) DEFAULT '',
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_entities_work ON entities(work_id);
CREATE INDEX idx_entities_type ON entities(work_id, type);

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entities_owner_all" ON entities
  FOR ALL USING (
    work_id IN (SELECT id FROM works WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    work_id IN (SELECT id FROM works WHERE owner_id = auth.uid())
  );

-- ============================================================
-- ANCHORS (錨點 — chapter ↔ entity 連接記錄)
-- ============================================================
CREATE TABLE anchors (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id           UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  chapter_id          UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  relation_type       VARCHAR(30) NOT NULL,
  summary             TEXT DEFAULT '',
  character_state     JSONB,
  foreshadow_progress INT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_id, chapter_id, relation_type)
);

CREATE INDEX idx_anchors_entity ON anchors(entity_id);
CREATE INDEX idx_anchors_chapter ON anchors(chapter_id);

ALTER TABLE anchors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anchors_owner_all" ON anchors
  FOR ALL USING (
    entity_id IN (
      SELECT e.id FROM entities e
      JOIN works w ON e.work_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT e.id FROM entities e
      JOIN works w ON e.work_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- ============================================================
-- READING LINKS (分享閱讀連結)
-- ============================================================
CREATE TABLE reading_links (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_id         UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  slug            VARCHAR(50) UNIQUE NOT NULL,
  title           VARCHAR(255) DEFAULT '',
  included_chapters UUID[] DEFAULT '{}',
  is_published    BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reading_links_slug ON reading_links(slug);
CREATE INDEX idx_reading_links_work ON reading_links(work_id);

ALTER TABLE reading_links ENABLE ROW LEVEL SECURITY;

-- Owner can manage their reading links
CREATE POLICY "reading_links_owner_all" ON reading_links
  FOR ALL USING (
    work_id IN (SELECT id FROM works WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    work_id IN (SELECT id FROM works WHERE owner_id = auth.uid())
  );

-- Anyone can read published reading links (for readers)
CREATE POLICY "reading_links_public_read" ON reading_links
  FOR SELECT USING (is_published = true);

-- ============================================================
-- READER ACCESS: public can read chapters of published works
-- ============================================================
-- We need a function to check if a chapter is in a published reading link
CREATE OR REPLACE FUNCTION is_chapter_published(chapter_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM reading_links rl
    WHERE rl.is_published = true
      AND chapter_uuid = ANY(rl.included_chapters)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Public read access to chapters via published reading links
CREATE POLICY "chapters_public_read" ON chapters
  FOR SELECT USING (is_chapter_published(id));

-- ============================================================
-- COMMENTS (章節批改意見)
-- ============================================================
CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id  UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  block_index INT NOT NULL DEFAULT 0,
  start_offset INT DEFAULT 0,
  end_offset   INT DEFAULT 0,
  comment     TEXT NOT NULL,
  resolved    BOOLEAN DEFAULT false,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comments_chapter ON comments(chapter_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_owner_all" ON comments
  FOR ALL USING (
    chapter_id IN (
      SELECT c.id FROM chapters c
      JOIN works w ON c.work_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    chapter_id IN (
      SELECT c.id FROM chapters c
      JOIN works w ON c.work_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- ============================================================
-- API USAGE TRACKING (Gemini quota)
-- ============================================================
CREATE TABLE api_usage (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      VARCHAR(10) NOT NULL DEFAULT 'gemini',
  model         VARCHAR(50) NOT NULL DEFAULT 'gemini-3.5-flash',
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider, model, date)
);

ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_usage_owner_all" ON api_usage
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER works_updated BEFORE UPDATE ON works
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER chapters_updated BEFORE UPDATE ON chapters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER entities_updated BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
