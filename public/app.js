(() => {
  const socket = io();
  let currentUser = { username: "Guest", role: "guest" };
  let isConnected = false;

  const toastContainer = document.getElementById("toast-container");
  const connectionBanner = document.getElementById("connection-banner");
  const connectionMessage = document.getElementById("connection-message");
  const loadingOverlay = document.getElementById("loading-overlay");
  const loadingText = document.getElementById("loading-text");

  const showToast = (message, type = "info", duration = 3000) => {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("hiding");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  const showConnectionBanner = (message, reconnecting = false) => {
    connectionMessage.textContent = message;
    connectionBanner.classList.remove("hidden");
    if (reconnecting) {
      connectionBanner.classList.add("reconnecting");
    } else {
      connectionBanner.classList.remove("reconnecting");
    }
  };

  const hideConnectionBanner = () => {
    connectionBanner.classList.add("hidden");
  };

  const showLoading = (message = "Đang xử lý...") => {
    loadingText.textContent = message;
    loadingOverlay.classList.remove("hidden");
    document.body.classList.add("loading");
  };

  const hideLoading = () => {
    loadingOverlay.classList.add("hidden");
    document.body.classList.remove("loading");
  };

  socket.on("connect", () => {
    isConnected = true;
    hideConnectionBanner();

    if (socket.io.engine.transport.name === "websocket") {
      showToast("✅ Kết nối thành công", "success", 2000);
    }
  });

  socket.on("disconnect", () => {
    isConnected = false;
    showConnectionBanner("⚠️ Mất kết nối - Đang kết nối lại...", false);
  });

  socket.io.on("reconnect_attempt", () => {
    showConnectionBanner("🔄 Đang kết nối lại...", true);
  });

  socket.io.on("reconnect_failed", () => {
    showConnectionBanner(
      "❌ Không thể kết nối - Vui lòng kiểm tra mạng",
      false
    );
  });

  socket.on("auth:status", (user) => {
    currentUser = user;
  });

  socket.on("admin:force-logout", async (data) => {
    // Only process if this is the old admin session being kicked
    if (currentUser.role !== "admin") {
      return;
    }

    console.warn("🚨 Force logout:", data.reason);

    await customConfirm(
      `${data.reason}\n\nBạn đã bị đăng xuất.`,
      "⚠️ Đăng xuất"
    );

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    }

    currentUser = { username: "Guest", role: "guest" };
    showToast(
      "⚠️ Bạn đã bị đăng xuất do admin khác đăng nhập",
      "warning",
      5000
    );

    checkGameState();
  });

  socket.on("error", (data) => {
    console.error("Socket error:", data.message);
    showToast(`❌ ${data.message}`, "error");
  });

  let previousState = null;

  socket.on("game:updated", async (gameState) => {
    if (gameState.isActive && gameState.order && gameState.order.length > 0) {
      showGameSection(gameState);
      await refreshGameHistory();

      previousState = {
        movesCount: gameState.movesCount,
        roundNumber: gameState.roundNumber,
      };
    } else {
      if (currentUser.role === "admin") {
        showSetupSection();
      } else {
        showEmptyState();
      }
      previousState = null;
    }
  });

  socket.on("game:win", (data) => {
    pushLog(`🏆 ${data.winner} thắng! Ván mới bắt đầu`);
  });

  socket.on("game:timeout", (data) => {
    showToast(data.message, "warning", 5000);
  });

  let allPlayers = [];
  let defaultPlayers = [];

  const emptyState = document.getElementById("empty-state");
  const setupSection = document.getElementById("setup");
  const gameSection = document.getElementById("game");
  const playerList = document.getElementById("player-list");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const adminLoginBtn = document.getElementById("admin-login-btn");
  const cancelLoginBtn = document.getElementById("cancel-login");
  const loginError = document.getElementById("login-error");
  const logoutBtn = document.getElementById("logout-btn");
  const startBtn = document.getElementById("start-game");

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

  toggleLogBtn.addEventListener("click", () => {
    logEl.classList.toggle("hidden");
    toggleLogBtn.classList.toggle("active");
  });

  let errorSelect, errorApplyBtn, winSelect, winApplyBtn;

  let setupOrder = [...defaultPlayers];
  let order = [];
  let currentIndex = 0; // whose turn in `order`
  const history = [];
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

  const themes = [
    { name: "lightning", icon: "⚡", label: "Phá bi" },
    { name: "fire", icon: "🔥", label: "Lửa" },
    { name: "ice", icon: "❄️", label: "Băng" },
    { name: "nature", icon: "🌿", label: "Rừng" },
    { name: "shadow", icon: "🌙", label: "Đêm" },
  ];

  const shuffleThemes = (players) => {
    const shuffledThemes = [...themes].sort(() => Math.random() - 0.5);
    const themeMap = {};
    players.forEach((player, i) => {
      themeMap[player] = shuffledThemes[i % shuffledThemes.length];
    });
    return themeMap;
  };

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

    const available = allPlayers.filter((name) => !setupOrder.includes(name));

    if (available.length === 0) {
      availableList.innerHTML =
        '<li class="empty-msg">Tất cả người chơi đã được chọn</li>';
      return;
    }

    available.forEach((name) => {
      const li = document.createElement("li");
      li.className = "available-player";

      const isDisabled = setupOrder.length >= 5;

      li.innerHTML = `
        <span class="pill">${name}</span>
        <button class="btn-add ${
          isDisabled ? "disabled" : ""
        }" data-name="${name}" ${isDisabled ? "disabled" : ""}></button>
      `;
      availableList.appendChild(li);
    });

    availableList.querySelectorAll(".btn-add").forEach((btn) => {
      btn.addEventListener("click", () => {
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

      attachTapHandlers(li, name);
      currentOrderEl.appendChild(li);
    });
  };

  const pushLog = (text, round) => {
    const li = document.createElement("li");
    const roundText = round ? `[Vòng ${round}] ` : "";
    li.textContent = `${roundText}${text}`;
    logEl.prepend(li);
    while (logEl.children.length > 20) {
      logEl.removeChild(logEl.lastChild);
    }
  };

  const refreshGameHistory = async () => {
    try {
      const response = await fetch("/api/history");
      if (!response.ok) {
        console.error("Failed to fetch history:", response.status);
        return;
      }

      const history = await response.json();

      logEl.innerHTML = "";

      for (let i = history.length - 1; i >= 0; i--) {
        const entry = history[i];
        const stateAfter = entry.stateAfter;
        const round = stateAfter
          ? stateAfter.roundNumber
          : entry.stateBefore.roundNumber;

        pushLog(entry.description, round);
      }
    } catch (error) {
      console.error("Failed to fetch game history:", error);
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

  let dragIndex = null;
  let touchDragEl = null;
  let touchStartY = 0;
  let touchCurrentY = 0;
  let isDragging = false;

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

  let lastHoverIndex = null;

  playerList.addEventListener(
    "touchstart",
    (e) => {
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

      touchDragEl.style.transform = `translateY(${deltaY}px)`;
      touchDragEl.style.opacity = "0.7";
      touchDragEl.style.zIndex = "1000";

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
      const updated = [...setupOrder];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(lastHoverIndex, 0, moved);
      setupOrder = updated;
      renderSetupList();
    } else if (touchDragEl) {
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

  startBtn.addEventListener("click", async () => {
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

    startBtn.disabled = true;
    startBtn.classList.add("loading");
    const originalText = startBtn.textContent;
    startBtn.textContent = "Đang khởi tạo...";

    try {
      socket.emit("game:start", { order: setupOrder });

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

      backBtn.classList.remove("hidden");

      showToast("🎮 Trận đấu bắt đầu!", "success");
    } catch (error) {
      console.error("Start game error:", error);
      showToast("❌ Lỗi khi bắt đầu trận đấu", "error");
    } finally {
      // Reset loading state
      startBtn.disabled = false;
      startBtn.classList.remove("loading");
      startBtn.textContent = originalText;
    }
    document.querySelector(".hint").classList.remove("hidden");
    adminLoginBtn.classList.add("hidden");

    const roundNumEl = document.getElementById("round-number");
    if (roundNumEl) roundNumEl.textContent = String(roundNumber);

    const matchNumEl = document.getElementById("match-number");
    if (matchNumEl) matchNumEl.textContent = String(matchNumber);

    renderOrder();
  });

  let isProcessing = false; // Flag để ngăn multiple calls

  const applyPickedError = (playerName) => {
    if (!order.includes(playerName)) return;
    if (isProcessing) return; // Ngăn gọi nhiều lần
    if (currentUser.role !== "admin") {
      showToast("⚠️ Chỉ admin mới có thể thao tác", "warning");
      return;
    }

    isProcessing = true;
    showLoading("Đang xử lý lỗi...");

    // Emit socket event - server will handle game logic
    socket.emit("game:error", { playerName });

    // Wait for server response (game:updated event will hide loading)
    setTimeout(() => {
      isProcessing = false;
      hideLoading();
    }, 500);
  };

  const applyPickedWin = async (playerName) => {
    if (!order.includes(playerName)) return;
    if (currentUser.role !== "admin") {
      showToast("⚠️ Chỉ admin mới có thể thao tác", "warning");
      return;
    }

    // Confirm trước khi xác nhận thắng
    const confirmed = await customConfirm(
      `Xác nhận ${playerName} thắng?`,
      "🏆 Chiến thắng"
    );

    if (!confirmed) return;

    showLoading("Đang xử lý chiến thắng...");

    // Emit socket event - server will handle game logic
    socket.emit("game:win", { playerName });

    // Server will broadcast game:updated and game:win events
    setTimeout(() => {
      hideLoading();
    }, 500);
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
      "Bạn có chắc muốn kết thúc trận đấu? Dữ liệu game hiện tại sẽ bị mất.",
      "⚠️ Kết thúc trận đấu"
    );

    if (confirmed) {
      // Emit socket event to reset game (admin only)
      if (currentUser.role === "admin") {
        socket.emit("game:reset");
      }

      // Reset local state
      erroredThisRound = new Set();
      actedThisRound = new Set();
      roundNumber = 1;
      movesCount = 0;

      // Admin về setup, guest về empty state
      if (currentUser.role === "admin") {
        showSetupSection();
        renderSetupList();
        renderAvailablePlayers();
      } else {
        checkGameState();
      }
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

  // ---------- Auth Functions ----------
  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const user = await response.json();
        currentUser = user;

        // Admin logged in - check if there's an active game
        await checkGameState();
        return true;
      }
    } catch (error) {
      console.log("Not authenticated:", error);
    }

    // Not authenticated - show game or empty state
    await checkGameState();
    return false;
  };

  const checkGameState = async () => {
    try {
      const response = await fetch("/api/game");
      const gameState = await response.json();

      if (gameState.isActive && gameState.order && gameState.order.length > 0) {
        // Có game đang chơi → Show game section
        showGameSection(gameState);
      } else {
        // Không có game → Show empty/setup state
        if (currentUser.role === "admin") {
          showSetupSection();
        } else {
          showEmptyState();
        }
      }
    } catch (error) {
      console.error("Failed to check game state:", error);
      showEmptyState();
    }
  };

  const showGameSection = (gameState) => {
    // Update local state from server
    order = gameState.order;
    currentIndex = gameState.currentIndex || 0;
    roundNumber = gameState.roundNumber || 1;
    matchNumber = gameState.matchNumber || 1;
    movesCount = gameState.movesCount || 0;
    actedThisRound = new Set(gameState.actedThisRound || []);
    erroredThisRound = new Set(gameState.erroredThisRound || []);
    breakerPlayer = gameState.breakerPlayer || null;
    lastActedPlayer = gameState.lastActedPlayer || null;

    // Regenerate themes if needed (deterministic based on match number)
    if (
      Object.keys(playerThemes).length === 0 ||
      playerThemes[order[0]] === undefined
    ) {
      playerThemes = shuffleThemes(order);
    }

    // Show game section
    emptyState.classList.add("hidden");
    setupSection.classList.add("hidden");
    gameSection.classList.remove("hidden");

    // Show/hide buttons based on role
    if (currentUser.role === "admin") {
      adminLoginBtn.classList.add("hidden");
      logoutBtn.classList.add("hidden"); // Hide logout in game screen
      backBtn.classList.remove("hidden");
      document.querySelector(".hint").classList.remove("hidden");
    } else {
      adminLoginBtn.classList.remove("hidden"); // Guest can still login
      logoutBtn.classList.add("hidden");
      backBtn.classList.add("hidden");
      document.querySelector(".hint").classList.add("hidden");
    }

    renderOrder();

    const roundNumEl = document.getElementById("round-number");
    if (roundNumEl) roundNumEl.textContent = String(roundNumber);

    const matchNumEl = document.getElementById("match-number");
    if (matchNumEl) matchNumEl.textContent = String(matchNumber);
  };

  const showEmptyState = () => {
    emptyState.classList.remove("hidden");
    setupSection.classList.add("hidden");
    gameSection.classList.add("hidden");

    // Show appropriate button based on user role
    if (currentUser.role === "admin") {
      adminLoginBtn.classList.add("hidden");
      logoutBtn.classList.remove("hidden");
    } else {
      adminLoginBtn.classList.remove("hidden");
      logoutBtn.classList.add("hidden");
    }
  };

  const showSetupSection = () => {
    emptyState.classList.add("hidden");
    setupSection.classList.remove("hidden");
    gameSection.classList.add("hidden");

    // Only admin can see setup section
    if (currentUser.role === "admin") {
      logoutBtn.classList.remove("hidden");
      adminLoginBtn.classList.add("hidden");
    } else {
      // Guest should never see this, but just in case
      logoutBtn.classList.add("hidden");
      adminLoginBtn.classList.remove("hidden");
    }
  };

  // Open login modal
  adminLoginBtn.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
    document.getElementById("username").focus();
  });

  // Cancel login
  cancelLoginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    loginModal.classList.add("hidden");
    loginError.classList.add("hidden");
    loginForm.reset();
  });

  // Close modal on backdrop click (not on modal content)
  loginModal.addEventListener("click", (e) => {
    // Only close if clicking directly on the backdrop (not on child elements)
    if (e.target.id === "login-modal") {
      cancelLoginBtn.click();
    }
  });

  // Login form submit
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.add("hidden");

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.classList.add("loading");
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Đang đăng nhập...";

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        currentUser = data.user;
        loginModal.classList.add("hidden");
        loginForm.reset();

        // Show loading overlay during reconnect
        showLoading("Đang kết nối lại...");

        // Force socket reconnect to get new session with admin role
        socket.disconnect();

        // Wait for reconnection to complete before proceeding
        await new Promise((resolve) => {
          socket.once("connect", () => {
            resolve();
          });
          socket.connect();
        });

        await checkGameState(); // Check if there's an active game
        hideLoading();
        showToast(`✅ Đăng nhập thành công`, "success");
      } else {
        loginError.textContent = data.error || "Đăng nhập thất bại";
        loginError.classList.remove("hidden");
        showToast(`❌ ${data.error || "Đăng nhập thất bại"}`, "error");
      }
    } catch (error) {
      console.error("Login error:", error);
      loginError.textContent = "Lỗi kết nối server";
      loginError.classList.remove("hidden");
      showToast("❌ Lỗi kết nối server", "error");
    } finally {
      // Reset loading state
      submitBtn.disabled = false;
      submitBtn.classList.remove("loading");
      submitBtn.textContent = originalText;
    }
  });

  // Logout
  logoutBtn.addEventListener("click", async () => {
    logoutBtn.disabled = true;
    logoutBtn.classList.add("loading");
    const originalText = logoutBtn.textContent;
    logoutBtn.textContent = "Đang đăng xuất...";

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      showToast("👋 Đã đăng xuất", "info");
    } catch (error) {
      console.error("Logout error:", error);
      showToast("❌ Lỗi khi đăng xuất", "error");
    } finally {
      logoutBtn.disabled = false;
      logoutBtn.classList.remove("loading");
      logoutBtn.textContent = originalText;
    }

    currentUser = { username: "Guest", role: "guest" };
    checkGameState(); // Go back to game or empty state
  });

  fetchPlayers();
  checkAuth(); // Check if already logged in
})();
