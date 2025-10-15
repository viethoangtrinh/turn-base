(() => {
  // All available players
  const allPlayers = [
    "Việt Hoàng",
    "Hùng Anh",
    "Tân",
    "Duy Thuần",
    "Tấn Đạt",
    "Tuấn",
    "Bảo",
    "Duy Mai",
    "Đạt Đồng",
    "Ánh Ngọc",
  ];

  // Default starting players
  const defaultPlayers = [
    "Việt Hoàng",
    "Hùng Anh",
    "Tân",
    "Duy Thuần",
    "Tấn Đạt",
  ];

  // DOM
  const setupSection = document.getElementById("setup");
  const gameSection = document.getElementById("game");
  const playerList = document.getElementById("player-list");
  const startBtn = document.getElementById("start-game");
  const resetDefaultBtn = document.getElementById("reset-default");

  // Modal elements
  const confirmModal = document.getElementById("confirm-modal");
  const confirmTitle = document.getElementById("confirm-title");
  const confirmMessage = document.getElementById("confirm-message");
  const confirmOkBtn = document.getElementById("confirm-ok");
  const confirmCancelBtn = document.getElementById("confirm-cancel");

  const currentOrderEl = document.getElementById("current-order");
  // Buttons removed in mobile-tap UX; we keep hidden handlers for internal reuse
  const errorBtn = { click: () => handleError() };
  const winBtn = { click: () => handleWin() };
  const backBtn = document.getElementById("action-back");
  const logEl = document.getElementById("log");
  const toggleLogBtn = document.getElementById("toggle-log");

  // Toggle log visibility
  toggleLogBtn.addEventListener("click", () => {
    logEl.classList.toggle("hidden");
    toggleLogBtn.classList.toggle("active");
  });

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
  let breakerPlayer = null; // Người phá bi của trận này
  let playerThemes = {}; // Theme của từng người chơi {playerName: themeName}

  // 5 themes khác nhau
  const themes = [
    { name: "lightning", icon: "⚡", label: "Phá bi" },
    { name: "fire", icon: "🔥", label: "Lửa" },
    { name: "ice", icon: "❄️", label: "Băng" },
    { name: "nature", icon: "🌿", label: "Rừng" },
    { name: "shadow", icon: "🌙", label: "Đêm" },
  ];

  const shuffleThemes = (players) => {
    // Shuffle themes và gán cho người chơi
    const shuffledThemes = [...themes].sort(() => Math.random() - 0.5);
    const themeMap = {};
    players.forEach((player, i) => {
      themeMap[player] = shuffledThemes[i % shuffledThemes.length];
    });
    return themeMap;
  };

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
        <button class="btn-remove" data-index="${i}" title="Xóa"></button>
      `;
      playerList.appendChild(li);
    });

    // Add click handlers for remove buttons
    playerList.querySelectorAll(".btn-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = Number(btn.dataset.index);

        setupOrder.splice(index, 1);
        renderSetupList();
        renderAvailablePlayers();
      });
    });
  };

  const renderAvailablePlayers = () => {
    const availableList = document.getElementById("available-players");
    if (!availableList) return;

    availableList.innerHTML = "";

    // Filter out players already in setupOrder
    const available = allPlayers.filter((name) => !setupOrder.includes(name));

    if (available.length === 0) {
      availableList.innerHTML =
        '<li class="empty-msg">Tất cả người chơi đã được chọn</li>';
      return;
    }

    available.forEach((name) => {
      const li = document.createElement("li");
      li.className = "available-player";

      // Disable if already at max
      const isDisabled = setupOrder.length >= 5;

      li.innerHTML = `
        <span class="pill">${name}</span>
        <button class="btn-add ${
          isDisabled ? "disabled" : ""
        }" data-name="${name}" ${isDisabled ? "disabled" : ""}></button>
      `;
      availableList.appendChild(li);
    });

    // Add click handlers for add buttons
    availableList.querySelectorAll(".btn-add").forEach((btn) => {
      btn.addEventListener("click", () => {
        // Prevent adding if already at maximum
        if (setupOrder.length >= 5) {
          return;
        }

        const name = btn.dataset.name;
        setupOrder.push(name);
        renderSetupList();
        renderAvailablePlayers();
      });
    });
  };

  const renderOrder = () => {
    currentOrderEl.innerHTML = "";
    order.forEach((name, i) => {
      const li = document.createElement("li");

      // Get theme cho người chơi này
      const theme = playerThemes[name];
      const isBreaker = name === breakerPlayer;

      li.innerHTML = `
        <span class="idx">${i + 1}</span>
        <span class="pill tappable pill-theme-${
          theme ? theme.name : "default"
        }" data-name="${name}">${name}</span>
        ${isBreaker ? '<span class="tag breaker-badge">🎱 Phá bi</span>' : ""}
        ${i === currentIndex ? '<span class="tag">Tới lượt</span>' : ""}
      `;
      if (i === currentIndex) li.classList.add("active");
      if (theme) li.classList.add(`theme-${theme.name}`);
      if (isBreaker && theme) li.classList.add(`breaker-animated`);

      // Tap/Long-press handlers per item
      attachTapHandlers(li, name);
      currentOrderEl.appendChild(li);
    });
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
      // Ignore if touching remove button
      if (e.target.closest(".btn-remove")) return;

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
  resetDefaultBtn.addEventListener("click", () => {
    setupOrder = [...defaultPlayers];
    renderSetupList();
    renderAvailablePlayers();
  });

  startBtn.addEventListener("click", async () => {
    // Validate 3-5 players
    if (setupOrder.length < 3) {
      await customConfirm(
        "Cần ít nhất 3 người chơi để bắt đầu.",
        "⚠️ Không đủ người chơi"
      );
      return;
    }

    if (setupOrder.length > 5) {
      await customConfirm(
        "Chỉ được tối đa 5 người chơi.",
        "⚠️ Quá nhiều người chơi"
      );
      return;
    }

    // Initialize a match with the chosen order
    order = [...setupOrder];
    currentIndex = 0;
    movesCount = 0;
    roundNumber = 1;
    matchNumber = 1; // Bắt đầu trận đầu tiên
    breakerPlayer = order[0]; // Người đầu tiên là người phá bi
    playerThemes = shuffleThemes(order); // Random themes cho người chơi
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
    // Người thắng: kết thúc ván, sắp xếp lại cho ván mới
    const winnerIndex = currentIndex;
    const winner = order[winnerIndex];
    const finalThisMatch = snapshotOrder();

    let nextMatchOrder;

    // Trường hợp đặc biệt: vòng 1 và người đầu tiên thắng → giữ nguyên
    if (roundNumber === 1 && winnerIndex === 0) {
      nextMatchOrder = [...order];
    } else {
      // Logic mới:
      // 1. Người thắng (winner) - vị trí 1
      // 2. Người trước người thắng (loser) - vị trí 2
      // 3. Người sau người thắng (waiter) - vị trí 3
      // 4. Các người còn lại xếp ngược từ gần người thắng nhất

      const n = order.length;
      const loserIndex = (winnerIndex - 1 + n) % n; // wrap around
      const waiterIndex = (winnerIndex + 1) % n; // wrap around

      const loser = order[loserIndex];
      const waiter = order[waiterIndex];

      // Lấy các người còn lại (không phải winner, loser, waiter)
      const others = [];
      for (let i = 0; i < n; i++) {
        if (i !== winnerIndex && i !== loserIndex && i !== waiterIndex) {
          others.push(order[i]);
        }
      }

      // Sắp xếp others: người xa winner nhất đi trước, người gần nhất đi cuối
      // Tính khoảng cách từ mỗi người tới winner (theo chiều ngược kim đồng hồ)
      const othersWithDistance = others.map((name) => {
        const idx = order.indexOf(name);
        const distance = (winnerIndex - idx + n) % n;
        return { name, distance };
      });

      // Sort giảm dần theo distance (xa winner nhất trước, gần nhất cuối)
      othersWithDistance.sort((a, b) => b.distance - a.distance);
      const sortedOthers = othersWithDistance.map((o) => o.name);

      // Xếp lại: winner - loser - waiter - others
      nextMatchOrder = [winner, loser, waiter, ...sortedOthers];
    }

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
    breakerPlayer = order[0]; // Người thắng là người phá bi ván mới
    playerThemes = shuffleThemes(order); // Random themes mới
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
    let longPressTriggered = false; // Flag để track long-press đã trigger chưa
    const pressDelay = 1000; // ms (1 second to trigger win)

    const onTap = (e) => {
      e.preventDefault();
      // Nếu long-press vừa trigger, không làm gì
      if (longPressTriggered) {
        longPressTriggered = false;
        return;
      }
      applyPickedError(playerName);
    };

    const onPressStart = () => {
      li.classList.add("li-pressing");
      longPressTriggered = false; // Reset flag
      pressTimer = setTimeout(() => {
        longPressTriggered = true; // Đánh dấu long-press đã trigger
        applyPickedWin(playerName);
        cleanup();
      }, pressDelay);
    };

    const onPressEnd = (e) => {
      e.preventDefault();

      // Nếu long-press đã trigger, không làm gì thêm
      if (longPressTriggered) {
        cleanup();
        return;
      }

      // Nếu vẫn còn timer (chưa đủ 3s), cancel và trigger error
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
        applyPickedError(playerName);
      }
      cleanup();
    };

    const onCancel = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      longPressTriggered = false;
      cleanup();
    };

    const cleanup = () => {
      li.classList.remove("li-pressing");
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
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
      renderAvailablePlayers();
    }
  });

  // ---------- Init ----------
  renderSetupList();
  renderAvailablePlayers();
})();
