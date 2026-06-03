use crate::models::{
    FavoriteIndex, FileHistoryEntry, FileHistoryIndex, PathIndex, Revision, RevisionChange,
    SaveResult,
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
    fs::create_dir_all(root.join(".daibase/file_notes")).map_err(to_error)?;
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

pub fn read_favorite_index(root: &Path) -> Result<FavoriteIndex, String> {
    let path = root.join(".daibase/versions/favorites.json");
    if !path.exists() {
        return Ok(FavoriteIndex::default());
    }

    let content = fs::read_to_string(path).map_err(to_error)?;
    serde_json::from_str(&content).map_err(to_error)
}

pub fn write_favorite_index(root: &Path, index: &FavoriteIndex) -> Result<(), String> {
    write_json_atomic(&root.join(".daibase/versions/favorites.json"), index)
}

pub fn is_favorite_path(root: &Path, path: &str) -> Result<bool, String> {
    Ok(read_favorite_index(root)?
        .paths
        .iter()
        .any(|favorite_path| favorite_path == path))
}

pub fn set_favorite_path(root: &Path, path: &str, is_favorite: bool) -> Result<(), String> {
    ensure_version_dirs(root)?;
    let mut index = read_favorite_index(root)?;
    if is_favorite {
        if !index
            .paths
            .iter()
            .any(|favorite_path| favorite_path == path)
        {
            index.paths.push(path.to_string());
        }
    } else {
        index.paths.retain(|favorite_path| favorite_path != path);
    }
    index.paths.sort();
    index.paths.dedup();
    write_favorite_index(root, &index)
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
    record_file_revision_with_content_type(
        root,
        namespace_id,
        path,
        content,
        "text/markdown",
        message,
    )
}

pub fn record_file_revision_with_content_type(
    root: &Path,
    namespace_id: &str,
    path: &str,
    content: &[u8],
    content_type: &str,
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
            content_type: content_type.to_string(),
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

pub fn record_file_deletion(
    root: &Path,
    namespace_id: &str,
    path: &str,
    content_type: &str,
    message: &str,
) -> Result<SaveResult, String> {
    ensure_version_dirs(root)?;

    let path_index = read_path_index(root)?;
    let file_id = path_index
        .entries
        .get(path)
        .cloned()
        .ok_or_else(|| "削除対象の履歴 ID が見つかりません。".to_string())?;
    let previous_revision_id = latest_revision_id(root, &file_id)?
        .ok_or_else(|| "削除対象の履歴が見つかりません。".to_string())?;
    let history = read_file_history(root, &file_id)?
        .ok_or_else(|| "削除対象の履歴が見つかりません。".to_string())?;
    let previous_entry = history
        .revisions
        .iter()
        .find(|entry| entry.revision_id == previous_revision_id)
        .ok_or_else(|| "削除対象の最新 revision が見つかりません。".to_string())?;

    let now = Utc::now();
    let created_at = now.to_rfc3339();
    let revision_id = format!("rev_{}", Ulid::new());
    let device_id = ensure_device_id(root)?;

    let revision = Revision {
        schema_version: 1,
        revision_id: revision_id.clone(),
        created_at: created_at.clone(),
        device_id,
        parent_revision_ids: vec![previous_revision_id],
        message: message.to_string(),
        changes: vec![RevisionChange {
            file_id: file_id.clone(),
            path: path.to_string(),
            kind: "deleted".to_string(),
            content_type: content_type.to_string(),
            object_id: previous_entry.object_id.clone(),
            size: 0,
        }],
    };

    write_revision(root, &revision, &now)?;
    update_file_history_with_kind(
        root,
        &file_id,
        path,
        &revision_id,
        &previous_entry.object_id,
        &created_at,
        "deleted",
    )?;
    Ok(SaveResult {
        namespace_id: namespace_id.to_string(),
        file_id,
        path: path.to_string(),
        revision_id,
        object_id: previous_entry.object_id.clone(),
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

pub fn read_text_object(root: &Path, object_id: &str) -> Result<String, String> {
    String::from_utf8(read_object(root, object_id)?).map_err(to_error)
}

pub fn read_object(root: &Path, object_id: &str) -> Result<Vec<u8>, String> {
    let hex = object_id
        .strip_prefix("sha256:")
        .ok_or_else(|| "未対応の object ID です。".to_string())?;
    if hex.len() != 64 || !hex.chars().all(|character| character.is_ascii_hexdigit()) {
        return Err("object ID が不正です。".to_string());
    }

    let object_path = root
        .join(".daibase/versions/objects")
        .join(&hex[0..2])
        .join(hex);
    fs::read(object_path).map_err(to_error)
}

fn update_file_history(
    root: &Path,
    file_id: &str,
    path: &str,
    revision_id: &str,
    object_id: &str,
    created_at: &str,
) -> Result<(), String> {
    update_file_history_with_kind(
        root,
        file_id,
        path,
        revision_id,
        object_id,
        created_at,
        "modified",
    )
}

fn update_file_history_with_kind(
    root: &Path,
    file_id: &str,
    path: &str,
    revision_id: &str,
    object_id: &str,
    created_at: &str,
    kind: &str,
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
        kind: kind.to_string(),
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

        let first = record_file_revision(&root, "namespace", "Main.md", b"# Main", "Save").unwrap();
        let second =
            record_file_revision(&root, "namespace", "Main.md", b"# Main", "Save").unwrap();

        assert_eq!(first.file_id, second.file_id);
        assert_eq!(first.object_id, second.object_id);
        assert_ne!(first.revision_id, second.revision_id);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reading_text_object_rejects_invalid_object_id() {
        let root = std::env::temp_dir().join(format!("daibase-test-{}", Ulid::new()));
        fs::create_dir_all(&root).unwrap();

        assert!(read_text_object(&root, "sha256:../secret").is_err());
        assert!(read_text_object(&root, "md5:abc").is_err());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn deleting_file_records_deleted_revision_and_keeps_path_index_entry() {
        let root = std::env::temp_dir().join(format!("daibase-test-{}", Ulid::new()));
        fs::create_dir_all(&root).unwrap();

        let saved = record_file_revision(&root, "namespace", "Main.md", b"# Main", "Save").unwrap();
        let deleted =
            record_file_deletion(&root, "namespace", "Main.md", "text/markdown", "Delete").unwrap();

        assert_eq!(saved.file_id, deleted.file_id);
        assert_eq!(
            file_id_for_path(&root, "Main.md").unwrap().as_deref(),
            Some(saved.file_id.as_str())
        );
        let history = read_file_history(&root, &saved.file_id).unwrap().unwrap();
        assert_eq!(history.revisions.last().unwrap().kind, "deleted");
        assert_eq!(history.revisions.last().unwrap().object_id, saved.object_id);

        fs::remove_dir_all(root).unwrap();
    }
}
