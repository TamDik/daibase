use std::path::{Component, Path, PathBuf};

pub fn validate_page_path(path: &str) -> Result<String, String> {
    let normalized = validate_managed_path(path)?;
    if !normalized.ends_with(".md") {
        return Err("Markdown ページの拡張子は .md にしてください。".to_string());
    }

    Ok(normalized)
}

pub fn validate_file_path(path: &str) -> Result<String, String> {
    let normalized = validate_managed_path(path)?;
    if normalized.ends_with(".md") {
        return Err(".md ファイルはページとして扱います。".to_string());
    }

    Ok(normalized)
}

pub fn validate_folder_path(path: &str) -> Result<String, String> {
    validate_managed_path(path)
}

pub fn resolve_namespace_path(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let normalized = validate_page_path(relative_path)?;
    Ok(root.join(normalized))
}

pub fn resolve_namespace_file_path(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let normalized = validate_file_path(relative_path)?;
    Ok(root.join(normalized))
}

pub fn resolve_namespace_folder_path(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let normalized = validate_folder_path(relative_path)?;
    Ok(root.join(normalized))
}

fn validate_managed_path(path: &str) -> Result<String, String> {
    if path.trim().is_empty() {
        return Err("パスが空です。".to_string());
    }

    let path = path.replace('\\', "/");
    let relative = Path::new(path.trim());

    if relative.is_absolute() {
        return Err("絶対パスは指定できません。".to_string());
    }

    let mut parts = Vec::new();
    for component in relative.components() {
        match component {
            Component::Normal(part) => {
                let part = part.to_string_lossy().to_string();
                if part.starts_with('.') {
                    return Err("隠しパスは指定できません。".to_string());
                }
                parts.push(part);
            }
            Component::CurDir => {}
            Component::ParentDir => {
                return Err("親ディレクトリへの参照は指定できません。".to_string());
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err("絶対パスは指定できません。".to_string());
            }
        }
    }

    if parts.is_empty() || parts.iter().any(|part| part.is_empty()) {
        return Err("ファイル名を指定してください。".to_string());
    }

    Ok(parts.join("/"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_markdown_page_path() {
        assert_eq!(validate_page_path("Main.md").unwrap(), "Main.md");
        assert_eq!(
            validate_page_path("Guide/Intro.md").unwrap(),
            "Guide/Intro.md"
        );
    }

    #[test]
    fn rejects_page_path_without_markdown_extension() {
        assert!(validate_page_path("Main").is_err());
    }

    #[test]
    fn rejects_path_traversal() {
        assert!(validate_page_path("../secret.md").is_err());
    }

    #[test]
    fn rejects_hidden_paths() {
        assert!(validate_page_path(".hidden.md").is_err());
        assert!(validate_file_path(".DS_Store").is_err());
        assert!(validate_file_path(".daibase/object").is_err());
        assert!(validate_folder_path(".daibase").is_err());
    }

    #[test]
    fn accepts_file_path_without_markdown_extension() {
        assert_eq!(
            validate_file_path("images/logo.png").unwrap(),
            "images/logo.png"
        );
        assert_eq!(validate_file_path("test").unwrap(), "test");
    }

    #[test]
    fn rejects_markdown_file_path() {
        assert!(validate_file_path("notes.md").is_err());
    }

    #[test]
    fn rejects_file_path_traversal() {
        assert!(validate_file_path("images/../secret.png").is_err());
    }
}
