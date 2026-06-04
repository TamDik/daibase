import type { InstalledPluginSummary, PluginContribution } from "../api/tauriCommands";

export type MarkdownRendererMatch = {
  plugin: InstalledPluginSummary;
  contribution: PluginContribution;
};

export function findMarkdownRendererPlugin(
  markdown: string,
  plugins: InstalledPluginSummary[],
): MarkdownRendererMatch | null {
  const frontmatter = flatFrontmatterValues(markdown);

  for (const plugin of plugins) {
    if (!plugin.enabled) {
      continue;
    }

    for (const contribution of plugin.manifest.contributions) {
      if (contribution.kind !== "markdownRenderer") {
        continue;
      }
      if (matchesFrontmatter(frontmatter, contribution.frontmatter)) {
        return { plugin, contribution };
      }
    }
  }

  return null;
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
  for (const line of frontmatter.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_.-]+):\s*(.*?)\s*$/);
    if (!match) {
      continue;
    }

    values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

function frontmatterBlock(markdown: string) {
  if (!markdown.startsWith("---")) {
    return null;
  }

  const end = markdown.indexOf("\n---", 3);
  if (end === -1) {
    return null;
  }

  return markdown.slice(3, end).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
