use log::{error, info, warn};
use tauri::{Emitter, Manager};

#[cfg(desktop)]
use std::collections::HashSet;
#[cfg(desktop)]
use std::path::{Path, PathBuf};
#[cfg(desktop)]
use std::process::Command;
#[cfg(desktop)]
use std::sync::Mutex;
#[cfg(desktop)]
use std::thread::sleep;
#[cfg(desktop)]
use std::time::{Duration, SystemTime, UNIX_EPOCH};
#[cfg(desktop)]
use tauri::{
    image::Image,
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
};
#[cfg(desktop)]
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
#[cfg(desktop)]
use tauri_plugin_opener::OpenerExt;

// ── State ──

const STABLE_DESKTOP_IDENTIFIER: &str = "com.radarboard.client";
#[cfg(desktop)]
const SIDECAR_METADATA_FILE: &str = ".sidecar-runtime.json";
#[cfg(desktop)]
const SIDECAR_NODE_RUNTIME_ARGS: &[&str] = &["--jitless"];

#[cfg(desktop)]
struct ServerState {
    child: Option<std::process::Child>,
    child_pid: Option<u32>,
    metadata_path: Option<PathBuf>,
}

#[cfg(desktop)]
#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
struct SidecarRuntimeMetadata {
    pid: u32,
    started_at: u64,
    binary_path: String,
    url: Option<String>,
}

#[cfg(desktop)]
#[derive(Debug, Clone, PartialEq, Eq)]
struct ProcessInfo {
    pid: u32,
    ppid: u32,
    command: String,
}

/// Represents a recent notification event sent from the frontend to populate the tray submenu.
#[cfg(desktop)]
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TrayEventItem {
    delivery_id: String,
    title: String,
    severity: String,
    source: String,
}

// ── Tray Icon Helpers ──

#[cfg(desktop)]
fn tray_image_from_png(bytes: &'static [u8]) -> Image<'static> {
    let img = image::load_from_memory(bytes).expect("tray icon PNG");
    let rgba = img.into_rgba8();
    let (w, h) = rgba.dimensions();
    Image::new_owned(rgba.into_raw(), w, h)
}

/// Set the tray icon and re-apply the template flag.
/// macOS resets `icon_as_template` on every `set_icon()` call, so we must
/// always re-apply it to keep the icon rendering as a proper template image.
#[cfg(desktop)]
fn set_tray_icon_template(tray: &tauri::tray::TrayIcon, icon: Image<'static>) {
    let _ = tray.set_icon(Some(icon));
    let _ = tray.set_icon_as_template(true);
}

#[cfg(desktop)]
fn desktop_app_name<M: Manager<R>, R: tauri::Runtime>(manager: &M) -> String {
    manager
        .config()
        .product_name
        .clone()
        .unwrap_or_else(|| "Radarboard".to_string())
}

#[cfg(desktop)]
fn is_stable_desktop_channel<M: Manager<R>, R: tauri::Runtime>(manager: &M) -> bool {
    manager.config().identifier == STABLE_DESKTOP_IDENTIFIER
}

// ── Tauri Commands ──

/// Set the tray icon state and tooltip based on notification status.
#[cfg(desktop)]
#[tauri::command]
fn set_tray_state(app: tauri::AppHandle, state: String, unread_count: u32, status_text: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let app_name = desktop_app_name(&app);
        // Swap icon based on state
        let icon = match state.as_str() {
            "badge" => tray_image_from_png(include_bytes!("../tray-icons/tray-badge.png")),
            "critical" => tray_image_from_png(include_bytes!("../tray-icons/tray-critical.png")),
            "paused" => tray_image_from_png(include_bytes!("../tray-icons/tray-paused.png")),
            _ => tray_image_from_png(include_bytes!("../tray-icons/tray-normal.png")),
        };
        set_tray_icon_template(&tray, icon);

        // Show unread count next to the tray icon (macOS renders this as text beside the icon)
        let title = if unread_count > 0 {
            Some(format!("{}", unread_count))
        } else {
            None
        };
        let _ = tray.set_title(title.as_deref());

        // Update tooltip
        let tooltip = if unread_count > 0 {
            format!(
                "{} — {} unread notification{}",
                app_name,
                unread_count,
                if unread_count == 1 { "" } else { "s" }
            )
        } else {
            app_name
        };
        let _ = tray.set_tooltip(Some(&tooltip));

        // Update the status menu item text
        if let Some(item) = app.menu().and_then(|_| None::<()>) {
            // Status item is updated via rebuild_tray_menu — tooltip is the quick path
            let _ = item;
        }

        info!(
            "Tray state: {} (unread={}, status={})",
            state, unread_count, status_text
        );
    }
}

