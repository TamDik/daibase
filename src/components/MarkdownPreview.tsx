import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import {
  buildMarkdownPreviewSx,
  resolveMarkdownPreviewStyleConfig,
  type MarkdownPreviewStyleOverrides,
} from "../lib/markdownStyle";

export function MarkdownPreview({
  existingPageLocations,
  markdown,
  onOpenLocation,
  onResolveMarkdownLink,
  styleConfig,
}: {
  existingPageLocations: ReadonlySet<string>;
  markdown: string;
  onOpenLocation: (location: string) => void;
  onResolveMarkdownLink: (target: string) => Promise<string>;
  styleConfig?: MarkdownPreviewStyleOverrides;
}) {
  const previewStyle = resolveMarkdownPreviewStyleConfig(styleConfig);

  return (
    <Box sx={buildMarkdownPreviewSx(previewStyle)}>
      <ReactMarkdown
        rehypePlugins={[rehypeHighlight]}
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            return (
              <MarkdownLink
                existingPageLocations={existingPageLocations}
                href={href}
                onOpenLocation={onOpenLocation}
                onResolveMarkdownLink={onResolveMarkdownLink}
              >
                {children}
              </MarkdownLink>
            );
          },
          h1({ children }) {
            return (
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  mt: previewStyle.heading.h1.marginTop,
                  mb: previewStyle.heading.h1.marginBottom,
                  lineHeight: previewStyle.heading.h1.lineHeight,
                }}
              >
                {children}
              </Typography>
            );
          },
          h2({ children }) {
            return (
              <Typography
                variant="h5"
                component="h2"
                sx={{
                  borderBottom: `1px solid ${previewStyle.heading.h2.borderColor}`,
                  mt: previewStyle.heading.h2.marginTop,
                  mb: previewStyle.heading.h2.marginBottom,
                  lineHeight: previewStyle.heading.h2.lineHeight,
                  pb: previewStyle.heading.h2.paddingBottom,
                }}
              >
                {children}
              </Typography>
            );
          },
          h3({ children }) {
            return (
              <Typography
                variant="h6"
                component="h3"
                sx={{
                  mt: previewStyle.heading.h3.marginTop,
                  mb: previewStyle.heading.h3.marginBottom,
                  lineHeight: previewStyle.heading.h3.lineHeight,
                }}
              >
                {children}
              </Typography>
            );
          },
          p({ children }) {
            return (
              <Typography
                variant="body1"
                sx={{
                  fontSize: previewStyle.paragraph.fontSize,
                  lineHeight: previewStyle.paragraph.lineHeight,
                  mt: previewStyle.paragraph.marginTop,
                  mb: previewStyle.paragraph.marginBottom,
                }}
              >
                {children}
              </Typography>
            );
          },
          li({ children }) {
            return (
              <Typography
                component="li"
                variant="body1"
                sx={{
                  lineHeight: previewStyle.list.itemLineHeight,
                  mb: previewStyle.list.itemMarginBottom,
                }}
              >
                {children}
              </Typography>
            );
          },
          img({ alt }) {
            return (
              <Typography variant="body2" color="text.secondary">
                {alt}
              </Typography>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </Box>
  );
}

function MarkdownLink({
  children,
  existingPageLocations,
  href,
  onOpenLocation,
  onResolveMarkdownLink,
}: {
  children: ReactNode;
  existingPageLocations: ReadonlySet<string>;
  href?: string;
  onOpenLocation: (location: string) => void;
  onResolveMarkdownLink: (target: string) => Promise<string>;
}) {
  const linkTarget = href ?? "";
  const isExternal = /^https?:\/\//.test(linkTarget);
  const [resolvedLocation, setResolvedLocation] = useState<string | null>(null);

  useEffect(() => {
    if (isExternal || !linkTarget) {
      setResolvedLocation(null);
      return;
    }

    let isActive = true;
    setResolvedLocation(null);
    void onResolveMarkdownLink(linkTarget).then((location) => {
      if (isActive) {
        setResolvedLocation(location);
      }
    });

    return () => {
      isActive = false;
    };
  }, [isExternal, linkTarget, onResolveMarkdownLink]);

  const exists = resolvedLocation === null ? null : existingPageLocations.has(resolvedLocation);

  return (
    <Link
      color={isExternal || exists !== false ? "primary" : "error"}
      data-page-exists={
        isExternal ? undefined : exists === null ? "unknown" : exists ? "true" : "false"
      }
      href={isExternal ? linkTarget : "#"}
      title={isExternal || exists !== false ? undefined : "このページはまだ作成されていません。"}
      sx={{
        textDecorationStyle: exists === false ? "dashed" : "solid",
      }}
      onClick={(event) => {
        if (isExternal) {
          return;
        }

        event.preventDefault();
        if (resolvedLocation) {
          onOpenLocation(resolvedLocation);
          return;
        }

        void onResolveMarkdownLink(linkTarget).then(onOpenLocation);
      }}
    >
      {children}
    </Link>
  );
}
