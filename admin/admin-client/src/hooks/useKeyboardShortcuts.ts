import { useEffect, useCallback } from 'react';

interface Shortcut {
  keys: string[];
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (e: KeyboardEvent) => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], dependencies: any[] = []) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    shortcuts.forEach(shortcut => {
      const { keys, ctrl = false, meta = false, shift = false, alt = false, handler } = shortcut;

      const modifierMatch = (
        (ctrl && e.ctrlKey) ||
        (meta && e.metaKey) ||
        (!ctrl && !meta && (e.ctrlKey || e.metaKey))
      ) && (!shift === !(e.shiftKey)) && (!alt === !e.altKey);

      if (!modifierMatch) return;

      const keyMatch = keys.includes(e.key.toLowerCase()) || keys.includes(e.key);
      if (keyMatch) {
        e.preventDefault();
        handler(e);
      }
    });
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, ...dependencies]);
}

export const shortcuts = {
  'Ctrl+K, Cmd+K': () => {}, // Will be overridden
  'Ctrl+N, Cmd+N': () => {},
  'Ctrl+E, Cmd+E': () => {},
  'Ctrl+S, Cmd+S': () => {},
  'Ctrl+I, Cmd+I': () => {},
  'Escape': () => {},
  '?': () => {},
};
