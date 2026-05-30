# Expenses Plugin Improvements Design

**Date:** 2026-03-21
**Status:** Draft
**Plugin:** `expenses` (packages/plugins/src/plugins/expenses/)

## Overview

Upgrade the Expenses plugin from a minimal side-panel tracker into a full-featured cost management tool with a 3-panel layout, expense editing, filtering/sorting, currency formatting, budget alerts, tags, and auto-sync from Vercel and GitHub billing APIs.

## Goals

1. Upgrade to fullscreen 3-panel layout (ThreePaneWorkspace) matching RSS/changelog pattern
2. Add expense detail/edit panel with all fields editable
3. Add filtering by category, tags, and sorting options
4. Implement proper currency formatting using the existing currency setting
5. Add budget alerts (total monthly + per-category limits)
6. Add free-form tags for flexible expense grouping
7. Auto-sync billing data from connected Vercel and GitHub integrations
8. Add soft delete (trash) for expense lifecycle management

## Non-Goals

- Real-time billing monitoring (polling is sufficient)
- Multi-currency conversion (all expenses stored in user's configured currency)
- Invoice/receipt attachment uploads
- Expense approval workflows
- Historical cost trend charts (future effort)

---

## 1. Data Model Changes

### ExpenseEntry Updates

```typescript
interface CostBreakdownItem {
  label: string;    // e.g. "Bandwidth", "Serverless Functions"
  amount: number;   // Monthly cost for this line item
}

interface ExpenseEntry {
  // Existing fields (unchanged)
  id: string;
  name: string;
  cost: number;
  billingCycle: BillingCycle;
  category: ExpenseCategory;
  renewalDate?: string;
  notes?: string;
  autoDetected?: boolean;
  createdAt: string;
  updatedAt: string;

  // New fields
  tags: string[];                       // Tag IDs for flexible grouping
  deletedAt: string | null;             // Soft delete timestamp (ISO 8601), null = active
  url?: string;                         // Service URL (pricing page, dashboard)
  integrationSource?: string;           // e.g. "vercel", "github" — set for auto-synced expenses
  costBreakdown?: CostBreakdownItem[];  // Per-service breakdown for aggregated expenses
}
```

**Auto-synced expense field conventions:** When an expense is created by the billing sync, `billingCycle` is set to `"monthly"` (since the API returns a monthly aggregate) and `cost` stores the raw monthly amount. This ensures `calculateMonthlyEquivalent()` returns the value as-is without double-conversion.

### New Types

```typescript
interface ExpenseTag {
  id: string;
  name: string;
}

interface Budget {
  totalMonthly?: number;                              // Overall monthly budget cap
  byCategory?: Partial<Record<ExpenseCategory, number>>; // Per-category limits
}

interface BudgetAlertState {
  totalExceededAt?: string;             // ISO timestamp when total budget was first exceeded
  totalApproachedAt?: string;           // ISO timestamp when >80% was first reached
  byCategoryExceededAt?: Partial<Record<ExpenseCategory, string>>;
  byCategoryApproachedAt?: Partial<Record<ExpenseCategory, string>>;
}
```

### New DB Keys

| Key | Type | Description |
|-----|------|-------------|
| `expenses:tags` | `ExpenseTag[]` | User-created tags |
| `expenses:budget` | `Budget` | Budget configuration |
| `expenses:budget-alert-state` | `BudgetAlertState` | Tracks when budget thresholds were last crossed to avoid repeat notifications |

### ExpensesSettings

The existing `ExpensesSettings` type (`{ currency: string; alertDaysAhead: number }`) and its defaults (`{ currency: "USD", alertDaysAhead: 7 }`) are unchanged. The `alertDaysAhead` value continues to control the upcoming renewals threshold in both the sidebar and MCP tools. The plugin descriptor setting key `"renewal-warning-days"` maps to `alertDaysAhead` as it does today.

### Migration

Existing expenses lack `tags`, `deletedAt`, `url`, `integrationSource`, `costBreakdown`. The `useExpenses` hook normalizes on load:

```typescript
const normalize = (expense: ExpenseEntry): ExpenseEntry => ({
  ...expense,
  tags: expense.tags ?? [],
  deletedAt: expense.deletedAt ?? null,
});
```

### Auto-Purge

On data load, expenses where `deletedAt` is older than 30 days are permanently removed. Same pattern as the tasks plugin.

### Shared Expense Operations Module

**New file: `expense-operations.ts`** — Pure utility functions used by both `use-expenses.ts` (React hook) and `mcp-tools.ts` (MCP tools).

Exports:
- `normalizeExpense(expense): ExpenseEntry` — migration/normalization
- `normalizeExpenses(expenses): ExpenseEntry[]` — normalize array + auto-purge
- `softDelete(expense): ExpenseEntry` — sets `deletedAt`
- `restoreExpense(expense): ExpenseEntry` — clears `deletedAt`
- `formatCurrency(amount: number, currency: string): string` — uses `Intl.NumberFormat` with locale derived from currency
- `calculateMonthlyEquivalent(cost: number, billingCycle: BillingCycle): number` — annual/12, one-time=0, monthly=as-is
- `syncBillingData(expenses: ExpenseEntry[], integration: string, billingData: { total: number, breakdown: CostBreakdownItem[] }): ExpenseEntry[]` — upserts auto-detected expense, returns updated array. Used by both hook and MCP tool.
- `generateId(): string` / `now(): string` — shared utilities

Both `use-expenses.ts` and `mcp-tools.ts` import from this module.

### Currency Formatting

The existing `currency` setting (USD, EUR, GBP, CAD, BRL) is currently stored but never used in display. The new `formatCurrency()` function uses `Intl.NumberFormat` with a locale derived from the currency code:

```typescript
const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  CAD: "en-CA",
  BRL: "pt-BR",
};

export function formatCurrency(amount: number, currency: string): string {
  const locale = CURRENCY_LOCALES[currency] ?? "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
```

This is used in the overlay, widget, detail panel, and MCP tool responses.

---

## 2. Integration Billing Sync

### Architecture

The expenses plugin reuses existing integration credentials. If a user has Vercel or GitHub configured (for deploys/repos), the same credentials work for billing — no extra setup needed.

**Two layers involved:**

1. **Integration layer** (`packages/integrations/`): A new `billing` `DataSourceDescriptor` is added to the Vercel and GitHub integration registries. This is a `fetch` function that calls the external billing API using credentials resolved via `DataSourceContext.resolveCredential()`. It's served via the existing unified integration route at `GET /api/integrations/[integration]/[action]`.

2. **Plugin layer** (`packages/plugins/`): The expenses plugin declares `dataSources` in its descriptor (for connection status checks via `api.dataSources.isConnected()`). At runtime, the plugin's `useExpenses` hook (and `sync_billing` MCP tool) call the integration route to fetch billing data.

**Data flow:**
```
Expenses plugin loads (useExpenses hook or sync_billing MCP tool)
  → api.dataSources.isConnected("vercel-billing") → true (credentials exist)
  → fetch("/api/integrations/vercel/billing") — hits the unified integration route
  → Route finds the "billing" DataSourceDescriptor in Vercel's integration registry
  → Descriptor.fetch() calls DataSourceContext.resolveCredential("vercel") for API key
  → Calls Vercel /billing/charges API with from/to params for current month
  → Returns { total: number, breakdown: CostBreakdownItem[] } (or null on 403)
  → Plugin upserts "Vercel" expense entry (matched by integrationSource field)
```

### Vercel Billing Data Source

**File:** `packages/integrations/src/vercel/api/data-sources.ts`

New `DataSourceDescriptor`:
- **Action:** `billing`
- **API endpoint:** `GET /billing/charges` with `from` and `to` query params
- **Date range:** The `fetch` function computes the current month range internally: `from` = first day of current month (YYYY-MM-01), `to` = today (YYYY-MM-DD). These are not passed as route params — the data source handles it.
- **Response processing:** Aggregates FOCUS v1.3 JSONL charges by service name into `{ total: number, breakdown: CostBreakdownItem[] }`
- **Cache TTL:** 3600s (1 hour)
- **Error handling:** Returns `null` if 403 (insufficient permissions) — the plugin skips silently

### GitHub Billing Data Source

**File:** `packages/integrations/src/github/api/data-sources.ts`

New `DataSourceDescriptor`:
- **Action:** `billing`
- **API endpoint:** `GET /orgs/{org}/settings/billing/usage` (enhanced billing platform endpoint)
- **Response processing:** Aggregates per-product usage (Actions, Packages, Copilot, etc.) into monthly total + `CostBreakdownItem[]`
- **Cache TTL:** 3600s (1 hour)
- **Org resolution:** Uses the first organization from the user's GitHub token scope. If no org access, returns `null`.
- **Error handling:** Returns `null` if 403 or no org found — plugin skips silently
- **Known limitation:** Requires classic PAT with org admin scope. Fine-grained tokens are not supported by GitHub's billing API.

### Plugin Data Sources Declaration

**File:** `packages/plugins/src/plugins/expenses/index.ts`

```typescript
dataSources: [
  {
    id: "vercel-billing",
    name: "Vercel Billing",
    description: "Auto-sync monthly costs from Vercel",
    connectionTypes: ["api_key"],
    integrationKey: "vercel",
  },
  {
    id: "github-billing",
    name: "GitHub Billing",
    description: "Auto-sync monthly costs from GitHub organization",
    connectionTypes: ["api_key"],
    integrationKey: "github",
  },
]
```

### Sync Behavior

The `useExpenses` hook exports a `syncBilling(integration?: string)` async function. The `sync_billing` MCP tool calls the same underlying logic (a shared `syncBillingData` function in `expense-operations.ts` that takes the integration fetch results and the current expense list, and returns the updated list).

- **On load:** If integration is connected, `syncBilling()` is called automatically
- **Manual:** "Sync" button per integration in the sidebar calls `syncBilling("vercel")` or `syncBilling("github")`
- **MCP:** `sync_billing` tool calls the shared `syncBillingData` function directly
- **Upsert logic:** Match existing expense by `integrationSource` field. If found, update `cost`, `costBreakdown`, `updatedAt`. If not found, create new expense with `autoDetected: true`, `billingCycle: "monthly"`, `category: "hosting"` (default, user can change).
- **Auto-detected expenses:** Show a sync badge in the UI. Cost field is read-only (overwritten on sync). User can still edit category, tags, notes, URL.
- **Disconnect:** User can delete auto-detected expense. It won't recreate until manual re-sync.

### Graceful Degradation

- Integration not configured → no sync, no error, manual-only expenses
- Token lacks billing permissions → fetch returns 403 → skip silently
- GitHub: no org access → skip GitHub billing
- Network failure → use last cached data, show stale indicator

---

## 3. Three-Panel Layout

### Presentation Change

Update plugin descriptor: `presentation: "fullscreen"` (was `"side-panel"`).

Uses the existing `ThreePaneWorkspace` component (same as RSS reader and changelog plugins).

### Sizing

```typescript
initialSidebarWidth={280}
initialListWidth={360}
minSidebarWidth={220}
minListWidth={280}
minDetailWidth={420}
```

### Sidebar

**Summary section (top):**
- Total monthly spend — large monospace number formatted with currency
- Budget progress bar (if total budget set): green (<80%), amber (80-100%), red (>100%)
- Per-category breakdown with amounts — small text, sorted by amount desc
- Per-category budget indicators when category budgets are set

**Filters section:**
- **Categories:** Button group (All + 6 categories). Active category highlights. Shows monthly amount next to each.
- **Tags:** Clickable tag chips. Multiple selection (AND filter). Only shown when tags exist.
- **Integrations:** "Connected" toggle to show only auto-synced expenses.

**Budget config (bottom):**
- "Set Budget" button opens inline budget editor in sidebar
- Total monthly limit input
- Per-category limit inputs (collapsible, only for categories with expenses)
- Save/cancel buttons

**Integration status:**
- Per-integration connection indicator (Vercel: Connected / Not connected)
- "Sync" button per connected integration
- Last synced timestamp

### List Panel

**Header:**
- "Add" button (Plus icon) — creates a new blank expense with defaults (`cost: 0`, `billingCycle: "monthly"`, `category: "other"`) and immediately selects it in the detail panel for editing. This is the primary creation flow — no separate form modal.
- Expense count label
- Sort dropdown: Cost (high→low), Cost (low→high), Name (A→Z), Renewal date, Recently added
- Search input: filters by name, notes, tag names

**Trash toggle:**
- "Trash" button at bottom of header (same pattern as tasks)
- When active, shows only soft-deleted expenses with "Restore" and "Delete Forever" actions

**Expense rows:**
Each row shows:
- Service name (primary text)
- Category chip (colored) + tag chips (muted)
- Monthly cost (right-aligned, monospace, formatted with currency)
- Billing cycle badge (Monthly / Annual / One-time) — muted
- Sync badge (small icon) if `autoDetected`
- Renewal date in amber if within `alertDaysAhead`
- Active state: highlighted background when selected

**Empty state:** "No expenses tracked yet. Add your first service expense."

### Detail Panel

All fields editable with auto-save on change:

| Field | Behavior |
|-------|----------|
| **Name** | Click to edit inline. Enter to save, Escape to cancel. |
| **Cost** | Number input with 2 decimal places. Read-only for auto-detected (shows sync badge). |
| **Billing cycle** | Button group: Monthly, Annual, One-time. |
| **Category** | Dropdown of 6 categories. |
| **Renewal date** | Date input. Clearing removes the date. |
| **URL** | Text input with clickable link icon to open in browser. |
| **Tags** | Inline tag chips with autocomplete. Click to add, X to remove. Create new tags inline. |
| **Notes** | Auto-expanding textarea. Saves on blur. |
| **Cost breakdown** | Read-only table shown when `costBreakdown` exists. Shows label + amount per line item. |
| **Metadata** | Read-only: created date, updated date, expense ID, integration source (if auto-detected). |
| **Actions** | Delete button ("Move to trash"). |

**Empty state:** "Select an expense to view details"

---

## 4. Budget Alerts

### Configuration

Stored in `expenses:budget` DB key as a `Budget` object. Configured inline in the sidebar.

### Alert Display

**Sidebar budget bar:**
- Shows `current / limit` text with progress bar
- Green: < 80% of budget
- Amber: 80-100% of budget
- Red: > 100% of budget

**Per-category indicators:**
- In sidebar category list, each category with a budget shows a small progress indicator
- Same color scheme (green/amber/red)

### Budget Alert Notifications

When expenses are added or updated and a budget threshold is crossed:
- **Approaching (>80%):** `api.notify("Approaching hosting budget: $180/$200", "info")`
- **Exceeded (>100%):** `api.notify("Hosting budget exceeded: $220/$200", "error")`

Notifications fire once per threshold crossing (not on every update). Track last-notified state in `expenses:budget-alert-state` DB key.

### Widget Integration

The widget shows a budget indicator when a total budget is set:
- Below the monthly total, show "of $X budget" with color-coded text
- No per-category budget in widget (too verbose for widget space)

---

## 5. Tags

### Data Model

Tags are stored separately in `expenses:tags` as `ExpenseTag[]`. Each expense references tags by ID in its `tags: string[]` array.

### Tag Management

- **Create:** Type a new tag name in the detail panel's tag input → creates tag in store + adds to expense
- **Remove from expense:** Click X on tag chip in detail panel
- **Delete tag globally:** Not exposed in UI (would require orphan cleanup). Tags without active expenses persist in storage but are hidden from the sidebar filter (which only shows tags on non-deleted expenses). This is an acceptable trade-off for a personal tool.
- **MCP tools:** `add_tag`, `remove_tag` operate on individual expenses

### Tag Filtering

Sidebar shows all tags that appear on at least one non-deleted expense. Clicking a tag filters the list. Multiple tags can be selected (AND logic — expense must have all selected tags).

---

## 6. MCP Tool Updates

### Modified Tools

**`add_expense`** — new optional parameters:
- `tags`: `string[]` — tag names (created if they don't exist)
- `url`: `string` — service URL

**`update_expense`** — new optional parameters:
- `tags`: `string[]` — replace tag list (by name)
- `url`: `string` — service URL

**`list_services`** — new optional parameters:
- `category`: filter by category
- `tags`: `string[]` — filter by tag names (AND logic — expense must have all listed tags)
- `include_deleted`: `boolean` (default false) — include trashed expenses
- Default behavior: excludes trashed expenses

**`delete_expense`** — becomes soft delete (sets `deletedAt`). Same pattern as tasks.

**`get_monthly_summary`** — updated:
- Excludes trashed expenses from calculations
- Includes budget status in response: `{ total_monthly, budget_limit?, over_budget?, breakdown, service_count }`

**`get_upcoming_renewals`** — updated:
- Excludes trashed expenses

### New Tools

**`get_expense`**
- Params: `expense_id: string`
- Returns full expense detail including tags, cost breakdown, integration source
- Returns: `{ success: boolean, expense?: ExpenseEntry, error?: string }`

**`restore_expense`**
- Params: `expense_id: string`
- Clears `deletedAt`
- Returns: `{ success: boolean, expense?: ExpenseEntry, error?: string }`

**`sync_billing`**
- Params: `integration?: string` — optional, sync specific integration or all connected
- Triggers billing data fetch from connected integrations
- Returns: `{ success: boolean, synced: string[], expenses_updated: number }`

**`set_budget`**
- Params: `total_monthly?: number`, `category_budgets?: Record<string, number>`
- Sets or clears budget limits
- Returns: `{ success: boolean, budget: Budget }`

**`get_budget_status`**
- Params: none
- Returns current spend vs budget: `{ total: { current, limit?, percentage? }, byCategory: [...] }`

### Updated Tool Descriptions

- `list_services`: *"List tracked service expenses with optional filters. By default excludes trashed expenses. Supports filtering by category and tag."*
- `delete_expense`: *"Soft-delete an expense (moves to trash, recoverable for 30 days). Use restore_expense to recover."*
- `add_expense`: *"Add a new service expense. Optionally include tags and service URL."*
- `sync_billing`: *"Sync billing data from connected integrations (Vercel, GitHub). Auto-creates or updates expense entries with current costs."*

---

## 7. Widget Updates

**File:** `widget.tsx`

Changes:
- Use `formatCurrency()` for all cost display (currently hardcodes `$`)
- Exclude trashed expenses (`deletedAt !== null`) from calculations
- Add budget indicator below monthly total when budget is set
- Read budget from `expenses:budget` DB key

---

## 8. File Changes Summary

| File | Change |
|------|--------|
| `types.ts` | Add `CostBreakdownItem`, `ExpenseTag`, `Budget` types. Add `tags`, `deletedAt`, `url`, `integrationSource`, `costBreakdown` to `ExpenseEntry`. |
| `expense-operations.ts` | **NEW**: Shared pure functions — `normalizeExpense`, `normalizeExpenses`, `softDelete`, `restoreExpense`, `formatCurrency`, `calculateMonthlyEquivalent`, `syncBillingData`, `generateId`, `now`. |
| `expense-operations.test.ts` | **NEW**: Unit tests for all shared operations. |
| `use-expenses.ts` | Import from `expense-operations.ts`. Add normalization on load. Add `softDeleteExpense`, `restoreExpense`, tag management, budget state, integration sync. Expand `addExpense`/`updateExpense` for new fields. |
| `mcp-tools.ts` | Import from `expense-operations.ts`. Update existing tools. Add `get_expense`, `restore_expense`, `sync_billing`, `set_budget`, `get_budget_status`. |
| `mcp-tools.test.ts` | Tests for all new/modified tools. |
| `components/expenses-overlay.tsx` | **REWRITE**: Replace side-panel with `ThreePaneWorkspace` (sidebar + list + detail). |
| `components/expense-list.tsx` | **NEW**: List panel with sorting, search, expense rows. |
| `components/expense-detail-panel.tsx` | **NEW**: Detail panel with all editable fields, tags, cost breakdown. |
| `components/expense-sidebar.tsx` | **NEW**: Sidebar with summary, budget, filters, integration status. |
| `components/budget-editor.tsx` | **NEW**: Inline budget configuration in sidebar. |
| `components/tag-input.tsx` | **NEW**: Tag autocomplete input for detail panel. |
| `widget.tsx` | Use `formatCurrency()`, exclude trashed, add budget indicator. |
| `index.ts` | Change `presentation` to `"fullscreen"`. Add `dataSources` for Vercel and GitHub billing. Register new MCP tools. |
| `packages/integrations/src/vercel/api/data-sources.ts` | Add `billing` data source. |
| `packages/integrations/src/github/api/data-sources.ts` | Add `billing` data source. |

---

## 9. Testing Strategy

- **expense-operations**: Unit tests for normalization, auto-purge, soft delete, restore, currency formatting, monthly equivalent calculation
- **MCP tools**: Unit tests for all new and modified tools (sync_billing uses mocked integration responses, budget CRUD, tag management, soft delete)
- **Integration data sources**: Unit tests for Vercel and GitHub billing response parsing/aggregation
- **Components**: Rely on existing pattern — no component tests required initially
