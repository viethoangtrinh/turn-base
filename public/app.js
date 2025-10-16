(() => {
  // Socket.IO connection
  const socket = io();
  let currentUser = { username: "Guest", role: "guest" };
  let isConnected = false;

  // Socket event listeners
  socket.on("connect", () => {
    console.log("✅ Connected to server");
    isConnected = true;
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected from server");
    isConnected = false;
  });

  socket.on("auth:status", (user) => {
    currentUser = user;
    console.log(`👤 Logged in as: ${user.username} (${user.role})`);
  });

  socket.on("error", (data) => {
    console.error("Socket error:", data.message);
    alert(`Lỗi: ${data.message}`);
  });

  // Listen for real-time game updates
  socket.on("game:updated", (gameState) => {
    console.log("📡 Game updated:", gameState);

    // Update local state from server
    if (gameState.order && Array.isArray(gameState.order)) {
      order = [...gameState.order];
      currentIndex = gameState.currentIndex || 0;
      roundNumber = gameState.roundNumber || 1;
      matchNumber = gameState.matchNumber || 1;
      movesCount = gameState.movesCount || 0;
      actedThisRound = new Set(gameState.actedThisRound || []);
      erroredThisRound = new Set(gameState.erroredThisRound || []);
      breakerPlayer = gameState.breakerPlayer || null;

      // Update UI if in game
      if (!gameSection.classList.contains("hidden")) {
        renderOrder();

        const roundNumEl = document.getElementById("round-number");
        if (roundNumEl) roundNumEl.textContent = String(roundNumber);

        const matchNumEl = document.getElementById("match-number");
        if (matchNumEl) matchNumEl.textContent = String(matchNumber);
      }
    }
  });

  socket.on("game:win", (data) => {
    console.log("🏆 Winner:", data.winner);
    pushLog(`🏆 ${data.winner} thắng! Ván mới bắt đầu`);
  });

  // Players will be loaded from API
  let allPlayers = [];
  let defaultPlayers = [];

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
        <div class="controls">
          <span class="drag-handle" title="Kéo để đổi vị trí"></span>
          <button class="btn-remove" data-index="${i}" title="Xóa"></button>
        </div>
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
        <div class="swipe-content">
          <span class="idx">${i + 1}</span>
          <span class="pill tappable pill-theme-${
            theme ? theme.name : "default"
          }" data-name="${name}">${name}</span>
          ${isBreaker ? '<span class="tag breaker-badge">🎱 Phá bi</span>' : ""}
          ${i === currentIndex ? '<span class="tag">Tới lượt</span>' : ""}
        </div>
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
    li.textContent = `[Vòng ${roundNumber}] ${text}`;
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
    // KHÔNG reset erroredThisRound - người lỗi vẫn giữ trạng thái lỗi
    // erroredThisRound = new Set();
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
    // Check if user is admin
    if (currentUser.role !== "admin") {
      await customConfirm(
        "Chỉ admin mới có thể bắt đầu game. Vui lòng đăng nhập.",
        "⚠️ Không có quyền"
      );
      return;
    }

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

    // Emit socket event to start game
    socket.emit("game:start", { order: setupOrder });

    // Initialize local state
    order = [...setupOrder];
    currentIndex = 0;
    movesCount = 0;
    roundNumber = 1;
    matchNumber = 1;
    breakerPlayer = order[0];
    playerThemes = shuffleThemes(order);
    lastActedPlayer = null;
    lastRoundLastPlayer = null;
    lastRoundErrors = new Set();
    erroredThisRound = new Set();
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

    // Logic: chỉ kiểm tra người NGAY TRƯỚC trong danh sách
    const prevIndex = (currentIndex - 1 + n) % n;
    const prevPlayer = order[prevIndex];

    // Kiểm tra: người trước có được hưởng lợi không?
    // Điều kiện: chưa lỗi (erroredThisRound giờ track lỗi xuyên vòng, chỉ xóa khi đánh thành công)
    const prevErrored = erroredThisRound.has(prevPlayer);

    if (!prevErrored) {
      // Swap: người lỗi với người trước
      // TRƯỚC swap: currentIndex=3 (Tân), prevIndex=2 (Duy Thuần)
      const tmp = order[prevIndex];
      order[prevIndex] = order[currentIndex];
      order[currentIndex] = tmp;
      // SAU swap: currentIndex=3 (Duy Thuần), prevIndex=2 (Tân)

      // currentIndex không đổi, vẫn chỉ vào người được hưởng lợi (Duy Thuần ở vị trí 3)

      pushLog(`${current} lỗi → ${prevPlayer} được đánh lại`);
    } else {
      // Người trước đã lỗi → không swap, advance sang người tiếp theo
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
    erroredThisRound = new Set(); // Reset trạng thái lỗi
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

    // Xóa trạng thái lỗi của người này (nếu có)
    erroredThisRound.delete(current);

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
    // Chỉ advance đến người được chọn, không advance quá
    let safety = 0;
    while (order[currentIndex] !== playerName && safety < 10_000) {
      const current = order[currentIndex];

      // Nếu người này đã acted (lỗi) rồi → skip
      if (actedThisRound.has(current)) {
        currentIndex = (currentIndex + 1) % order.length;
      } else {
        // Chưa acted → giả định thành công (chỉ update state, không render)
        actedThisRound.add(current);
        movesCount += 1; // Tăng movesCount để không bị nhầm với cú phá bi
        currentIndex = (currentIndex + 1) % order.length;
        pushLog(`${current} không lỗi`);
      }

      safety++;
    }
  };

  let isProcessing = false; // Flag để ngăn multiple calls

  const applyPickedError = (playerName) => {
    if (!order.includes(playerName)) return;
    if (isProcessing) return; // Ngăn gọi nhiều lần
    if (currentUser.role !== "admin") {
      alert("Chỉ admin mới có thể thao tác");
      return;
    }

    isProcessing = true;

    // Fast-forward so that it's this player's turn to error
    fastForwardToPlayer(playerName);

    // Emit socket event for error
    socket.emit("game:error", { playerName });

    // Now trigger error with existing rules (local update)
    handleError();

    // Delay reset để đảm bảo render xong
    setTimeout(() => {
      isProcessing = false;
    }, 300);
  };

  const applyPickedWin = async (playerName) => {
    if (!order.includes(playerName)) return;
    if (currentUser.role !== "admin") {
      alert("Chỉ admin mới có thể thao tác");
      return;
    }

    // Confirm trước khi xác nhận thắng
    const confirmed = await customConfirm(
      `Xác nhận ${playerName} thắng?`,
      "🏆 Chiến thắng"
    );

    if (!confirmed) return;

    // Move turn to this player, simulating successes for those before
    fastForwardToPlayer(playerName);

    // Emit socket event for win
    socket.emit("game:win", { playerName });

    // Trigger win flow (local update)
    handleWin();
  };

  // Tap vs Swipe-left detection on list items
  function attachTapHandlers(li, playerName) {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isSwiping = false;
    let swipeTriggered = false;

    // Create swipe indicator overlay
    const swipeIndicator = document.createElement("div");
    swipeIndicator.className = "swipe-win-indicator";
    swipeIndicator.innerHTML = '<span class="swipe-win-text">🏆</span>';
    li.appendChild(swipeIndicator);

    const swipeContent = li.querySelector(".swipe-content");

    const onTouchStart = (e) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      currentX = startX;
      isSwiping = false;
      swipeTriggered = false;
    };

    const onTouchMove = (e) => {
      if (swipeTriggered) return;

      const touch = e.touches[0];
      currentX = touch.clientX;
      const currentY = touch.clientY;

      const diffX = currentX - startX;
      const diffY = Math.abs(currentY - startY);

      // Chỉ detect horizontal swipe (không phải vertical scroll)
      if (Math.abs(diffX) > 10 && diffY < 30) {
        // Chỉ preventDefault khi chắc chắn là horizontal swipe
        if (e.cancelable) {
          e.preventDefault();
        }
        isSwiping = true;

        // Visual feedback khi swipe left
        if (diffX < 0) {
          const swipeAmount = Math.abs(diffX);
          const indicatorOpacity = Math.min(swipeAmount / 80, 1);

          swipeContent.style.transform = `translateX(${diffX}px)`;
          swipeContent.style.transition = "none";

          // Show indicator at fixed position
          swipeIndicator.style.opacity = indicatorOpacity;
        }
      }
    };

    const onTouchEnd = (e) => {
      if (swipeTriggered) return;

      const diffX = currentX - startX;

      // Reset visual
      swipeContent.style.transform = "";
      swipeContent.style.transition = "";
      swipeIndicator.style.opacity = "";

      // Swipe left đủ xa (> 80px) = Win
      if (isSwiping && diffX < -80) {
        swipeTriggered = true;
        applyPickedWin(playerName);
        return;
      }

      // Tap thông thường = Error
      if (!isSwiping) {
        applyPickedError(playerName);
      }

      isSwiping = false;
    };

    const onTouchCancel = () => {
      swipeContent.style.transform = "";
      swipeContent.style.transition = "";
      swipeIndicator.style.opacity = "";
      isSwiping = false;
      swipeTriggered = false;
    };

    // Touch events
    li.addEventListener("touchstart", onTouchStart, { passive: true });
    li.addEventListener("touchmove", onTouchMove, { passive: false });
    li.addEventListener("touchend", onTouchEnd, { passive: false });
    li.addEventListener("touchcancel", onTouchCancel, { passive: true });

    // Click for desktop (only error, no win on desktop)
    li.addEventListener("click", (e) => {
      if (!isSwiping && !swipeTriggered) {
        applyPickedError(playerName);
      }
    });
  }

  backBtn.addEventListener("click", async () => {
    const confirmed = await customConfirm(
      "Bạn có chắc muốn thoát? Dữ liệu game hiện tại sẽ bị mất.",
      "⚠️ Thoát game"
    );

    if (confirmed) {
      // Emit socket event to reset game (if admin)
      if (currentUser.role === "admin") {
        socket.emit("game:reset");
      }

      // Reset toàn bộ state
      erroredThisRound = new Set();
      actedThisRound = new Set();
      roundNumber = 1;
      movesCount = 0;
      setupSection.classList.remove("hidden");
      gameSection.classList.add("hidden");
      renderSetupList();
      renderAvailablePlayers();
    }
  });

  // ---------- Fetch Players from API ----------
  const fetchPlayers = async () => {
    try {
      const response = await fetch("/api/players");
      const players = await response.json();

      // Extract player names
      allPlayers = players.map((p) => p.name);

      // Default: first 5 players
      defaultPlayers = allPlayers.slice(0, 5);

      // Initialize UI
      renderSetupList();
      renderAvailablePlayers();
    } catch (error) {
      console.error("Failed to fetch players:", error);
      // Fallback to empty
      allPlayers = [];
      defaultPlayers = [];
    }
  };

  // ---------- Init ----------
  fetchPlayers();
})();
