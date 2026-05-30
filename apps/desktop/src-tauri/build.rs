use std::path::Path;

fn main() {
    // Expose the target triple to the Rust code via TAURI_TARGET_TRIPLE env var
    println!(
        "cargo:rustc-env=TAURI_TARGET_TRIPLE={}",
        std::env::var("TARGET").unwrap_or_else(|_| "aarch64-apple-darwin".to_string())
    );
    reencode_bundle_pngs_as_rgba();
    generate_tray_icon_variants();
    tauri_build::build();
}

fn png_ihdr_color_type(path: &Path) -> Option<u8> {
    let data = std::fs::read(path).ok()?;
    (data.len() > 25 && data.starts_with(b"\x89PNG\r\n\x1a\n")).then_some(data[25])
}

/// Generate tray icon variants from the base 32x32.png:
///  - tray-normal.png  → original icon
///  - tray-badge.png   → icon with a small blue dot (unread notifications)
///  - tray-critical.png → icon with a small red dot (critical alert)
///  - tray-paused.png  → icon at 40% opacity (notifications paused)
fn generate_tray_icon_variants() {
    use image::{Pixel, RgbaImage};

    let icons_dir = Path::new("icons");
    let base_path = icons_dir.join("32x32.png");
    println!("cargo:rerun-if-changed={}", base_path.display());

    if !base_path.exists() {
        return;
    }

    let base = image::open(&base_path)
        .unwrap_or_else(|e| panic!("open base icon: {e}"))
        .into_rgba8();
    let (w, h) = base.dimensions();

    // Normal — just a copy of the base
    save_if_changed(&icons_dir.join("tray-normal.png"), &base);

    // Badge — base + blue dot in bottom-right
    let mut badge = base.clone();
    draw_dot(&mut badge, w, h, [59, 130, 246, 255]); // blue-500
    save_if_changed(&icons_dir.join("tray-badge.png"), &badge);

    // Critical — base + red dot in bottom-right
    let mut critical = base.clone();
    draw_dot(&mut critical, w, h, [239, 68, 68, 255]); // red-500
    save_if_changed(&icons_dir.join("tray-critical.png"), &critical);

    // Paused — base at 40% opacity
    let mut paused = RgbaImage::new(w, h);
    for (x, y, pixel) in base.enumerate_pixels() {
        let mut p = *pixel;
        let channels = p.channels_mut();
        channels[3] = (channels[3] as f32 * 0.4) as u8;
        paused.put_pixel(x, y, p);
    }
    save_if_changed(&icons_dir.join("tray-paused.png"), &paused);
}

/// Only write a PNG if its content differs from what's on disk, preventing Tauri's
/// file watcher from triggering an infinite rebuild loop.
fn save_if_changed(path: &Path, img: &image::RgbaImage) {
    let mut buf = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgba8(img.clone())
        .write_to(&mut buf, image::ImageFormat::Png)
        .unwrap();
    let new_bytes = buf.into_inner();
    if let Ok(existing) = std::fs::read(path) {
        if existing == new_bytes {
            return;
        }
    }
    std::fs::write(path, new_bytes).unwrap();
}

/// Draw a filled circle (notification dot) in the bottom-right corner of the icon.
fn draw_dot(img: &mut image::RgbaImage, w: u32, h: u32, color: [u8; 4]) {
    let radius: f32 = (w as f32 * 0.2).max(3.0);
    let cx = w as f32 - radius - 1.0;
    let cy = h as f32 - radius - 1.0;
    let r2 = radius * radius;

    for y in 0..h {
        for x in 0..w {
            let dx = x as f32 - cx;
            let dy = y as f32 - cy;
            if dx * dx + dy * dy <= r2 {
                img.put_pixel(x, y, image::Rgba(color));
            }
        }
    }
}

/// Tauri requires bundle PNG icons to be color type 6 (RGBA). Palette/grayscale PNGs fail
/// `generate_context!` with "is not RGBA".
fn reencode_bundle_pngs_as_rgba() {
    const NAMES: &[&str] = &["32x32.png", "128x128.png", "128x128@2x.png", "icon.png"];
    let icons_dir = Path::new("icons");
    for name in NAMES {
        let path = icons_dir.join(name);
        println!("cargo:rerun-if-changed={}", path.display());
        if !path.exists() {
            continue;
        }
        if png_ihdr_color_type(&path) == Some(6) {
            continue;
        }
        let img = image::open(&path).unwrap_or_else(|e| panic!("open {}: {e}", path.display()));
        let rgba = img.into_rgba8();
        image::DynamicImage::ImageRgba8(rgba)
            .save(&path)
            .unwrap_or_else(|e| panic!("write RGBA {}: {e}", path.display()));
    }
}
