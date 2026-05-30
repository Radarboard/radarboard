/// <reference types="vitest" />
/// <reference types="@testing-library/jest-dom" />

// biome-ignore lint/correctness/noUndeclaredDependencies: test-only dependencies
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
