const GameState = require("../models/GameState");
const GameHistory = require("../models/GameHistory");
const {
  handlePlayerError,
  handlePlayerSuccess,
  calculateNextMatchOrder,
} = require("../utils/gameLogic");

module.exports = (io, socket) => {
  const getSession = () => socket.request.session;

  const isAdmin = () => getSession()?.role === "admin";

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
    }
  };

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

      io.emit("game:updated", state);
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

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

      const stateBefore = state.toObject();

      const playerIndex = state.order.indexOf(playerName);
      if (playerIndex === -1) {
        return socket.emit("error", { message: "Player not found in order" });
      }

      // AUTO-FILL: If target player is not current turn, fill skipped players
      if (playerIndex !== state.currentIndex) {
        await autoFillSkippedPlayers(state, playerIndex);
      }

      state.currentIndex = playerIndex;

      if (!state.erroredThisRound.includes(playerName)) {
        state.erroredThisRound.push(playerName);
      }

      if (!state.actedThisRound.includes(playerName)) {
        state.actedThisRound.push(playerName);
      }

      state.movesCount += 1;
      state.lastActedPlayer = playerName;

      handlePlayerError(state);

      await state.save();

      await GameHistory.create({
        eventType: "ERROR",
        playerName,
        stateBefore,
        stateAfter: state.toObject(),
        matchNumber: state.matchNumber,
        description: `${playerName} lỗi`,
      });

      io.emit("game:updated", state);
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

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

      const stateBefore = state.toObject();

      const playerIndex = state.order.indexOf(playerName);
      if (playerIndex === -1) {
        return socket.emit("error", { message: "Player not found in order" });
      }

      // AUTO-FILL: If target player is not current turn, fill skipped players
      if (playerIndex !== state.currentIndex) {
        await autoFillSkippedPlayers(state, playerIndex);
      }

      state.currentIndex = playerIndex;

      if (!state.actedThisRound.includes(playerName)) {
        state.actedThisRound.push(playerName);
      }

      state.erroredThisRound = state.erroredThisRound.filter(
        (p) => p !== playerName
      );

      state.movesCount += 1;
      state.lastActedPlayer = playerName;

      handlePlayerSuccess(state);

      await state.save();

      await GameHistory.create({
        eventType: "SUCCESS",
        playerName,
        stateBefore,
        stateAfter: state.toObject(),
        matchNumber: state.matchNumber,
        description: `${playerName} thành công`,
      });

      io.emit("game:updated", state);
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

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

      const winnerIndex = state.order.indexOf(playerName);
      const nextOrder = calculateNextMatchOrder(state.order, winnerIndex);

      await GameHistory.deleteMany({ matchNumber: state.matchNumber });

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

      io.emit("game:updated", state);
      io.emit("game:win", { winner: playerName, nextMatch: state.matchNumber });
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("game:reset", async () => {
    if (!isAdmin()) {
      return socket.emit("error", { message: "Admin access required" });
    }

    try {
      const state = await GameState.resetGame();

      await GameHistory.deleteMany({});

      io.emit("game:updated", state);
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

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

      Object.assign(state, lastHistory.stateBefore);
      await state.save();

      await GameHistory.deleteOne({ _id: lastHistory._id });

      io.emit("game:updated", state);
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });
};
