"use client";

interface CompactProjectBadgeProps {
  color: string;
  label: string;
}

export function toCompactProjectLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveCompactProjectBadgeLabel(label: unknown): string | null {
  if (typeof label !== "string") return null;
  const trimmed = label.trim();
  if (trimmed.length === 0) return null;
  return toCompactProjectLabel(trimmed);
}

export function CompactProjectBadge({ color, label }: CompactProjectBadgeProps) {
  return (
    <span
      className="shrink-0 rounded-item px-1.5 py-0.5 font-mono text-w-sm"
      style={{
        color,
        backgroundColor: `${color}18`,
      }}
    >
      {label}
    </span>
  );
}
