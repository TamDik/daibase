import { describe, expect, it } from "vitest";

import type { InstalledPluginSummary } from "../api/tauriCommands";
import { findPageViewPlugin, markdownContext } from "./pluginHost";

describe("findPageViewPlugin", () => {
  it("matches an enabled main page view from flat frontmatter", () => {
    const match = findPageViewPlugin("---\ndaibase.view: calendar\n---\n# Calendar\n", [
      plugin({ enabled: true }),
    ]);

    expect(match?.plugin.id).toBe("com.example.calendar");
    expect(match?.contribution.id).toBe("calendar");
  });

  it("ignores disabled plugins", () => {
    const match = findPageViewPlugin("---\ndaibase.view: calendar\n---\n# Calendar\n", [
      plugin({ enabled: false }),
    ]);

    expect(match).toBeNull();
  });

  it("returns null when frontmatter does not request the view", () => {
    const match = findPageViewPlugin("# Calendar\n", [plugin({ enabled: true })]);

    expect(match).toBeNull();
  });
});

describe("markdownContext", () => {
  it("parses flat and nested frontmatter and separates the body", () => {
    expect(
      markdownContext(
        "---\ndaibase.view: calendar\ncalendar:\n  month: 2026-06\n---\n# Calendar\n",
      ),
    ).toEqual({
      frontmatter: {
        "daibase.view": "calendar",
        calendar: {
          month: "2026-06",
        },
      },
      body: "# Calendar",
    });
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
      main: "dist/index.html",
      contributions: [
        {
          kind: "pageView",
          id: "calendar",
          name: "Calendar",
          slot: "main",
          match: {
            frontmatter: {
              "daibase.view": "calendar",
            },
          },
          view: {
            kind: "custom",
          },
          activation: {
            autoOpen: true,
          },
        },
      ],
      permissions: ["page-read", "location-open"],
    },
  };
}