/// Update the tray icon tooltip with health status (called by useTauriHealthSync).
#[cfg(desktop)]
#[tauri::command]
fn update_health_status(app: tauri::AppHandle, is_healthy: bool, message: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let app_name = desktop_app_name(&app);
        let tooltip = if is_healthy {
            format!("{app_name} — {message}")
        } else {
            format!("{app_name} — CRITICAL: {message}")
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

/// Rebuild the tray menu with the latest notifications from the frontend.
#[cfg(desktop)]
#[tauri::command]
fn update_tray_recent_events(app: tauri::AppHandle, events: Vec<TrayEventItem>) {
    // Store events so they're available for menu rebuilds
    if let Some(state) = app.try_state::<Mutex<Vec<TrayEventItem>>>() {
        if let Ok(mut stored) = state.lock() {
            *stored = events;
        }
    }
    // Rebuild the tray menu with updated recent events
    if let Some(tray) = app.tray_by_id("main") {
        match build_tray_menu(&app) {
            Ok(menu) => {
                let _ = tray.set_menu(Some(menu));
            }
            Err(e) => error!("Failed to rebuild tray menu: {e}"),
        }
    }
}

/// Pause notifications for a given duration (in minutes). Emits event to frontend.
#[cfg(desktop)]
#[tauri::command]
fn pause_notifications(app: tauri::AppHandle, duration_minutes: u32) {
    info!("Pausing notifications for {} minutes", duration_minutes);
    // Switch to paused icon
    if let Some(tray) = app.tray_by_id("main") {
        let app_name = desktop_app_name(&app);
        let icon = tray_image_from_png(include_bytes!("../tray-icons/tray-paused.png"));
        set_tray_icon_template(&tray, icon);
        let _ = tray.set_tooltip(Some(format!(
            "{} — Notifications paused ({}m)",
            app_name, duration_minutes
        )));
    }
    let _ = app.emit("pause-notifications", duration_minutes);
}

/// Mark all notifications as read. Emits event to frontend.
#[cfg(desktop)]
#[tauri::command]
fn mark_all_read(app: tauri::AppHandle) {
    info!("Marking all notifications as read");
    // Reset to normal icon
    if let Some(tray) = app.tray_by_id("main") {
        let icon = tray_image_from_png(include_bytes!("../tray-icons/tray-normal.png"));
        set_tray_icon_template(&tray, icon);
        let _ = tray.set_tooltip(Some(desktop_app_name(&app)));
    }
    let _ = app.emit("mark-all-read", ());
}

/// Trigger the auto-updater check.
#[cfg(desktop)]
#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_updater::UpdaterExt;
    if !is_stable_desktop_channel(&app) {
        return Err("Updater is disabled for this desktop channel".to_string());
    }
    info!("Checking for updates...");
    let updater = app
        .updater()
        .map_err(|e| format!("Updater not available: {e}"))?;
    match updater.check().await {
        Ok(Some(update)) => {
            let version = update.version.clone();
            info!("Update available: {}", version);
            Ok(format!("Update available: {}", version))
        }
        Ok(None) => {
            info!("Already up to date");
            Ok("Already up to date".to_string())
        }
        Err(e) => {
            warn!("Update check failed: {e}");
            Err(format!("Update check failed: {e}"))
        }
    }
}

/// Open the log file directory in the system file manager.
#[cfg(desktop)]
#[tauri::command]
fn open_log_file(app: tauri::AppHandle) {
    if let Ok(log_dir) = app.path().app_log_dir() {
        info!("Opening log dir: {}", log_dir.display());
        let _ = app
            .opener()
            .open_path(log_dir.to_string_lossy(), None::<&str>);
    }
}

/// Open an external URL in the system default browser.
#[cfg(desktop)]
#[tauri::command]
fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| format!("Failed to open external URL: {e}"))
}

#[cfg(desktop)]
#[tauri::command]
fn save_text_file(path: String, content: String) -> Result<(), String> {
    let file_path = PathBuf::from(path);
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {e}"))?;
    }

    std::fs::write(&file_path, content).map_err(|e| format!("Failed to write file: {e}"))
}

/// Reset all app data.
#[cfg(desktop)]
#[tauri::command]
fn reset_app_data(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;

    if data_dir.exists() {
        std::fs::remove_dir_all(&data_dir)
            .map_err(|e| format!("Failed to remove data dir: {e}"))?;
        std::fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to recreate data dir: {e}"))?;
    }

    info!("App data reset at {}", data_dir.display());
    Ok("App data reset. Restart the app to start fresh.".to_string())
}

// ── Sidecar / Server ──

#[cfg(desktop)]
fn sidecar_metadata_path(data_dir: &Path) -> PathBuf {
    data_dir.join(SIDECAR_METADATA_FILE)
}

#[cfg(desktop)]
fn current_unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(desktop)]
fn persist_sidecar_metadata(path: &Path, metadata: &SidecarRuntimeMetadata) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create sidecar metadata dir: {e}"))?;
    }

    let payload = serde_json::to_vec_pretty(metadata)
        .map_err(|e| format!("Failed to serialize sidecar metadata: {e}"))?;
    std::fs::write(path, payload).map_err(|e| format!("Failed to write sidecar metadata: {e}"))
}

#[cfg(desktop)]
fn read_sidecar_metadata(path: &Path) -> Result<Option<SidecarRuntimeMetadata>, String> {
    match std::fs::read(path) {
        Ok(payload) => serde_json::from_slice(&payload)
            .map(Some)
            .map_err(|e| format!("Failed to parse sidecar metadata: {e}")),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(format!("Failed to read sidecar metadata: {err}")),
    }
}

#[cfg(desktop)]
fn remove_sidecar_metadata(path: &Path) -> Result<(), String> {
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(format!("Failed to remove sidecar metadata: {err}")),
    }
}

