// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const { registerLanguageMock } = vi.hoisted(() => ({
  registerLanguageMock: vi.fn(),
}));

vi.mock("react-syntax-highlighter", () => ({
  PrismLight: Object.assign(
    ({ children, language }: { children: ReactNode; language: string }) => (
      <pre data-testid="code-highlight" data-language={language}>
        {children}
      </pre>
    ),
    { registerLanguage: registerLanguageMock }
  ),
}));

vi.mock("react-syntax-highlighter/dist/esm/languages/prism/bash", () => ({ default: {} }));
vi.mock("react-syntax-highlighter/dist/esm/languages/prism/css", () => ({ default: {} }));
vi.mock("react-syntax-highlighter/dist/esm/languages/prism/json", () => ({ default: {} }));
vi.mock("react-syntax-highlighter/dist/esm/languages/prism/markdown", () => ({ default: {} }));
vi.mock("react-syntax-highlighter/dist/esm/languages/prism/python", () => ({ default: {} }));
vi.mock("react-syntax-highlighter/dist/esm/languages/prism/sql", () => ({ default: {} }));
vi.mock("react-syntax-highlighter/dist/esm/languages/prism/tsx", () => ({ default: {} }));
vi.mock("react-syntax-highlighter/dist/esm/languages/prism/typescript", () => ({ default: {} }));
vi.mock("react-syntax-highlighter/dist/esm/languages/prism/yaml", () => ({ default: {} }));
vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneDark: {
    'pre[class*="language-"]': {},
    'code[class*="language-"]': {},
  },
}));

import CodeHighlight from "./rich-text-viewer/code-highlight";

describe("CodeHighlight", () => {
  it("registers supported languages and renders code with the requested language", () => {
    render(<CodeHighlight lang="typescript" code={"const answer = 42;"} />);

    expect(screen.getByTestId("code-highlight").getAttribute("data-language")).toBe("typescript");
    expect(screen.getByText("const answer = 42;")).toBeTruthy();
    expect(registerLanguageMock).toHaveBeenCalledWith("typescript", {});
    expect(registerLanguageMock).toHaveBeenCalledWith("tsx", {});
    expect(registerLanguageMock).toHaveBeenCalledWith("javascript", {});
    expect(registerLanguageMock).toHaveBeenCalledWith("jsx", {});
    expect(registerLanguageMock).toHaveBeenCalledWith("bash", {});
    expect(registerLanguageMock).toHaveBeenCalledWith("sh", {});
    expect(registerLanguageMock).toHaveBeenCalledWith("json", {});
    expect(registerLanguageMock).toHaveBeenCalledWith("python", {});
    expect(registerLanguageMock).toHaveBeenCalledWith("sql", {});
    expect(registerLanguageMock).toHaveBeenCalledWith("css", {});
    expect(registerLanguageMock).toHaveBeenCalledWith("yaml", {});
    expect(registerLanguageMock).toHaveBeenCalledWith("yml", {});
    expect(registerLanguageMock).toHaveBeenCalledWith("markdown", {});
    expect(registerLanguageMock).toHaveBeenCalledWith("md", {});
  });
});
