import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownPreview({
  markdown,
  onOpenLocation,
  onResolveMarkdownLink,
}: {
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
            const linkTarget = href ?? "";
            const isExternal = /^https?:\/\//.test(linkTarget);
            return (
              <Link
                href={isExternal ? linkTarget : "#"}
                onClick={(event) => {
                  if (isExternal) {
                    return;
                  }

                  event.preventDefault();
                  void onResolveMarkdownLink(linkTarget).then(onOpenLocation);
                }}
              >
                {children}
              </Link>
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
