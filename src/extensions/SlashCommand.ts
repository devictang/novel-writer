import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  command: (props: { editor: import('@tiptap/core').Editor; range: { from: number; to: number } }) => void;
}

export const SlashCommandExtension = Extension.create<{ items: SlashCommandItem[] }>({
  name: 'slashCommand',

  addOptions() {
    return {
      items: [],
    };
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey('slashCommand');

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, set) {
            return set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          handleKeyDown(view, event) {
            if (event.key === '/' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
              const { state } = view;
              const { selection } = state;
              const { $from } = selection;

              // Only trigger at start of a paragraph/heading block
              const parent = $from.parent;
              if (parent.type.name !== 'paragraph' && parent.type.name !== 'heading') {
                return false;
              }

              if ($from.parentOffset !== 0) {
                return false;
              }

              // Find position where slash was typed
              const pos = $from.pos;

              // Dispatch custom event that React can listen to
              const eventDetail = { pos, editor: this.editor };
              window.dispatchEvent(
                new CustomEvent('slash-command-open', { detail: eventDetail })
              );

              return false;
            }

            // Close slash menu on Escape
            if (event.key === 'Escape') {
              window.dispatchEvent(new CustomEvent('slash-command-close'));
              return false;
            }

            return false;
          },
        },
      }),
    ];
  },
});
