// Minimal N-API addon: switch the current process to a macOS "accessory"
// (UIElement) application so the Node sidecar does not get its own Dock icon.
//
// A Tauri sidecar/external binary spawned from the app registers with
// LaunchServices as a regular (dockable) application, producing a stray
// "radarboard-helper" Dock tile (see tauri-apps/tauri#14014). The reliable fix
// is for the sidecar process itself to set an accessory activation policy —
// which for a bare Node binary means calling TransformProcessType from inside
// the process. This addon exposes that call to launcher.mjs.
//
// Built at bundle time by build-sidecar.sh (clang, no node-gyp) and loaded via
// createRequire in the launcher. Both the build step and the call are best
// effort: if anything fails, the app still runs (the Dock tile just remains).
#include <node_api.h>

// TransformProcessType / ProcessSerialNumber live in the deprecated Process
// Manager API, but they remain the supported way to change activation policy
// for a non-Cocoa process. Silence the deprecation noise.
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
#include <ApplicationServices/ApplicationServices.h>

static napi_value SetAccessoryPolicy(napi_env env, napi_callback_info info) {
  ProcessSerialNumber psn = {0, kCurrentProcess};
  OSStatus status = TransformProcessType(&psn, kProcessTransformToUIElementApplication);
  napi_value result;
  napi_create_int32(env, (int32_t)status, &result);
  return result;
}
#pragma clang diagnostic pop

static napi_value Init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "setAccessoryPolicy", NAPI_AUTO_LENGTH, SetAccessoryPolicy, NULL, &fn);
  napi_set_named_property(env, exports, "setAccessoryPolicy", fn);
  return exports;
}

NAPI_MODULE(accessory, Init)
