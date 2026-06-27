import type {
  GameStatePayload,
  GameStartedPayload,
  GamePlayerState,
  GuessResultPayload,
  TurnChangePayload,
  RoundCompletePayload,
  GameOverPayload,
  TimerUpdatePayload,
  GameErrorPayload,
  LetterFeedback,
} from "../../types/game.js";

/**
 * Browser client for the word-guessing game. Connects through the shared
 * socketManager, joins the game room, renders the Wordle-style grids and
 * drives guesses + live updates over sockets.
 *
 * Bundled to /js/gameplay.js via `npm run build:client`.
 */

interface SocketManagerLike {
  connected: boolean;
  connect: () => void;
  emit: (event: string, data?: unknown) => void;
  on: (event: string, cb: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    socketManager?: SocketManagerLike;
    mainUtils?: { showNotification: (message: string, type?: string) => void };
    gameUtils?: { initializeGame: () => void };
  }
}

/** A rendered player slot (you or your opponent) on the page. */
interface PlayerSlot {
  userId: string;
  card: HTMLElement | null;
  grid: HTMLElement | null;
  scoreEl: HTMLElement | null;
  triesEl: HTMLElement | null;
  nameEl: HTMLElement | null;
  attempt: number; // number of guesses made this round
}

let gameId: string | null = null;
let myUserId: string | null = null;
let wordLength = 5;
let maxTries = 6;
let currentTurnId: string | null = null;
let gameOver = false;

/** Map of userId -> rendered slot. */
const slots = new Map<string, PlayerSlot>();

