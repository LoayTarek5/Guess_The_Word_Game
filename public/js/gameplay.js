"use strict";
(() => {
  // public/ts/gameplay.ts
  var gameId = null;
  var myUserId = null;
  var wordLength = 5;
  var maxTries = 6;
  var currentTurnId = null;
  var gameOver = false;
  var slots = /* @__PURE__ */ new Map();
  function notify(message, type = "info") {
    if (window.mainUtils?.showNotification) {
      window.mainUtils.showNotification(message, type);
    } else {
      console.log(`[${type}] ${message}`);
    }
  }
  function $(id) {
    return document.getElementById(id);
  }
  function getMyUserId() {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      return user.id || user._id || null;
    } catch {
      return null;
    }
  }
  function getGameId() {
    const fromQuery = new URLSearchParams(window.location.search).get("gameId");
    if (fromQuery) return fromQuery;
    return sessionStorage.getItem("activeGameId");
  }
  function buildGrid(grid, rows, cols) {
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
  function renderGuessRow(grid, rowIndex, feedback) {
    if (!grid) return;
    const rows = grid.querySelectorAll(".guess-row");
    const row = rows[rowIndex];
    if (!row) return;
    const boxes = row.querySelectorAll(".letter-box");
    feedback.forEach((cell, i) => {
      const box = boxes[i];
      if (!box) return;
      box.textContent = cell.letter;
      box.classList.remove("correct", "present", "absent", "filled");
      box.classList.add(cell.status);
    });
  }
  function assignSlots(players) {
    slots.clear();
    const me = players.find((p) => p.userId === myUserId);
    const opponent = players.find((p) => p.userId !== myUserId);
    const makeSlot = (player, gridId, scoreId, triesId) => {
      if (!player) return;
      const grid = $(gridId);
      const card = grid ? grid.closest(".player-card") : null;
      slots.set(player.userId, {
        userId: player.userId,
        card,
        grid,
        scoreEl: $(scoreId),
        triesEl: $(triesId),
        nameEl: card ? card.querySelector(".player-name") : null,
        attempt: 0
      });
    };
    makeSlot(me, "your-grid", "your-score", "your-tries");
    makeSlot(opponent, "opponent-grid", "opponent-score", "opponent-tries");
    for (const player of [me, opponent]) {
      if (!player) continue;
      const slot = slots.get(player.userId);
      if (!slot) continue;
      if (slot.nameEl) {
        slot.nameEl.textContent = player.userId === myUserId ? "You" : player.username;
      }
      if (slot.scoreEl) slot.scoreEl.textContent = String(player.score);
      if (slot.triesEl) slot.triesEl.textContent = "0";
      buildGrid(slot.grid, maxTries, wordLength);
    }
  }
  function resetRound() {
    for (const slot of slots.values()) {
      slot.attempt = 0;
      buildGrid(slot.grid, maxTries, wordLength);
      if (slot.triesEl) slot.triesEl.textContent = "0";
    }
    updateGuessCount();
  }
  function updateScore(userId, score) {
    const slot = slots.get(userId);
    if (slot?.scoreEl) slot.scoreEl.textContent = String(score);
  }
  function updateMeta() {
    const timeLimit = $("time-limit");
    const guessTime = $("guess-time");
    if (timeLimit) timeLimit.textContent = `${wordLength}L`;
    if (guessTime) guessTime.textContent = `${maxTries}T`;
    document.querySelectorAll(".player-stats").forEach((el) => {
      el.innerHTML = el.innerHTML.replace(/\/\s*\d+/, `/${maxTries}`);
    });
  }
  function updateGuessCount() {
    const countEl = $("guess-count");
    const mySlot = myUserId ? slots.get(myUserId) : void 0;
    const attempt = mySlot ? mySlot.attempt : 0;
    if (countEl) countEl.textContent = String(Math.min(attempt + 1, maxTries));
  }
  function isMyTurn() {
    return !gameOver && currentTurnId === myUserId;
  }
  function updateTurnUI() {
    const turnText = $("turn-text");
    const input = $("guess-input");
    const submitBtn = $("submit-guess-btn");
    if (turnText) {
      if (gameOver) {
        turnText.textContent = "Game over";
      } else if (isMyTurn()) {
        turnText.textContent = "Your turn";
      } else {
        const current = currentTurnId ? slots.get(currentTurnId) : void 0;
        const name = current && current.nameEl ? current.nameEl.textContent : "Opponent";
        turnText.textContent = `${name}'s turn`;
      }
    }
    const myTurn = isMyTurn();
    if (input) {
      input.disabled = !myTurn;
      if (myTurn) input.focus();
    }
    if (submitBtn) submitBtn.disabled = !myTurn;
    for (const slot of slots.values()) {
      if (!slot.card) continue;
      slot.card.classList.toggle("active-player", slot.userId === currentTurnId);
    }
  }
  function applyState(state) {
    wordLength = state.wordLength;
    maxTries = state.maxTries;
    gameOver = state.status === "completed" || state.status === "abandoned";
    const totalRounds = $("total-rounds");
    const currentRound = $("current-round");
    if (totalRounds) totalRounds.textContent = String(state.settings.roundsToWin);
    if (currentRound) currentRound.textContent = String(state.currentRound);
    assignSlots(state.players);
    for (const player of state.players) {
      const slot = slots.get(player.userId);
      if (slot && slot.triesEl) slot.triesEl.textContent = "0";
    }
    currentTurnId = state.currentTurn.userId;
    updateMeta();
    updateGuessCount();
    updateTurnUI();
    const input = $("guess-input");
    if (input) {
      input.maxLength = wordLength;
      input.placeholder = `Enter your ${wordLength}-letter guess`;
    }
  }
  function handleGuessResult(result) {
    const slot = slots.get(result.userId);
    if (!slot) return;
    renderGuessRow(slot.grid, slot.attempt, result.feedback);
    slot.attempt += 1;
    if (slot.triesEl) slot.triesEl.textContent = String(slot.attempt);
    if (result.userId === myUserId) updateGuessCount();
  }
  function handleTurnChange(data) {
    currentTurnId = data.currentTurn;
    updateTurnUI();
  }
  function handleRoundComplete(data) {
    if (data.winner) {
      updateScore(data.winner.userId, data.winner.score);
      const who = data.winner.userId === myUserId ? "You" : data.winner.username;
      notify(`${who} guessed "${data.word}"!`, "success");
    } else {
      notify(`Round over \u2014 the word was "${data.word}"`, "info");
    }
    if (data.finalScores) {
      for (const fs of data.finalScores) updateScore(fs.userId, fs.score);
    }
    if (data.gameComplete) {
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
  function handleGameOver(data) {
    gameOver = true;
    if (data.finalScores) {
      for (const fs of data.finalScores) updateScore(fs.userId, fs.score);
    }
    let message;
    if (!data.winner) {
      message = "Game over \u2014 it's a draw!";
    } else if (data.winner.userId === myUserId) {
      message = "\u{1F389} You won the game!";
    } else {
      message = `Game over \u2014 ${data.winner.username} won!`;
    }
    notify(message, data.winner?.userId === myUserId ? "success" : "info");
    updateTurnUI();
  }
  function handleTimerUpdate(data) {
    const guessTime = $("guess-time");
    if (guessTime) guessTime.textContent = `${data.timeRemaining}s`;
  }
  function submitGuess() {
    const input = $("guess-input");
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
  function wireInputs() {
    const input = $("guess-input");
    const submitBtn = $("submit-guess-btn");
    submitBtn?.addEventListener("click", submitGuess);
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitGuess();
      }
    });
  }
  function registerSocketListeners() {
    const sm = window.socketManager;
    if (!sm) return;
    sm.on("game:stateUpdate", (state) => applyState(state));
    sm.on("game:started", (data) => {
      if (data.gameId && gameId === data.gameId) {
        window.socketManager?.emit("game:requestState", { gameId });
      }
    });
    sm.on("game:guessResult", (r) => handleGuessResult(r));
    sm.on("game:turnChange", (d) => handleTurnChange(d));
    sm.on(
      "game:roundComplete",
      (d) => handleRoundComplete(d)
    );
    sm.on("game:over", (d) => handleGameOver(d));
    sm.on("game:timerUpdate", (d) => handleTimerUpdate(d));
    sm.on("game:timeExpired", () => notify("Time's up!", "warning"));
    sm.on("game:error", (e) => notify(e.message, "error"));
    sm.on(
      "game:playerDisconnected",
      (p) => notify(`${p.username} disconnected`, "warning")
    );
    sm.on(
      "game:playerReconnected",
      (p) => notify(`${p.username} reconnected`, "info")
    );
  }
  function joinWhenConnected() {
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
  function initializeGame() {
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
})();
