PRAGMA foreign_keys = ON;

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  home_team TEXT NOT NULL CHECK(length(home_team) BETWEEN 1 AND 60),
  away_team TEXT NOT NULL CHECK(length(away_team) BETWEEN 1 AND 60),
  home_score INTEGER NOT NULL DEFAULT 0 CHECK(home_score BETWEEN 0 AND 199),
  away_score INTEGER NOT NULL DEFAULT 0 CHECK(away_score BETWEEN 0 AND 199),
  venue TEXT NOT NULL CHECK(length(venue) BETWEEN 1 AND 100),
  game_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'live', 'final')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(home_team <> away_team)
);

CREATE TABLE drives (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK(sequence > 0),
  quarter INTEGER NOT NULL CHECK(quarter BETWEEN 1 AND 5),
  clock TEXT NOT NULL,
  possession TEXT NOT NULL CHECK(length(possession) BETWEEN 1 AND 60),
  result TEXT NOT NULL CHECK(result IN ('Touchdown', 'Field goal', 'Punt', 'Turnover', 'Turnover on downs', 'End of half')),
  yards INTEGER NOT NULL CHECK(yards BETWEEN -99 AND 99),
  summary TEXT NOT NULL CHECK(length(summary) BETWEEN 1 AND 280),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(game_id, sequence)
);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  drive_id TEXT NOT NULL REFERENCES drives(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_games_status_date ON games(status, game_date DESC);
CREATE INDEX idx_drives_game_sequence ON drives(game_id, sequence DESC);
CREATE INDEX idx_notes_drive_created ON notes(drive_id, created_at);

INSERT INTO games (id, home_team, away_team, home_score, away_score, venue, game_date, status)
VALUES ('demo-game', 'Northside Hawks', 'Riverton Tigers', 14, 10, 'Memorial Field', '2026-09-04T23:00:00.000Z', 'live');

INSERT INTO drives (id, game_id, sequence, quarter, clock, possession, result, yards, summary)
VALUES
  ('demo-drive-1', 'demo-game', 1, 1, '8:42', 'Northside Hawks', 'Touchdown', 68, 'Nine-play opening drive finished by a sweep around the right edge.'),
  ('demo-drive-2', 'demo-game', 2, 2, '3:18', 'Riverton Tigers', 'Field goal', 41, 'Defense held in the red zone after a long return gave Riverton a short field.'),
  ('demo-drive-3', 'demo-game', 3, 3, '6:05', 'Northside Hawks', 'Touchdown', 74, 'Play-action opened the seam for the go-ahead score.');

INSERT INTO notes (id, drive_id, body)
VALUES ('demo-note-1', 'demo-drive-3', 'The safety stepped downhill twice before the deep shot—watch for that look again.');