function notify(message: string, type: string = "info"): void {
  if (window.mainUtils?.showNotification) {
    window.mainUtils.showNotification(message, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function getMyUserId(): string | null {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.id || user._id || null;
  } catch {
    return null;
  }
}

function getGameId(): string | null {
  const fromQuery = new URLSearchParams(window.location.search).get("gameId");
  if (fromQuery) return fromQuery;
  // Fall back to a value stashed by the room page before navigating.
  return sessionStorage.getItem("activeGameId");
}

/** (Re)build a guess grid as rows x cols empty letter boxes. */
function buildGrid(grid: HTMLElement | null, rows: number, cols: number): void {
  if (!grid) return;
  grid.innerHTML = "";
  for (let r = 0; r < rows; r++) {
    const row = document.createElement("div");
    row.className = "guess-row";
    for (let c = 0; c < cols; c++) {
      const box = document.createElement("div");
      box.className = "letter-box";
      row.appendChild(box);
    }
    grid.appendChild(row);
  }
}

function renderGuessRow(
  grid: HTMLElement | null,
  rowIndex: number,
  feedback: LetterFeedback[]
): void {
  if (!grid) return;
  const rows = grid.querySelectorAll<HTMLElement>(".guess-row");
  const row = rows[rowIndex];
  if (!row) return;
  const boxes = row.querySelectorAll<HTMLElement>(".letter-box");
  feedback.forEach((cell, i) => {
    const box = boxes[i];
    if (!box) return;
    box.textContent = cell.letter;
    box.classList.remove("correct", "present", "absent", "filled");
    box.classList.add(cell.status);
  });
}

/** Assign the two on-page player cards to "you" and the opponent. */
function assignSlots(players: GamePlayerState[]): void {
  slots.clear();

  const me = players.find((p) => p.userId === myUserId);
  const opponent = players.find((p) => p.userId !== myUserId);

  const makeSlot = (
    player: GamePlayerState | undefined,
    gridId: string,
    scoreId: string,
    triesId: string
  ): void => {
    if (!player) return;
    const grid = $(gridId);
    const card = grid ? grid.closest<HTMLElement>(".player-card") : null;
    slots.set(player.userId, {
      userId: player.userId,
      card,
      grid,
      scoreEl: $(scoreId),
      triesEl: $(triesId),
      nameEl: card ? card.querySelector<HTMLElement>(".player-name") : null,
      attempt: 0,
    });
  };

  makeSlot(me, "your-grid", "your-score", "your-tries");
  makeSlot(opponent, "opponent-grid", "opponent-score", "opponent-tries");

  // Label and seed each slot.
  for (const player of [me, opponent]) {
    if (!player) continue;
    const slot = slots.get(player.userId);
    if (!slot) continue;
    if (slot.nameEl) {
      slot.nameEl.textContent =
        player.userId === myUserId ? "You" : player.username;
    }
    if (slot.scoreEl) slot.scoreEl.textContent = String(player.score);
    if (slot.triesEl) slot.triesEl.textContent = "0";
    buildGrid(slot.grid, maxTries, wordLength);
  }
}

/** Reset both grids and per-round counters for a fresh round. */
function resetRound(): void {
  for (const slot of slots.values()) {
    slot.attempt = 0;
    buildGrid(slot.grid, maxTries, wordLength);
    if (slot.triesEl) slot.triesEl.textContent = "0";
  }
  updateGuessCount();
}

function updateScore(userId: string, score: number): void {
  const slot = slots.get(userId);
  if (slot?.scoreEl) slot.scoreEl.textContent = String(score);
}

function updateMeta(): void {
  const timeLimit = $("time-limit");
  const guessTime = $("guess-time");
  if (timeLimit) timeLimit.textContent = `${wordLength}L`;
  if (guessTime) guessTime.textContent = `${maxTries}T`;
  // Reflect max tries in the static "/6" labels.
  document.querySelectorAll(".player-stats").forEach((el) => {
    el.innerHTML = el.innerHTML.replace(/\/\s*\d+/, `/${maxTries}`);
  });
}

function updateGuessCount(): void {
  const countEl = $("guess-count");
  const mySlot = myUserId ? slots.get(myUserId) : undefined;
  const attempt = mySlot ? mySlot.attempt : 0;
  if (countEl) countEl.textContent = String(Math.min(attempt + 1, maxTries));
}

function isMyTurn(): boolean {
  return !gameOver && currentTurnId === myUserId;
}

function updateTurnUI(): void {
  const turnText = $("turn-text");
  const input = $("guess-input") as HTMLInputElement | null;
  const submitBtn = $("submit-guess-btn") as HTMLButtonElement | null;

  if (turnText) {
    if (gameOver) {
      turnText.textContent = "Game over";
    } else if (isMyTurn()) {
      turnText.textContent = "Your turn";
    } else {
      const current = currentTurnId ? slots.get(currentTurnId) : undefined;
      const name =
        current && current.nameEl ? current.nameEl.textContent : "Opponent";
      turnText.textContent = `${name}'s turn`;
    }
  }

  const myTurn = isMyTurn();
  if (input) {
    input.disabled = !myTurn;
    if (myTurn) input.focus();
  }
  if (submitBtn) submitBtn.disabled = !myTurn;

  // Highlight whichever card is active this turn.
  for (const slot of slots.values()) {
    if (!slot.card) continue;
    slot.card.classList.toggle("active-player", slot.userId === currentTurnId);
  }
}

function applyState(state: GameStatePayload): void {
  wordLength = state.wordLength;
  maxTries = state.maxTries;
  gameOver = state.status === "completed" || state.status === "abandoned";

  const totalRounds = $("total-rounds");
  const currentRound = $("current-round");
  if (totalRounds) totalRounds.textContent = String(state.settings.roundsToWin);
  if (currentRound) currentRound.textContent = String(state.currentRound);

  assignSlots(state.players);
  // Restore each player's progress for the current attempt count.
  for (const player of state.players) {
    const slot = slots.get(player.userId);
    if (slot && slot.triesEl) slot.triesEl.textContent = "0";
  }

  currentTurnId = state.currentTurn.userId;
  updateMeta();
  updateGuessCount();
  updateTurnUI();

  const input = $("guess-input") as HTMLInputElement | null;
  if (input) {
    input.maxLength = wordLength;
    input.placeholder = `Enter your ${wordLength}-letter guess`;
  }
}

function handleGuessResult(result: GuessResultPayload): void {
  const slot = slots.get(result.userId);
  if (!slot) return;

  // Fill this player's own next empty row (attempts are shared per round,
  // so track each grid independently to keep guesses top-down).
  renderGuessRow(slot.grid, slot.attempt, result.feedback);
  slot.attempt += 1;
  if (slot.triesEl) slot.triesEl.textContent = String(slot.attempt);
  if (result.userId === myUserId) updateGuessCount();
}

function handleTurnChange(data: TurnChangePayload): void {
  currentTurnId = data.currentTurn;
  updateTurnUI();
}

function handleRoundComplete(data: RoundCompletePayload): void {
  if (data.winner) {
    updateScore(data.winner.userId, data.winner.score);
    const who =
      data.winner.userId === myUserId ? "You" : data.winner.username;
    notify(`${who} guessed "${data.word}"!`, "success");
  } else {
    notify(`Round over — the word was "${data.word}"`, "info");
  }

  if (data.finalScores) {
    for (const fs of data.finalScores) updateScore(fs.userId, fs.score);
  }

  if (data.gameComplete) {
    // game:over will finalise the UI.
    return;
  }

  if (data.nextRound) {
    wordLength = data.nextRound.wordLength;
    currentTurnId = data.nextRound.currentTurn;
    const currentRound = $("current-round");
    if (currentRound) {
      currentRound.textContent = String(data.nextRound.roundNumber);
    }
    resetRound();
    updateMeta();
    updateTurnUI();
  }
}

function handleGameOver(data: GameOverPayload): void {
  gameOver = true;
  if (data.finalScores) {
    for (const fs of data.finalScores) updateScore(fs.userId, fs.score);
  }

  let message: string;
  if (!data.winner) {
    message = "Game over — it's a draw!";
  } else if (data.winner.userId === myUserId) {
    message = "🎉 You won the game!";
  } else {
    message = `Game over — ${data.winner.username} won!`;
  }
  notify(message, data.winner?.userId === myUserId ? "success" : "info");
  updateTurnUI();
}

function handleTimerUpdate(data: TimerUpdatePayload): void {
  const guessTime = $("guess-time");
  if (guessTime) guessTime.textContent = `${data.timeRemaining}s`;
}

function submitGuess(): void {
  const input = $("guess-input") as HTMLInputElement | null;
  if (!input || !gameId) return;

  const guess = input.value.trim().toUpperCase();
  if (!isMyTurn()) {
    notify("It's not your turn yet.", "warning");
    return;
  }
  if (guess.length !== wordLength) {
    notify(`Guess must be ${wordLength} letters.`, "warning");
    return;
  }

  window.socketManager?.emit("game:submitGuess", { gameId, guess });
  input.value = "";
}

function wireInputs(): void {
  const input = $("guess-input") as HTMLInputElement | null;
  const submitBtn = $("submit-guess-btn");

  submitBtn?.addEventListener("click", submitGuess);
  input?.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitGuess();
    }
  });
}

