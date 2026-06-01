"use client";

import type React from "react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional label shown in the error card header. */
  title?: string;
  /** Class name applied to the default error fallback container. */
  className?: string;
  /** Fully custom fallback UI — receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** When any value in this array changes, the error state is automatically cleared (without remounting). */
  resetKeys?: ReadonlyArray<unknown>;
  /** Called when an error is caught — use to report to Sentry, logging, etc. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export function isRecoverableChunkLoadError(error: Error): boolean {
  const value = `${error.name}\n${error.message}\n${error.stack ?? ""}`.toLowerCase();
  return (
    value.includes("chunkloaderror") ||
    value.includes("failed to load chunk") ||
    value.includes("loading chunk") ||
    value.includes("dynamically imported module")
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && this.props.resetKeys) {
      const prevKeys = prevProps.resetKeys ?? [];
      const nextKeys = this.props.resetKeys;
      if (nextKeys.length !== prevKeys.length || nextKeys.some((key, i) => key !== prevKeys[i])) {
        this.setState({ error: null });
      }
    }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("radarboard:error-boundary", {
          detail: {
            title: this.props.title,
            message: _error.message,
            stack: _error.stack,
          },
        })
      );
    }

    this.props.onError?.(_error, _info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  recover = () => {
    if (
      this.state.error &&
      isRecoverableChunkLoadError(this.state.error) &&
      typeof window !== "undefined"
    ) {
      window.location.reload();
      return;
    }

    this.reset();
  };

  render() {
    const { error } = this.state;
    const { children, title, className, fallback } = this.props;

    if (!error) return children;

    if (fallback) return fallback(error, this.recover);

    const actionLabel = isRecoverableChunkLoadError(error) ? "Reload" : "Retry";

    return (
      <div
        className={["flex h-full flex-col overflow-hidden", className].filter(Boolean).join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-border border-b px-3 py-2">
          <h2 className="font-medium font-mono text-dim text-w-sm uppercase tracking-widest">
            {title ?? "Error"}
          </h2>
          <button
            type="button"
            onClick={this.recover}
            className="cursor-pointer font-mono text-dim text-w-sm transition-colors hover:text-foreground-secondary"
          >
            {actionLabel}
          </button>
        </div>

        {/* Error detail */}
        <div className="flex-1 space-y-2 overflow-auto p-3">
          <p className="font-medium font-mono text-red-400 text-w-sm">{error.message}</p>
          {Boolean(error.stack) && (
            <pre className="whitespace-pre-wrap break-all font-mono text-dim text-w-sm leading-relaxed">
              {error.stack}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

/**
 * HOC convenience wrapper.
 *
 * @example
 * export const SafeMyComponent = withErrorBoundary(MyComponent, { title: "My Component" });
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  boundaryProps?: Omit<ErrorBoundaryProps, "children">
) {
  const displayName = WrappedComponent.displayName ?? WrappedComponent.name ?? "Component";

  function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...boundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  }

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  return WithErrorBoundary;
}
