use crate::models::NamespaceSummary;
use serde::Serialize;

pub const NAMESPACES_LOCATION: &str = "Special:Namespaces";
pub const SPECIAL_PAGES_LOCATION: &str = "Special:SpecialPages";
pub const DELETED_PAGES_LOCATION: &str = "Special:DeletedPages";

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
    SpecialDeletedPages {
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

    let (namespace, path) = split_location(location, namespaces, source_namespace)?;

    if path == NAMESPACES_LOCATION {
        return Ok(ResolvedLocation::SpecialNamespaces {
            location: NAMESPACES_LOCATION.to_string(),
        });
    }

    if path == SPECIAL_PAGES_LOCATION || path == "Special:SpecialPages" {
        return Ok(ResolvedLocation::SpecialPages {
            namespace: namespace.clone(),
            location: format!("{}:{SPECIAL_PAGES_LOCATION}", namespace.name),
        });
    }

    if path == "Special:Pages" {
        return Ok(ResolvedLocation::SpecialPagesList {
            namespace: namespace.clone(),
            location: format!("{}:Special:Pages", namespace.name),
        });
    }

    if path == DELETED_PAGES_LOCATION || path == "Special:DeletedPages" {
        return Ok(ResolvedLocation::SpecialDeletedPages {
            namespace: namespace.clone(),
            location: format!("{}:{DELETED_PAGES_LOCATION}", namespace.name),
        });
    }

    let normalized_path = normalize_content_path(path);
    if is_page_path(&normalized_path) {
        Ok(ResolvedLocation::Page {
            namespace: namespace.clone(),
            page_path: normalized_path.clone(),
            location: content_location(&normalized_path, namespace),
        })
    } else {
        Ok(ResolvedLocation::File {
            namespace: namespace.clone(),
            file_path: normalized_path.clone(),
            location: content_location(&normalized_path, namespace),
        })
    }
}

pub fn resolve_markdown_link(
    current_namespace: &NamespaceSummary,
    current_path: &str,
    target: &str,
) -> String {
    if target.starts_with('#') {
        return content_location(current_path, current_namespace);
    }

    let path_without_fragment = target.split('#').next().unwrap_or("");
    let path_without_query = path_without_fragment.split('?').next().unwrap_or("");

    if is_special_location(path_without_query) || has_namespace_prefix(path_without_query) {
        return path_without_query.to_string();
    }

    let normalized_path = normalize_relative_content_path(current_path, path_without_query);
    content_location(&normalized_path, current_namespace)
}

pub fn resolve_markdown_image(
    current_namespace: &NamespaceSummary,
    current_path: &str,
    target: &str,
) -> String {
    resolve_markdown_link(current_namespace, current_path, target)
}

pub fn is_external_markdown_link_target(target: &str) -> bool {
    if target.starts_with('#') {
        return false;
    }

    let Some((scheme, _)) = target.split_once(':') else {
        return false;
    };

    if matches!(scheme, "http" | "https" | "mailto") {
        return true;
    }

    if is_special_location(target) || has_namespace_prefix(target) {
        return false;
    }

    let mut chars = scheme.chars();
    chars
        .next()
        .is_some_and(|first_char| first_char.is_ascii_alphabetic())
        && chars
            .all(|char| char.is_ascii_alphanumeric() || char == '+' || char == '.' || char == '-')
}

fn split_location<'a>(
    location: &'a str,
    namespaces: &'a [NamespaceSummary],
    source_namespace: Option<&'a NamespaceSummary>,
) -> Result<(&'a NamespaceSummary, &'a str), String> {
    if let Some((namespace_name, path)) = location.split_once(':') {
        if namespace_name == "Special" {
            return Ok((require_namespace(source_namespace)?, location));
        }

        let namespace = find_namespace_by_name(namespaces, namespace_name)?;
        return Ok((namespace, path));
    }

    Ok((require_namespace(source_namespace)?, location))
}

fn is_page_path(path: &str) -> bool {
    path.ends_with(".md")
}

fn is_special_location(target: &str) -> bool {
    target == NAMESPACES_LOCATION || target.starts_with("Special:")
}

fn has_namespace_prefix(target: &str) -> bool {
    let Some((prefix, _)) = target.split_once(':') else {
        return false;
    };

    prefix != "Special"
}

fn content_location(path: &str, namespace: &NamespaceSummary) -> String {
    format!("{}:{}", namespace.name, normalize_content_path(path))
}

fn normalize_content_path(path: &str) -> String {
    path.trim()
        .replace('\\', "/")
        .trim_start_matches('/')
        .to_string()
}

