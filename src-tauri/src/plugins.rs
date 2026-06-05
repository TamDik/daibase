use crate::models::{
    InstalledPluginSummary, PluginContribution, PluginDocumentation, PluginInstallSource,
    PluginMainResolution, PluginManifest, PluginPermission, PluginRegistry, PluginViewKind,
    PluginViewSlot,
};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const PLUGINS_DIR_NAME: &str = "plugins";
const REGISTRY_FILE_NAME: &str = "registry.json";
const MANIFEST_FILE_NAME: &str = "manifest.json";
const DOCUMENTATION_ENTRY_PATH: &str = "README.md";

pub fn list_plugins(app: &AppHandle) -> Result<Vec<InstalledPluginSummary>, String> {
    let mut plugins = read_registry(app)?.plugins;
    for plugin in &mut plugins {
        match refresh_local_folder_plugin(plugin) {
            Ok(()) => plugin.load_error = None,
            Err(error) => plugin.load_error = Some(error),
        }
    }
    plugins.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(plugins)
}

pub fn install_plugin_from_folder(
    app: &AppHandle,
    source_path: PathBuf,
) -> Result<InstalledPluginSummary, String> {
    let manifest = read_manifest_from_folder(&source_path)?;
    validate_manifest(&manifest)?;
    let source_path = fs::canonicalize(source_path).map_err(to_error)?;

    let mut registry = read_registry(app)?;
    let enabled = registry
        .plugins
        .iter()
        .find(|plugin| plugin.id == manifest.id)
        .map(|plugin| plugin.enabled)
        .unwrap_or(false);
    let plugin = InstalledPluginSummary {
        id: manifest.id.clone(),
        name: manifest.name.clone(),
        version: manifest.version.clone(),
        description: manifest.description.clone(),
        enabled,
        load_error: None,
        source: PluginInstallSource::LocalFolder {
            path: source_path.to_string_lossy().to_string(),
        },
        manifest,
    };
    registry.plugins.retain(|current| current.id != plugin.id);
    registry.plugins.push(plugin.clone());
    registry
        .plugins
        .sort_by(|left, right| left.name.cmp(&right.name));
    write_registry(app, &registry)?;

    Ok(plugin)
}

pub fn set_plugin_enabled(
    app: &AppHandle,
    plugin_id: String,
    enabled: bool,
) -> Result<InstalledPluginSummary, String> {
    let mut registry = read_registry(app)?;
    let Some(plugin) = registry
        .plugins
        .iter_mut()
        .find(|plugin| plugin.id == plugin_id)
    else {
        return Err("プラグインが見つかりません。".to_string());
    };

    plugin.enabled = enabled;
    let updated = plugin.clone();
    write_registry(app, &registry)?;
    Ok(updated)
}

pub fn resolve_plugin_main(
    app: &AppHandle,
    plugin_id: String,
) -> Result<PluginMainResolution, String> {
    let registry = read_registry(app)?;
    let Some(plugin) = registry
        .plugins
        .iter()
        .find(|plugin| plugin.id == plugin_id)
    else {
        return Err("プラグインが見つかりません。".to_string());
    };

    if !plugin.enabled {
        return Err("プラグインが無効です。".to_string());
    }

    let manifest = current_plugin_manifest(plugin)?;
    validate_relative_main_path(&manifest.main)?;
    let main_path = plugin_source_dir(plugin)?.join(&manifest.main);
    if !main_path.is_file() {
        return Err("プラグインの main ファイルが見つかりません。".to_string());
    }

    let html = fs::read_to_string(&main_path)
        .map_err(|_| "プラグインの main ファイルを読み込めません。".to_string())?;

    Ok(PluginMainResolution {
        path: main_path,
        html,
    })
}

