use std::path::{Component, Path, PathBuf};

const MANAGED_PAGE_DIR: &str = "Pages";
const MANAGED_FILE_DIR: &str = "Files";

pub fn validate_page_path(path: &str) -> Result<String, String> {
    if path.trim().is_empty() {
        return Err("ページパスが空です。".to_string());
    }

    let path = path.replace('\\', "/");
    let relative = Path::new(&path);

    if relative.is_absolute() {
        return Err("絶対パスは指定できません。".to_string());
    }

    let mut parts = Vec::new();
    for component in relative.components() {
        match component {
            Component::Normal(part) => parts.push(part.to_string_lossy().to_string()),
            Component::CurDir => {}
            Component::ParentDir => {
                return Err("親ディレクトリへの参照は指定できません。".to_string());
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err("絶対パスは指定できません。".to_string());
            }
        }
    }

    if parts.first().map(String::as_str) != Some(MANAGED_PAGE_DIR) {
        return Err("Markdown ページは Pages/ 配下に保存してください。".to_string());
    }

    let normalized = parts.join("/");
    if !normalized.ends_with(".md") {
        return Err("Markdown ページの拡張子は .md にしてください。".to_string());
    }

    Ok(normalized)
}

pub fn validate_file_path(path: &str) -> Result<String, String> {
    let normalized = validate_relative_path(path)?;

    let parts = normalized.split('/').collect::<Vec<_>>();
    if parts.first().copied() != Some(MANAGED_FILE_DIR) {
        return Err("ファイルは Files/ 配下に保存してください。".to_string());
    }
    if parts.len() < 2 || parts.iter().any(|part| part.is_empty()) {
        return Err("ファイル名を指定してください。".to_string());
    }

    Ok(normalized)
}

pub fn resolve_namespace_path(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let normalized = validate_page_path(relative_path)?;
    Ok(root.join(normalized))
}

pub fn resolve_namespace_file_path(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let normalized = validate_file_path(relative_path)?;
    Ok(root.join(normalized))
}

fn validate_relative_path(path: &str) -> Result<String, String> {
    if path.trim().is_empty() {
        return Err("パスが空です。".to_string());
    }

    let path = path.replace('\\', "/");
    let relative = Path::new(&path);

    if relative.is_absolute() {
        return Err("絶対パスは指定できません。".to_string());
    }

    let mut parts = Vec::new();
    for component in relative.components() {
        match component {
            Component::Normal(part) => parts.push(part.to_string_lossy().to_string()),
            Component::CurDir => {}
            Component::ParentDir => {
                return Err("親ディレクトリへの参照は指定できません。".to_string());
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err("絶対パスは指定できません。".to_string());
            }
        }
    }

    Ok(parts.join("/"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_pages_markdown_path() {
        assert_eq!(
            validate_page_path("Pages/Main.md").unwrap(),
            "Pages/Main.md"
        );
    }

    #[test]
    fn rejects_path_traversal() {
        assert!(validate_page_path("Pages/../secret.md").is_err());
    }

    #[test]
    fn rejects_paths_outside_pages() {
        assert!(validate_page_path("Main.md").is_err());
    }

    #[test]
    fn accepts_files_path() {
        assert_eq!(
            validate_file_path("Files/images/logo.png").unwrap(),
            "Files/images/logo.png"
        );
    }

    #[test]
    fn rejects_file_path_traversal() {
        assert!(validate_file_path("Files/../secret.png").is_err());
    }

    #[test]
    fn rejects_files_directory_without_name() {
        assert!(validate_file_path("Files").is_err());
    }
}
