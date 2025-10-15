(() => {
  // Default players (fixed set of 5)
  const defaultPlayers = ["VH", "HA", "Tân", "DyT", "TĐ"];

  // DOM
  const setupSection = document.getElementById("setup");
  const gameSection = document.getElementById("game");
  const playerList = document.getElementById("player-list");
  const startBtn = document.getElementById("start-game");

  // Modal elements
  const confirmModal = document.getElementById("confirm-modal");
  const confirmTitle = document.getElementById("confirm-title");
  const confirmMessage = document.getElementById("confirm-message");
  const confirmOkBtn = document.getElementById("confirm-ok");
  const confirmCancelBtn = document.getElementById("confirm-cancel");

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
  let matchNumber = 0; // Số trận đấu
  let actedThisRound = new Set(); // player names who have acted this round
  let erroredThisRound = new Set(); // player names who have errored this round
  let roundStarterName = null; // player name who started the current round
  let lastActedPlayer = null; // Người vừa đánh xong gần nhất (không reset khi chuyển vòng)
  let lastRoundLastPlayer = null; // Người cuối cùng của vòng trước
  let lastRoundErrors = new Set(); // Những người lỗi ở vòng trước

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
        ${i === currentIndex ? '<span class="tag">Tới lượt</span>' : ""}
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
    // Keep only last 5 entries
    while (logEl.children.length > 5) {
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

  // Custom confirm dialog (Promise-based)
  const customConfirm = (message, title = "Xác nhận") => {
    return new Promise((resolve) => {
      confirmTitle.textContent = title;
      confirmMessage.textContent = message;
      confirmModal.classList.remove("hidden");

      const handleOk = () => {
        confirmModal.classList.add("hidden");
        cleanup();
        resolve(true);
      };

      const handleCancel = () => {
        confirmModal.classList.add("hidden");
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        confirmOkBtn.removeEventListener("click", handleOk);
        confirmCancelBtn.removeEventListener("click", handleCancel);
        confirmModal.removeEventListener("click", handleBackdropClick);
      };

      const handleBackdropClick = (e) => {
        if (
          e.target === confirmModal ||
          e.target.classList.contains("modal-backdrop")
        ) {
          handleCancel();
        }
      };

      confirmOkBtn.addEventListener("click", handleOk);
      confirmCancelBtn.addEventListener("click", handleCancel);
      confirmModal.addEventListener("click", handleBackdropClick);
    });
  };

  const maybeAdvanceRound = () => {
    if (order.length === 0) return;
    // Vòng mới khi tất cả đã acted (thành công hoặc lỗi)
    const totalActed = actedThisRound.size;
    const everyoneActed = totalActed >= order.length;
    if (everyoneActed) {
      roundNumber += 1;
      // Lưu thông tin vòng trước
      lastRoundLastPlayer = lastActedPlayer;
      lastRoundErrors = new Set(erroredThisRound);

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

  // ---------- DnD for setup ----------
  let dragIndex = null;
  let touchDragEl = null;
  let touchStartY = 0;
  let touchCurrentY = 0;
  let isDragging = false;

  // Desktop drag events
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

  // Mobile touch events - simpler approach: track hover, swap on drop
  let lastHoverIndex = null;

  playerList.addEventListener(
    "touchstart",
    (e) => {
      const li = e.target.closest("li");
      if (!li) return;

      touchDragEl = li;
      dragIndex = Number(li.dataset.index);
      lastHoverIndex = dragIndex;
      touchStartY = e.touches[0].clientY;
      isDragging = false;

      li.style.transition = "none";
    },
    { passive: false }
  );

  playerList.addEventListener(
    "touchmove",
    (e) => {
      if (!touchDragEl) return;

      e.preventDefault();
      isDragging = true;
      touchCurrentY = e.touches[0].clientY;
      const deltaY = touchCurrentY - touchStartY;

      // Visual feedback only - don't modify array yet
      touchDragEl.style.transform = `translateY(${deltaY}px)`;
      touchDragEl.style.opacity = "0.7";
      touchDragEl.style.zIndex = "1000";

      // Find what we're hovering over
      touchDragEl.style.pointerEvents = "none";
      const elementBelow = document.elementFromPoint(
        e.touches[0].clientX,
        e.touches[0].clientY
      );
      touchDragEl.style.pointerEvents = "";

      const liBelow = elementBelow?.closest("li");
      if (
        liBelow &&
        liBelow !== touchDragEl &&
        liBelow.dataset.index !== undefined
      ) {
        lastHoverIndex = Number(liBelow.dataset.index);
      }
    },
    { passive: false }
  );

  const finishTouch = (e) => {
    if (
      touchDragEl &&
      isDragging &&
      lastHoverIndex !== null &&
      lastHoverIndex !== dragIndex
    ) {
      // Perform swap
      const updated = [...setupOrder];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(lastHoverIndex, 0, moved);
      setupOrder = updated;
      renderSetupList();
    } else if (touchDragEl) {
      // Just reset styles
      touchDragEl.style.transform = "";
      touchDragEl.style.opacity = "";
      touchDragEl.style.zIndex = "";
      touchDragEl.style.transition = "";
      touchDragEl.style.pointerEvents = "";
    }

    touchDragEl = null;
    dragIndex = null;
    lastHoverIndex = null;
    isDragging = false;
  };

  playerList.addEventListener("touchend", finishTouch, { passive: false });
  playerList.addEventListener("touchcancel", finishTouch, { passive: false });

  // ---------- Actions ----------
  startBtn.addEventListener("click", () => {
    // Initialize a match with the chosen order
    order = [...setupOrder];
    currentIndex = 0;
    movesCount = 0;
    roundNumber = 1;
    matchNumber = 1; // Bắt đầu trận đầu tiên
    lastActedPlayer = null; // Reset người đánh gần nhất
    lastRoundLastPlayer = null;
    lastRoundErrors = new Set();
    resetRound(order[0]);
    history.push({ type: "start", order: snapshotOrder() });
    logEl.innerHTML = "";
    setupSection.classList.add("hidden");
    gameSection.classList.remove("hidden");

    const roundNumEl = document.getElementById("round-number");
    if (roundNumEl) roundNumEl.textContent = String(roundNumber);

    const matchNumEl = document.getElementById("match-number");
    if (matchNumEl) matchNumEl.textContent = String(matchNumber);

    renderOrder();
  });

  const handleError = () => {
    // Người lỗi: mất lượt trong vòng này, người trước được hưởng lợi (nếu chưa lỗi)
    if (order.length <= 1) return;
    const n = order.length;
    const current = order[currentIndex];

    // Đánh dấu người này đã lỗi
    actedThisRound.add(current);
    erroredThisRound.add(current);
    movesCount += 1;

    // Trường hợp đặc biệt: Cú đầu tiên của ván (phá bi) bị lỗi → không swap
    if (movesCount === 1) {
      // Chỉ advance sang người tiếp theo
      lastActedPlayer = current;
      currentIndex = (currentIndex + 1) % n;
      pushLog(`${current} lỗi (phá bi)`);
      maybeAdvanceRound();
      renderOrder();
      return;
    }

    // Tìm người đánh gần nhất trước người hiện tại
    // Nếu chưa có ai đánh (đầu vòng mới), lấy người ở vị trí trước trong array
    const prevIndex = (currentIndex - 1 + n) % n;
    const candidatePrev = lastActedPlayer || order[prevIndex];

    // Luật: Người vừa đánh trước được hưởng lợi NẾU:
    // 1. Chưa lỗi trong vòng này
    // 2. HOẶC nếu là người cuối vòng trước, phải chưa lỗi ở vòng trước
    const erroredInCurrentRound = erroredThisRound.has(candidatePrev);
    const isLastPlayerOfPrevRound = candidatePrev === lastRoundLastPlayer;
    const erroredInPrevRound = lastRoundErrors.has(candidatePrev);

    const shouldSwap =
      !erroredInCurrentRound &&
      !(isLastPlayerOfPrevRound && erroredInPrevRound);

    if (shouldSwap) {
      // Previous được hưởng lợi → swap và được đánh lại
      const prevIdx = order.indexOf(candidatePrev);
      const tmp = order[prevIdx];
      order[prevIdx] = order[currentIndex];
      order[currentIndex] = tmp;

      // Update currentIndex to point to the advantaged player
      currentIndex = prevIdx;

      pushLog(`${current} lỗi → ${candidatePrev} được đánh lại`);
    } else {
      // Previous đã lỗi → không được hưởng lợi, advance
      currentIndex = (currentIndex + 1) % n;
      pushLog(`${current} lỗi`);
    }

    lastActedPlayer = current; // Track người vừa lỗi
    maybeAdvanceRound();
    renderOrder();
  };

  const handleWin = () => {
    // Người thắng: kết thúc ván, người thắng lên đầu cho ván mới
    const winnerIndex = currentIndex;
    const winner = order[winnerIndex];
    const finalThisMatch = snapshotOrder();

    // Rotate người thắng lên đầu tiên
    const nextMatchOrder = rotateToFront(order, winnerIndex);

    pushLog(`🏆 ${winner} thắng! Ván mới bắt đầu`);
    history.push({
      type: "win",
      winner,
      final: finalThisMatch,
      next: nextMatchOrder.join(" "),
    });

    // Bắt đầu ván mới
    order = nextMatchOrder;
    currentIndex = 0;
    movesCount = 0;
    roundNumber = 1;
    matchNumber += 1; // Tăng số trận
    lastActedPlayer = null; // Reset người đánh gần nhất
    lastRoundLastPlayer = null;
    lastRoundErrors = new Set();
    resetRound(order[0]);

    const roundNumEl = document.getElementById("round-number");
    if (roundNumEl) roundNumEl.textContent = String(roundNumber);

    const matchNumEl = document.getElementById("match-number");
    if (matchNumEl) matchNumEl.textContent = String(matchNumber);

    renderOrder();
  };

  const handleSuccess = (shouldRender = true) => {
    // Người chơi đánh thành công (không lỗi) → advance sang người tiếp theo
    const current = order[currentIndex];

    actedThisRound.add(current);
    movesCount += 1;
    lastActedPlayer = current; // Track người vừa đánh xong

    // Advance to next player
    currentIndex = (currentIndex + 1) % order.length;

    pushLog(`${current} ✓`);
    maybeAdvanceRound();

    if (shouldRender) {
      renderOrder();
    }
  };

  // ---------- Quick-select behaviors ----------
  const fastForwardToPlayer = (playerName) => {
    // Advance turn pointer, simulating success for players who haven't acted yet
    let safety = 0;
    while (order[currentIndex] !== playerName && safety < 10_000) {
      const current = order[currentIndex];

      // Nếu người này đã acted (lỗi) rồi → skip
      if (actedThisRound.has(current)) {
        currentIndex = (currentIndex + 1) % order.length;
      } else {
        // Chưa acted → giả định thành công (không render mỗi lần)
        handleSuccess(false);
      }

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

  const applyPickedWin = async (playerName) => {
    if (!order.includes(playerName)) return;

    // Confirm trước khi xác nhận thắng
    const confirmed = await customConfirm(
      `Xác nhận ${playerName} thắng?`,
      "🏆 Chiến thắng"
    );

    if (!confirmed) return;

    // Move turn to this player, simulating successes for those before
    fastForwardToPlayer(playerName);
    // Trigger win flow
    handleWin();
  };

  // Tap vs Long-press detection on list items
  function attachTapHandlers(li, playerName) {
    let pressTimer = null;
    const pressDelay = 3000; // ms (3 seconds to trigger win)

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

  backBtn.addEventListener("click", async () => {
    const confirmed = await customConfirm(
      "Bạn có chắc muốn thoát? Dữ liệu game hiện tại sẽ bị mất.",
      "⚠️ Thoát game"
    );

    if (confirmed) {
      setupSection.classList.remove("hidden");
      gameSection.classList.add("hidden");
      renderSetupList();
    }
  });

  // ---------- Init ----------
  renderSetupList();
})();
