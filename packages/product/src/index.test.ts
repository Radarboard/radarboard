import { describe, expect, it } from "vitest";
import {
  formatProductTitle,
  PRODUCT_DASHBOARD_DESCRIPTION,
  PRODUCT_DESCRIPTION,
  PRODUCT_NAME,
  PRODUCT_WAITLIST_SUBJECT,
} from "./index";

describe("@radarboard/product", () => {
  it("exports the canonical product metadata constants", () => {
    expect(PRODUCT_NAME).toBe("Radarboard");
    expect(PRODUCT_DESCRIPTION).toBe("Real-time business dashboard");
    expect(PRODUCT_DASHBOARD_DESCRIPTION).toContain("revenue, analytics, and project health");
    expect(PRODUCT_WAITLIST_SUBJECT).toBe("You're on the Radarboard waitlist!");
  });

  it("formats product page titles consistently", () => {
    expect(formatProductTitle("Debug")).toBe("Debug — Radarboard");
  });
});
