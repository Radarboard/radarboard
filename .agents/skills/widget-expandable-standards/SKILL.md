# Skill: Widget Expandable View Standards

Standards and patterns for building expanded (fullscreen) widget views in Radarboard.

---

## Size system

Three sizes, controlled by the user at runtime via **S / M / L** toggle buttons in the portal header. The user's choice is persisted to `localStorage` per widget ID (`radarboard:expanded-size:{widgetId}`).

The `WidgetDescriptor.expandedSize` field sets the **default** only (what the user sees the first time). Do not use it to force a fixed size.

| Size | Class | Use for |
|------|-------|---------|
| `lg` | full viewport − 16px margin | Multi-column layouts with charts (SEO, Analytics, Revenue) |
| `md` | 90vw / max-w-5xl × 80vh | Single-column tables (GitHub Stars, npm downloads) |
| `sm` | 75vw / max-w-3xl × 65vh | Compact focused widgets (ASO Keywords, Ideas) |

```ts
// In your WidgetDescriptor:
expandedSize: "md",  // default shown before user makes a choice
```

---

## Typography — match github-activity as the reference

| Element | Class | Example |
|---------|-------|---------|
| Primary content (titles, names, keywords) | `text-[13px] font-mono` | PR title, keyword name, page path |
| Secondary / metadata | `text-[11px] font-mono` | Repo name, country code, timestamp |
| Column headers (table `<th>`) | `text-[10px] font-mono uppercase tracking-wider` | "Rank", "Clicks" |
| KPI values | `text-[16px]` to `text-[20px] font-mono` | "62", "1.4k" |
| KPI labels | `text-[11px] font-mono uppercase tracking-wider` | "Top 10", "Improving" |
| Tiny labels / badges | `text-[10px] font-mono` | Store code "US", version "v2.1" |
| Footer / footnotes | `text-[11px] font-mono` | "All countries · Avg rank: 4" |

**Never use `text-[10px]` or `text-[9px]` for primary readable content.** These sizes are only for column headers, badges, and decorative labels.

---

## WidgetTable

All expandable views with tabular data must use `<WidgetTable>` from `../../components/widget-table`.

`WidgetTable` automatically:
- Sets `text-[13px]` on data cells
- Sets `text-[10px] uppercase tracking-wider` on column headers
- Provides column sorting (click header)
- Provides global text filter
- Persists sort + filter state to `localStorage` via `stateKey`

### stateKey convention
```ts
stateKey="<widget-id>:<table-name>"
// e.g. "seo:queries", "aso-keywords:keywords", "github-stars:repos"
```

### defaultSorting
Always provide a meaningful default sort so the table is useful on first open:
```ts
defaultSorting={[{ id: "clicks", desc: true }]}   // SEO — most clicks first
defaultSorting={[{ id: "stars", desc: true }]}     // GitHub Stars
defaultSorting={[{ id: "currentRanking", desc: false }]}  // ASO — best rank first
```

### Column meta for alignment
```ts
columnHelper.accessor("stars", {
  header: "Stars",
  meta: { align: "right" },  // numbers always right-aligned
  cell: (info) => <span className="text-[#f5c542]">{formatNumber(info.getValue())}</span>,
})
```

---

## Layout patterns

### Standard: KPI strip + table
```tsx
<div className="flex flex-col h-full">
  {/* KPI strip — fixed height, never scrolls */}
  <div className="grid grid-cols-4 gap-px bg-[#222] shrink-0">
    <KPI label="Top 10" value="62" />
    ...
  </div>

  {/* Table fills remaining space */}
  <WidgetTable stateKey="..." columns={columns} data={data} ... />

  {/* Optional footer — fixed, never scrolls */}
  <div className="px-3 py-1.5 border-t border-[#1a1a1a] flex items-center justify-between shrink-0">
    <span className="text-[11px] font-mono text-[#555]">Context info</span>
  </div>
</div>
```

### Split: charts left + table right (SEO, Analytics)
```tsx
<div className="flex flex-1 min-h-0">
  <div className="w-[260px] shrink-0 border-r border-[#222]">
    {/* charts */}
  </div>
  <div className="flex-1 min-h-0">
    <WidgetTable ... />
  </div>
</div>
```

---

## Offline / stale banner
When `isStale: true` (Astro or other MCP service is down), show the amber offline banner **above the KPI strip**, as the first child:

```tsx
{isStale && <OfflineBanner fetchedAt={fetchedAt} />}
```

The `OfflineBanner` is defined in each widget that uses it. Standard appearance:
- Background: `bg-[#1a1400]`, border: `border-amber-900/50`
- Icon: `WifiOff` in `text-amber-500`
- Text: `text-[11px] font-mono text-amber-500/80` — e.g. "Astro offline · cached 3h"

---

## KPI cells

```tsx
function KPI({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="bg-[#161616] px-3 py-2.5">
      <div className="text-[11px] font-mono uppercase tracking-wider text-[#555]">{label}</div>
      <div className={cn("text-[16px] font-mono mt-0.5", dim ? "text-[#666]" : "text-[#e8e8e8]")}>
        {value}
      </div>
    </div>
  );
}
```

For podium-style KPIs (rank #1/#2/#3) with accent colors, see `aso-keywords/index.tsx → PodiumKPI`.

---

## Dos and Don'ts

**Do:**
- Use `font-mono` for all data content — this is a developer dashboard
- Right-align all numeric columns via `meta: { align: "right" }`
- Provide `filterPlaceholder` on WidgetTable for all text-searchable tables
- Set `shrink-0` on the KPI strip and footer to prevent them from being squeezed
- Use `flex flex-col h-full` as the root element of every expanded component

**Don't:**
- Don't use `overflow-y-auto` on the expanded component root — let WidgetTable handle scrolling
- Don't add inline `<table>` — use `WidgetTable`
- Don't hardcode colors for ranks/metrics that should match the design system (see `rankColor` in ASO)
- Don't call hooks after conditional returns (React rule — put all `useState`/`useMemo`/`useCallback` before any `if (loading) return ...`)
