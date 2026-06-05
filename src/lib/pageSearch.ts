export type PageSearchMatch = {
  end: number;
  start: number;
};

export function findPageSearchMatches(text: string, query: string): PageSearchMatch[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return [];
  }

  const normalizedText = text.toLowerCase();
  const matches: PageSearchMatch[] = [];
  let cursor = 0;

  while (cursor <= normalizedText.length) {
    const start = normalizedText.indexOf(normalizedQuery, cursor);
    if (start < 0) {
      break;
    }

    const end = start + normalizedQuery.length;
    matches.push({ end, start });
    cursor = end;
  }

  return matches;
}
