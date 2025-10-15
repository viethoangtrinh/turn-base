(() => {
  // Default players (fixed set of 5)
  const defaultPlayers = ["VH", "HA", "Tân", "DyT", "TĐ"];

  // DOM
  const setupSection = document.getElementById("setup");
  const gameSection = document.getElementById("game");
  const playerList = document.getElementById("player-list");
  const resetDefaultBtn = document.getElementById("reset-default");
  const startBtn = document.getElementById("start-game");

  const currentOrderEl = document.getElementById("current-order");
  const currentPlayerEl = document.getElementById("current-player");
  // Buttons removed in mobile-tap UX; we keep hidden handlers for internal reuse
  const errorBtn = { click: () => handleError() };
  const winBtn = { click: () => handleWin() };
  const backBtn = document.getElementById("action-back");
  const logEl = document.getElementById("log");
  // Quick-select controls
  let errorSelect, errorApplyBtn, winSelect, winApplyBtn;

  // State
  let setupOrder = [...defaultPlayers];
  let order = [];
  let currentIndex = 0; // whose turn in `order`
  const history = [];
  // Round/match state
  let movesCount = 0; // number of turns taken in current match
  let roundNumber = 1;
  let actedThisRound = new Set(); // player names who have acted this round
  let erroredThisRound = new Set(); // player names who have errored this round
  let roundStarterName = null; // player name who started the current round

  // ---------- Helpers ----------
  const renderSetupList = () => {
    playerList.innerHTML = "";
    setupOrder.forEach((name, i) => {
      const li = document.createElement("li");
      li.draggable = true;
      li.dataset.index = String(i);
      li.innerHTML = `
        <span class="idx">${i + 1}</span>
        <span class="pill">${name}</span>
        <span class="drag-handle" title="Kéo để đổi vị trí"></span>
      `;
      playerList.appendChild(li);
    });
  };

  const renderOrder = () => {
    currentOrderEl.innerHTML = "";
    order.forEach((name, i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="idx">${i + 1}</span>
        <span class="pill tappable" data-name="${name}">${name}</span>
        ${i === currentIndex ? '<span class="tag">Đang lượt</span>' : ""}
      `;
      if (i === currentIndex) li.classList.add("active");
      // Tap/Long-press handlers per item
      attachTapHandlers(li, name);
      currentOrderEl.appendChild(li);
    });
    currentPlayerEl.textContent = order[currentIndex] ?? "";
  };

  const pushLog = (text) => {
    const li = document.createElement("li");
    li.textContent = text;
    logEl.prepend(li);
    // Keep only last 3 entries
    while (logEl.children.length > 3) {
      logEl.removeChild(logEl.lastChild);
    }
  };

  const rotateToFront = (arr, index) => {
    const n = arr.length;
    const idx = ((index % n) + n) % n;
    return [...arr.slice(idx), ...arr.slice(0, idx)];
  };

  const snapshotOrder = () => order.join(" ");

  const resetRound = (starterName) => {
    actedThisRound = new Set();
    erroredThisRound = new Set();
    roundStarterName = starterName;
  };

  const maybeAdvanceRound = () => {
    if (order.length === 0) return;
    const everyoneActed = actedThisRound.size >= order.length;
    if (everyoneActed) {
      roundNumber += 1;
      // New round starts from the current turn holder
      resetRound(order[currentIndex]);
      const roundNumEl = document.getElementById("round-number");
      const roundIndicator = document.getElementById("round-indicator");
      if (roundNumEl) roundNumEl.textContent = String(roundNumber);
      if (roundIndicator) {
        roundIndicator.classList.add("round-ping");
        setTimeout(() => roundIndicator.classList.remove("round-ping"), 450);
      }
    }
  };

  const forceAdvanceRound = () => {
    // Manual confirmation to proceed to next round
    if (order.length === 0) return;
    roundNumber += 1;
    resetRound(order[currentIndex]);
    const roundNumEl = document.getElementById("round-number");
    const roundIndicator = document.getElementById("round-indicator");
    if (roundNumEl) roundNumEl.textContent = String(roundNumber);
    if (roundIndicator) {
      roundIndicator.classList.add("round-ping");
      setTimeout(() => roundIndicator.classList.remove("round-ping"), 450);
    }
    pushLog(`Xác nhận sang vòng ${roundNumber}`);
  };

  // ---------- DnD for setup ----------
  let dragIndex = null;
  playerList.addEventListener("dragstart", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    dragIndex = Number(li.dataset.index);
  });
  playerList.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  playerList.addEventListener("drop", (e) => {
    e.preventDefault();
    const li = e.target.closest("li");
    if (!li) return;
    const dropIndex = Number(li.dataset.index);
    if (dragIndex === null || dropIndex === dragIndex) return;
    const updated = [...setupOrder];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(dropIndex, 0, moved);
    setupOrder = updated;
    renderSetupList();
  });

  // ---------- Actions ----------
  resetDefaultBtn.addEventListener("click", () => {
    setupOrder = [...defaultPlayers];
    renderSetupList();
  });

  startBtn.addEventListener("click", () => {
    // Initialize a match with the chosen order
    order = [...setupOrder];
    currentIndex = 0;
    movesCount = 0;
    roundNumber = 1;
    resetRound(order[0]);
    history.push({ type: "start", order: snapshotOrder() });
    logEl.innerHTML = "";
    setupSection.classList.add("hidden");
    gameSection.classList.remove("hidden");
    const roundNumEl = document.getElementById("round-number");
    if (roundNumEl) roundNumEl.textContent = String(roundNumber);
    const roundIndicator = document.getElementById("round-indicator");
    if (roundIndicator) {
      roundIndicator.onclick = () => forceAdvanceRound();
      roundIndicator.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          forceAdvanceRound();
        },
        { passive: false }
      );
    }
    renderOrder();
  });

  const handleError = () => {
    // Error: swap current with previous, then next player is the one after the error turn
    if (order.length <= 1) return;
    const n = order.length;
    const current = order[currentIndex];
    const prevIndex = (currentIndex - 1 + n) % n;
    const nextIndex = (currentIndex + 1) % n;
    const prevPlayer = order[prevIndex];
    const nextPlayer = order[nextIndex];

    movesCount += 1;
    actedThisRound.add(current);
    erroredThisRound.add(current);

    // Case: very first move of match errors → NO SWAP, just advance
    if (movesCount === 1) {
      currentIndex = nextIndex;
      pushLog(`${current} lỗi`);
      maybeAdvanceRound();
      renderOrder();
      return;
    }

    // General rule: swap with previous unless previous has already errored this round
    if (!erroredThisRound.has(prevPlayer)) {
      // swap current with previous; advantaged previous plays immediately
      const tmp = order[prevIndex];
      order[prevIndex] = order[currentIndex];
      order[currentIndex] = tmp;
      // keep currentIndex pointing at advantaged player (now at currentIndex)
    } else {
      // previous already errored → swap with next; advantaged next plays immediately
      const tmp = order[nextIndex];
      order[nextIndex] = order[currentIndex];
      order[currentIndex] = tmp;
      // keep currentIndex pointing to the advantaged player now at currentIndex
    }

    pushLog(`${current} lỗi`);
    maybeAdvanceRound();
    renderOrder();
  };

  const handleWin = () => {
    // Winner is the current player; rotate order so winner goes first for next match
    const winnerIndex = currentIndex;
    const winner = order[winnerIndex];
    const finalThisMatch = snapshotOrder();
    const nextMatchOrder = rotateToFront(order, winnerIndex);
    pushLog(`${winner} thắng`);
    history.push({
      type: "win",
      winner,
      final: finalThisMatch,
      next: nextMatchOrder.join(" "),
    });

    // Start new match with rotated order
    order = nextMatchOrder;
    currentIndex = 0;
    movesCount = 0;
    roundNumber = 1;
    resetRound(order[0]);
    const roundNumEl = document.getElementById("round-number");
    if (roundNumEl) roundNumEl.textContent = String(roundNumber);
    renderOrder();
  };

  // ---------- Quick-select behaviors ----------
  const fastForwardToPlayer = (playerName) => {
    // Advance turn pointer as if players before have acted successfully this round
    let safety = 0;
    while (order[currentIndex] !== playerName && safety < 10_000) {
      const current = order[currentIndex];
      // simulate success turn advancement
      actedThisRound.add(current);
      pushLog(`${current} không lỗi`);
      currentIndex = (currentIndex + 1) % order.length;
      safety++;
    }
  };

  const applyPickedError = (playerName) => {
    if (!order.includes(playerName)) return;
    // Fast-forward so that it's this player's turn to error
    fastForwardToPlayer(playerName);
    // Now trigger error with existing rules
    handleError();
  };

  const applyPickedWin = (playerName) => {
    if (!order.includes(playerName)) return;
    // Move turn to this player, simulating successes for those before
    fastForwardToPlayer(playerName);
    // Trigger win flow
    handleWin();
  };

  // Tap vs Long-press detection on list items
  function attachTapHandlers(li, playerName) {
    let pressTimer = null;
    const pressDelay = 5000; // ms (5 seconds to trigger win)

    const onTap = (e) => {
      e.preventDefault();
      applyPickedError(playerName);
    };

    const onPressStart = () => {
      li.classList.add("li-pressing");
      pressTimer = setTimeout(() => {
        applyPickedWin(playerName);
        cleanup();
      }, pressDelay);
    };

    const onPressEnd = (e) => {
      e.preventDefault();
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
        // Consider this a tap if it ends before delay
        applyPickedError(playerName);
      }
      cleanup();
    };

    const onCancel = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      cleanup();
    };

    const cleanup = () => {
      li.classList.remove("li-pressing");
    };

    // Touch events for mobile
    li.addEventListener("touchstart", onPressStart, { passive: true });
    li.addEventListener("touchend", onPressEnd, { passive: false });
    li.addEventListener("touchcancel", onCancel, { passive: true });

    // Mouse events as fallback
    li.addEventListener("mousedown", onPressStart);
    li.addEventListener("mouseleave", onCancel);
    li.addEventListener("mouseup", onPressEnd);
    li.addEventListener("click", onTap);
  }

  backBtn.addEventListener("click", () => {
    setupSection.classList.remove("hidden");
    gameSection.classList.add("hidden");
    renderSetupList();
  });

  // ---------- Init ----------
  renderSetupList();
})();