fn normalize_relative_content_path(current_path: &str, target: &str) -> String {
    let mut current_parts = current_path
        .split('/')
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    current_parts.pop();

    let mut normalized_parts = Vec::new();
    for part in current_parts
        .into_iter()
        .chain(target.split('/').map(ToString::to_string))
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

    normalized_parts.join("/")
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
        let resolved = resolve_location("Notes.md", &namespaces, Some(&namespaces[1])).unwrap();

        assert_eq!(
            resolved,
            ResolvedLocation::Page {
                namespace: namespaces[1].clone(),
                page_path: "Notes.md".to_string(),
                location: "Work:Notes.md".to_string(),
            }
        );
    }

    #[test]
    fn resolves_file_location_without_namespace_from_source_namespace() {
        let namespaces = namespaces();
        let resolved =
            resolve_location("images/logo.png", &namespaces, Some(&namespaces[1])).unwrap();

        assert_eq!(
            resolved,
            ResolvedLocation::File {
                namespace: namespaces[1].clone(),
                file_path: "images/logo.png".to_string(),
                location: "Work:images/logo.png".to_string(),
            }
        );
    }

    #[test]
    fn resolves_extensionless_location_as_file() {
        let namespaces = namespaces();
        let resolved = resolve_location("test", &namespaces, Some(&namespaces[1])).unwrap();

        assert_eq!(
            resolved,
            ResolvedLocation::File {
                namespace: namespaces[1].clone(),
                file_path: "test".to_string(),
                location: "Work:test".to_string(),
            }
        );
    }

    #[test]
    fn resolves_explicit_namespace_content_location() {
        let namespaces = namespaces();
        let resolved =
            resolve_location("Work:Notes.md", &namespaces, Some(&namespaces[0])).unwrap();

        assert_eq!(
            resolved,
            ResolvedLocation::Page {
                namespace: namespaces[1].clone(),
                page_path: "Notes.md".to_string(),
                location: "Work:Notes.md".to_string(),
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
    fn resolves_deleted_pages_special_page_from_source_namespace() {
        let namespaces = namespaces();
        let resolved =
            resolve_location("Special:DeletedPages", &namespaces, Some(&namespaces[1])).unwrap();

        assert_eq!(
            resolved,
            ResolvedLocation::SpecialDeletedPages {
                namespace: namespaces[1].clone(),
                location: "Work:Special:DeletedPages".to_string(),
            }
        );
    }

    #[test]
    fn resolves_deleted_pages_special_page_from_explicit_namespace() {
        let namespaces = namespaces();
        let resolved = resolve_location(
            "Work:Special:DeletedPages",
            &namespaces,
            Some(&namespaces[0]),
        )
        .unwrap();

        assert_eq!(
            resolved,
            ResolvedLocation::SpecialDeletedPages {
                namespace: namespaces[1].clone(),
                location: "Work:Special:DeletedPages".to_string(),
            }
        );
    }

    #[test]
    fn rejects_unknown_namespace() {
        let namespaces = namespaces();
        let error =
            resolve_location("Unknown:Main.md", &namespaces, Some(&namespaces[0])).unwrap_err();

        assert_eq!(error, "ネームスペースが見つかりません: Unknown");
    }

    #[test]
    fn rejects_missing_source_namespace() {
        let namespaces = namespaces();
        let error = resolve_location("Main.md", &namespaces, None).unwrap_err();

        assert_eq!(error, "ネームスペースを選択してください。");
    }

    #[test]
    fn resolves_markdown_relative_link() {
        assert_eq!(
            resolve_markdown_link(
                &namespace("ns-work", "Work"),
                "Guide/Intro.md",
                "Install.md"
            ),
            "Work:Guide/Install.md"
        );
    }

    #[test]
    fn resolves_markdown_parent_link() {
        assert_eq!(
            resolve_markdown_link(
                &namespace("ns-work", "Work"),
                "Guide/Intro/Start.md",
                "../Install.md",
            ),
            "Work:Guide/Install.md"
        );
    }

    #[test]
    fn strips_markdown_fragment_and_query() {
        assert_eq!(
            resolve_markdown_link(
                &namespace("ns-work", "Work"),
                "Guide/Intro.md",
                "Install.md?tab=mac#setup",
            ),
            "Work:Guide/Install.md"
        );
    }

    #[test]
    fn resolves_fragment_only_markdown_link_to_current_page() {
        assert_eq!(
            resolve_markdown_link(&namespace("ns-work", "Work"), "Guide/Intro.md", "#setup",),
            "Work:Guide/Intro.md"
        );
    }

    #[test]
    fn keeps_namespaced_markdown_links_for_location_resolution() {
        let namespace = namespace("ns-work", "Work");
        assert_eq!(
            resolve_markdown_link(&namespace, "Guide/Intro.md", "Main:Special:Pages"),
            "Main:Special:Pages"
        );
        assert_eq!(
            resolve_markdown_link(&namespace, "Guide/Intro.md", "Work:images/logo.png"),
            "Work:images/logo.png"
        );
    }

    #[test]
    fn resolves_markdown_image_target_to_file_location() {
        let namespace = namespace("ns-work", "Work");
        assert_eq!(
            resolve_markdown_image(&namespace, "Guide/Intro.md", "test"),
            "Work:Guide/test"
        );
        assert_eq!(
            resolve_markdown_image(&namespace, "Guide/Intro.md", "../images/logo.png"),
            "Work:images/logo.png"
        );
    }

    #[test]
    fn classifies_external_markdown_link_targets() {
        assert!(is_external_markdown_link_target("https://example.com"));
        assert!(is_external_markdown_link_target("mailto:hello@example.com"));
        assert!(!is_external_markdown_link_target("Special:Pages"));
        assert!(!is_external_markdown_link_target("Work:Draft.md"));
        assert!(!is_external_markdown_link_target("Guide/Intro.md"));
        assert!(!is_external_markdown_link_target("../Draft.md"));
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
            default_page: "Main.md".to_string(),
            default_location: format!("{name}:Main.md"),
            pages_location: format!("{name}:Special:Pages"),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }
}
