import { describe, expect, it } from "vitest";
import { parseCreatorArguments } from "../src/arguments.js";

describe("Project Creator arguments", () => {
  it("accepts an extensible repeated Agent selection", () => {
    expect(
      parseCreatorArguments(["example-service", "--agent", "codex", "--agent", "claude", "--yes"]),
    ).toEqual({
      target: "example-service",
      agents: ["codex", "claude"],
      allAgents: false,
      yes: true,
      install: true,
      verbose: false,
      values: {},
    });
  });
});
