export type AppCommand = {
  id: string;
  name: string;
  title: string;
  description: string;
  category: string;
  defaultBinding: string;
  source: "builtin" | `plugin:${string}`;
  keywords?: string[];
};

export const builtinCommands: AppCommand[] = [
  {
    id: "search.global",
    name: "Global Search",
    title: "全体検索",
    description: "現在の namespace を検索します。",
    category: "検索",
    defaultBinding: "Mod+K",
    source: "builtin",
    keywords: ["search", "find"],
  },
  {
    id: "search.page",
    name: "Find in Page",
    title: "ページ内検索",
    description: "表示中のページ本文を検索します。",
    category: "検索",
    defaultBinding: "Mod+F",
    source: "builtin",
    keywords: ["search", "find", "page"],
  },
  {
    id: "navigation.back",
    name: "Back",
    title: "戻る",
    description: "前に表示していたlocationへ戻ります。",
    category: "ナビゲーション",
    defaultBinding: "Alt+ArrowLeft",
    source: "builtin",
    keywords: ["back", "previous"],
  },
  {
    id: "navigation.forward",
    name: "Forward",
    title: "進む",
    description: "戻る前に表示していたlocationへ進みます。",
    category: "ナビゲーション",
    defaultBinding: "Alt+ArrowRight",
    source: "builtin",
    keywords: ["forward", "next"],
  },
  {
    id: "view.reload",
    name: "Reload",
    title: "再読み込み",
    description: "現在のロケーションを再読み込みします。",
    category: "ナビゲーション",
    defaultBinding: "Mod+R",
    source: "builtin",
    keywords: ["reload", "refresh"],
  },
  {
    id: "shortcuts.open",
    name: "Keyboard Shortcuts",
    title: "ショートカット一覧",
    description: "キーボードショートカットの確認と編集を行います。",
    category: "アプリケーション",
    defaultBinding: "Mod+Shift+K",
    source: "builtin",
    keywords: ["keyboard", "shortcut", "settings"],
  },
  {
    id: "commands.open",
    name: "Commands",
    title: "コマンド一覧",
    description: "利用可能なコマンドを表示します。",
    category: "アプリケーション",
    defaultBinding: "",
    source: "builtin",
    keywords: ["command", "commands"],
  },
];

export function searchCommands(commands: AppCommand[], query: string): AppCommand[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return commands;

  return commands
    .map((command, index) => ({
      command,
      index,
      score: commandSearchScore(command, normalizedQuery),
    }))
    .filter((entry) => entry.score !== null)
    .sort((left, right) => (left.score ?? 0) - (right.score ?? 0) || left.index - right.index)
    .map((entry) => entry.command);
}

function commandSearchScore(command: AppCommand, query: string): number | null {
  const values = [
    command.name,
    command.title,
    command.id,
    command.description,
    command.category,
    ...(command.keywords ?? []),
  ];
  let bestScore: number | null = null;

  for (const value of values) {
    const score = fuzzyScore(value.toLocaleLowerCase(), query);
    if (score !== null && (bestScore === null || score < bestScore)) bestScore = score;
  }
  return bestScore;
}

function fuzzyScore(value: string, query: string): number | null {
  let valueIndex = 0;
  let score = 0;
  let previousMatch = -1;

  for (const character of query) {
    const matchIndex = value.indexOf(character, valueIndex);
    if (matchIndex < 0) return null;
    score += matchIndex;
    if (previousMatch >= 0) score += matchIndex - previousMatch - 1;
    previousMatch = matchIndex;
    valueIndex = matchIndex + 1;
  }
  return score + value.length - query.length;
}
