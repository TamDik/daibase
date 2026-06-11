use crate::models::{HelpDocument, HelpDocumentSummary};

include!(concat!(env!("OUT_DIR"), "/help_documents.rs"));

pub fn list_documents() -> Vec<HelpDocumentSummary> {
    HELP_DOCUMENTS
        .iter()
        .map(|(path, content)| HelpDocumentSummary {
            path: (*path).to_string(),
            title: document_title(content, path),
            location: format!("Special:Help/{path}"),
        })
        .collect()
}

pub fn read_document(path: &str) -> Result<HelpDocument, String> {
    let normalized_path = normalize_document_path(path)?;
    let (_, content) = HELP_DOCUMENTS
        .iter()
        .find(|(document_path, _)| *document_path == normalized_path)
        .ok_or_else(|| format!("ヘルプドキュメントが見つかりません: {normalized_path}"))?;

    Ok(HelpDocument {
        path: normalized_path.to_string(),
        title: document_title(content, normalized_path),
        location: format!("Special:Help/{normalized_path}"),
        markdown: (*content).to_string(),
    })
}

fn normalize_document_path(path: &str) -> Result<&str, String> {
    let path = path.trim().trim_start_matches('/');
    if path.is_empty() || path.contains('/') || path.contains('\\') || path.contains("..") {
        return Err("ヘルプドキュメントのパスが不正です。".to_string());
    }
    Ok(path)
}

fn document_title(content: &str, fallback_path: &str) -> String {
    content
        .lines()
        .find_map(|line| line.strip_prefix("# ").map(str::trim))
        .filter(|title| !title.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| fallback_path.trim_end_matches(".md").to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_all_embedded_markdown_documents() {
        let documents = list_documents();

        assert!(documents
            .iter()
            .any(|document| document.path == "content-app-design.md"));
        assert!(documents
            .iter()
            .any(|document| document.path == "plugin-development.md"));
        assert!(documents
            .iter()
            .all(|document| document.location.starts_with("Special:Help/")));
    }

    #[test]
    fn reads_document_with_markdown_title() {
        let document = read_document("plugin-development.md").unwrap();

        assert_eq!(document.title, "Plugin Development");
        assert!(document.markdown.starts_with("# Plugin Development"));
    }

    #[test]
    fn rejects_nested_or_parent_paths() {
        assert!(read_document("../Cargo.toml").is_err());
        assert!(read_document("nested/document.md").is_err());
    }
}