#[cfg(desktop)]
fn parse_ps_line(line: &str) -> Option<ProcessInfo> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    let pid_end = trimmed.find(char::is_whitespace)?;
    let pid = trimmed[..pid_end].parse().ok()?;
    let remainder = trimmed[pid_end..].trim_start();

    let ppid_end = remainder.find(char::is_whitespace)?;
    let ppid = remainder[..ppid_end].parse().ok()?;
    let command = remainder[ppid_end..].trim_start();
    if command.is_empty() {
        return None;
    }

    Some(ProcessInfo {
        pid,
        ppid,
        command: command.to_string(),
    })
}

#[cfg(desktop)]
fn parse_ps_output(output: &str) -> Vec<ProcessInfo> {
    output.lines().filter_map(parse_ps_line).collect()
}

#[cfg(desktop)]
fn command_basename(command: &str) -> Option<&str> {
    let executable = command.split_whitespace().next()?;
    Path::new(executable).file_name()?.to_str()
}

#[cfg(desktop)]
fn is_radarboard_desktop_command(command: &str) -> bool {
    matches!(command_basename(command), Some("radarboard-desktop"))
}

#[cfg(desktop)]
fn is_radarboard_server_command(command: &str) -> bool {
    command_basename(command)
        .is_some_and(|name| name == "radarboard-helper" || name.starts_with("radarboard-helper-"))
}

#[cfg(desktop)]
fn classify_stale_sidecar_pids(processes: &[ProcessInfo]) -> Vec<u32> {
    let desktop_pids: HashSet<u32> = processes
        .iter()
        .filter(|process| is_radarboard_desktop_command(&process.command))
        .map(|process| process.pid)
        .collect();

    processes
        .iter()
        .filter(|process| {
            is_radarboard_server_command(&process.command) && !desktop_pids.contains(&process.ppid)
        })
        .map(|process| process.pid)
        .collect()
}

#[cfg(desktop)]
fn list_processes() -> Result<Vec<ProcessInfo>, String> {
    let output = Command::new("/bin/ps")
        .args(["-axo", "pid=,ppid=,command="])
        .output()
        .map_err(|e| format!("Failed to inspect processes with ps: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "ps exited with status {}",
            output
                .status
                .code()
                .map_or_else(|| "unknown".to_string(), |code| code.to_string())
        ));
    }

    let stdout = String::from_utf8(output.stdout)
        .map_err(|e| format!("ps output was not valid UTF-8: {e}"))?;
    Ok(parse_ps_output(&stdout))
}

#[cfg(desktop)]
fn process_exists(pid: u32) -> Result<bool, String> {
    Ok(list_processes()?.iter().any(|process| process.pid == pid))
}

#[cfg(desktop)]
fn signal_process(pid: u32, signal: &str) -> Result<(), String> {
    let status = Command::new("/bin/kill")
        .args([signal, &pid.to_string()])
        .status()
        .map_err(|e| format!("Failed to send {signal} to sidecar {pid}: {e}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "kill {signal} failed for sidecar {pid} with status {}",
            status
                .code()
                .map_or_else(|| "unknown".to_string(), |code| code.to_string())
        ))
    }
}

#[cfg(desktop)]
fn terminate_stale_process(pid: u32) -> Result<(), String> {
    if !process_exists(pid)? {
        return Ok(());
    }

    signal_process(pid, "-TERM")?;

    for _ in 0..10 {
        if !process_exists(pid)? {
            return Ok(());
        }
        sleep(Duration::from_millis(100));
    }

    if process_exists(pid)? {
        signal_process(pid, "-KILL")?;
    }

    for _ in 0..10 {
        if !process_exists(pid)? {
            return Ok(());
        }
        sleep(Duration::from_millis(100));
    }

    Err(format!("Timed out waiting for stale sidecar {pid} to exit"))
}

#[cfg(desktop)]
fn reap_stale_sidecars(metadata_path: &Path) -> Result<(), String> {
    let metadata = read_sidecar_metadata(metadata_path)?;
    let processes = list_processes()?;
    let stale_pids = classify_stale_sidecar_pids(&processes);

    for pid in &stale_pids {
        info!("Reaping stale sidecar process {}", pid);
        terminate_stale_process(*pid)?;
    }

    let should_remove_metadata = match metadata {
        Some(metadata) => stale_pids.contains(&metadata.pid) || !process_exists(metadata.pid)?,
        None => !stale_pids.is_empty(),
    };

    if should_remove_metadata {
        remove_sidecar_metadata(metadata_path)?;
    }

    Ok(())
}

#[cfg(desktop)]
fn shutdown_sidecar(state: &mut ServerState) {
    let metadata_path = state.metadata_path.take();
    state.child_pid = None;

    if let Some(mut child) = state.child.take() {
        if let Err(err) = child.kill() {
            warn!("Failed to signal sidecar shutdown: {err}");
        }
        if let Err(err) = child.wait() {
            warn!("Failed to wait for sidecar shutdown: {err}");
        }
    }

    if let Some(path) = metadata_path.as_deref() {
        if let Err(err) = remove_sidecar_metadata(path) {
            warn!("Failed to remove sidecar metadata: {err}");
        }
    }
}

