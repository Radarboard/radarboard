/**
 * @vitest-environment jsdom
 */
import "../test-setup";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Message, MessageContent } from "./chat-ui";

describe("Chat UI Primitives", () => {
  describe("Message", () => {
    it("renders user message with reverse alignment", () => {
      render(
        // biome-ignore lint/a11y/useValidAriaRole: role is used for testing logic
        <Message role="user">
          <div data-testid="content">Hello</div>
        </Message>
      );

      const message = screen.getByTestId("content").parentElement?.parentElement;
      expect(message).toHaveAttribute("data-role", "user");
      expect(message).toHaveClass("flex-row-reverse");
    });

    it("renders assistant message with normal alignment", () => {
      render(
        // biome-ignore lint/a11y/useValidAriaRole: role is used for testing logic
        <Message role="assistant">
          <div data-testid="content">Hello</div>
        </Message>
      );

      const message = screen.getByTestId("content").parentElement?.parentElement;
      expect(message).toHaveAttribute("data-role", "assistant");
      expect(message).toHaveClass("flex-row");
    });
  });

  describe("MessageContent", () => {
    it("applies user bubble styles", () => {
      render(
        // biome-ignore lint/a11y/useValidAriaRole: role is used for testing logic
        <Message role="user">
          <MessageContent data-testid="bubble">User text</MessageContent>
        </Message>
      );

      const bubble = screen.getByTestId("bubble");
      expect(bubble).toHaveClass("group-[.is-user]:bg-surface-raised");
    });

    it("applies assistant bubble-less styles", () => {
      render(
        // biome-ignore lint/a11y/useValidAriaRole: role is used for testing logic
        <Message role="assistant">
          <MessageContent data-testid="bubble">Assistant text</MessageContent>
        </Message>
      );

      const bubble = screen.getByTestId("bubble");
      expect(bubble).not.toHaveClass("bg-surface-raised");
    });
  });
});
