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
    File {
        namespace: NamespaceSummary,
        #[serde(rename = "filePath")]
        file_path: String,
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
    let has_namespace = first != "Page" && first != "File" && first != "Special";
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

    if kind == "File" {
        let resolved_namespace = require_namespace(namespace)?;
        return Ok(ResolvedLocation::File {
            namespace: resolved_namespace.clone(),
            file_path: normalize_file_path(&name),
            location: file_location_from_name(&name, resolved_namespace),
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

pub fn normalize_file_path(file_name: &str) -> String {
    let without_file_prefix = file_name.strip_prefix("File:").unwrap_or(file_name);
    let without_prefix = without_file_prefix
        .strip_prefix("Files/")
        .unwrap_or(without_file_prefix);
    format!("Files/{}", without_prefix.trim())
}

pub fn resolve_markdown_link(
    current_namespace: &NamespaceSummary,
    current_path: &str,
    target: &str,
) -> String {
    if target.starts_with('#') {
        return page_location_from_name(current_path, current_namespace);
    }

    let path_without_fragment = target.split('#').next().unwrap_or("");
    let path_without_query = path_without_fragment.split('?').next().unwrap_or("");
    let parts = path_without_query.split(':').collect::<Vec<_>>();

    if parts.len() >= 2
        && (parts[0] == "Page"
            || parts[0] == "File"
            || parts[0] == "Special"
            || parts[1] == "Page"
            || parts[1] == "File"
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

    let normalized_path = normalized_parts.join("/");
    if normalized_path.starts_with("Files/") {
        file_location_from_name(&normalized_path, current_namespace)
    } else {
        page_location_from_name(&normalized_path, current_namespace)
    }
}

pub fn resolve_markdown_image(
    current_namespace: &NamespaceSummary,
    current_path: &str,
    target: &str,
) -> String {
    let path_without_fragment = target.split('#').next().unwrap_or("");
    let path_without_query = path_without_fragment.split('?').next().unwrap_or("");
    let parts = path_without_query.split(':').collect::<Vec<_>>();

    if parts.len() >= 2
        && (parts[0] == "Page"
            || parts[0] == "File"
            || parts[0] == "Special"
            || parts[1] == "Page"
            || parts[1] == "File"
            || parts[1] == "Special")
    {
        return path_without_query.to_string();
    }

    let page_relative_location =
        resolve_markdown_link(current_namespace, current_path, path_without_query);
    if page_relative_location.contains(":File:") || page_relative_location.starts_with("File:") {
        return page_relative_location;
    }

    let normalized_file_path = normalize_file_path(path_without_query.trim_start_matches('/'));
    file_location_from_name(&normalized_file_path, current_namespace)
}

pub fn is_external_markdown_link_target(target: &str) -> bool {
    if target.starts_with('#') {
        return false;
    }

    let mut parts = target.split(':');
    let first = parts.next().unwrap_or("");
    let second = parts.next().unwrap_or("");
    if first == "Page"
        || first == "File"
        || first == "Special"
        || second == "Page"
        || second == "File"
        || second == "Special"
    {
        return false;
    }

    let Some((scheme, _)) = target.split_once(':') else {
        return false;
    };

    let mut chars = scheme.chars();
    chars
        .next()
        .is_some_and(|first_char| first_char.is_ascii_alphabetic())
        && chars
            .all(|char| char.is_ascii_alphanumeric() || char == '+' || char == '.' || char == '-')
}

fn page_location_from_name(page_name: &str, namespace: &NamespaceSummary) -> String {
    let normalized_name = page_name
        .strip_prefix("Pages/")
        .unwrap_or(page_name)
        .strip_suffix(".md")
        .unwrap_or(page_name);
    format!("{}:Page:{normalized_name}", namespace.name)
}

fn file_location_from_name(file_name: &str, namespace: &NamespaceSummary) -> String {
    let without_files_prefix = file_name.strip_prefix("Files/").unwrap_or(file_name);
    let normalized_name = without_files_prefix
        .strip_prefix("File:")
        .unwrap_or(without_files_prefix);
    format!("{}:File:{normalized_name}", namespace.name)
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
    fn resolves_file_location_from_source_namespace() {
        let namespaces = namespaces();
        let resolved =
            resolve_location("File:images/logo.png", &namespaces, Some(&namespaces[1])).unwrap();

        assert_eq!(
            resolved,
            ResolvedLocation::File {
                namespace: namespaces[1].clone(),
                file_path: "Files/images/logo.png".to_string(),
                location: "Work:File:images/logo.png".to_string(),
            }
        );
    }

    #[test]
    fn resolves_explicit_namespace_file_location() {
        let namespaces = namespaces();
        let resolved = resolve_location(
            "Work:File:images/logo.png",
            &namespaces,
            Some(&namespaces[0]),
        )
        .unwrap();

        assert_eq!(
            resolved,
            ResolvedLocation::File {
                namespace: namespaces[1].clone(),
                file_path: "Files/images/logo.png".to_string(),
                location: "Work:File:images/logo.png".to_string(),
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
    fn normalizes_file_path() {
        assert_eq!(
            normalize_file_path("File:images/logo.png"),
            "Files/images/logo.png"
        );
        assert_eq!(
            normalize_file_path("Files/images/logo.png"),
            "Files/images/logo.png"
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
    fn resolves_fragment_only_markdown_link_to_current_page() {
        assert_eq!(
            resolve_markdown_link(
                &namespace("ns-work", "Work"),
                "Pages/Guide/Intro.md",
                "#setup",
            ),
            "Work:Page:Guide/Intro"
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
            resolve_markdown_link(&namespace, "Pages/Guide/Intro.md", "File:images/logo.png"),
            "File:images/logo.png"
        );
        assert_eq!(
            resolve_markdown_link(&namespace, "Pages/Guide/Intro.md", "Main:Special:Pages"),
            "Main:Special:Pages"
        );
    }

    #[test]
    fn resolves_markdown_file_link_to_file_location() {
        assert_eq!(
            resolve_markdown_link(
                &namespace("ns-work", "Work"),
                "Pages/Guide/Intro.md",
                "../../Files/images/logo.png",
            ),
            "Work:File:images/logo.png"
        );
    }

    #[test]
    fn resolves_markdown_image_target_to_file_location() {
        let namespace = namespace("ns-work", "Work");
        assert_eq!(
            resolve_markdown_image(&namespace, "Pages/Guide/Intro.md", "test"),
            "Work:File:test"
        );
        assert_eq!(
            resolve_markdown_image(&namespace, "Pages/Guide/Intro.md", "File:test"),
            "File:test"
        );
        assert_eq!(
            resolve_markdown_image(&namespace, "Pages/Guide/Intro.md", "Files/images/logo.png"),
            "Work:File:images/logo.png"
        );
        assert_eq!(
            resolve_markdown_image(&namespace, "Pages/Guide/Intro.md", "../../Files/logo.png"),
            "Work:File:logo.png"
        );
    }

    #[test]
    fn classifies_external_markdown_link_targets() {
        assert!(is_external_markdown_link_target("https://example.com"));
        assert!(is_external_markdown_link_target("mailto:hello@example.com"));
        assert!(!is_external_markdown_link_target("Page:Draft"));
        assert!(!is_external_markdown_link_target("File:images/logo.png"));
        assert!(!is_external_markdown_link_target("Special:Pages"));
        assert!(!is_external_markdown_link_target("Work:Page:Draft"));
        assert!(!is_external_markdown_link_target(
            "Work:File:images/logo.png"
        ));
        assert!(!is_external_markdown_link_target("Work:Special:Pages"));
        assert!(!is_external_markdown_link_target("Guide/Intro"));
        assert!(!is_external_markdown_link_target("../Draft"));
        assert!(!is_external_markdown_link_target("#section"));
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
            default_location: format!("{name}:Page:Main"),
            pages_location: format!("{name}:Special:Pages"),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }
}
