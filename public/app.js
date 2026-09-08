const state = { games: [], selectedId: null, detail: null };
const $ = (id) => document.getElementById(id);
const statusEl = $("status");

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function setStatus(message = "", error = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", error);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function renderGames() {
  $("game-count").textContent = String(state.games.length);
  $("game-list").replaceChildren(...state.games.map((game) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `game-button${game.id === state.selectedId ? " active" : ""}`;
    const teams = document.createElement("strong");
    teams.textContent = `${game.away_team} at ${game.home_team}`;
    const meta = document.createElement("small");
    meta.textContent = `${game.status} · ${game.away_score}–${game.home_score} · ${game.drive_count} drives`;
    button.append(teams, meta);
    button.addEventListener("click", () => selectGame(game.id));
    return button;
  }));
}

function noteElement(note) {
  const node = document.createElement("div");
  node.className = "note";
  node.textContent = note.body;
  return node;
}

function renderDetail() {
  const { game, drives, notes } = state.detail;
  $("workspace").hidden = false;
  $("away-team").textContent = game.away_team;
  $("home-team").textContent = game.home_team;
  $("away-score").textContent = String(game.away_score);
  $("home-score").textContent = String(game.home_score);
  $("away-score-input").value = String(game.away_score);
  $("home-score-input").value = String(game.home_score);
  $("status-input").value = game.status;
  $("game-venue").textContent = `${game.venue} · ${formatDate(game.game_date)}`;
  $("game-quarter").textContent = game.status === "final" ? "FINAL" : game.status === "scheduled" ? "SOON" : "LIVE";
  $("game-status").textContent = game.status;
  $("game-status").className = `live-pill ${game.status}`;
  $("possession").replaceChildren(...[game.away_team, game.home_team].map((team) => new Option(team, team)));
  $("drive-count").textContent = `${drives.length} drive${drives.length === 1 ? "" : "s"}`;

  const noteMap = new Map();
  notes.forEach((note) => noteMap.set(note.drive_id, [...(noteMap.get(note.drive_id) || []), note]));
  const cards = drives.map((drive) => {
    const card = $("drive-template").content.firstElementChild.cloneNode(true);
    card.querySelector(".drive-sequence").textContent = `#${drive.sequence}`;
    card.querySelector(".drive-possession").textContent = drive.possession;
    card.querySelector(".drive-time").textContent = `Q${drive.quarter} · ${drive.clock}`;
    card.querySelector(".result-pill").textContent = drive.result;
    card.querySelector(".drive-summary").textContent = drive.summary;
    card.querySelector(".drive-yards").textContent = `${drive.yards >= 0 ? "+" : ""}${drive.yards} yards`;
    card.querySelector(".notes").replaceChildren(...(noteMap.get(drive.id) || []).map(noteElement));
    card.querySelector(".note-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = event.currentTarget.querySelector("input");
      try {
        setStatus("Saving note…");
        await api(`/api/drives/${drive.id}/notes`, { method: "POST", body: JSON.stringify({ body: input.value }) });
        input.value = "";
        await selectGame(state.selectedId);
        setStatus("Sideline note saved.");
      } catch (error) { setStatus(error.message, true); }
    });
    return card;
  });
  $("drive-list").replaceChildren(...(cards.length ? cards : [Object.assign(document.createElement("div"), { className: "empty", textContent: "No drives yet. Log the opening possession." })]));
}

async function selectGame(id) {
  state.selectedId = id;
  renderGames();
  try {
    state.detail = await api(`/api/games/${id}`);
    renderDetail();
    setStatus();
  } catch (error) { setStatus(error.message, true); }
}

async function loadGames(preferredId) {
  try {
    const data = await api("/api/games");
    state.games = data.games;
    renderGames();
    const id = preferredId || state.selectedId || state.games[0]?.id;
    if (id) await selectGame(id);
    else { $("workspace").hidden = true; setStatus("Create the first game to begin."); }
  } catch (error) { setStatus(error.message, true); }
}

$("score-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    setStatus("Updating scoreboard…");
    await api(`/api/games/${state.selectedId}/score`, { method: "PATCH", body: JSON.stringify({ homeScore: Number($("home-score-input").value), awayScore: Number($("away-score-input").value), status: $("status-input").value }) });
    await loadGames(state.selectedId);
    setStatus("Scoreboard updated.");
  } catch (error) { setStatus(error.message, true); }
});

$("drive-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    setStatus("Adding drive…");
    await api(`/api/games/${state.selectedId}/drives`, { method: "POST", body: JSON.stringify({ quarter: Number($("quarter").value), clock: $("clock").value, possession: $("possession").value, result: $("result").value, yards: Number($("yards").value), summary: $("summary").value }) });
    form.reset();
    $("yards").value = "0";
    await loadGames(state.selectedId);
    setStatus("Drive added to the timeline.");
  } catch (error) { setStatus(error.message, true); }
});

const dialog = $("new-game-dialog");
$("new-game-button").addEventListener("click", () => { $("new-date").value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16); dialog.showModal(); });
$("close-dialog").addEventListener("click", () => dialog.close());
$("new-game-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    setStatus("Creating game…");
    const { game } = await api("/api/games", { method: "POST", body: JSON.stringify({ awayTeam: $("new-away").value, homeTeam: $("new-home").value, venue: $("new-venue").value, gameDate: new Date($("new-date").value).toISOString() }) });
    dialog.close();
    form.reset();
    await loadGames(game.id);
    setStatus("New live game created.");
  } catch (error) { setStatus(error.message, true); }
});

loadGames();
