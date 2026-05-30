/* biome-ignore-all lint/style/useNamingConvention: React error boundary lifecycle requires framework naming. */
"use client";

import type { ComponentType, ReactNode } from "react";
import { Component } from "react";

class StoryRenderBoundary extends Component<
  {
    componentName: string;
    sourcePath: string;
    children: ReactNode;
  },
  { error: Error | null }
> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    const { error } = this.state;

    if (error) {
      return (
        <div className="rounded-panel border border-warning/40 bg-warning/10 p-4 text-foreground text-sm">
          <div className="font-mono text-w-sm text-warning uppercase tracking-[0.18em]">
            Scaffold Needs Fixture
          </div>
          <div className="mt-2 font-medium text-w-base">{this.props.componentName}</div>
          <div className="mt-1 text-muted-foreground text-w-sm">{this.props.sourcePath}</div>
          <pre className="mt-3 overflow-x-auto rounded-card bg-background/70 p-3 text-dim text-w-sm">
            {error.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export function renderScaffoldStory<TArgs extends object>({
  componentName,
  sourcePath,
  Component,
  args,
}: {
  componentName: string;
  sourcePath: string;
  Component: ComponentType<TArgs>;
  args: Partial<TArgs>;
}) {
  const resolvedArgs = {
    children: componentName,
    ...args,
  } as TArgs;

  return (
    <div className="min-h-screen bg-background px-6 py-6 text-foreground">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-panel border border-border bg-surface-raised px-4 py-3">
          <div className="font-mono text-dim text-w-sm uppercase tracking-[0.18em]">
            Component Inventory
          </div>
          <div className="mt-1 font-medium text-lg">{componentName}</div>
          <div className="mt-1 text-muted-foreground text-w-sm">{sourcePath}</div>
        </header>

        <section className="rounded-panel border border-border bg-surface p-5">
          <StoryRenderBoundary componentName={componentName} sourcePath={sourcePath}>
            <Component {...resolvedArgs} />
          </StoryRenderBoundary>
        </section>
      </div>
    </div>
  );
}
