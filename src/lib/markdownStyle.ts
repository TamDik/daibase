import type { SxProps, Theme } from "@mui/material/styles";

type ResponsiveSpacing = {
  xs: number;
  sm: number;
  md?: number;
};

type MarkdownBlockSpacing = {
  marginTop: number | string;
  marginBottom: number | string;
};

export type MarkdownPreviewStyleConfig = {
  content: {
    maxWidth: number;
    horizontalPadding: ResponsiveSpacing;
    verticalPadding: Omit<ResponsiveSpacing, "md">;
    textColor: string;
    fontSize: string;
    lineHeight: number;
  };
  heading: {
    h1: MarkdownBlockSpacing & {
      lineHeight: number;
    };
    h2: MarkdownBlockSpacing & {
      borderColor: string;
      lineHeight?: number;
      paddingBottom: number;
    };
    h3: MarkdownBlockSpacing & {
      lineHeight: number;
    };
  };
  paragraph: MarkdownBlockSpacing & {
    fontSize: string;
    lineHeight: number;
  };
  list: {
    marginBottom: number;
    paddingLeft: number;
    itemMarginBottom: number;
    itemLineHeight: number;
    nestedParagraphMarginBottom: number;
  };
  blockquote: {
    borderColor: string;
    textColor: string;
    margin: string;
    paddingLeft: number;
  };
  table: {
    borderColor: string;
    headerBackgroundColor: string;
    fontSize: string;
    cellPadding: number;
    marginBottom: number;
  };
  inlineCode: {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    borderRadius: number;
    fontSize: string;
    paddingX: number;
    paddingY: number;
  };
  codeBlock: {
    backgroundColor: string;
    borderColor: string;
    borderRadius: number;
    fontSize: string;
    lineHeight: number;
    marginTop: number;
    marginBottom: number;
    padding: number;
  };
  syntax: {
    comment: string;
    keyword: string;
    title: string;
    literal: string;
    string: string;
    symbol: string;
    text: string;
    selector: string;
  };
};

type DeepPartial<T> = {
  [Key in keyof T]?: T[Key] extends object ? DeepPartial<T[Key]> : T[Key];
};

export type MarkdownPreviewStyleOverrides = DeepPartial<MarkdownPreviewStyleConfig>;

export const defaultMarkdownPreviewStyleConfig: MarkdownPreviewStyleConfig = {
  content: {
    maxWidth: 880,
    horizontalPadding: { xs: 2.5, sm: 4, md: 6 },
    verticalPadding: { xs: 3, sm: 4.5 },
    textColor: "text.primary",
    fontSize: "1rem",
    lineHeight: 1.75,
  },
  heading: {
    h1: {
      marginTop: 4,
      marginBottom: 2,
      lineHeight: 1.25,
    },
    h2: {
      marginTop: 3.5,
      marginBottom: 1.5,
      borderColor: "#d8dee4",
      paddingBottom: 0.75,
    },
    h3: {
      marginTop: 2.75,
      marginBottom: 1,
      lineHeight: 1.35,
    },
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 2,
    fontSize: "1rem",
    lineHeight: 1.75,
  },
  list: {
    marginBottom: 2,
    paddingLeft: 3,
    itemMarginBottom: 0.5,
    itemLineHeight: 1.7,
    nestedParagraphMarginBottom: 0.75,
  },
  blockquote: {
    borderColor: "#d0d7de",
    textColor: "text.secondary",
    margin: "1.25rem 0",
    paddingLeft: 2,
  },
  table: {
    borderColor: "#d0d7de",
    headerBackgroundColor: "#f6f8fa",
    fontSize: "0.9375rem",
    cellPadding: 1.25,
    marginBottom: 2.5,
  },
  inlineCode: {
    backgroundColor: "#f6f8fa",
    borderColor: "#d8dee4",
    textColor: "#24292f",
    borderRadius: 0.75,
    fontSize: "0.875em",
    paddingX: 0.625,
    paddingY: 0.125,
  },
  codeBlock: {
    backgroundColor: "#f6f8fa",
    borderColor: "#d8dee4",
    borderRadius: 1,
    fontSize: "0.875rem",
    lineHeight: 1.65,
    marginTop: 1.5,
    marginBottom: 2.5,
    padding: 2,
  },
  syntax: {
    comment: "#6e7781",
    keyword: "#cf222e",
    title: "#8250df",
    literal: "#0550ae",
    string: "#0a3069",
    symbol: "#953800",
    text: "#24292f",
    selector: "#116329",
  },
};

