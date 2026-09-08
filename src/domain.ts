export const DRIVE_RESULTS = [
  "Touchdown",
  "Field goal",
  "Punt",
  "Turnover",
  "Turnover on downs",
  "End of half",
] as const;

export const GAME_STATUSES = ["scheduled", "live", "final"] as const;

export type DriveResult = (typeof DRIVE_RESULTS)[number];
export type GameStatus = (typeof GAME_STATUSES)[number];

export type NewGame = {
  homeTeam: string;
  awayTeam: string;
  venue: string;
  gameDate: string;
};

export type NewDrive = {
  quarter: number;
  clock: string;
  possession: string;
  result: DriveResult;
  yards: number;
  summary: string;
};

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length > 0 && cleaned.length <= maxLength ? cleaned : null;
}

export function parseNewGame(value: unknown): NewGame | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const homeTeam = cleanText(body.homeTeam, 60);
  const awayTeam = cleanText(body.awayTeam, 60);
  const venue = cleanText(body.venue, 100);
  const gameDate = cleanText(body.gameDate, 40);

  if (!homeTeam || !awayTeam || !venue || !gameDate || Number.isNaN(Date.parse(gameDate))) {
    return null;
  }
  if (homeTeam.toLocaleLowerCase() === awayTeam.toLocaleLowerCase()) return null;
  return { homeTeam, awayTeam, venue, gameDate: new Date(gameDate).toISOString() };
}

export function parseNewDrive(value: unknown): NewDrive | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const quarter = Number(body.quarter);
  const yards = Number(body.yards);
  const clock = cleanText(body.clock, 8);
  const possession = cleanText(body.possession, 60);
  const summary = cleanText(body.summary, 280);
  const result = cleanText(body.result, 40);

  if (
    !Number.isInteger(quarter) || quarter < 1 || quarter > 5 ||
    !Number.isInteger(yards) || yards < -99 || yards > 99 ||
    !clock || !/^(?:[0-9]|1[0-5]):[0-5][0-9]$/.test(clock) ||
    !possession || !summary || !result ||
    !DRIVE_RESULTS.includes(result as DriveResult)
  ) return null;

  return { quarter, yards, clock, possession, summary, result: result as DriveResult };
}

export function parseScore(value: unknown): { homeScore: number; awayScore: number; status: GameStatus } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const homeScore = Number(body.homeScore);
  const awayScore = Number(body.awayScore);
  const status = body.status;
  if (
    !Number.isInteger(homeScore) || homeScore < 0 || homeScore > 199 ||
    !Number.isInteger(awayScore) || awayScore < 0 || awayScore > 199 ||
    typeof status !== "string" || !GAME_STATUSES.includes(status as GameStatus)
  ) return null;
  return { homeScore, awayScore, status: status as GameStatus };
}

export function parseNote(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  return cleanText((value as Record<string, unknown>).body, 500);
}

