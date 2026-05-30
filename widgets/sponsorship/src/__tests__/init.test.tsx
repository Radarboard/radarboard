// @vitest-environment jsdom

import { DETAIL_RENDERER_REGISTRY } from "@radarboard/widget-sdk/detail-renderer-registry";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { initializeSponsorshipWidget } from "../init";

describe("initializeSponsorshipWidget", () => {
  beforeEach(() => {
    DETAIL_RENDERER_REGISTRY.clear();
  });

  it("registers sponsor, member, and transaction detail renderers", () => {
    initializeSponsorshipWidget();

    expect(DETAIL_RENDERER_REGISTRY.has("sponsorship.sponsor")).toBe(true);
    expect(DETAIL_RENDERER_REGISTRY.has("sponsorship.member")).toBe(true);
    expect(DETAIL_RENDERER_REGISTRY.has("sponsorship.transaction")).toBe(true);
  });

  it("returns react elements from the registered sponsorship renderers", () => {
    initializeSponsorshipWidget();
    const sponsorRenderer = DETAIL_RENDERER_REGISTRY.get("sponsorship.sponsor");
    const memberRenderer = DETAIL_RENDERER_REGISTRY.get("sponsorship.member");
    const transactionRenderer = DETAIL_RENDERER_REGISTRY.get("sponsorship.transaction");

    if (!sponsorRenderer || !memberRenderer || !transactionRenderer) {
      throw new Error("Expected sponsorship detail renderers");
    }

    expect(
      isValidElement(
        sponsorRenderer({
          item: { displayName: "Alice", monthlyValue: 5, currency: "USD" },
        } as never)
      )
    ).toBe(true);
    expect(
      isValidElement(
        memberRenderer({
          item: {
            name: "Bob",
            donatedValue: 20,
            displayTier: "Gold",
            account: { type: "USER", name: "Bob" },
            since: "2026-03-20T00:00:00.000Z",
          },
        } as never)
      )
    ).toBe(true);
    expect(
      isValidElement(
        transactionRenderer({
          item: { descriptionText: "Contribution", displayAmount: 10, accountName: "Alice" },
        } as never)
      )
    ).toBe(true);
  });
});
