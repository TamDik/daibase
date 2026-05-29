import type { NamespaceSummary } from "../api/tauriCommands";

export const defaultPageLocation = "Page:Main";
export const namespacesLocation = "Special:Namespaces";

export function pageLocation(path: string, namespace: NamespaceSummary) {
  const name = path.replace(/^Pages\//, "").replace(/\.md$/, "");
  return `${namespace.name}:Page:${name}`;
}

export function pageTitle(path: string) {
  const parts = path
    .replace(/^Pages\//, "")
    .replace(/\.md$/, "")
    .split("/");
  return parts[parts.length - 1] ?? path;
}
