export function categoriesFromMarkdown(markdown: string): string[] {
  const frontmatter = frontmatterLines(markdown);
  if (frontmatter === null) {
    return [];
  }

  const categories: string[] = [];
  for (let index = 0; index < frontmatter.length; index += 1) {
    const line = frontmatter[index] ?? "";
    const match = line.match(/^categories?\s*:\s*(.*)$/i);
    if (!match) {
      continue;
    }

    const value = match[1]?.trim() ?? "";
    if (value) {
      categories.push(...parseCategoryValue(value));
      continue;
    }

    for (let nestedIndex = index + 1; nestedIndex < frontmatter.length; nestedIndex += 1) {
      const nestedLine = frontmatter[nestedIndex] ?? "";
      const nestedMatch = nestedLine.match(/^\s*-\s*(.+)$/);
      if (nestedMatch) {
        categories.push(cleanCategoryName(nestedMatch[1] ?? ""));
        continue;
      }
      if (nestedLine.trim() === "") {
        continue;
      }
      break;
    }
  }

  return uniqueCategories(categories);
}

export function updateMarkdownCategories(markdown: string, categories: string[]): string {
  const nextCategories = uniqueCategories(categories);
  const normalizedFrontmatter =
    nextCategories.length > 0 ? categoryFrontmatter(nextCategories) : "";
  const frontmatter = frontmatterRange(markdown);

  if (frontmatter === null) {
    return normalizedFrontmatter ? `${normalizedFrontmatter}${markdown}` : markdown;
  }

  const existingLines = frontmatter.content.split(/\r?\n/);
  const keptLines: string[] = [];
  for (let index = 0; index < existingLines.length; index += 1) {
    const line = existingLines[index] ?? "";
    if (!/^categories?\s*:/i.test(line)) {
      keptLines.push(line);
      continue;
    }

    const value = line.split(/:(.*)/s)[1]?.trim() ?? "";
    if (value) {
      continue;
    }

    for (let nestedIndex = index + 1; nestedIndex < existingLines.length; nestedIndex += 1) {
      const nestedLine = existingLines[nestedIndex] ?? "";
      if (/^\s*-\s+/.test(nestedLine) || nestedLine.trim() === "") {
        index = nestedIndex;
        continue;
      }
      break;
    }
  }

  if (nextCategories.length > 0) {
    keptLines.push("categories:");
    keptLines.push(...nextCategories.map((category) => `  - ${category}`));
  }

  const cleanLines = keptLines.filter((line, index, lines) => {
    if (line.trim() !== "") {
      return true;
    }
    return lines[index - 1]?.trim() !== "" && lines[index + 1]?.trim() !== "";
  });

  if (cleanLines.length === 0) {
    return markdown.slice(frontmatter.end);
  }

  return `---\n${cleanLines.join("\n")}\n---\n${markdown.slice(frontmatter.end)}`;
}

export function markdownBodyFromMarkdown(markdown: string): string {
  const frontmatter = frontmatterRange(markdown);
  return frontmatter === null ? markdown : markdown.slice(frontmatter.end);
}

export function updateMarkdownBodyPreservingFrontmatter(markdown: string, body: string): string {
  const frontmatter = frontmatterRange(markdown);
  return frontmatter === null ? body : `${markdown.slice(0, frontmatter.end)}${body}`;
}

function frontmatterLines(markdown: string) {
  const range = frontmatterRange(markdown);
  return range === null ? null : range.content.split(/\r?\n/);
}

function frontmatterRange(markdown: string): { content: string; end: number } | null {
  if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) {
    return null;
  }

  const lineBreakLength = markdown.startsWith("---\r\n") ? 2 : 1;
  let cursor = 3 + lineBreakLength;
  const contentStart = cursor;

  while (cursor < markdown.length) {
    const nextBreak = markdown.indexOf("\n", cursor);
    const lineEnd = nextBreak === -1 ? markdown.length : nextBreak;
    const line = markdown.slice(cursor, lineEnd).replace(/\r$/, "");
    if (line === "---") {
      return {
        content: markdown.slice(contentStart, cursor).replace(/\r?\n$/, ""),
        end: nextBreak === -1 ? lineEnd : nextBreak + 1,
      };
    }
    cursor = nextBreak === -1 ? markdown.length : nextBreak + 1;
  }

  return null;
}

function categoryFrontmatter(categories: string[]) {
  return `---\ncategories:\n${categories.map((category) => `  - ${category}`).join("\n")}\n---\n`;
}

function parseCategoryValue(value: string) {
  const trimmed = value.trim();
  const listValue =
    trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;
  return listValue.split(",").map(cleanCategoryName);
}

function cleanCategoryName(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function uniqueCategories(categories: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const category of categories.map(cleanCategoryName)) {
    if (!category || seen.has(category)) {
      continue;
    }
    seen.add(category);
    result.push(category);
  }
  return result;
}
