import { Box, TextField } from "@mui/material";
import { Crepe } from "@milkdown/crepe";
import { $prose } from "@milkdown/kit/utils";
import { Plugin } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import "@milkdown/crepe/theme/common/style.css";
import { useCallback, useEffect, useRef, type RefObject } from "react";

import type { PageSearchMatch } from "../lib/pageSearch";

type MarkdownLinkStatus = {
  exists: boolean;
  is_internal: boolean;
  location: string;
};

type MarkdownImageResolution = {
  content_type: string | null;
  data_url: string | null;
  exists: boolean;
  is_image: boolean;
  is_internal: boolean;
  location: string;
};

export function MarkdownWysiwygEditor({
  activeSearchMatch,
  ariaLabel,
  disabled,
  onOpenMarkdownLink,
  onResolveMarkdownImage,
  onResolveMarkdownLinkStatus,
  searchMatches,
  searchQuery,
  searchIndex,
  value,
  onChange,
}: {
  activeSearchMatch: PageSearchMatch | null;
  ariaLabel: string;
  disabled: boolean;
  onOpenMarkdownLink: (target: string) => void;
  onResolveMarkdownImage: (target: string) => Promise<MarkdownImageResolution>;
  onResolveMarkdownLinkStatus: (target: string) => Promise<MarkdownLinkStatus>;
  searchMatches: PageSearchMatch[];
  searchQuery: string;
  searchIndex: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const milkdownViewRef = useRef<EditorView | null>(null);
  const initialValueRef = useRef(value);
  const disabledRef = useRef(disabled);
  const onChangeRef = useRef(onChange);
  const onOpenMarkdownLinkRef = useRef(onOpenMarkdownLink);
  const onResolveMarkdownImageRef = useRef(onResolveMarkdownImage);
  const onResolveMarkdownLinkStatusRef = useRef(onResolveMarkdownLinkStatus);
  const linkStatusFrameRef = useRef<number | null>(null);
  const linkStatusRunIdRef = useRef(0);
  const imageResolutionCacheRef = useRef(new Map<string, MarkdownImageResolution>());
  const linkStatusCacheRef = useRef(new Map<string, MarkdownLinkStatus>());
  const searchStateRef = useRef({
    activeSearchMatch,
    searchIndex,
    searchMatches,
    searchQuery,
  });
  const searchScrollFrameRef = useRef<number | null>(null);
  const isTest = import.meta.env.MODE === "test";

  const scrollActiveSearchMatchIntoView = useCallback(() => {
    if (searchScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(searchScrollFrameRef.current);
    }

    searchScrollFrameRef.current = window.requestAnimationFrame(() => {
      searchScrollFrameRef.current = null;
      const root = rootRef.current;
      const activeMatch = root?.querySelector<HTMLElement>(".daibase-search-match-active");
      if (!activeMatch) {
        return;
      }

      activeMatch.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    });
  }, []);

  useEffect(() => {
    searchStateRef.current = {
      activeSearchMatch,
      searchIndex,
      searchMatches,
      searchQuery,
    };

    const view = milkdownViewRef.current;
    if (view) {
      view.dispatch(view.state.tr.setMeta(milkdownSearchHighlightMetaKey, true));
      scrollActiveSearchMatchIntoView();
    }
  }, [activeSearchMatch, scrollActiveSearchMatchIntoView, searchIndex, searchMatches, searchQuery]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onOpenMarkdownLinkRef.current = onOpenMarkdownLink;
  }, [onOpenMarkdownLink]);

  useEffect(() => {
    onResolveMarkdownImageRef.current = onResolveMarkdownImage;
  }, [onResolveMarkdownImage]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    onResolveMarkdownLinkStatusRef.current = onResolveMarkdownLinkStatus;
  }, [onResolveMarkdownLinkStatus]);

  const scheduleLinkStatusUpdate = useCallback(() => {
    if (isTest) {
      return;
    }

    if (linkStatusFrameRef.current !== null) {
      window.cancelAnimationFrame(linkStatusFrameRef.current);
    }

    linkStatusFrameRef.current = window.requestAnimationFrame(() => {
      const currentMarkdownAnchors = (root: ParentNode) => {
        return Array.from(root.querySelectorAll<HTMLAnchorElement>(".ProseMirror a[href]"));
      };

      const currentMarkdownImages = (root: ParentNode) => {
        return Array.from(root.querySelectorAll<HTMLImageElement>(".ProseMirror img[src]"));
      };

      const matchingCurrentAnchors = (target: string) => {
        const root = rootRef.current;
        if (!root) {
          return [];
        }

        return currentMarkdownAnchors(root).filter(
          (anchor) => anchor.getAttribute("href") === target,
        );
      };

      const matchingCurrentImages = (target: string) => {
        const root = rootRef.current;
        if (!root) {
          return [];
        }

        return currentMarkdownImages(root).filter((image) => markdownImageTarget(image) === target);
      };

      const markLinkStatusUnknown = (anchor: HTMLAnchorElement) => {
        anchor.dataset.linkInternal = "unknown";
        anchor.dataset.pageExists = "unknown";
      };

      const applyLinkStatus = (anchor: HTMLAnchorElement, status: MarkdownLinkStatus) => {
        anchor.dataset.linkInternal = status.is_internal ? "true" : "false";
        if (!status.is_internal) {
          anchor.removeAttribute("data-page-exists");
          anchor.removeAttribute("title");
          return;
        }

        anchor.dataset.pageExists = status.exists ? "true" : "false";
        if (status.exists) {
          anchor.removeAttribute("title");
        } else {
          anchor.title = "このページはまだ作成されていません。";
        }
      };

      const markImageResolutionUnknown = (image: HTMLImageElement) => {
        image.dataset.imageInternal = "unknown";
        image.dataset.imageExists = "unknown";
      };

      const applyImageResolution = (
        image: HTMLImageElement,
        target: string,
        resolution: MarkdownImageResolution,
      ) => {
        image.dataset.markdownImageTarget = target;
        image.dataset.imageInternal = resolution.is_internal ? "true" : "false";
        image.dataset.imageExists = resolution.exists ? "true" : "false";

        if (resolution.is_image && resolution.data_url) {
          image.setAttribute("src", resolution.data_url);
          image.removeAttribute("title");
          return;
        }

        if (resolution.is_internal) {
          image.title = resolution.exists
            ? "画像として表示できないファイルです。"
            : "ファイルが見つかりません。";
        }
      };

      const applyLinkStatusToCurrentAnchors = (target: string, status: MarkdownLinkStatus) => {
        for (const anchor of matchingCurrentAnchors(target)) {
          applyLinkStatus(anchor, status);
        }
      };

      const applyUnknownStatusToCurrentAnchors = (target: string) => {
        for (const anchor of matchingCurrentAnchors(target)) {
          markLinkStatusUnknown(anchor);
        }
      };

      const applyImageResolutionToCurrentImages = (
        target: string,
        resolution: MarkdownImageResolution,
      ) => {
        for (const image of matchingCurrentImages(target)) {
          applyImageResolution(image, target, resolution);
        }
      };

      const applyUnknownResolutionToCurrentImages = (target: string) => {
        for (const image of matchingCurrentImages(target)) {
          markImageResolutionUnknown(image);
        }
      };

      linkStatusFrameRef.current = null;
      const root = rootRef.current;
      if (!root) {
        return;
      }

      const runId = (linkStatusRunIdRef.current += 1);
      const anchors = currentMarkdownAnchors(root);
      const targets = new Set<string>();
      for (const anchor of anchors) {
        const target = anchor.getAttribute("href") ?? "";
        const cachedStatus = linkStatusCacheRef.current.get(target);
        if (cachedStatus) {
          applyLinkStatus(anchor, cachedStatus);
        } else {
          markLinkStatusUnknown(anchor);
        }

        targets.add(target);
      }

      const images = currentMarkdownImages(root);
      const imageTargets = new Set<string>();
      for (const image of images) {
        const target = markdownImageTarget(image);
        if (!target || target.startsWith("data:")) {
          continue;
        }

        const cachedResolution = imageResolutionCacheRef.current.get(target);
        if (cachedResolution) {
          applyImageResolution(image, target, cachedResolution);
        } else {
          image.dataset.markdownImageTarget = target;
          markImageResolutionUnknown(image);
        }

        imageTargets.add(target);
      }

      for (const target of targets) {
        void onResolveMarkdownLinkStatusRef
          .current(target)
          .then((status) => {
            if (runId !== linkStatusRunIdRef.current) {
              return;
            }

            linkStatusCacheRef.current.set(target, status);
            applyLinkStatusToCurrentAnchors(target, status);
          })
          .catch(() => {
            if (runId !== linkStatusRunIdRef.current) {
              return;
            }
            linkStatusCacheRef.current.delete(target);
            applyUnknownStatusToCurrentAnchors(target);
          });
      }

      for (const target of imageTargets) {
        void onResolveMarkdownImageRef
          .current(target)
          .then((resolution) => {
            if (runId !== linkStatusRunIdRef.current) {
              return;
            }

            imageResolutionCacheRef.current.set(target, resolution);
            applyImageResolutionToCurrentImages(target, resolution);
          })
          .catch(() => {
            if (runId !== linkStatusRunIdRef.current) {
              return;
            }
            imageResolutionCacheRef.current.delete(target);
            applyUnknownResolutionToCurrentImages(target);
          });
      }
    });
  }, [isTest]);

  useEffect(() => {
    if (isTest) {
      return;
    }

    const root = rootRef.current;
    if (!root) {
      return;
    }

    const crepe = new Crepe({
      root,
      defaultValue: initialValueRef.current,
      features: {
        [Crepe.Feature.AI]: false,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          mode: "block",
          text: "",
        },
      },
    });
    crepe.editor.use(
      createMilkdownSearchHighlightPlugin(
        searchStateRef,
        (view) => {
          milkdownViewRef.current = view;
        },
        (view) => {
          if (milkdownViewRef.current === view) {
            milkdownViewRef.current = null;
          }
        },
      ),
    );

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        onChangeRef.current(markdown);
        scheduleLinkStatusUpdate();
      });
    });
    crepeRef.current = crepe;

    void crepe.create().then(() => {
      crepe.setReadonly(disabledRef.current);
      scheduleLinkStatusUpdate();
    });

    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>(".ProseMirror a[href]");
      const href = anchor?.getAttribute("href") ?? "";
      if (!href || anchor?.dataset.linkInternal === "false") {
        return;
      }

      event.preventDefault();
      onOpenMarkdownLinkRef.current(href);
    };
    root.addEventListener("click", handleClick);

    return () => {
      root.removeEventListener("click", handleClick);
      linkStatusRunIdRef.current += 1;
      if (linkStatusFrameRef.current !== null) {
        window.cancelAnimationFrame(linkStatusFrameRef.current);
        linkStatusFrameRef.current = null;
      }
      if (searchScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(searchScrollFrameRef.current);
        searchScrollFrameRef.current = null;
      }
      milkdownViewRef.current = null;
      crepeRef.current = null;
      void crepe.destroy();
    };
  }, [isTest, scheduleLinkStatusUpdate]);

  useEffect(() => {
    crepeRef.current?.setReadonly(disabled);
  }, [disabled]);

  useEffect(() => {
    scheduleLinkStatusUpdate();
  }, [scheduleLinkStatusUpdate]);

  if (isTest) {
    return (
      <TextField
        label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        multiline
        minRows={24}
        fullWidth
        sx={{
          "& textarea": {
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            lineHeight: 1.6,
          },
        }}
      />
    );
  }

  return (
    <Box
      aria-label={ariaLabel}
      ref={rootRef}
      sx={{
        minHeight: "calc(100vh - 120px)",
        "& .milkdown": {
          "--crepe-color-background": "#ffffff",
          "--crepe-color-hover": "#f6f8fa",
          "--crepe-color-on-background": "#1f2328",
          "--crepe-color-primary": "#0969da",
          "--crepe-color-outline": "#57606a",
          "--crepe-color-selected": "#d8dee4",
          "--crepe-color-surface": "#ffffff",
          "--crepe-shadow-1":
            "0 8px 24px rgba(140, 149, 159, 0.2), 0 2px 8px rgba(31, 35, 40, 0.12)",
          minHeight: "calc(100vh - 152px)",
        },
        "& .milkdown-toolbar, & .milkdown-link-preview, & .milkdown-link-edit": {
          zIndex: 1300,
        },
        "& .ProseMirror-focused": {
          "--prosemirror-virtual-cursor-color": "#1f2328",
        },
        "& .ProseMirror": {
          caretColor: "#1f2328",
          color: "#1f2328",
          minHeight: "calc(100vh - 160px)",
          outline: "none",
        },
        "& .ProseMirror a[data-page-exists='false']": {
          color: "#cf222e",
          textDecorationLine: "underline",
          textDecorationStyle: "dashed",
          textUnderlineOffset: "0.18em",
        },
        "& .ProseMirror a[data-page-exists='true']": {
          color: "#0969da",
          textDecorationLine: "underline",
          textDecorationStyle: "solid",
          textUnderlineOffset: "0.18em",
        },
        "& .ProseMirror .daibase-search-match": {
          backgroundColor: "#fff0a6",
          borderRadius: 0.5,
        },
        "& .ProseMirror .daibase-search-match-active": {
          backgroundColor: "#ffd33d",
          outline: "1px solid #d29922",
        },
      }}
    />
  );
}

