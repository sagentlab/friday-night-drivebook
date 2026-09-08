import { describe, expect, it } from "vitest";
import { parseNewDrive, parseNewGame, parseNote, parseScore } from "../src/domain";

describe("domain input validation", () => {
  it("normalizes a valid game", () => {
    expect(parseNewGame({ homeTeam: " Hawks ", awayTeam: "Tigers", venue: "Memorial Field", gameDate: "2026-09-04T19:00:00-04:00" }))
      .toEqual({ homeTeam: "Hawks", awayTeam: "Tigers", venue: "Memorial Field", gameDate: "2026-09-04T23:00:00.000Z" });
  });

  it("rejects a game against the same team", () => {
    expect(parseNewGame({ homeTeam: "Hawks", awayTeam: "hawks", venue: "Field", gameDate: "2026-09-04" })).toBeNull();
  });

  it("accepts bounded drive data", () => {
    expect(parseNewDrive({ quarter: 4, clock: "0:09", possession: "Hawks", result: "Touchdown", yards: 82, summary: "A late score." }))
      .toMatchObject({ quarter: 4, clock: "0:09", yards: 82 });
  });

  it("rejects invalid clocks and unknown results", () => {
    expect(parseNewDrive({ quarter: 1, clock: "19:90", possession: "Hawks", result: "Safety", yards: 2, summary: "Nope" })).toBeNull();
  });

  it("bounds scores and notes", () => {
    expect(parseScore({ homeScore: 21, awayScore: 17, status: "final" })).toEqual({ homeScore: 21, awayScore: 17, status: "final" });
    expect(parseScore({ homeScore: -1, awayScore: 17, status: "live" })).toBeNull();
    expect(parseNote({ body: "  Great   protection pickup. " })).toBe("Great protection pickup.");
  });
});

