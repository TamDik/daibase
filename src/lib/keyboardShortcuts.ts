export type ShortcutCommand = {
  id: string;
  title: string;
  description: string;
  category: string;
  defaultBinding: string;
  source: "builtin" | `plugin:${string}`;
};

export type ShortcutBindings = Record<string, string>;

export const shortcutCommands: ShortcutCommand[] = [
  {
    id: "search.global",
    title: "全体検索",
    description: "現在の namespace を検索します。",
    category: "検索",
    defaultBinding: "Mod+K",
    source: "builtin",
  },
  {
    id: "search.page",
    title: "ページ内検索",
    description: "表示中のページ本文を検索します。",
    category: "検索",
    defaultBinding: "Mod+F",
    source: "builtin",
  },
  {
    id: "navigation.back",
    title: "戻る",
    description: "前に表示していたlocationへ戻ります。",
    category: "ナビゲーション",
    defaultBinding: "Alt+ArrowLeft",
    source: "builtin",
  },
  {
    id: "navigation.forward",
    title: "進む",
    description: "戻る前に表示していたlocationへ進みます。",
    category: "ナビゲーション",
    defaultBinding: "Alt+ArrowRight",
    source: "builtin",
  },
  {
    id: "shortcuts.open",
    title: "ショートカット一覧",
    description: "キーボードショートカットの確認と編集を行います。",
    category: "アプリケーション",
    defaultBinding: "Mod+Shift+K",
    source: "builtin",
  },
];

const storageKey = "daibase.keyboard-shortcuts.v1";

export function defaultShortcutBindings(
  commands: ShortcutCommand[] = shortcutCommands,
): ShortcutBindings {
  return Object.fromEntries(commands.map((command) => [command.id, command.defaultBinding]));
}

export function loadShortcutBindings(
  commands: ShortcutCommand[] = shortcutCommands,
): ShortcutBindings {
  const defaults = defaultShortcutBindings(commands);
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return defaults;
    }
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    return Object.fromEntries(
      commands.map((command) => [
        command.id,
        typeof parsed[command.id] === "string" ? parsed[command.id] : defaults[command.id],
      ]),
    ) as ShortcutBindings;
  } catch {
    return defaults;
  }
}

export function saveShortcutBindings(bindings: ShortcutBindings) {
  window.localStorage.setItem(storageKey, JSON.stringify(bindings));
}

export function bindingFromKeyboardEvent(event: KeyboardEvent): string | null {
  const key = normalizeKey(event.key);
  if (!key || ["Control", "Meta", "Alt", "Shift"].includes(key)) {
    return null;
  }
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("Mod");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  parts.push(key);
  return parts.join("+");
}

export function shortcutCommandForEvent(
  event: KeyboardEvent,
  commands: ShortcutCommand[],
  bindings: ShortcutBindings,
): ShortcutCommand | null {
  const binding = bindingFromKeyboardEvent(event);
  if (!binding) return null;
  return commands.find((command) => bindings[command.id] === binding) ?? null;
}

export function shortcutConflict(
  commandId: string,
  binding: string,
  bindings: ShortcutBindings,
): string | null {
  return (
    Object.entries(bindings).find(([id, value]) => id !== commandId && value === binding)?.[0] ??
    null
  );
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function normalizeKey(key: string): string {
  if (key === " ") return "Space";
  if (key.length === 1) return key.toUpperCase();
  return key;
}
