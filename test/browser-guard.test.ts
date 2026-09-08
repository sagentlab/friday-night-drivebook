import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("browser async form handlers", () => {
  it("does not dereference event.currentTarget after an await", () => {
    const app = readFileSync(fileURLToPath(new URL("../public/app.js", import.meta.url)), "utf8");
    expect(app).not.toMatch(/await api\([\s\S]{0,900}event\.currentTarget\.reset\(\)/);
    expect(app.match(/const form = event\.currentTarget;/g)).toHaveLength(2);
  });
});
