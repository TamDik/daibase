import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownPreview({
  existingPageLocations,
  markdown,
  onOpenLocation,
  onResolveMarkdownLink,
}: {
  existingPageLocations: ReadonlySet<string>;
  markdown: string;
  onOpenLocation: (location: string) => void;
  onResolveMarkdownLink: (target: string) => Promise<string>;
}) {
  return (
    <Box
      sx={{
        "& > :first-of-type": { mt: 0 },
        "& > :last-child": { mb: 0 },
        "& table": {
          borderCollapse: "collapse",
          width: "100%",
        },
        "& th, & td": {
          border: "1px solid #d0d7de",
          p: 1,
        },
        "& code": {
          bgcolor: "#f6f8fa",
          borderRadius: 0.5,
          px: 0.5,
        },
        "& pre": {
          bgcolor: "#f6f8fa",
          borderRadius: 1,
          overflow: "auto",
          p: 2,
        },
      }}
    >
      <ReactMarkdown
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
              <Typography variant="h4" component="h1" sx={{ mt: 3, mb: 1.5 }}>
                {children}
              </Typography>
            );
          },
          h2({ children }) {
            return (
              <Typography variant="h5" component="h2" sx={{ mt: 2.5, mb: 1 }}>
                {children}
              </Typography>
            );
          },
          h3({ children }) {
            return (
              <Typography variant="h6" component="h3" sx={{ mt: 2, mb: 1 }}>
                {children}
              </Typography>
            );
          },
          p({ children }) {
            return (
              <Typography variant="body1" sx={{ mb: 1.5 }}>
                {children}
              </Typography>
            );
          },
          li({ children }) {
            return (
              <Typography component="li" variant="body1" sx={{ mb: 0.5 }}>
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