function registerSocketListeners(): void {
  const sm = window.socketManager;
  if (!sm) return;

  sm.on("game:stateUpdate", (state: GameStatePayload) => applyState(state));
  sm.on("game:started", (data: GameStartedPayload) => {
    // A late game:started (e.g. opened before start) — refresh state.
    if (data.gameId && gameId === data.gameId) {
      window.socketManager?.emit("game:requestState", { gameId });
    }
  });
  sm.on("game:guessResult", (r: GuessResultPayload) => handleGuessResult(r));
  sm.on("game:turnChange", (d: TurnChangePayload) => handleTurnChange(d));
  sm.on("game:roundComplete", (d: RoundCompletePayload) =>
    handleRoundComplete(d)
  );
  sm.on("game:over", (d: GameOverPayload) => handleGameOver(d));
  sm.on("game:timerUpdate", (d: TimerUpdatePayload) => handleTimerUpdate(d));
  sm.on("game:timeExpired", () => notify("Time's up!", "warning"));
  sm.on("game:error", (e: GameErrorPayload) => notify(e.message, "error"));
  sm.on("game:playerDisconnected", (p: { username: string }) =>
    notify(`${p.username} disconnected`, "warning")
  );
  sm.on("game:playerReconnected", (p: { username: string }) =>
    notify(`${p.username} reconnected`, "info")
  );
}

/** Emit game:join once the socket is connected. */
function joinWhenConnected(): void {
  const sm = window.socketManager;
  if (!sm) {
    notify("Realtime connection unavailable.", "error");
    return;
  }
  if (sm.connected) {
    sm.emit("game:join", { gameId });
    return;
  }
  sm.connect();
  const timer = window.setInterval(() => {
    if (sm.connected) {
      window.clearInterval(timer);
      sm.emit("game:join", { gameId });
    }
  }, 100);
}

function initializeGame(): void {
  gameId = getGameId();
  myUserId = getMyUserId();

  if (!gameId) {
    notify("No game specified. Returning to lobby.", "error");
    return;
  }
  if (!myUserId) {
    notify("Could not determine your account. Please log in again.", "error");
    return;
  }

  wireInputs();
  registerSocketListeners();
  joinWhenConnected();
}

window.gameUtils = { initializeGame };
