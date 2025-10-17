const GameState = require("../models/GameState");
const GameHistory = require("../models/GameHistory");
const {
  handlePlayerError,
  handlePlayerSuccess,
  calculateNextMatchOrder,
} = require("../utils/gameLogic");

module.exports = (io, socket) => {
  // Helper: Get current session (real-time, not cached)
  const getSession = () => socket.request.session;

  // Helper: Check if user is admin
  const isAdmin = () => getSession()?.role === "admin";

  // Helper: Get username for logging
  const getUsername = () => getSession()?.username || "Unknown";

  /**
   * Auto-fill skipped players with SUCCESS
   * If user clicks on a player that's not the current turn,
   * automatically fill all players from currentIndex to targetIndex as SUCCESS
   */
  const autoFillSkippedPlayers = async (state, targetIndex) => {
    const { order, currentIndex, actedThisRound } = state;
    const n = order.length;

    let idx = currentIndex;
    const playersToFill = [];

    // Calculate how many players to auto-fill
    while (idx !== targetIndex) {
      const player = order[idx];

      // Only fill if player hasn't acted this round yet
      if (!actedThisRound.includes(player)) {
        playersToFill.push(player);
      }

      idx = (idx + 1) % n;

      // Safety check: prevent infinite loop
      if (playersToFill.length > n) break;
    }

    // Fill all skipped players as SUCCESS
    for (const player of playersToFill) {
      // Save state before change
      const stateBefore = state.toObject();

      if (!state.actedThisRound.includes(player)) {
        state.actedThisRound.push(player);
      }

      // Advance turn using handlePlayerSuccess
      state.currentIndex = state.order.indexOf(player);
      handlePlayerSuccess(state);

      state.movesCount += 1;
      state.lastActedPlayer = player;

      // Save to history
      await GameHistory.create({
        eventType: "SUCCESS",
        playerName: player,
        stateBefore,
        stateAfter: state.toObject(),
        matchNumber: state.matchNumber,
        description: `${player} thành công (tự động)`,
      });

      console.log(`✅ [AUTO-FILL] ${player} thành công (skipped)`);
    }
  };

  // Handle game start
  socket.on("game:start", async (data) => {
    if (!isAdmin()) {
      return socket.emit("error", { message: "Admin access required" });
    }

    try {
      const { order } = data;
      const state = await GameState.getSingleton();

      // Prevent starting a new game if one is already active
      if (state.isActive) {
        return socket.emit("error", {
          message:
            "Đã có trận đấu đang diễn ra. Vui lòng kết thúc trận hiện tại trước.",
        });
      }

      state.order = order;
      state.currentIndex = 0;
      state.roundNumber = 1;
      // Don't increment matchNumber here - only increment on win
      // First match should be "Trận 1", not "Trận 2"
      state.movesCount = 0;
      state.actedThisRound = [];
      state.erroredThisRound = [];
      state.breakerPlayer = order[0];
      state.isActive = true;

      await state.save();

      // Broadcast to ALL clients (including sender)
      io.emit("game:updated", state);

      console.log(
        `🎮 Game started by ${getUsername()} (Match ${state.matchNumber})`
      );
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  // Handle player error
  socket.on("game:error", async (data) => {
    if (!isAdmin()) {
      return socket.emit("error", { message: "Admin access required" });
    }

    try {
      const { playerName } = data;
      const state = await GameState.getSingleton();

      if (!state.isActive) {
        return socket.emit("error", { message: "Game is not active" });
      }

      // Save state before change (for undo)
      const stateBefore = state.toObject();

      // Find player index in order
      const playerIndex = state.order.indexOf(playerName);
      if (playerIndex === -1) {
        return socket.emit("error", { message: "Player not found in order" });
      }

      // AUTO-FILL: If target player is not current turn, fill skipped players
      if (playerIndex !== state.currentIndex) {
        await autoFillSkippedPlayers(state, playerIndex);
      }

      // Now set currentIndex to the erroring player
      state.currentIndex = playerIndex;

      // Add to errored list
      if (!state.erroredThisRound.includes(playerName)) {
        state.erroredThisRound.push(playerName);
      }

      // Add to acted list
      if (!state.actedThisRound.includes(playerName)) {
        state.actedThisRound.push(playerName);
      }

      state.movesCount += 1;
      state.lastActedPlayer = playerName;

      // Apply game logic (advance turn, check round completion, etc.)
      handlePlayerError(state);

      await state.save();

      // Save history for undo
      await GameHistory.create({
        eventType: "ERROR",
        playerName,
        stateBefore,
        stateAfter: state.toObject(),
        matchNumber: state.matchNumber,
        description: `${playerName} lỗi`,
      });

      // Broadcast to ALL clients
      io.emit("game:updated", state);

      console.log(
        `❌ ${playerName} lỗi (by ${getUsername()}) → Turn: ${
          state.order[state.currentIndex]
        }, Round: ${state.roundNumber}`
      );
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  // Handle player success
  socket.on("game:success", async (data) => {
    if (!isAdmin()) {
      return socket.emit("error", { message: "Admin access required" });
    }

    try {
      const { playerName } = data;
      const state = await GameState.getSingleton();

      if (!state.isActive) {
        return socket.emit("error", { message: "Game is not active" });
      }

      // Save state before change
      const stateBefore = state.toObject();

      // Find player index in order
      const playerIndex = state.order.indexOf(playerName);
      if (playerIndex === -1) {
        return socket.emit("error", { message: "Player not found in order" });
      }

      // AUTO-FILL: If target player is not current turn, fill skipped players
      if (playerIndex !== state.currentIndex) {
        await autoFillSkippedPlayers(state, playerIndex);
      }

      // Now set currentIndex to the succeeding player
      state.currentIndex = playerIndex;

      // Add to acted list
      if (!state.actedThisRound.includes(playerName)) {
        state.actedThisRound.push(playerName);
      }

      // Remove from errored list
      state.erroredThisRound = state.erroredThisRound.filter(
        (p) => p !== playerName
      );

      state.movesCount += 1;
      state.lastActedPlayer = playerName;

      // Apply game logic (advance turn, check round completion, etc.)
      handlePlayerSuccess(state);

      await state.save();

      // Save history
      await GameHistory.create({
        eventType: "SUCCESS",
        playerName,
        stateBefore,
        stateAfter: state.toObject(),
        matchNumber: state.matchNumber,
        description: `${playerName} thành công`,
      });

      // Broadcast to ALL clients
      io.emit("game:updated", state);

      console.log(
        `✅ ${playerName} thành công (by ${getUsername()}) → Turn: ${
          state.order[state.currentIndex]
        }, Round: ${state.roundNumber}`
      );
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  // Handle player win
  socket.on("game:win", async (data) => {
    if (!isAdmin()) {
      return socket.emit("error", { message: "Admin access required" });
    }

    try {
      const { playerName } = data;
      const state = await GameState.getSingleton();

      if (!state.isActive) {
        return socket.emit("error", { message: "Game is not active" });
      }

      // Save state before change
      const stateBefore = state.toObject();

      // Save WIN history
      await GameHistory.create({
        eventType: "WIN",
        playerName,
        stateBefore,
        stateAfter: null,
        matchNumber: state.matchNumber,
        description: `${playerName} thắng`,
      });

      // Calculate new order for next match
      const winnerIndex = state.order.indexOf(playerName);
      const nextOrder = calculateNextMatchOrder(state.order, winnerIndex);

      // Clear history of current match
      await GameHistory.deleteMany({ matchNumber: state.matchNumber });

      // Start new match automatically with new order
      state.matchNumber += 1; // Increment for next match
      state.order = nextOrder;
      state.currentIndex = 0;
      state.roundNumber = 1;
      state.movesCount = 0;
      state.actedThisRound = [];
      state.erroredThisRound = [];
      state.breakerPlayer = nextOrder[0]; // Winner is breaker
      state.isActive = true;

      await state.save();

      // Broadcast to ALL clients
      io.emit("game:updated", state);
      io.emit("game:win", { winner: playerName, nextMatch: state.matchNumber });

      console.log(
        `🏆 ${playerName} thắng trận ${stateBefore.matchNumber}! Trận ${state.matchNumber} bắt đầu.`
      );
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  // Handle game reset
  socket.on("game:reset", async () => {
    if (!isAdmin()) {
      return socket.emit("error", { message: "Admin access required" });
    }

    try {
      const state = await GameState.resetGame();

      // Clear all history
      await GameHistory.deleteMany({});

      // Broadcast to ALL clients
      io.emit("game:updated", state);

      console.log(`🔄 Game reset by ${getUsername()}`);
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  // Handle undo
  socket.on("game:undo", async () => {
    if (!isAdmin()) {
      return socket.emit("error", { message: "Admin access required" });
    }

    try {
      const state = await GameState.getSingleton();

      // Get last history entry
      const lastHistory = await GameHistory.findOne({
        matchNumber: state.matchNumber,
      }).sort({ timestamp: -1 });

      if (!lastHistory) {
        return socket.emit("error", { message: "No history to undo" });
      }

      // Restore state before
      Object.assign(state, lastHistory.stateBefore);
      await state.save();

      // Delete the history entry
      await GameHistory.deleteOne({ _id: lastHistory._id });

      // Broadcast to ALL clients
      io.emit("game:updated", state);

      console.log(`↩️ Undo by ${getUsername()}`);
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });
};
