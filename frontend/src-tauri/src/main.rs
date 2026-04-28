use std::{
    fs,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
};

use tauri::{Manager, RunEvent};

struct BackendProcess(Mutex<Option<Child>>);

fn repo_root() -> Option<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir.parent()?.parent().map(PathBuf::from)
}

fn target_triple() -> Option<&'static str> {
    match (std::env::consts::ARCH, std::env::consts::OS) {
        ("aarch64", "macos") => Some("aarch64-apple-darwin"),
        ("x86_64", "macos") => Some("x86_64-apple-darwin"),
        _ => None,
    }
}

fn bundled_backend(app: &tauri::App) -> Option<PathBuf> {
    let triple = target_triple()?;
    let resource_dir = app.path().resource_dir().ok()?;
    let candidate = resource_dir
        .join("binaries")
        .join(format!("syswatch-backend-{triple}"));

    candidate.exists().then_some(candidate)
}

fn spawn_backend(app: &tauri::App) -> Result<Child, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Could not resolve app data directory: {err}"))?;
    fs::create_dir_all(&data_dir)
        .map_err(|err| format!("Could not create app data directory: {err}"))?;

    let mut command = if let Some(backend) = bundled_backend(app) {
        Command::new(backend)
    } else {
        let root = repo_root().ok_or_else(|| "Could not resolve repository root".to_string())?;
        let server = root.join("server.py");
        if !server.exists() {
            return Err(format!("Backend script not found at {}", server.display()));
        }

        let mut command = Command::new("uv");
        command.args(["run", "server.py"]).current_dir(root);
        command
    };

    command
        .env("SYSWATCH_HOST", "127.0.0.1")
        .env("SYSWATCH_PORT", "8080")
        .env("SYSWATCH_DATA_DIR", data_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|err| format!("Could not start backend: {err}"))
}

fn stop_backend(app_handle: &tauri::AppHandle) {
    let Some(state) = app_handle.try_state::<BackendProcess>() else {
        return;
    };

    let Ok(mut child) = state.0.lock() else {
        return;
    };

    if let Some(mut process) = child.take() {
        let _ = process.kill();
        let _ = process.wait();
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let backend = match spawn_backend(app) {
                Ok(child) => Some(child),
                Err(err) => {
                    eprintln!("{err}");
                    None
                }
            };
            app.manage(BackendProcess(Mutex::new(backend)));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                stop_backend(app_handle);
            }
        });
}
