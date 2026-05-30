export default function DashboardNotFound() {
  return (
    <div className="fixed inset-0 z-ticker flex items-center justify-center bg-background/96 backdrop-blur-sm">
      <div className="rounded-panel border border-border bg-surface px-6 py-5 text-center shadow-modal">
        <div className="font-mono text-dim text-w-sm uppercase tracking-[0.3em]">Radarboard</div>
        <h1 className="mt-3 font-semibold text-foreground text-lg">Project not found</h1>
        <p className="mt-2 max-w-xs text-muted-foreground text-sm">
          The requested project route does not exist in the current dashboard configuration.
        </p>
      </div>
    </div>
  );
}