pub fn read_plugin_documentation(
    app: &AppHandle,
    plugin_id: String,
) -> Result<PluginDocumentation, String> {
    let registry = read_registry(app)?;
    let Some(plugin) = registry
        .plugins
        .iter()
        .find(|plugin| plugin.id == plugin_id)
    else {
        return Err("プラグインが見つかりません。".to_string());
    };

    read_plugin_documentation_from_dir(&plugin_id, &plugin_source_dir(plugin)?)
}

fn read_plugin_documentation_from_dir(
    plugin_id: &str,
    plugin_dir: &Path,
) -> Result<PluginDocumentation, String> {
    let docs_path = plugin_dir.join(DOCUMENTATION_ENTRY_PATH);
    if !docs_path.is_file() {
        return Err("プラグインの README.md が見つかりません。".to_string());
    }

    let markdown = fs::read_to_string(&docs_path)
        .map_err(|_| "プラグインの README.md を読み込めません。".to_string())?;

    Ok(PluginDocumentation {
        plugin_id: plugin_id.to_string(),
        path: docs_path,
        markdown,
    })
}

fn read_manifest_from_folder(source_path: &Path) -> Result<PluginManifest, String> {
    if !source_path.is_dir() {
        return Err("プラグインフォルダを選択してください。".to_string());
    }

    let manifest_path = source_path.join(MANIFEST_FILE_NAME);
    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|_| "manifest.json が見つからないか読み込めません。".to_string())?;
    serde_json::from_str(&manifest_content)
        .map_err(|error| format!("manifest.json の形式が正しくありません: {error}"))
}

fn refresh_local_folder_plugin(plugin: &mut InstalledPluginSummary) -> Result<(), String> {
    let manifest = current_plugin_manifest(plugin)?;
    plugin.id = manifest.id.clone();
    plugin.name = manifest.name.clone();
    plugin.version = manifest.version.clone();
    plugin.description = manifest.description.clone();
    plugin.manifest = manifest;
    Ok(())
}

fn current_plugin_manifest(plugin: &InstalledPluginSummary) -> Result<PluginManifest, String> {
    let manifest = read_manifest_from_folder(&plugin_source_dir(plugin)?)?;
    validate_manifest(&manifest)?;
    if manifest.id != plugin.id {
        return Err(format!("プラグイン ID が変更されています: {}", plugin.id));
    }
    Ok(manifest)
}

fn plugin_source_dir(plugin: &InstalledPluginSummary) -> Result<PathBuf, String> {
    match &plugin.source {
        PluginInstallSource::LocalFolder { path } => Ok(PathBuf::from(path)),
    }
}

fn validate_manifest(manifest: &PluginManifest) -> Result<(), String> {
    validate_plugin_id(&manifest.id)?;
    require_non_empty("name", &manifest.name)?;
    require_non_empty("version", &manifest.version)?;

    if manifest.schema_version != 1 {
        return Err("未対応の plugin manifest schema version です。".to_string());
    }

    if manifest.main.trim().is_empty() {
        return Err("manifest.json の main を指定してください。".to_string());
    }

    validate_relative_main_path(&manifest.main)?;

    if manifest.contributions.is_empty() {
        return Err("manifest.json の contributions を 1 つ以上指定してください。".to_string());
    }

    for contribution in &manifest.contributions {
        match contribution {
            PluginContribution::PageView {
                id,
                name,
                slot,
                view,
                ..
            } => {
                validate_plugin_id(id)?;
                require_non_empty("contribution name", name)?;
                validate_page_view_slot(slot)?;
                validate_page_view_kind(&view.kind)?;
            }
        }
    }

    for permission in &manifest.permissions {
        validate_permission(permission)?;
    }

    Ok(())
}

fn validate_plugin_id(id: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err("plugin id を指定してください。".to_string());
    }

    if id.len() > 128
        || !id
            .chars()
            .all(|char| char.is_ascii_alphanumeric() || matches!(char, '.' | '-' | '_'))
    {
        return Err(
            "plugin id には英数字、ドット、ハイフン、アンダースコアだけ使えます。".to_string(),
        );
    }

    Ok(())
}

