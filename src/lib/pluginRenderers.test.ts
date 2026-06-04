import { describe, expect, it } from "vitest";

import type { InstalledPluginSummary } from "../api/tauriCommands";
import { findMarkdownRendererPlugin } from "./pluginRenderers";

describe("findMarkdownRendererPlugin", () => {
  it("matches an enabled markdown renderer from flat frontmatter", () => {
    const match = findMarkdownRendererPlugin("---\ndaibase.renderer: calendar\n---\n# Calendar\n", [
      plugin({ enabled: true }),
    ]);

    expect(match?.plugin.id).toBe("com.example.calendar");
    expect(match?.contribution.id).toBe("calendar");
  });

  it("ignores disabled plugins", () => {
    const match = findMarkdownRendererPlugin("---\ndaibase.renderer: calendar\n---\n# Calendar\n", [
      plugin({ enabled: false }),
    ]);

    expect(match).toBeNull();
  });

  it("returns null when frontmatter does not request the renderer", () => {
    const match = findMarkdownRendererPlugin("# Calendar\n", [plugin({ enabled: true })]);

    expect(match).toBeNull();
  });
});

function plugin({ enabled }: { enabled: boolean }): InstalledPluginSummary {
  return {
    id: "com.example.calendar",
    name: "Calendar",
    version: "0.1.0",
    description: "Calendar view",
    enabled,
    source: {
      kind: "localFolder",
      path: "/tmp/calendar-plugin",
    },
    manifest: {
      schemaVersion: 1,
      id: "com.example.calendar",
      name: "Calendar",
      version: "0.1.0",
      description: "Calendar view",
      entry: "dist/index.html",
      contributions: [
        {
          kind: "markdownRenderer",
          id: "calendar",
          name: "Calendar",
          frontmatter: {
            "daibase.renderer": "calendar",
          },
        },
      ],
      permissions: ["page-read", "location-open"],
    },
  };
}
