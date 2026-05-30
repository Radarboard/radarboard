import { describe, expect, it } from "vitest";
import { swapWidgetSlots } from "../layout-utils";

describe("swapWidgetSlots", () => {
  const baseLayout = {
    slot1: "revenue",
    slot2: "shipping",
    slot3: "roadmap",
    slot4: null,
    slot5: null,
    slot6: null,
    slot7: null,
    slot8: null,
    slot9: null,
  };

  it("swaps two widgets when both slots are filled", () => {
    const result = swapWidgetSlots(baseLayout, "slot1", "slot2");
    expect(result.slot1).toBe("shipping");
    expect(result.slot2).toBe("revenue");
  });

  it("moves a widget to an empty slot and clears the source", () => {
    const result = swapWidgetSlots(baseLayout, "slot1", "slot4");
    expect(result.slot1).toBeNull();
    expect(result.slot4).toBe("revenue");
  });

  it("is a no-op when source and target are the same slot", () => {
    const result = swapWidgetSlots(baseLayout, "slot1", "slot1");
    // Must return the exact same reference — no copying, no update
    expect(result).toBe(baseLayout);
  });

  it("never mutates the original layout", () => {
    const original = { ...baseLayout };
    swapWidgetSlots(baseLayout, "slot1", "slot2");
    expect(baseLayout.slot1).toBe(original.slot1);
    expect(baseLayout.slot2).toBe(original.slot2);
  });

  it("leaves all other slots unchanged", () => {
    const result = swapWidgetSlots(baseLayout, "slot1", "slot2");
    expect(result.slot3).toBe("roadmap");
    expect(result.slot4).toBeNull();
    expect(result.slot5).toBeNull();
    expect(result.slot6).toBeNull();
    expect(result.slot7).toBeNull();
    expect(result.slot8).toBeNull();
    expect(result.slot9).toBeNull();
  });

  it("handles swapping an empty slot into a filled slot (drop onto empty then move to filled)", () => {
    // Dragging from empty slot4 to filled slot1 — slot4 was the source
    const result = swapWidgetSlots(baseLayout, "slot4", "slot1");
    expect(result.slot4).toBe("revenue");
    expect(result.slot1).toBeNull();
  });

  it("handles two empty slots — both remain null", () => {
    const result = swapWidgetSlots(baseLayout, "slot4", "slot5");
    expect(result.slot4).toBeNull();
    expect(result.slot5).toBeNull();
  });

  it("returns a new object reference even when both slots are null", () => {
    const result = swapWidgetSlots(baseLayout, "slot4", "slot5");
    // A new layout object must be returned (not the same reference)
    expect(result).not.toBe(baseLayout);
  });

  it("works with unknown slot names without throwing", () => {
    // Robustness: dragging to a slot not in the layout
    const result = swapWidgetSlots(baseLayout, "slot1", "slot99");
    expect(result.slot1).toBeNull();
    expect((result as Record<string, string | null>).slot99).toBe("revenue");
  });
});
