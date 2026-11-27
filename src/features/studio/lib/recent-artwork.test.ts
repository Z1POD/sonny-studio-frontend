import { describe, expect, it } from "vitest";
import { newestFirst } from "./recent-artwork";

describe("newestFirst", () => {
  it("orders by createdAt descending", () => {
    const out = newestFirst([{ id: "a", createdAt: "2026-01-01T00:00:00Z" }, { id: "b", createdAt: "2026-03-01T00:00:00Z" }]);
    expect(out.map((i) => i.id)).toEqual(["b", "a"]);
  });
  it("keeps server order without timestamps", () => {
    expect(newestFirst([{ id: "a" }, { id: "b" }]).map((i) => i.id)).toEqual(["a", "b"]);
  });
});
