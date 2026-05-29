use crate::models::NamespaceSummary;
use serde::Serialize;

pub const NAMESPACES_LOCATION: &str = "Special:Namespaces";
pub const SPECIAL_PAGES_LOCATION: &str = "Special:SpecialPages";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ResolvedLocation {
    Page {
        namespace: NamespaceSummary,
        #[serde(rename = "pagePath")]
        page_path: String,
        location: String,
    },
    SpecialNamespaces {
        location: String,
    },
    SpecialPages {
        namespace: NamespaceSummary,
        location: String,
    },
    SpecialPagesList {
        namespace: NamespaceSummary,
        location: String,
    },
}

pub fn resolve_location(
    raw_location: &str,
    namespaces: &[NamespaceSummary],
    source_namespace: Option<&NamespaceSummary>,
) -> Result<ResolvedLocation, String> {
    let location = raw_location.trim();
    if location == NAMESPACES_LOCATION {
        return Ok(ResolvedLocation::SpecialNamespaces {
            location: NAMESPACES_LOCATION.to_string(),
        });
    }

    let parts = location.split(':').collect::<Vec<_>>();
    if parts.len() < 2 {
        let namespace = require_namespace(source_namespace)?;
        return Ok(ResolvedLocation::Page {
            namespace: namespace.clone(),
            page_path: normalize_page_path(location),
            location: page_location_from_name(location, namespace),
        });
    }

    let first = parts[0];
    let second = parts[1];
    let has_namespace = first != "Page" && first != "Special";
    let namespace = if has_namespace {
        Some(find_namespace_by_name(namespaces, first)?)
    } else {
        source_namespace
    };
    let kind = if has_namespace { second } else { first };
    let name = parts[if has_namespace { 2 } else { 1 }..].join(":");

    if kind == "Special" && name == "Namespaces" {
        return Ok(ResolvedLocation::SpecialNamespaces {
            location: NAMESPACES_LOCATION.to_string(),
        });
    }

    if kind == "Special" && name == "SpecialPages" {
        let resolved_namespace = require_namespace(namespace)?;
        return Ok(ResolvedLocation::SpecialPages {
            namespace: resolved_namespace.clone(),
            location: format!("{}:{SPECIAL_PAGES_LOCATION}", resolved_namespace.name),
        });
    }

    if kind == "Special" && name == "Pages" {
        let resolved_namespace = require_namespace(namespace)?;
        return Ok(ResolvedLocation::SpecialPagesList {
            namespace: resolved_namespace.clone(),
            location: format!("{}:Special:Pages", resolved_namespace.name),
        });
    }

    if kind == "Page" {
        let resolved_namespace = require_namespace(namespace)?;
        return Ok(ResolvedLocation::Page {
            namespace: resolved_namespace.clone(),
            page_path: normalize_page_path(&name),
            location: page_location_from_name(&name, resolved_namespace),
        });
    }

    Err(format!("未対応のロケーションです: {location}"))
}

pub fn normalize_page_path(page_name: &str) -> String {
    let without_prefix = page_name.strip_prefix("Page:").unwrap_or(page_name);
    let without_extension = without_prefix
        .trim()
        .strip_suffix(".md")
        .unwrap_or_else(|| without_prefix.trim());
    format!("Pages/{without_extension}.md")
}

pub fn resolve_markdown_link(
    current_namespace: &NamespaceSummary,
    current_path: &str,
    target: &str,
) -> String {
    let path_without_fragment = target.split('#').next().unwrap_or("");
    let path_without_query = path_without_fragment.split('?').next().unwrap_or("");
    let parts = path_without_query.split(':').collect::<Vec<_>>();

    if parts.len() >= 2
        && (parts[0] == "Page"
            || parts[0] == "Special"
            || parts[1] == "Page"
            || parts[1] == "Special")
    {
        return path_without_query.to_string();
    }

    let mut current_parts = current_path
        .strip_prefix("Pages/")
        .unwrap_or(current_path)
        .strip_suffix(".md")
        .unwrap_or(current_path)
        .split('/')
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    current_parts.pop();

    let mut normalized_parts = Vec::new();
    for part in current_parts
        .into_iter()
        .chain(path_without_query.split('/').map(ToString::to_string))
    {
        if part.is_empty() || part == "." {
            continue;
        }

        if part == ".." {
            normalized_parts.pop();
            continue;
        }

        normalized_parts.push(part);
    }

    page_location_from_name(&normalized_parts.join("/"), current_namespace)
}

fn page_location_from_name(page_name: &str, namespace: &NamespaceSummary) -> String {
    let normalized_name = page_name
        .strip_prefix("Pages/")
        .unwrap_or(page_name)
        .strip_suffix(".md")
        .unwrap_or(page_name);
    format!("{}:Page:{normalized_name}", namespace.name)
}

fn require_namespace(namespace: Option<&NamespaceSummary>) -> Result<&NamespaceSummary, String> {
    namespace.ok_or_else(|| "ネームスペースを選択してください。".to_string())
}

