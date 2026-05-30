/**
 * Module route registrations barrel.
 *
 * Each module defines its routes and calls `registerRoutes()` in its own file.
 * Import those files here so the catch-all dispatcher picks them up.
 *
 * Migration is incremental — add a module import here, then delete the
 * corresponding `app/api/` route files.
 */

// --- Assistant ---
import "@/modules/assistant-shell/routes/register";

// --- Auth ---
import "@/modules/auth-shell/routes/register";

// --- Backup ---
import "@/modules/backup-shell/routes/register";

// --- Credentials ---
import "@/modules/credentials-shell/routes/register";

// --- Database ---
import "@/modules/database-shell/routes/register";

// --- Debug ---
import "@/modules/debug-shell/routes/register";

// --- Demo ---
import "@/modules/demo-shell/routes/register";

// --- Extensions ---
import "@/modules/extensions-shell/routes/register";

// --- Integrations ---
import "@/modules/integration-shell/routes/register";

// --- MCP ---
import "@/modules/mcp-shell/routes/register";

// --- Notifications ---
import "@/modules/notifications-shell/routes/register";

// --- Plugins ---
import "@/modules/plugin-shell/routes/register";

// --- Settings ---
import "@/modules/settings-shell/register";
