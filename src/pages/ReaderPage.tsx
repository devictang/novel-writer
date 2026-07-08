import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Feather, Loader2 } from 'lucide-react';
import type { Chapter, ReadingLink } from '../types';

export function ReaderPage() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [readingLink, setReadingLink] = useState<ReadingLink | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load reading link + chapters
  useEffect(() => {
    if (!slug) return;

    (async () => {
      setLoading(true);
      const { data: link, error: linkErr } = await supabase
        .from('reading_links')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();

      if (linkErr || !link) {
        setError('This story is not available.');
        setLoading(false);
        return;
      }

      setReadingLink(link as ReadingLink);

      // Fetch chapters in order
      if (link.included_chapters && link.included_chapters.length > 0) {
        const { data: chaps } = await supabase
          .from('chapters')
          .select('*')
          .in('id', link.included_chapters)
          .order('sort_order', { ascending: true });
        setChapters((chaps ?? []) as Chapter[]);
      }

      setLoading(false);
    })();
  }, [slug]);

  // Restore scroll position from localStorage
  useEffect(() => {
    if (loading || !slug) return;
    const saved = localStorage.getItem(`gq-reader-${slug}`);
    if (saved) {
      const position = parseInt(saved, 10);
      requestAnimationFrame(() => {
        window.scrollTo({ top: position, behavior: 'instant' });
      });
    }
  }, [loading, slug]);

  // Save scroll position on scroll (debounced)
  useEffect(() => {
    if (!slug) return;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        localStorage.setItem(`gq-reader-${slug}`, String(window.scrollY));
      }, 500);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-parchment">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 animate-spin text-quill" size={32} />
          <p className="text-sm text-gray-500">Loading story…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-parchment">
        <div className="text-center">
          <p className="text-lg text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const progress = (() => {
    const saved = localStorage.getItem(`gq-reader-${slug}`);
    if (!saved) return 0;
    const pos = parseInt(saved, 10);
    const total = document.body.scrollHeight - window.innerHeight;
    return total > 0 ? Math.round((pos / total) * 100) : 0;
  })();

  return (
    <div className="min-h-screen bg-parchment">
      {/* Fixed progress bar */}
      <div className="fixed left-0 top-0 z-50 h-0.5 bg-quill transition-all" style={{ width: `${progress}%` }} />

      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-2xl px-6 py-4">
          <div className="flex items-center gap-2">
            <Feather size={16} className="text-quill" />
            <span className="font-serif text-sm font-semibold text-ink">{readingLink?.title || 'Untitled'}</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div ref={containerRef} className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-8 text-center font-serif text-3xl font-bold text-ink">
          {readingLink?.title || 'Untitled Story'}
        </h1>

        <div className="reader-content space-y-12">
          {chapters.map((chapter, i) => {
            const blocks = Array.isArray(chapter.content) ? chapter.content : [];
            return (
              <article key={chapter.id} className="border-b border-gray-100 pb-8 last:border-0">
                <h2 className="mb-4 font-serif text-xl font-semibold text-ink">
                  {i + 1}. {chapter.title}
                </h2>
                <RenderBlocks blocks={blocks} />
              </article>
            );
          })}
        </div>

        <div className="mt-12 text-center text-xs text-gray-400">
          <p>— End of available content —</p>
          <p className="mt-2">
            Progress saved. Come back anytime to continue reading.
          </p>
        </div>
      </div>
    </div>
  );
}

// Render TipTap blocks to plain HTML (minimal renderer for reader)
function RenderBlocks({ blocks }: { blocks: unknown[] }) {
  if (!blocks || blocks.length === 0) {
    return <p className="text-gray-400 italic">No content yet.</p>;
  }

  return (
    <>
      {blocks.map((block, i) => {
        const b = block as { type?: string; content?: unknown[]; text?: string; attrs?: Record<string, unknown> };
        const text = b.content
          ? (b.content as Array<{ text?: string }>).map((c) => c.text ?? '').join('')
          : '';

        switch (b.type) {
          case 'paragraph':
            return <p key={i}>{text}</p>;
          case 'heading':
            const level = (b.attrs?.level as number) ?? 2;
            const Tag = `h${level}` as keyof JSX.IntrinsicElements;
            return <Tag key={i}>{text}</Tag>;
          case 'blockquote':
            return <blockquote key={i}>{text}</blockquote>;
          case 'bulletList':
          case 'orderedList':
            return (
              <ul key={i} className={b.type === 'orderedList' ? 'list-decimal' : 'list-disc'}>
                {(b.content as unknown[]).map((item, j) => {
                  const itemText = ((item as { content?: unknown[] }).content ?? [])
                    .map((c: { content?: unknown[] }) =>
                      (c.content ?? []).map((cc: { text?: string }) => cc.text ?? '').join('')
                    )
                    .join('');
                  return <li key={j}>{itemText}</li>;
                })}
              </ul>
            );
          case 'codeBlock':
            return <pre key={i}><code>{text}</code></pre>;
          default:
            return text ? <p key={i}>{text}</p> : null;
        }
      })}
    </>
  );
}