#[cfg(desktop)]
fn resolve_sidecar(app: &tauri::App) -> Result<std::path::PathBuf, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = exe_path.parent().unwrap_or(std::path::Path::new("."));

    let target = env!("TAURI_TARGET_TRIPLE");
    let suffixed_name = format!("radarboard-helper-{target}");
    let plain_name = "radarboard-helper";

    let resource_dir = app.path().resource_dir().ok();

    let mut candidates: Vec<std::path::PathBuf> = vec![exe_dir.join(plain_name)];
    if let Some(ref res) = resource_dir {
        candidates.push(res.join(plain_name));
    }
    candidates.push(
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join(&suffixed_name),
    );

    for path in &candidates {
        if path.exists() {
            return Ok(path.clone());
        }
    }

    Err(format!(
        "Sidecar binary not found. Checked: {:?}",
        candidates
            .iter()
            .map(|p| p.display().to_string())
            .collect::<Vec<_>>()
    ))
}

#[cfg(desktop)]
fn start_server(
    sidecar_path: &std::path::Path,
    resource_dir: &std::path::Path,
) -> Result<(std::process::Child, String), String> {
    let launcher = resource_dir
        .join("resources")
        .join("standalone")
        .join("launcher.mjs");
    if !launcher.exists() {
        return Err(format!("Launcher script not found at {:?}", launcher));
    }

    info!(
        "Starting sidecar: {} {} {}",
        sidecar_path.display(),
        SIDECAR_NODE_RUNTIME_ARGS.join(" "),
        launcher.display()
    );

    let mut child = Command::new(sidecar_path)
        .args(SIDECAR_NODE_RUNTIME_ARGS)
        .arg(&launcher)
        .env(
            "TAURI_RESOURCE_DIR",
            resource_dir.join("resources").as_os_str(),
        )
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {e}"))?;

    if let Some(stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            let reader = std::io::BufReader::new(stderr);
            for line in std::io::BufRead::lines(reader) {
                match line {
                    Ok(line) => warn!("Sidecar: {line}"),
                    Err(err) => {
                        warn!("Failed to read sidecar stderr: {err}");
                        break;
                    }
                }
            }
        });
    }

    let stdout = child.stdout.take().ok_or("No stdout from sidecar")?;
    let mut reader = std::io::BufReader::new(stdout);
    let mut url = String::new();
    std::io::BufRead::read_line(&mut reader, &mut url)
        .map_err(|e| format!("Failed to read server URL: {e}"))?;
    let url = url.trim().to_string();

    if url.is_empty() {
        let status = child.wait().ok();
        return Err(format!(
            "Sidecar exited before outputting a URL{}",
            status
                .map(|status| format!(" with status {status}"))
                .unwrap_or_default()
        ));
    }

    Ok((child, url))
}

#[cfg(desktop)]
fn transition_from_splash(app: &tauri::App) {
    if let Some(splash) = app.get_webview_window("splashscreen") {
        let _ = splash.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        // On first launch (no saved window state), size the window to 90% of
        // the primary monitor, capped at 1920x1200 so it feels spacious on any
        // display without overflowing smaller screens. The window-state plugin
        // overrides this on subsequent launches with the user's last size.
        if let Ok(Some(monitor)) = main.primary_monitor() {
            let scale = monitor.scale_factor();
            let screen_w = monitor.size().width as f64 / scale;
            let screen_h = monitor.size().height as f64 / scale;
            let target_w = (screen_w * 0.90).min(1920.0).max(1024.0) as u32;
            let target_h = (screen_h * 0.90).min(1200.0).max(700.0) as u32;
            let _ = main.set_size(tauri::Size::Logical(tauri::LogicalSize::new(
                target_w as f64,
                target_h as f64,
            )));
            let _ = main.center();
        }
        let _ = main.show();
        let _ = main.set_focus();
    }
}

#[cfg(desktop)]
fn escape_html(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&#39;"),
            _ => escaped.push(ch),
        }
    }
    escaped
}

#[cfg(desktop)]
fn show_startup_error(app: &tauri::App, message: &str) {
    error!("Desktop startup failed: {message}");

    let log_dir = app
        .path()
        .app_log_dir()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|_| "the Radarboard app log directory".to_string());
    let html = format!(
        r#"<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Radarboard Startup Error</title>
  <style>
    :root {{ color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
    body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }}
    main {{ width: min(720px, calc(100vw - 48px)); }}
    h1 {{ font-size: 22px; line-height: 1.2; margin: 0 0 12px; }}
    p {{ font-size: 14px; line-height: 1.5; margin: 0 0 16px; color: color-mix(in srgb, CanvasText 78%, transparent); }}
    pre {{ overflow: auto; white-space: pre-wrap; border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); padding: 12px; font-size: 12px; line-height: 1.4; }}
  </style>
</head>
<body>
  <main>
    <h1>Radarboard could not start</h1>
    <p>The local desktop server failed to launch. The app stayed open so diagnostics remain available.</p>
    <p>Logs: {}</p>
    <pre>{}</pre>
  </main>
</body>
</html>"#,
        escape_html(&log_dir),
        escape_html(message)
    );

    if let Ok(data_dir) = app.path().app_local_data_dir() {
        if let Err(err) = std::fs::create_dir_all(&data_dir) {
            warn!("Failed to create startup diagnostics dir: {err}");
        } else {
            let diagnostics_path = data_dir.join("startup-error.html");
            match std::fs::write(&diagnostics_path, html) {
                Ok(()) => {
                    if let Some(main) = app.get_webview_window("main") {
                        if let Ok(url) = tauri::Url::from_file_path(&diagnostics_path) {
                            let _ = main.navigate(url);
                        }
                    }
                }
                Err(err) => warn!("Failed to write startup diagnostics page: {err}"),
            }
        }
    }

    transition_from_splash(app);
}