function markdownImageTarget(image: HTMLImageElement) {
  return image.dataset.markdownImageTarget ?? image.getAttribute("src") ?? "";
}

const milkdownSearchHighlightMetaKey = "daibase-search-highlight";

function createMilkdownSearchHighlightPlugin(
  searchStateRef: RefObject<{
    activeSearchMatch: PageSearchMatch | null;
    searchIndex: number;
    searchMatches: PageSearchMatch[];
    searchQuery: string;
  }>,
  onViewCreate: (view: EditorView) => void,
  onViewDestroy: (view: EditorView) => void,
) {
  return $prose(
    () =>
      new Plugin({
        props: {
          decorations(state) {
            const { searchMatches, searchQuery } = searchStateRef.current;
            const normalizedQuery = searchQuery.trim().toLowerCase();
            if (!normalizedQuery || searchMatches.length === 0) {
              return DecorationSet.empty;
            }

            const decorations: Decoration[] = [];
            let visibleMatchIndex = 0;
            state.doc.descendants((node, position) => {
              if (!node.isText || !node.text) {
                return;
              }

              const normalizedText = node.text.toLowerCase();
              let cursor = 0;
              while (cursor <= normalizedText.length) {
                const start = normalizedText.indexOf(normalizedQuery, cursor);
                if (start < 0) {
                  break;
                }

                const end = start + normalizedQuery.length;
                const isActive = visibleMatchIndex === searchStateRef.current.searchIndex;
                const className = isActive
                  ? "daibase-search-match daibase-search-match-active"
                  : "daibase-search-match";
                decorations.push(
                  Decoration.inline(position + start, position + end, {
                    class: className,
                    ...(isActive ? { "data-active-search-match": "true" } : {}),
                  }),
                );
                visibleMatchIndex += 1;
                cursor = end;
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
        view(view) {
          onViewCreate(view);
          return {
            update(currentView) {
              window.requestAnimationFrame(() => {
                const activeMatch = currentView.dom.querySelector<HTMLElement>(
                  ".daibase-search-match-active",
                );
                if (!activeMatch) {
                  return;
                }

                activeMatch.scrollIntoView({
                  block: "nearest",
                  inline: "nearest",
                });
              });
            },
            destroy() {
              onViewDestroy(view);
            },
          };
        },
      }),
  );
}