export function resolveMarkdownPreviewStyleConfig(
  overrides?: MarkdownPreviewStyleOverrides,
): MarkdownPreviewStyleConfig {
  if (!overrides) {
    return defaultMarkdownPreviewStyleConfig;
  }

  return {
    content: {
      ...defaultMarkdownPreviewStyleConfig.content,
      ...overrides.content,
      horizontalPadding: {
        ...defaultMarkdownPreviewStyleConfig.content.horizontalPadding,
        ...overrides.content?.horizontalPadding,
      },
      verticalPadding: {
        ...defaultMarkdownPreviewStyleConfig.content.verticalPadding,
        ...overrides.content?.verticalPadding,
      },
    },
    heading: {
      h1: { ...defaultMarkdownPreviewStyleConfig.heading.h1, ...overrides.heading?.h1 },
      h2: { ...defaultMarkdownPreviewStyleConfig.heading.h2, ...overrides.heading?.h2 },
      h3: { ...defaultMarkdownPreviewStyleConfig.heading.h3, ...overrides.heading?.h3 },
    },
    paragraph: { ...defaultMarkdownPreviewStyleConfig.paragraph, ...overrides.paragraph },
    list: { ...defaultMarkdownPreviewStyleConfig.list, ...overrides.list },
    blockquote: { ...defaultMarkdownPreviewStyleConfig.blockquote, ...overrides.blockquote },
    table: { ...defaultMarkdownPreviewStyleConfig.table, ...overrides.table },
    inlineCode: { ...defaultMarkdownPreviewStyleConfig.inlineCode, ...overrides.inlineCode },
    codeBlock: { ...defaultMarkdownPreviewStyleConfig.codeBlock, ...overrides.codeBlock },
    syntax: { ...defaultMarkdownPreviewStyleConfig.syntax, ...overrides.syntax },
  };
}

export function buildMarkdownPreviewSx(style: MarkdownPreviewStyleConfig): SxProps<Theme> {
  return {
    color: style.content.textColor,
    fontSize: style.content.fontSize,
    lineHeight: style.content.lineHeight,
    maxWidth: style.content.maxWidth,
    mx: "auto",
    px: style.content.horizontalPadding,
    py: style.content.verticalPadding,
    wordBreak: "break-word",
    "& > :first-of-type": { mt: 0 },
    "& > :last-child": { mb: 0 },
    "& blockquote": {
      borderLeft: `4px solid ${style.blockquote.borderColor}`,
      color: style.blockquote.textColor,
      m: style.blockquote.margin,
      pl: style.blockquote.paddingLeft,
    },
    "& blockquote > :first-of-type": { mt: 0 },
    "& blockquote > :last-child": { mb: 0 },
    "& ul, & ol": {
      mb: style.list.marginBottom,
      mt: 0,
      pl: style.list.paddingLeft,
    },
    "& li > p": {
      mb: style.list.nestedParagraphMarginBottom,
    },
    "& table": {
      borderCollapse: "collapse",
      display: "block",
      fontSize: style.table.fontSize,
      mb: style.table.marginBottom,
      overflowX: "auto",
      width: "100%",
    },
    "& th, & td": {
      border: `1px solid ${style.table.borderColor}`,
      p: style.table.cellPadding,
      verticalAlign: "top",
    },
    "& th": {
      bgcolor: style.table.headerBackgroundColor,
      fontWeight: 700,
      textAlign: "left",
    },
    "& code": {
      bgcolor: style.inlineCode.backgroundColor,
      border: `1px solid ${style.inlineCode.borderColor}`,
      borderRadius: style.inlineCode.borderRadius,
      color: style.inlineCode.textColor,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: style.inlineCode.fontSize,
      px: style.inlineCode.paddingX,
      py: style.inlineCode.paddingY,
    },
    "& pre": {
      bgcolor: style.codeBlock.backgroundColor,
      border: `1px solid ${style.codeBlock.borderColor}`,
      borderRadius: style.codeBlock.borderRadius,
      fontSize: style.codeBlock.fontSize,
      lineHeight: style.codeBlock.lineHeight,
      mb: style.codeBlock.marginBottom,
      mt: style.codeBlock.marginTop,
      overflow: "auto",
      p: style.codeBlock.padding,
    },
    "& pre code": {
      bgcolor: "transparent",
      border: 0,
      borderRadius: 0,
      color: "inherit",
      display: "block",
      fontSize: "inherit",
      lineHeight: "inherit",
      p: 0,
    },
    "& .hljs-comment, & .hljs-quote": {
      color: style.syntax.comment,
    },
    "& .hljs-doctag, & .hljs-keyword, & .hljs-meta .hljs-keyword, & .hljs-template-tag, & .hljs-template-variable, & .hljs-type, & .hljs-variable.language_":
      {
        color: style.syntax.keyword,
      },
    "& .hljs-title, & .hljs-title.class_, & .hljs-title.class_.inherited__, & .hljs-title.function_":
      {
        color: style.syntax.title,
      },
    "& .hljs-attr, & .hljs-attribute, & .hljs-literal, & .hljs-meta, & .hljs-number, & .hljs-operator, & .hljs-selector-attr, & .hljs-selector-class, & .hljs-selector-id, & .hljs-variable":
      {
        color: style.syntax.literal,
      },
    "& .hljs-meta .hljs-string, & .hljs-regexp, & .hljs-string": {
      color: style.syntax.string,
    },
    "& .hljs-built_in, & .hljs-symbol": {
      color: style.syntax.symbol,
    },
    "& .hljs-code, & .hljs-formula": {
      color: style.syntax.text,
    },
    "& .hljs-name, & .hljs-quote, & .hljs-selector-pseudo, & .hljs-selector-tag": {
      color: style.syntax.selector,
    },
    "& .hljs-subst": {
      color: style.syntax.text,
    },
  };
}