fn require_non_empty(name: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("manifest.json の {name} を指定してください。"));
    }
    Ok(())
}

fn validate_relative_main_path(main: &str) -> Result<(), String> {
    let path = Path::new(main);
    if path.is_absolute() || main.contains('\\') {
        return Err("manifest.json の main は相対パスで指定してください。".to_string());
    }

    if path
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return Err("manifest.json の main に .. は使えません。".to_string());
    }

    Ok(())
}

fn validate_page_view_slot(slot: &PluginViewSlot) -> Result<(), String> {
    match slot {
        PluginViewSlot::Main
        | PluginViewSlot::SidebarSection
        | PluginViewSlot::RightPanel
        | PluginViewSlot::BottomPanel
        | PluginViewSlot::Toolbar
        | PluginViewSlot::StatusBar => Ok(()),
    }
}

fn validate_page_view_kind(kind: &PluginViewKind) -> Result<(), String> {
    match kind {
        PluginViewKind::Custom => Ok(()),
    }
}

fn validate_permission(permission: &PluginPermission) -> Result<(), String> {
    match permission {
        PluginPermission::PageRead
        | PluginPermission::PageWrite
        | PluginPermission::FileRead
        | PluginPermission::FileWrite
        | PluginPermission::NamespaceRead
        | PluginPermission::HistoryRead
        | PluginPermission::LocationOpen
        | PluginPermission::UiNotify => Ok(()),
    }
}

fn read_registry(app: &AppHandle) -> Result<PluginRegistry, String> {
    let path = registry_path(app)?;
    if !path.exists() {
        return Ok(PluginRegistry::default());
    }

    let content = fs::read_to_string(path).map_err(to_error)?;
    serde_json::from_str(&content).map_err(to_error)
}

fn write_registry(app: &AppHandle, registry: &PluginRegistry) -> Result<(), String> {
    let path = registry_path(app)?;
    write_json_atomic(&path, registry)
}

fn registry_path(app: &AppHandle) -> Result<PathBuf, String> {
    let plugin_dir = plugins_dir(app)?;
    fs::create_dir_all(&plugin_dir).map_err(to_error)?;
    Ok(plugin_dir.join(REGISTRY_FILE_NAME))
}

fn plugins_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(to_error)?
        .join(PLUGINS_DIR_NAME))
}

fn write_json_atomic<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let content = serde_json::to_string_pretty(value).map_err(to_error)?;
    let temporary_path = path.with_extension("json.tmp");
    fs::write(&temporary_path, content).map_err(to_error)?;
    fs::rename(&temporary_path, path).map_err(to_error)
}

