# 🖋️ Novel Writer — 敘事管理與寫作助手

A narrative management workbench for novelists — manage story structure, scene cards, character/worldbuilding/foreshadow tracking, AI-assisted writing, and shareable reading links.

## ✨ Features

- **文本樹 (Tree View)** — Hierarchical chapter/scene structure with drag-friendly sort_order
- **Scene Card** — Pre-plan each scene with characters, locations, foreshadows
- **Writing Brief** — Per-chapter parameters (POV, tone, pacing, target word count)
- **Block Editor** — Notion-style editor powered by TipTap
- **Entity Management** — Characters, worldbuilding, foreshadows, timeline events
- **AI Generation** — Scene → Prose in one call (Gemini 3.5 Flash), with automatic entity state updates
- **Quota Management** — Track daily API usage (1500 RPD free tier), cache to minimize calls
- **Reading Links** — Generate shareable `/read/:slug` links with continuous scroll + localStorage progress
- **Secure API Key Storage** — Gemini keys encrypted via Supabase Vault, never exposed to client

## 🛠️ Tech Stack

| Layer | Technology |
|:--|:--|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Editor | TipTap (ProseMirror) |
| State | Zustand (client) + TanStack Query (server) |
| Backend | Supabase (PostgreSQL + Auth + RLS + Edge Functions) |
| AI | Google Gemini 3.5 Flash |
| Hosting | Vercel (novels.oyx.app) |

## 🚀 Setup

### 1. Clone & Install

```bash
git clone https://github.com/devictang/novel-writer.git
cd novel-writer
npm install
```

### 2. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → run `supabase/migrations/001_initial_schema.sql`
3. Enable **Vault** extension: `CREATE EXTENSION IF NOT EXISTS supabase_vault;`
4. Go to **Settings → API** → copy your Project URL and anon key
5. Copy `.env.example` to `.env` and fill in:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### 3. Deploy Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy generate-prose --no-verify-jwt
supabase functions deploy manage-api-key --no-verify-jwt

# Set service role key as secret (for vault access)
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Run Dev Server

```bash
npm run dev
```

### 5. Deploy to Vercel

```bash
# Push to GitHub
git remote add origin https://github.com/devictang/novel-writer.git
git push -u origin main

# In Vercel dashboard:
# - Import the GitHub repo
# - Set domain: novels.oyx.app
# - Add env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

## 📊 Data Model

```
Works (作品)
 ├─ Chapters (章節 — 文本樹)
 │   ├─ content (TipTap JSON)
 │   ├─ scene_card (characters, locations, foreshadows, summary)
 │   └─ writing_brief (POV, tone, pacing, word count)
 │
 ├─ Entities (實體)
 │   ├─ character (角色 — mood, status, aliases, relationships)
 │   ├─ worldbuilding (世界觀 — category, tags)
 │   ├─ foreshadow (伏筆 — planted → in_progress → resolved)
 │   └─ timeline_event (事件 — story_date, event_type)
 │
 ├─ Anchors (錨點 — entity ↔ chapter connection records)
 │   └─ relation_type, character_state, foreshadow_progress
 │
 ├─ Comments (批改意見 — text range + comment + resolved)
 │
 └─ Reading Links (分享連結 — slug + included_chapters + is_published)
```

## 🔐 Security

- API keys encrypted via **Supabase Vault** (AEAD encryption)
- Keys never sent to client — only Edge Functions decrypt
- **Row Level Security** on all tables
- Reading links are public-read for published works only
- JWT auth on all API operations

## ⚡ Quota Optimization

| Strategy | Effect |
|:--|:--|
| All-in-one AI call (prose + entity update) | Saves 2/3 calls per chapter |
| Scene card hash caching | Unchanged scenes = 0 calls |
| Rule-based entity name detection | 0 API calls for appearance tracking |
| Manual consistency check | No auto-check waste |
| Daily quota tracking + UI display | Author sees usage, self-regulates |

## License

MIT
