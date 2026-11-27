import { describe, expect, it } from "vitest";
import { resolveZoneMethod } from "./zone-method";
import type { PrintZone } from "../types";

const zone = (allowed: string[]) => ({ id: "z", allowedMethods: allowed }) as unknown as PrintZone;

describe("resolveZoneMethod", () => {
  it("prefers the zone's own pick, then the default, then the first allowed", () => {
    expect(resolveZoneMethod(zone(["a", "b"]), { z: "b" }, "a")).toBe("b");
    expect(resolveZoneMethod(zone(["a", "b"]), {}, "b")).toBe("b");
    expect(resolveZoneMethod(zone(["emb"]), { z: "dtg" }, "dtg")).toBe("emb");
  });
});
