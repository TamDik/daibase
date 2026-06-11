use std::{env, fs, path::PathBuf};

fn main() {
    generate_help_documents();
    tauri_build::build();
}

fn generate_help_documents() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("manifest dir"));
    let docs_dir = manifest_dir.join("../docs");
    println!("cargo:rerun-if-changed={}", docs_dir.display());

    let mut documents = fs::read_dir(&docs_dir)
        .expect("docs directory")
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|extension| extension == "md"))
        .collect::<Vec<_>>();
    documents.sort();

    let entries = documents
        .into_iter()
        .map(|path| {
            let name = path
                .file_name()
                .expect("document file name")
                .to_string_lossy();
            let content = fs::read_to_string(&path).expect("help document");
            format!("({name:?}, {content:?})")
        })
        .collect::<Vec<_>>()
        .join(",\n");
    let generated = format!("pub const HELP_DOCUMENTS: &[(&str, &str)] = &[\n{entries}\n];\n");
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("out dir"));
    fs::write(out_dir.join("help_documents.rs"), generated).expect("generated help documents");
}
