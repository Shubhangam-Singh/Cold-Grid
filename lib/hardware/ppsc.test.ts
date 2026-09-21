import { describe, expect, it } from "vitest";
import { ppscUnitId } from "./ppsc";

describe("ppscUnitId", () => {
  it("derives a zero-padded unit id from a shipment id", () => {
    expect(ppscUnitId("SHP-1")).toBe("PPSC-001");
    expect(ppscUnitId("SHP-12")).toBe("PPSC-012");
    expect(ppscUnitId("SHP-103")).toBe("PPSC-103");
  });
});
