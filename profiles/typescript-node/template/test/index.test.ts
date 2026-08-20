import { describe, expect, it } from "vitest";
import * as project from "../src/index.js";

describe("project entry point", () => {
  it("loads as an ECMAScript module", () => {
    expect(project).toBeTypeOf("object");
  });
});
