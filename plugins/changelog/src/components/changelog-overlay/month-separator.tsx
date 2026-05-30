export function MonthSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-1 pt-2 pb-1">
      <div className="font-mono text-dim text-w-sm uppercase tracking-[0.22em]">{label}</div>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
