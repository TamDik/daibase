import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import { useEffect, useRef } from "react";

export function MarkdownWysiwygEditor({
  ariaLabel,
  disabled,
  value,
  onChange,
}: {
  ariaLabel: string;
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const initialValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const isTest = import.meta.env.MODE === "test";

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
      });
    });
    crepeRef.current = crepe;

    void crepe.create().then(() => {
      crepe.setReadonly(disabled);
    });

    return () => {
      crepeRef.current = null;
      void crepe.destroy();
    };
  }, [isTest]);

  useEffect(() => {
    crepeRef.current?.setReadonly(disabled);
  }, [disabled]);

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
      }}
    />
  );
}
