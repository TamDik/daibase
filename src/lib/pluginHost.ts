import type { InstalledPluginSummary, PluginContribution } from "../api/tauriCommands";

export type PageViewPluginMatch = {
  plugin: InstalledPluginSummary;
  contribution: PluginContribution;
};

export function findPageViewPlugin(
  markdown: string,
  plugins: InstalledPluginSummary[],
): PageViewPluginMatch | null {
  const frontmatter = flatFrontmatterValues(markdown);

  for (const plugin of plugins) {
    if (!plugin.enabled) {
      continue;
    }

    for (const contribution of plugin.manifest.contributions) {
      if (contribution.kind !== "pageView") {
        continue;
      }
      if ((contribution.slot ?? "main") !== "main") {
        continue;
      }
      if (contribution.view.kind !== "custom") {
        continue;
      }
      if (matchesFrontmatter(frontmatter, contribution.match?.frontmatter)) {
        return { plugin, contribution };
      }
    }
  }

  return null;
}

export function markdownContext(markdown: string) {
  const frontmatter = frontmatterBlock(markdown);
  if (frontmatter === null) {
    return {
      body: markdown,
      frontmatter: {},
    };
  }

  return {
    body: markdown.slice(frontmatter.end).trim(),
    frontmatter: nestedFrontmatterValues(frontmatter.content),
  };
}

function matchesFrontmatter(frontmatter: Record<string, string>, expected: unknown) {
  if (!isRecord(expected)) {
    return false;
  }

  const entries = Object.entries(expected);
  if (entries.length === 0) {
    return false;
  }

  return entries.every(([key, value]) => frontmatter[key] === String(value));
}

function flatFrontmatterValues(markdown: string): Record<string, string> {
  const frontmatter = frontmatterBlock(markdown);
  if (frontmatter === null) {
    return {};
  }

  const values: Record<string, string> = {};
  for (const line of frontmatter.content.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_.-]+):\s*(.*?)\s*$/);
    if (!match) {
      continue;
    }

    values[match[1]] = stripQuotes(match[2]);
  }
  return values;
}

function nestedFrontmatterValues(markdown: string): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  let section: string | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    const topLevel = line.match(/^([A-Za-z0-9_.-]+):\s*(.*?)\s*$/);
    if (topLevel) {
      section = null;
      if (topLevel[2].trim()) {
        values[topLevel[1]] = stripQuotes(topLevel[2]);
      } else {
        values[topLevel[1]] = {};
        section = topLevel[1];
      }
      continue;
    }

    const nested = line.match(/^\s+([A-Za-z0-9_.-]+):\s*(.*?)\s*$/);
    if (!nested || section === null || !isRecord(values[section])) {
      continue;
    }

    const sectionValues = values[section];
    if (isRecord(sectionValues)) {
      sectionValues[nested[1]] = stripQuotes(nested[2]);
    }
  }

  return values;
}

function frontmatterBlock(markdown: string): { content: string; end: number } | null {
  if (!markdown.startsWith("---")) {
    return null;
  }

  const closingMarker = markdown.indexOf("\n---", 3);
  if (closingMarker === -1) {
    return null;
  }

  const afterMarker = markdown.indexOf("\n", closingMarker + 4);
  return {
    content: markdown.slice(3, closingMarker).trim(),
    end: afterMarker === -1 ? markdown.length : afterMarker + 1,
  };
}

function stripQuotes(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