#[cfg(mobile)]
fn get_cloud_url() -> String {
    std::env::var("RADARBOARD_CLOUD_URL")
        .unwrap_or_else(|_| "https://app.radarboard.dev".to_string())
}

// ── Tray Menu Builder ──

#[cfg(desktop)]
fn build_tray_menu(
    app: &impl Manager<tauri::Wry>,
) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let app_name = desktop_app_name(app);
    let updates_enabled = is_stable_desktop_channel(app);

    // Header items
    let header = MenuItem::with_id(
        app,
        "tray-header",
        format!("{} v{}", app_name, app.package_info().version),
        false,
        None::<&str>,
    )?;
    let status = MenuItem::with_id(
        app,
        "tray-status",
        "● All systems healthy",
        false,
        None::<&str>,
    )?;

    // Notifications
    let notif_item = MenuItem::with_id(
        app,
        "tray-notifications",
        "Notifications",
        true,
        None::<&str>,
    )?;

    // Recent Events submenu — populated from stored TrayEventItem state
    let stored_events: Vec<TrayEventItem> = app
        .try_state::<Mutex<Vec<TrayEventItem>>>()
        .and_then(|state| state.lock().ok().map(|v| v.clone()))
        .unwrap_or_default();

    let recent_events = if stored_events.is_empty() {
        let empty = MenuItem::with_id(
            app,
            "tray-no-events",
            "No recent events",
            false,
            None::<&str>,
        )?;
        Submenu::with_items(app, "Recent Events", true, &[&empty])?
    } else {
        let mut items: Vec<MenuItem<_>> = Vec::new();
        for (i, evt) in stored_events.iter().take(10).enumerate() {
            let severity_dot = match evt.severity.as_str() {
                "critical" => "🔴",
                "warning" => "🟡",
                _ => "🔵",
            };
            let label = format!("{} {} — {}", severity_dot, evt.title, evt.source);
            items.push(MenuItem::with_id(
                app,
                format!("tray-event-{}", i),
                label,
                true,
                None::<&str>,
            )?);
        }
        let item_refs: Vec<&dyn tauri::menu::IsMenuItem<_>> = items
            .iter()
            .map(|i| i as &dyn tauri::menu::IsMenuItem<_>)
            .collect();
        Submenu::with_items(app, "Recent Events", true, &item_refs)?
    };

    // Navigation
    let open_dashboard =
        MenuItem::with_id(app, "tray-dashboard", "Open Dashboard", true, None::<&str>)?;

    // Pause notifications submenu
    let pause_30m = MenuItem::with_id(app, "tray-pause-30", "30 minutes", true, None::<&str>)?;
    let pause_1h = MenuItem::with_id(app, "tray-pause-60", "1 hour", true, None::<&str>)?;
    let pause_2h = MenuItem::with_id(app, "tray-pause-120", "2 hours", true, None::<&str>)?;
    let pause_tomorrow = MenuItem::with_id(
        app,
        "tray-pause-tomorrow",
        "Until tomorrow",
        true,
        None::<&str>,
    )?;
    let pause_resume = MenuItem::with_id(app, "tray-resume", "Resume", true, None::<&str>)?;
    let pause_menu = Submenu::with_items(
        app,
        "Pause Notifications",
        true,
        &[
            &pause_30m,
            &pause_1h,
            &pause_2h,
            &pause_tomorrow,
            &PredefinedMenuItem::separator(app)?,
            &pause_resume,
        ],
    )?;

    let mark_read = MenuItem::with_id(app, "tray-mark-read", "Mark All Read", true, None::<&str>)?;

    // Settings & diagnostics
    let preferences =
        MenuItem::with_id(app, "tray-preferences", "Settings...", true, None::<&str>)?;
    let view_logs = MenuItem::with_id(app, "tray-logs", "View Logs...", true, None::<&str>)?;
    let check_updates = MenuItem::with_id(
        app,
        "tray-updates",
        if updates_enabled {
            "Check for Updates..."
        } else {
            "Updates Disabled for Dev Build"
        },
        updates_enabled,
        None::<&str>,
    )?;

    // Quit
    let quit = MenuItem::with_id(
        app,
        "tray-quit",
        format!("Quit {}", app_name),
        true,
        None::<&str>,
    )?;

    let sep = || PredefinedMenuItem::separator(app);

    let menu = Menu::with_items(
        app,
        &[
            &header,
            &status,
            &sep()?,
            &open_dashboard,
            &sep()?,
            // Notifications group
            &notif_item,
            &recent_events,
            &mark_read,
            &pause_menu,
            &sep()?,
            // Settings & diagnostics
            &preferences,
            &view_logs,
            &check_updates,
            &sep()?,
            &quit,
        ],
    )?;

    Ok(menu)
}

// ── App Entry Point ──

pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Stdout,
                ))
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Webview,
                ))
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init());

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    #[cfg(desktop)]
    {
        #[cfg(feature = "devtools")]
        {
            builder = builder.plugin(devtools::init());
        }

        builder = builder
            .plugin(tauri_plugin_window_state::Builder::new().build())
            .plugin(tauri_plugin_process::init())
            .plugin(tauri_plugin_global_shortcut::Builder::new().build())
            .plugin(tauri_plugin_positioner::init())
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }));

        if !cfg!(debug_assertions) {
            builder = builder.plugin(tauri_plugin_prevent_default::init());
        }
    }

    builder
        .setup(|app| {
            // Stronghold needs the app data dir for its salt file, so it must be
            // registered inside .setup() rather than on the builder chain.
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("stronghold-salt.txt");
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;
            app.handle().plugin(tauri_plugin_deep_link::init())?;

            #[cfg(desktop)]
            {
                if is_stable_desktop_channel(app) {
                    app.handle()
                        .plugin(tauri_plugin_updater::Builder::new().build())?;
                    app.handle().plugin(tauri_plugin_autostart::init(
                        tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                        None,
                    ))?;
                }

                // Manage shared state for tray recent events
                app.manage(Mutex::new(Vec::<TrayEventItem>::new()));

                if is_stable_desktop_channel(app) {
                    // ── Register global shortcut: Cmd+Shift+D to show/focus ──
                    let shortcut: Shortcut = "CmdOrCtrl+Shift+D".parse().unwrap();
                    app.global_shortcut()
                        .on_shortcut(shortcut, |app, _shortcut, event| {
                            if event.state == ShortcutState::Pressed {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        })?;

                    // ── Register global shortcut: Cmd+Shift+N to toggle notification panel ──
                    let notif_shortcut: Shortcut = "CmdOrCtrl+Shift+N".parse().unwrap();
                    app.global_shortcut().on_shortcut(
                        notif_shortcut,
                        |app, _shortcut, event| {
                            if event.state == ShortcutState::Pressed {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        },
                    )?;
                }

                if cfg!(debug_assertions) {
                    let dev_url = app.config().build.dev_url.clone().ok_or_else(|| {
                        let msg = "build.devUrl must be set in tauri.conf.json for `tauri dev`";
                        error!("{msg}");
                        msg.to_string()
                    })?;
                    info!("Dev mode — loading {}", dev_url.as_str());
                    app.manage(Mutex::new(ServerState {
                        child: None,
                        child_pid: None,
                        metadata_path: None,
                    }));

                    if let Some(main) = app.get_webview_window("main") {
                        let _ = main.navigate(dev_url);
                    }
                    transition_from_splash(app);
                } else {
                    let data_dir = app
                        .path()
                        .app_local_data_dir()
                        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
                    std::fs::create_dir_all(&data_dir)
                        .map_err(|e| format!("Failed to create app data dir: {e}"))?;
                    let metadata_path = sidecar_metadata_path(&data_dir);
                    if let Err(err) = reap_stale_sidecars(&metadata_path) {
                        warn!("Failed to reap stale sidecars: {err}");
                    }

                    let resource_dir = app
                        .path()
                        .resource_dir()
                        .map_err(|e| format!("Failed to get resource dir: {e}"))?;

                    let result = resolve_sidecar(app).and_then(|path| {
                        start_server(&path, &resource_dir)
                            .map(|(child, url)| (child, url, path, metadata_path.clone()))
                    });

                    match result {
                        Ok((mut child, url, sidecar_path, metadata_path)) => {
                            let child_pid = child.id();
                            let metadata = SidecarRuntimeMetadata {
                                pid: child_pid,
                                started_at: current_unix_timestamp(),
                                binary_path: sidecar_path.display().to_string(),
                                url: Some(url.clone()),
                            };
                            persist_sidecar_metadata(&metadata_path, &metadata).map_err(|e| {
                                let _ = child.kill();
                                let _ = child.wait();
                                error!("{e}");
                                transition_from_splash(app);
                                e
                            })?;

                            info!("Server ready at {url}");

                            app.manage(Mutex::new(ServerState {
                                child: Some(child),
                                child_pid: Some(child_pid),
                                metadata_path: Some(metadata_path),
                            }));

                            if let Some(main) = app.get_webview_window("main") {
                                let parsed_url: tauri::Url = url.parse().expect("valid URL");
                                let _ = main.navigate(parsed_url);
                            }
                            transition_from_splash(app);
                        }
                        Err(err) => {
                            app.manage(Mutex::new(ServerState {
                                child: None,
                                child_pid: None,
                                metadata_path: Some(metadata_path),
                            }));
                            show_startup_error(app, &err);
                        }
                    }
                }

                // ── App menu bar ──
                let app_name = desktop_app_name(app);
                let about_label = format!("About {}", app_name);
                let app_menu = Submenu::with_items(
                    app,
                    &app_name,
                    true,
                    &[
                        &PredefinedMenuItem::about(
                            app,
                            Some(&about_label),
                            Some(AboutMetadata {
                                version: Some(app.package_info().version.to_string()),
                                copyright: Some(app_name.clone()),
                                website: Some("https://radarboard.app".to_string()),
                                ..Default::default()
                            }),
                        )?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::services(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::hide(app, None)?,
                        &PredefinedMenuItem::hide_others(app, None)?,
                        &PredefinedMenuItem::show_all(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::quit(app, None)?,
                    ],
                )?;

                let edit_menu = Submenu::with_items(
                    app,
                    "Edit",
                    true,
                    &[
                        &PredefinedMenuItem::undo(app, None)?,
                        &PredefinedMenuItem::redo(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::cut(app, None)?,
                        &PredefinedMenuItem::copy(app, None)?,
                        &PredefinedMenuItem::paste(app, None)?,
                        &PredefinedMenuItem::select_all(app, None)?,
                    ],
                )?;

                let view_menu = Submenu::with_items(
                    app,
                    "View",
                    true,
                    &[
                        &MenuItem::with_id(app, "reload", "Reload", true, Some("CmdOrCtrl+R"))?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::fullscreen(app, None)?,
                    ],
                )?;

                let window_menu = Submenu::with_items(
                    app,
                    "Window",
                    true,
                    &[
                        &PredefinedMenuItem::minimize(app, None)?,
                        &PredefinedMenuItem::maximize(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::close_window(app, None)?,
                    ],
                )?;

                let help_menu = Submenu::with_items(
                    app,
                    "Help",
                    true,
                    &[
                        &MenuItem::with_id(app, "docs", "Documentation", true, None::<&str>)?,
                        &MenuItem::with_id(app, "github", "GitHub", true, None::<&str>)?,
                        &PredefinedMenuItem::separator(app)?,
                        &MenuItem::with_id(
                            app,
                            "reset-data",
                            "Reset App Data...",
                            true,
                            None::<&str>,
                        )?,
                    ],
                )?;

                let menubar = Menu::with_items(
                    app,
                    &[&app_menu, &edit_menu, &view_menu, &window_menu, &help_menu],
                )?;
                app.set_menu(menubar)?;

                app.on_menu_event(move |app, event| match event.id().as_ref() {
                    "reload" => {
                        if let Some(w) = app.get_webview_window("main") {
                            if let Ok(url) = w.url() {
                                let _ = w.navigate(url);
                            }
                        }
                    }
                    "docs" => {
                        let _ = app
                            .opener()
                            .open_url("https://docs.radarboard.dev", None::<&str>);
                    }
                    "github" => {
                        let _ = app
                            .opener()
                            .open_url("https://github.com/Radarboard/radarboard", None::<&str>);
                    }
                    "reset-data" => match reset_app_data(app.clone()) {
                        Ok(msg) => {
                            info!("{msg}");
                            app.restart();
                        }
                        Err(e) => error!("Reset failed: {e}"),
                    },
                    _ => {}
                });

                // ── System tray ──
                let tray_menu = build_tray_menu(app)?;

                let _tray = TrayIconBuilder::with_id("main")
                    .icon(tray_image_from_png(include_bytes!(
                        "../tray-icons/tray-normal.png"
                    )))
                    .icon_as_template(true)
                    .tooltip(desktop_app_name(app))
                    .menu(&tray_menu)
                    .show_menu_on_left_click(true)
                    .on_menu_event(move |app, event| {
                        match event.id.as_ref() {
                            // Navigation
                            "tray-notifications" | "tray-dashboard" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            // Pause durations
                            "tray-pause-30" => {
                                let _ = app.emit("pause-notifications", 30u32);
                                if let Some(tray) = app.tray_by_id("main") {
                                    let app_name = desktop_app_name(app);
                                    let icon = tray_image_from_png(include_bytes!(
                                        "../tray-icons/tray-paused.png"
                                    ));
                                    set_tray_icon_template(&tray, icon);
                                    let _ = tray
                                        .set_tooltip(Some(format!("{app_name} — Paused (30m)")));
                                }
                            }
                            "tray-pause-60" => {
                                let _ = app.emit("pause-notifications", 60u32);
                                if let Some(tray) = app.tray_by_id("main") {
                                    let app_name = desktop_app_name(app);
                                    let icon = tray_image_from_png(include_bytes!(
                                        "../tray-icons/tray-paused.png"
                                    ));
                                    set_tray_icon_template(&tray, icon);
                                    let _ =
                                        tray.set_tooltip(Some(format!("{app_name} — Paused (1h)")));
                                }
                            }
                            "tray-pause-120" => {
                                let _ = app.emit("pause-notifications", 120u32);
                                if let Some(tray) = app.tray_by_id("main") {
                                    let app_name = desktop_app_name(app);
                                    let icon = tray_image_from_png(include_bytes!(
                                        "../tray-icons/tray-paused.png"
                                    ));
                                    set_tray_icon_template(&tray, icon);
                                    let _ =
                                        tray.set_tooltip(Some(format!("{app_name} — Paused (2h)")));
                                }
                            }
                            "tray-pause-tomorrow" => {
                                // 720 minutes = 12 hours (approximate "until tomorrow")
                                let _ = app.emit("pause-notifications", 720u32);
                                if let Some(tray) = app.tray_by_id("main") {
                                    let app_name = desktop_app_name(app);
                                    let icon = tray_image_from_png(include_bytes!(
                                        "../tray-icons/tray-paused.png"
                                    ));
                                    set_tray_icon_template(&tray, icon);
                                    let _ = tray.set_tooltip(Some(format!(
                                        "{app_name} — Paused until tomorrow"
                                    )));
                                }
                            }
                            "tray-resume" => {
                                let _ = app.emit("resume-notifications", ());
                                if let Some(tray) = app.tray_by_id("main") {
                                    let icon = tray_image_from_png(include_bytes!(
                                        "../tray-icons/tray-normal.png"
                                    ));
                                    set_tray_icon_template(&tray, icon);
                                    let _ = tray.set_tooltip(Some(desktop_app_name(app)));
                                }
                            }
                            // Actions
                            "tray-mark-read" => {
                                let _ = app.emit("mark-all-read", ());
                                if let Some(tray) = app.tray_by_id("main") {
                                    let icon = tray_image_from_png(include_bytes!(
                                        "../tray-icons/tray-normal.png"
                                    ));
                                    set_tray_icon_template(&tray, icon);
                                    let _ = tray.set_tooltip(Some(desktop_app_name(app)));
                                }
                            }
                            // Settings & diagnostics
                            "tray-preferences" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                    let _ = app.emit("navigate", "/?settings=general");
                                }
                            }
                            "tray-logs" => {
                                if let Ok(log_dir) = app.path().app_log_dir() {
                                    let _ = app
                                        .opener()
                                        .open_path(log_dir.to_string_lossy(), None::<&str>);
                                }
                            }
                            "tray-updates" => {
                                let _ = app.emit("check-for-updates", ());
                            }
                            "tray-quit" => app.exit(0),
                            // Recent event items — clicking opens the main window
                            id if id.starts_with("tray-event-") => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            _ => {}
                        }
                    })
                    .build(app)?;
            }

            #[cfg(mobile)]
            {
                let url = get_cloud_url();
                info!("Loading cloud app at {url}");
                if let Some(window) = app.get_webview_window("main") {
                    let parsed_url: tauri::Url = url.parse().expect("valid cloud URL");
                    let _ = window.navigate(parsed_url);
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(desktop)]
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    if window.label() == "main" {
                        let _ = window.hide();
                        api.prevent_close();
                    }
                }
                tauri::WindowEvent::Focused(_) => {}
                _ => {}
            }

            #[cfg(mobile)]
            {
                let _ = (window, event);
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_tray_state,
            update_health_status,
            update_tray_recent_events,
            pause_notifications,
            mark_all_read,
            check_for_updates,
            open_log_file,
            open_external_url,
            save_text_file,
            reset_app_data
        ])
        .build(tauri::generate_context!())
        .expect("error building Radarboard")
        .run(|app, event| {
            #[cfg(desktop)]
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let Some(state) = app.try_state::<Mutex<ServerState>>() {
                    if let Ok(mut state) = state.lock() {
                        shutdown_sidecar(&mut state);
                    }
                }
            }

            #[cfg(mobile)]
            {
                let _ = (app, event);
            }
        });
}

#[cfg(test)]
mod tests {
    use super::{
        classify_stale_sidecar_pids, parse_ps_output, persist_sidecar_metadata,
        read_sidecar_metadata, remove_sidecar_metadata, ProcessInfo, SidecarRuntimeMetadata,
    };
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_path(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "radarboard-sidecar-tests-{}-{}-{}",
            std::process::id(),
            nanos,
            name
        ))
    }

    #[test]
    fn parse_ps_output_skips_invalid_rows() {
        let processes = parse_ps_output(
            " 101 1 /Applications/Radarboard.app/Contents/MacOS/radarboard-desktop\n\
             invalid-row\n\
             202 101 /Applications/Radarboard.app/Contents/MacOS/radarboard-helper /launcher.mjs\n\
             303 nope /usr/bin/node\n",
        );

        assert_eq!(
            processes,
            vec![
                ProcessInfo {
                    pid: 101,
                    ppid: 1,
                    command:
                        "/Applications/Radarboard.app/Contents/MacOS/radarboard-desktop".to_string(),
                },
                ProcessInfo {
                    pid: 202,
                    ppid: 101,
                    command:
                        "/Applications/Radarboard.app/Contents/MacOS/radarboard-helper /launcher.mjs"
                            .to_string(),
                },
            ]
        );
    }

    #[test]
    fn classify_stale_sidecars_only_returns_orphans() {
        let processes = vec![
            ProcessInfo {
                pid: 400,
                ppid: 1,
                command: "/Applications/Radarboard.app/Contents/MacOS/radarboard-desktop"
                    .to_string(),
            },
            ProcessInfo {
                pid: 401,
                ppid: 400,
                command:
                    "/Applications/Radarboard.app/Contents/MacOS/radarboard-helper /launcher.mjs"
                        .to_string(),
            },
            ProcessInfo {
                pid: 402,
                ppid: 1,
                command:
                    "/Applications/Radarboard.app/Contents/MacOS/radarboard-helper /launcher.mjs"
                        .to_string(),
            },
            ProcessInfo {
                pid: 403,
                ppid: 1,
                command: "/usr/bin/node /tmp/other-app.js".to_string(),
            },
        ];

        assert_eq!(classify_stale_sidecar_pids(&processes), vec![402]);
    }

    #[test]
    fn sidecar_metadata_round_trips_and_cleans_up() {
        let dir = unique_temp_path("metadata");
        std::fs::create_dir_all(&dir).expect("create temp dir");
        let path = dir.join(".sidecar-runtime.json");

        let metadata = SidecarRuntimeMetadata {
            pid: 512,
            started_at: 1_744_070_000,
            binary_path: "/Applications/Radarboard.app/Contents/MacOS/radarboard-helper"
                .to_string(),
            url: Some("http://127.0.0.1:4311".to_string()),
        };

        persist_sidecar_metadata(&path, &metadata).expect("write metadata");
        let loaded = read_sidecar_metadata(&path).expect("read metadata");
        assert_eq!(loaded, Some(metadata));

        remove_sidecar_metadata(&path).expect("remove metadata");
        let loaded = read_sidecar_metadata(&path).expect("read missing metadata");
        assert_eq!(loaded, None);

        std::fs::remove_dir_all(&dir).expect("remove temp dir");
    }
}
