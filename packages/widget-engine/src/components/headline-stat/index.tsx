"use client";

interface HeadlineStatProps {
  value: string;
  label: string;
  indicatorColor?: string;
}

export function HeadlineStat({ value, label, indicatorColor = "#4ade80" }: HeadlineStatProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-3">
      <span
        className="pulse-dot inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: indicatorColor }}
      />
      <span className="font-bold font-mono text-foreground text-w-2xl">{value}</span>
      <span className="text-dim text-w-base">{label}</span>
    </div>
  );
}