fn to_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_page_view_manifest() {
        let manifest = valid_manifest();

        assert!(validate_manifest(&manifest).is_ok());
    }

    #[test]
    fn rejects_main_parent_path() {
        let mut manifest = valid_manifest();
        manifest.main = "../dist/index.html".to_string();

        assert_eq!(
            validate_manifest(&manifest).unwrap_err(),
            "manifest.json の main に .. は使えません。"
        );
    }

    #[test]
    fn rejects_invalid_plugin_id() {
        let mut manifest = valid_manifest();
        manifest.id = "calendar plugin".to_string();

        assert_eq!(
            validate_manifest(&manifest).unwrap_err(),
            "plugin id には英数字、ドット、ハイフン、アンダースコアだけ使えます。"
        );
    }

    #[test]
    fn reads_plugin_documentation_from_readme() {
        let plugin_dir = test_plugin_dir("reads_plugin_documentation_from_readme");
        fs::create_dir_all(&plugin_dir).unwrap();
        fs::write(plugin_dir.join("README.md"), "# Calendar\n\nPlugin docs").unwrap();

        let documentation =
            read_plugin_documentation_from_dir("com.example.calendar", &plugin_dir).unwrap();

        assert_eq!(documentation.plugin_id, "com.example.calendar");
        assert_eq!(documentation.markdown, "# Calendar\n\nPlugin docs");
        assert_eq!(documentation.path, plugin_dir.join("README.md"));

        fs::remove_dir_all(plugin_dir).unwrap();
    }

    #[test]
    fn rejects_missing_plugin_documentation() {
        let plugin_dir = test_plugin_dir("rejects_missing_plugin_documentation");
        fs::create_dir_all(&plugin_dir).unwrap();

        assert_eq!(
            read_plugin_documentation_from_dir("com.example.calendar", &plugin_dir).unwrap_err(),
            "プラグインの README.md が見つかりません。"
        );

        fs::remove_dir_all(plugin_dir).unwrap();
    }

    #[test]
    fn refreshes_local_folder_manifest_from_source() {
        let plugin_dir = test_plugin_dir("refreshes_local_folder_manifest_from_source");
        fs::create_dir_all(&plugin_dir).unwrap();
        let mut manifest = valid_manifest();
        manifest.version = "0.2.0".to_string();
        manifest.description = "Updated calendar view".to_string();
        write_manifest(&plugin_dir, &manifest);

        let mut plugin = InstalledPluginSummary {
            id: "com.example.calendar".to_string(),
            name: "Calendar".to_string(),
            version: "0.1.0".to_string(),
            description: "Calendar view".to_string(),
            enabled: true,
            load_error: None,
            source: PluginInstallSource::LocalFolder {
                path: plugin_dir.to_string_lossy().to_string(),
            },
            manifest: valid_manifest(),
        };

        refresh_local_folder_plugin(&mut plugin).unwrap();

        assert!(plugin.enabled);
        assert_eq!(plugin.version, "0.2.0");
        assert_eq!(plugin.description, "Updated calendar view");
        assert_eq!(plugin.manifest.version, "0.2.0");

        fs::remove_dir_all(plugin_dir).unwrap();
    }

    #[test]
    fn marks_broken_plugin_without_dropping_summary() {
        let mut plugin = InstalledPluginSummary {
            id: "com.example.calendar".to_string(),
            name: "Calendar".to_string(),
            version: "0.1.0".to_string(),
            description: "Calendar view".to_string(),
            enabled: true,
            load_error: None,
            source: PluginInstallSource::LocalFolder {
                path: test_plugin_dir("missing_plugin")
                    .to_string_lossy()
                    .to_string(),
            },
            manifest: valid_manifest(),
        };

        let error = refresh_local_folder_plugin(&mut plugin).unwrap_err();
        plugin.load_error = Some(error);

        assert!(plugin.enabled);
        assert_eq!(plugin.name, "Calendar");
        assert!(plugin
            .load_error
            .as_deref()
            .unwrap()
            .contains("プラグインフォルダを選択してください。"));
    }

    fn write_manifest(plugin_dir: &Path, manifest: &PluginManifest) {
        fs::write(
            plugin_dir.join("manifest.json"),
            serde_json::to_string_pretty(manifest).unwrap(),
        )
        .unwrap();
    }

    fn test_plugin_dir(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("daibase-plugin-test-{name}-{}", std::process::id()))
    }

    fn valid_manifest() -> PluginManifest {
        PluginManifest {
            schema_version: 1,
            id: "com.example.calendar".to_string(),
            name: "Calendar".to_string(),
            version: "0.1.0".to_string(),
            description: "Calendar view".to_string(),
            main: "dist/index.html".to_string(),
            contributions: vec![PluginContribution::PageView {
                id: "calendar".to_string(),
                name: "Calendar".to_string(),
                slot: PluginViewSlot::Main,
                r#match: crate::models::PluginContributionMatch {
                    frontmatter: serde_json::json!({
                        "daibase.view": "calendar"
                    }),
                },
                view: crate::models::PluginViewContribution {
                    kind: PluginViewKind::Custom,
                },
                activation: crate::models::PluginActivation { auto_open: true },
            }],
            permissions: vec![PluginPermission::PageRead, PluginPermission::LocationOpen],
        }
    }
}
