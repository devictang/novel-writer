import { useEffect, useRef, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import type { SlashCommandItem } from '../extensions/SlashCommand';

interface SlashMenuProps {
  editor: Editor | null;
}

export function SlashMenu({ editor }: SlashMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pos, setPos] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputTimer = useRef<ReturnType<typeof setTimeout>>();

  const items: SlashCommandItem[] = [
    { title: 'Text', description: '普通段落', icon: '📝', command: ({ editor: e, range }) => e.chain().focus().deleteRange(range).setParagraph().run() },
    { title: 'Heading 1', description: '大標題', icon: 'H1', command: ({ editor: e, range }) => e.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run() },
    { title: 'Heading 2', description: '中標題', icon: 'H2', command: ({ editor: e, range }) => e.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run() },
    { title: 'Heading 3', description: '小標題', icon: 'H3', command: ({ editor: e, range }) => e.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run() },
    { title: 'Bullet List', description: '項目清單', icon: '•', command: ({ editor: e, range }) => e.chain().focus().deleteRange(range).toggleBulletList().run() },
    { title: 'Ordered List', description: '編號清單', icon: '1.', command: ({ editor: e, range }) => e.chain().focus().deleteRange(range).toggleOrderedList().run() },
    { title: 'Blockquote', description: '引言', icon: '❝', command: ({ editor: e, range }) => e.chain().focus().deleteRange(range).toggleBlockquote().run() },
    { title: 'Code Block', description: '程式碼', icon: '<>', command: ({ editor: e, range }) => e.chain().focus().deleteRange(range).toggleCodeBlock().run() },
    { title: 'Divider', description: '分隔線', icon: '—', command: ({ editor: e, range }) => e.chain().focus().deleteRange(range).setHorizontalRule().run() },
  ];

  const filteredItems = query
    ? items.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.includes(query)
      )
    : items;

  // Listen for slash command events
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.pos !== undefined) {
        setPos(detail.pos);
      }
      setQuery('');
      setSelectedIndex(0);
      setOpen(true);
    };
    const onClose = () => setOpen(false);

    window.addEventListener('slash-command-open', onOpen);
    window.addEventListener('slash-command-close', onClose);
    return () => {
      window.removeEventListener('slash-command-open', onOpen);
      window.removeEventListener('slash-command-close', onClose);
    };
  }, []);

  // Listen for keyboard input after slash
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      // Close on Escape, Enter, arrow keys handled separately
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredItems.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }

      if (e.key === 'Enter' && filteredItems[selectedIndex]) {
        e.preventDefault();
        executeCommand(filteredItems[selectedIndex]);
        return;
      }

      if (e.key === 'Backspace') {
        // The editor handles backspace normally — the extension tracks query
        // We debounce read the current text
        clearTimeout(inputTimer.current);
        inputTimer.current = setTimeout(readQueryFromEditor, 50);
        return;
      }

      // Regular character — read the text after slash
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        clearTimeout(inputTimer.current);
        inputTimer.current = setTimeout(readQueryFromEditor, 50);
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      clearTimeout(inputTimer.current);
    };
  }, [open, filteredItems, selectedIndex]);

  const readQueryFromEditor = useCallback(() => {
    if (!editor || pos === null) return;
    const text = editor.state.doc.textBetween(pos, editor.state.selection.from);
    // Remove the leading / and any whitespace
    const q = text.replace(/^\//, '').trim();
    setQuery(q);
    setSelectedIndex(0);
  }, [editor, pos]);

  const executeCommand = useCallback(
    (item: SlashCommandItem) => {
      if (!editor || pos === null) return;
      const to = editor.state.selection.from;
      item.command({ editor, range: { from: pos, to } });
      setOpen(false);
      editor.commands.focus();
    },
    [editor, pos]
  );

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 rounded-xl border border-gray-200 bg-white shadow-lg"
      style={{
        top: 'auto',
        left: '50%',
        transform: 'translateX(-50%)',
        marginTop: '4px',
      }}
    >
      {query && (
        <div className="border-b border-gray-100 px-3 py-2 text-xs text-gray-400">
          Filter: /{query}
        </div>
      )}
      <div className="max-h-64 overflow-y-auto p-1">
        {filteredItems.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-gray-400">
            沒有相符的指令
          </div>
        ) : (
          filteredItems.map((item, i) => (
            <button
              key={item.title}
              onClick={() => executeCommand(item)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                i === selectedIndex ? 'bg-quill-light/20 text-quill-dark' : 'hover:bg-gray-50'
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs font-bold">
                {item.icon}
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">{item.title}</div>
                <div className="text-xs text-gray-400">{item.description}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
