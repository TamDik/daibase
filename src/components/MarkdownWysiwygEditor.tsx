import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import { useCallback, useEffect, useRef } from "react";

type MarkdownLinkStatus = {
  exists: boolean;
  is_internal: boolean;
  location: string;
};

export function MarkdownWysiwygEditor({
  ariaLabel,
  disabled,
  onOpenMarkdownLink,
  onResolveMarkdownLinkStatus,
  value,
  onChange,
}: {
  ariaLabel: string;
  disabled: boolean;
  onOpenMarkdownLink: (target: string) => void;
  onResolveMarkdownLinkStatus: (target: string) => Promise<MarkdownLinkStatus>;
  value: string;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const initialValueRef = useRef(value);
  const disabledRef = useRef(disabled);
  const onChangeRef = useRef(onChange);
  const onOpenMarkdownLinkRef = useRef(onOpenMarkdownLink);
  const onResolveMarkdownLinkStatusRef = useRef(onResolveMarkdownLinkStatus);
  const linkStatusFrameRef = useRef<number | null>(null);
  const linkStatusRunIdRef = useRef(0);
  const linkStatusCacheRef = useRef(new Map<string, MarkdownLinkStatus>());
  const isTest = import.meta.env.MODE === "test";

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onOpenMarkdownLinkRef.current = onOpenMarkdownLink;
  }, [onOpenMarkdownLink]);

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

      const matchingCurrentAnchors = (target: string) => {
        const root = rootRef.current;
        if (!root) {
          return [];
        }

        return currentMarkdownAnchors(root).filter(
          (anchor) => anchor.getAttribute("href") === target,
        );
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
        px: 2,
        py: 1.5,
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
      }}
    />
  );
}
