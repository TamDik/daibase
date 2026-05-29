import type { NamespaceSummary } from "../api/tauriCommands";

export const defaultPageLocation = "Page:Main";
export const namespacesLocation = "Special:Namespaces";

export type ResolvedLocation =
  | {
      kind: "page";
      namespace: NamespaceSummary;
      pagePath: string;
      location: string;
    }
  | {
      kind: "specialNamespaces";
      location: string;
    }
  | {
      kind: "specialAllPages";
      namespace: NamespaceSummary;
      location: string;
    };

export function resolveLocation(
  rawLocation: string,
  namespaces: NamespaceSummary[],
  sourceNamespace: NamespaceSummary | null,
): ResolvedLocation {
  const location = rawLocation.trim();
  if (location === "Special:Namespaces") {
    return {
      kind: "specialNamespaces",
      location: namespacesLocation,
    };
  }

  const parts = location.split(":");
  if (parts.length < 2) {
    const namespace = requireNamespace(sourceNamespace);
    return {
      kind: "page",
      namespace,
      pagePath: normalizePagePath(location),
      location: pageLocationFromName(location, namespace),
    };
  }

  const first = parts[0];
  const second = parts[1];
  const hasNamespace = first !== "Page" && first !== "Special";
  const namespace = hasNamespace ? findNamespaceByName(namespaces, first) : sourceNamespace;
  const kind = hasNamespace ? second : first;
  const name = parts.slice(hasNamespace ? 2 : 1).join(":");

  if (kind === "Special" && name === "Namespaces") {
    return {
      kind: "specialNamespaces",
      location: namespacesLocation,
    };
  }

  if (kind === "Special" && name === "AllPages") {
    const resolvedNamespace = requireNamespace(namespace);
    return {
      kind: "specialAllPages",
      namespace: resolvedNamespace,
      location: `${resolvedNamespace.name}:Special:AllPages`,
    };
  }

  if (kind === "Page") {
    const resolvedNamespace = requireNamespace(namespace);
    return {
      kind: "page",
      namespace: resolvedNamespace,
      pagePath: normalizePagePath(name),
      location: pageLocationFromName(name, resolvedNamespace),
    };
  }

  throw new Error(`未対応のロケーションです: ${location}`);
}

export function normalizePagePath(pageName: string) {
  const withoutPrefix = pageName.startsWith("Page:") ? pageName.slice("Page:".length) : pageName;
  const withoutExtension = withoutPrefix.trim().replace(/\.md$/, "");
  return `Pages/${withoutExtension}.md`;
}

export function pageLocation(path: string, namespace: NamespaceSummary) {
  const name = path.replace(/^Pages\//, "").replace(/\.md$/, "");
  return pageLocationFromName(name, namespace);
}

export function pageLocationFromName(pageName: string, namespace: NamespaceSummary) {
  const normalizedName = pageName.replace(/^Pages\//, "").replace(/\.md$/, "");
  return `${namespace.name}:Page:${normalizedName}`;
}

export function pageTitle(path: string) {
  const parts = path
    .replace(/^Pages\//, "")
    .replace(/\.md$/, "")
    .split("/");
  return parts[parts.length - 1] ?? path;
}

export function resolveMarkdownLink(
  currentNamespace: NamespaceSummary,
  currentPath: string,
  target: string,
) {
  const [pathWithoutFragment] = target.split("#");
  const pathWithoutQuery = pathWithoutFragment.split("?")[0];
  const parts = pathWithoutQuery.split(":");

  if (
    parts.length >= 2 &&
    (parts[0] === "Page" || parts[0] === "Special" || parts[1] === "Page" || parts[1] === "Special")
  ) {
    return pathWithoutQuery;
  }

  const currentParts = currentPath
    .replace(/^Pages\//, "")
    .replace(/\.md$/, "")
    .split("/");
  currentParts.pop();
  const resolvedParts = [...currentParts, pathWithoutQuery].flatMap((part) => part.split("/"));
  const normalizedParts: string[] = [];

  for (const part of resolvedParts) {
    if (part === "" || part === ".") {
      continue;
    }

    if (part === "..") {
      normalizedParts.pop();
      continue;
    }

    normalizedParts.push(part);
  }

  return pageLocationFromName(normalizedParts.join("/"), currentNamespace);
}

function requireNamespace(namespace: NamespaceSummary | null) {
  if (!namespace) {
    throw new Error("ネームスペースを選択してください。");
  }

  return namespace;
}

function findNamespaceByName(namespaces: NamespaceSummary[], name: string) {
  const namespace = namespaces.find((item) => item.name === name);
  if (!namespace) {
    throw new Error(`ネームスペースが見つかりません: ${name}`);
  }

  return namespace;
}