fn find_namespace_by_name<'a>(
    namespaces: &'a [NamespaceSummary],
    name: &str,
) -> Result<&'a NamespaceSummary, String> {
    namespaces
        .iter()
        .find(|namespace| namespace.name == name)
        .ok_or_else(|| format!("ネームスペースが見つかりません: {name}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn resolves_page_location_without_namespace_from_source_namespace() {
        let namespaces = namespaces();
        let resolved = resolve_location("Page:Notes", &namespaces, Some(&namespaces[1])).unwrap();

        assert_eq!(
            resolved,
            ResolvedLocation::Page {
                namespace: namespaces[1].clone(),
                page_path: "Pages/Notes.md".to_string(),
                location: "Work:Page:Notes".to_string(),
            }
        );
    }

    #[test]
    fn resolves_plain_page_name_from_source_namespace() {
        let namespaces = namespaces();
        let resolved = resolve_location("Notes", &namespaces, Some(&namespaces[0])).unwrap();

        assert_eq!(
            resolved,
            ResolvedLocation::Page {
                namespace: namespaces[0].clone(),
                page_path: "Pages/Notes.md".to_string(),
                location: "Main:Page:Notes".to_string(),
            }
        );
    }

    #[test]
    fn resolves_explicit_namespace_page_location() {
        let namespaces = namespaces();
        let resolved =
            resolve_location("Work:Page:Notes", &namespaces, Some(&namespaces[0])).unwrap();

        assert_eq!(
            resolved,
            ResolvedLocation::Page {
                namespace: namespaces[1].clone(),
                page_path: "Pages/Notes.md".to_string(),
                location: "Work:Page:Notes".to_string(),
            }
        );
    }

    #[test]
    fn resolves_global_namespaces_special_page() {
        let namespaces = namespaces();
        let resolved =
            resolve_location("Special:Namespaces", &namespaces, Some(&namespaces[1])).unwrap();

        assert_eq!(
            resolved,
            ResolvedLocation::SpecialNamespaces {
                location: "Special:Namespaces".to_string(),
            }
        );
    }

    #[test]
    fn resolves_special_pages_from_source_namespace() {
        let namespaces = namespaces();
        let resolved =
            resolve_location("Special:SpecialPages", &namespaces, Some(&namespaces[1])).unwrap();

        assert_eq!(
            resolved,
            ResolvedLocation::SpecialPages {
                namespace: namespaces[1].clone(),
                location: "Work:Special:SpecialPages".to_string(),
            }
        );
    }

    #[test]
    fn resolves_pages_special_page_from_source_namespace() {
        let namespaces = namespaces();
        let resolved =
            resolve_location("Special:Pages", &namespaces, Some(&namespaces[1])).unwrap();

        assert_eq!(
            resolved,
            ResolvedLocation::SpecialPagesList {
                namespace: namespaces[1].clone(),
                location: "Work:Special:Pages".to_string(),
            }
        );
    }

    #[test]
    fn rejects_unknown_namespace() {
        let namespaces = namespaces();
        let error =
            resolve_location("Unknown:Page:Main", &namespaces, Some(&namespaces[0])).unwrap_err();

        assert_eq!(error, "ネームスペースが見つかりません: Unknown");
    }

    #[test]
    fn rejects_missing_source_namespace() {
        let namespaces = namespaces();
        let error = resolve_location("Page:Main", &namespaces, None).unwrap_err();

        assert_eq!(error, "ネームスペースを選択してください。");
    }

    #[test]
    fn normalizes_page_path() {
        assert_eq!(
            normalize_page_path("Page:Guide/Intro.md"),
            "Pages/Guide/Intro.md"
        );
    }

    #[test]
    fn resolves_markdown_relative_link() {
        assert_eq!(
            resolve_markdown_link(
                &namespace("ns-work", "Work"),
                "Pages/Guide/Intro.md",
                "Install"
            ),
            "Work:Page:Guide/Install"
        );
    }

    #[test]
    fn resolves_markdown_parent_link() {
        assert_eq!(
            resolve_markdown_link(
                &namespace("ns-work", "Work"),
                "Pages/Guide/Intro/Start.md",
                "../Install",
            ),
            "Work:Page:Guide/Install"
        );
    }

    #[test]
    fn strips_markdown_fragment_and_query() {
        assert_eq!(
            resolve_markdown_link(
                &namespace("ns-work", "Work"),
                "Pages/Guide/Intro.md",
                "Install?tab=mac#setup",
            ),
            "Work:Page:Guide/Install"
        );
    }

    #[test]
    fn keeps_typed_markdown_links_for_location_resolution() {
        let namespace = namespace("ns-work", "Work");
        assert_eq!(
            resolve_markdown_link(&namespace, "Pages/Guide/Intro.md", "Page:Main"),
            "Page:Main"
        );
        assert_eq!(
            resolve_markdown_link(&namespace, "Pages/Guide/Intro.md", "Main:Special:Pages"),
            "Main:Special:Pages"
        );
    }

    fn namespaces() -> Vec<NamespaceSummary> {
        vec![namespace("ns-main", "Main"), namespace("ns-work", "Work")]
    }

    fn namespace(id: &str, name: &str) -> NamespaceSummary {
        NamespaceSummary {
            id: id.to_string(),
            name: name.to_string(),
            root_path: PathBuf::from(format!("/tmp/{name}")),
            default_page: "Pages/Main.md".to_string(),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }
}
