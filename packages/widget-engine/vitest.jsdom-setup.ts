/**
 * Polyfills for jsdom-based tests in widget-engine.
 * jsdom does not implement ResizeObserver, which is used by the chart component.
 *
 * The mock triggers the callback immediately with a reasonable dimension
 * so chart components don't warn about zero width/height.
 */

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    private callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      // Fire callback synchronously with mock dimensions
      this.callback(
        [
          {
            target,
            contentRect: {
              width: 400,
              height: 300,
              top: 0,
              left: 0,
              bottom: 300,
              right: 400,
              x: 0,
              y: 0,
              toJSON: () => ({}),
            },
            borderBoxSize: [{ inlineSize: 400, blockSize: 300 }],
            contentBoxSize: [{ inlineSize: 400, blockSize: 300 }],
            devicePixelContentBoxSize: [{ inlineSize: 400, blockSize: 300 }],
          } as ResizeObserverEntry,
        ],
        this
      );
    }

    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}
