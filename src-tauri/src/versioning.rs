use crate::models::{
    FileHistoryEntry, FileHistoryIndex, PathIndex, Revision, RevisionChange, SaveResult,
};
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;
use ulid::Ulid;

const DEVICE_ID_FILE: &str = ".daibase/device_id";

pub fn ensure_version_dirs(root: &Path) -> Result<(), String> {
    fs::create_dir_all(root.join(".daibase/versions/objects")).map_err(to_error)?;
    fs::create_dir_all(root.join(".daibase/versions/revisions")).map_err(to_error)?;
    fs::create_dir_all(root.join(".daibase/versions/files")).map_err(to_error)?;
    fs::create_dir_all(root.join(".daibase/locks")).map_err(to_error)?;
    Ok(())
}

pub fn read_path_index(root: &Path) -> Result<PathIndex, String> {
    let path = root.join(".daibase/versions/path_index.json");
    if !path.exists() {
        return Ok(PathIndex::default());
    }

    let content = fs::read_to_string(path).map_err(to_error)?;
    serde_json::from_str(&content).map_err(to_error)
}

pub fn write_path_index(root: &Path, index: &PathIndex) -> Result<(), String> {
    write_json_atomic(&root.join(".daibase/versions/path_index.json"), index)
}

pub fn file_id_for_path(root: &Path, path: &str) -> Result<Option<String>, String> {
    Ok(read_path_index(root)?.entries.get(path).cloned())
}

pub fn record_file_revision(
    root: &Path,
    namespace_id: &str,
    path: &str,
    content: &[u8],
    message: &str,
) -> Result<SaveResult, String> {
    ensure_version_dirs(root)?;

    let now = Utc::now();
    let created_at = now.to_rfc3339();
    let mut path_index = read_path_index(root)?;
    let file_id = path_index
        .entries
        .get(path)
        .cloned()
        .unwrap_or_else(|| format!("file_{}", Ulid::new()));
    let object_id = write_object(root, content)?;
    let revision_id = format!("rev_{}", Ulid::new());
    let parent_revision_ids = latest_revision_id(root, &file_id)?.into_iter().collect();
    let device_id = ensure_device_id(root)?;
    let size = u64::try_from(content.len()).map_err(|error| error.to_string())?;

    let revision = Revision {
        schema_version: 1,
        revision_id: revision_id.clone(),
        created_at: created_at.clone(),
        device_id,
        parent_revision_ids,
        message: message.to_string(),
        changes: vec![RevisionChange {
            file_id: file_id.clone(),
            path: path.to_string(),
            kind: "modified".to_string(),
            content_type: "text/markdown".to_string(),
            object_id: object_id.clone(),
            size,
        }],
    };

    write_revision(root, &revision, &now)?;
    update_file_history(root, &file_id, path, &revision_id, &object_id, &created_at)?;
    path_index.entries.insert(path.to_string(), file_id.clone());
    write_path_index(root, &path_index)?;

    Ok(SaveResult {
        namespace_id: namespace_id.to_string(),
        file_id,
        path: path.to_string(),
        revision_id,
        object_id,
        saved_at: created_at,
    })
}

pub fn latest_revision_id(root: &Path, file_id: &str) -> Result<Option<String>, String> {
    let Some(history) = read_file_history(root, file_id)? else {
        return Ok(None);
    };

    Ok(history
        .revisions
        .last()
        .map(|revision| revision.revision_id.clone()))
}

pub fn read_file_history(root: &Path, file_id: &str) -> Result<Option<FileHistoryIndex>, String> {
    let path = root
        .join(".daibase/versions/files")
        .join(format!("{file_id}.json"));
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(path).map_err(to_error)?;
    serde_json::from_str(&content).map(Some).map_err(to_error)
}

fn update_file_history(
    root: &Path,
    file_id: &str,
    path: &str,
    revision_id: &str,
    object_id: &str,
    created_at: &str,
) -> Result<(), String> {
    let mut history = read_file_history(root, file_id)?.unwrap_or(FileHistoryIndex {
        schema_version: 1,
        file_id: file_id.to_string(),
        current_path: path.to_string(),
        revisions: Vec::new(),
    });

    history.current_path = path.to_string();
    history.revisions.push(FileHistoryEntry {
        revision_id: revision_id.to_string(),
        object_id: object_id.to_string(),
        created_at: created_at.to_string(),
        kind: "modified".to_string(),
        path: path.to_string(),
    });

    write_json_atomic(
        &root
            .join(".daibase/versions/files")
            .join(format!("{file_id}.json")),
        &history,
    )
}

fn write_revision(
    root: &Path,
    revision: &Revision,
    now: &chrono::DateTime<Utc>,
) -> Result<(), String> {
    let revision_dir = root
        .join(".daibase/versions/revisions")
        .join(now.format("%Y").to_string())
        .join(now.format("%m").to_string())
        .join(now.format("%d").to_string());
    fs::create_dir_all(&revision_dir).map_err(to_error)?;
    write_json_atomic(
        &revision_dir.join(format!("{}.json", revision.revision_id)),
        revision,
    )
}

fn write_object(root: &Path, content: &[u8]) -> Result<String, String> {
    let digest = Sha256::digest(content);
    let hex = digest
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let prefix = &hex[0..2];
    let object_dir = root.join(".daibase/versions/objects").join(prefix);
    fs::create_dir_all(&object_dir).map_err(to_error)?;
    let object_path = object_dir.join(&hex);

    if !object_path.exists() {
        fs::write(&object_path, content).map_err(to_error)?;
    }

    Ok(format!("sha256:{hex}"))
}

fn ensure_device_id(root: &Path) -> Result<String, String> {
    let path = root.join(DEVICE_ID_FILE);
    if path.exists() {
        return fs::read_to_string(path)
            .map(|value| value.trim().to_string())
            .map_err(to_error);
    }

    let device_id = format!("device_{}", Ulid::new());
    fs::write(path, &device_id).map_err(to_error)?;
    Ok(device_id)
}

fn write_json_atomic<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let Some(parent) = path.parent() else {
        return Err("保存先の親ディレクトリが見つかりません。".to_string());
    };
    fs::create_dir_all(parent).map_err(to_error)?;

    let temporary_path = path.with_extension("json.tmp");
    let content = serde_json::to_string_pretty(value).map_err(to_error)?;
    fs::write(&temporary_path, content).map_err(to_error)?;
    fs::rename(temporary_path, path).map_err(to_error)
}

fn to_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn saving_same_content_creates_multiple_revisions() {
        let root = std::env::temp_dir().join(format!("daibase-test-{}", Ulid::new()));
        fs::create_dir_all(&root).unwrap();

        let first =
            record_file_revision(&root, "namespace", "Pages/Main.md", b"# Main", "Save").unwrap();
        let second =
            record_file_revision(&root, "namespace", "Pages/Main.md", b"# Main", "Save").unwrap();

        assert_eq!(first.file_id, second.file_id);
        assert_eq!(first.object_id, second.object_id);
        assert_ne!(first.revision_id, second.revision_id);

        fs::remove_dir_all(root).unwrap();
    }
}
