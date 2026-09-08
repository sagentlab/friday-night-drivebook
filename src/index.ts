import { parseNewDrive, parseNewGame, parseNote, parseScore } from "./domain";

type GameRow = {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  venue: string;
  game_date: string;
  status: string;
  created_at: string;
};

type DriveRow = {
  id: string;
  game_id: string;
  sequence: number;
  quarter: number;
  clock: string;
  possession: string;
  result: string;
  yards: number;
  summary: string;
  created_at: string;
};

type NoteRow = { id: string; drive_id: string; body: string; created_at: string };

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 16_384) throw new Error("request_too_large");
  return request.json();
}

async function listGames(env: Env): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT g.*, COUNT(DISTINCT d.id) AS drive_count, COUNT(n.id) AS note_count
    FROM games g
    LEFT JOIN drives d ON d.game_id = g.id
    LEFT JOIN notes n ON n.drive_id = d.id
    GROUP BY g.id
    ORDER BY CASE g.status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END, g.game_date DESC
    LIMIT 30
  `).all<GameRow & { drive_count: number; note_count: number }>();
  return json({ games: result.results });
}

async function createGame(request: Request, env: Env): Promise<Response> {
  const input = parseNewGame(await readJson(request));
  if (!input) return json({ error: "Enter two different teams, a venue, and a valid date." }, 400);
  const id = crypto.randomUUID();
  const game = await env.DB.prepare(`
    INSERT INTO games (id, home_team, away_team, venue, game_date, status)
    VALUES (?1, ?2, ?3, ?4, ?5, 'live')
    RETURNING *
  `).bind(id, input.homeTeam, input.awayTeam, input.venue, input.gameDate).first<GameRow>();
  return json({ game }, 201);
}

async function getGame(gameId: string, env: Env): Promise<Response> {
  const results = await env.DB.batch([
    env.DB.prepare("SELECT * FROM games WHERE id = ?1").bind(gameId),
    env.DB.prepare("SELECT * FROM drives WHERE game_id = ?1 ORDER BY sequence DESC").bind(gameId),
    env.DB.prepare(`
      SELECT n.* FROM notes n
      JOIN drives d ON d.id = n.drive_id
      WHERE d.game_id = ?1
      ORDER BY n.created_at ASC
    `).bind(gameId),
  ]);
  const gameResult = results[0];
  const drivesResult = results[1];
  const notesResult = results[2];
  if (!gameResult || !drivesResult || !notesResult) {
    throw new Error("incomplete_database_batch");
  }
  const game = gameResult.results[0] as GameRow | undefined;
  if (!game) return json({ error: "Game not found." }, 404);
  return json({ game, drives: drivesResult.results as DriveRow[], notes: notesResult.results as NoteRow[] });
}

async function updateScore(gameId: string, request: Request, env: Env): Promise<Response> {
  const input = parseScore(await readJson(request));
  if (!input) return json({ error: "Scores must be whole numbers from 0–199 and status must be valid." }, 400);
  const game = await env.DB.prepare(`
    UPDATE games SET home_score = ?1, away_score = ?2, status = ?3, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?4 RETURNING *
  `).bind(input.homeScore, input.awayScore, input.status, gameId).first<GameRow>();
  return game ? json({ game }) : json({ error: "Game not found." }, 404);
}

async function createDrive(gameId: string, request: Request, env: Env): Promise<Response> {
  const input = parseNewDrive(await readJson(request));
  if (!input) return json({ error: "Check the quarter, clock, result, yards, possession, and summary." }, 400);
  const id = crypto.randomUUID();
  const drive = await env.DB.prepare(`
    INSERT INTO drives (id, game_id, sequence, quarter, clock, possession, result, yards, summary)
    SELECT ?1, ?2, COALESCE(MAX(sequence), 0) + 1, ?3, ?4, ?5, ?6, ?7, ?8
    FROM drives WHERE game_id = ?2
    RETURNING *
  `).bind(id, gameId, input.quarter, input.clock, input.possession, input.result, input.yards, input.summary).first<DriveRow>();
  return json({ drive }, 201);
}

async function createNote(driveId: string, request: Request, env: Env): Promise<Response> {
  const body = parseNote(await readJson(request));
  if (!body) return json({ error: "A note is required and must be 500 characters or fewer." }, 400);
  const note = await env.DB.prepare(`
    INSERT INTO notes (id, drive_id, body) SELECT ?1, id, ?2 FROM drives WHERE id = ?3 RETURNING *
  `).bind(crypto.randomUUID(), body, driveId).first<NoteRow>();
  return note ? json({ note }, 201) : json({ error: "Drive not found." }, 404);
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.pathname === "/api/health" && request.method === "GET") {
    await env.DB.prepare("SELECT 1").first();
    return json({ ok: true, database: "connected" });
  }
  if (url.pathname === "/api/games") {
    if (request.method === "GET") return listGames(env);
    if (request.method === "POST") return createGame(request, env);
  }
  if (parts[0] === "api" && parts[1] === "games" && parts[2]) {
    if (parts.length === 3 && request.method === "GET") return getGame(parts[2], env);
    if (parts[3] === "score" && request.method === "PATCH") return updateScore(parts[2], request, env);
    if (parts[3] === "drives" && request.method === "POST") return createDrive(parts[2], request, env);
  }
  if (parts[0] === "api" && parts[1] === "drives" && parts[2] && parts[3] === "notes" && request.method === "POST") {
    return createNote(parts[2], request, env);
  }
  return json({ error: "Not found." }, 404);
}

export default {
  async fetch(request, env): Promise<Response> {
    try {
      if (new URL(request.url).pathname.startsWith("/api/")) return await route(request, env);
      return await env.ASSETS.fetch(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      const status = message === "request_too_large" ? 413 : 500;
      console.error(JSON.stringify({ message: "request failed", error: message, path: new URL(request.url).pathname }));
      return json({ error: status === 413 ? "Request body is too large." : "Something went wrong. Try again." }, status);
    }
  },
} satisfies ExportedHandler<Env>;
