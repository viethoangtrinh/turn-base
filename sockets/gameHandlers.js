const GameState = require("../models/GameState");
const GameHistory = require("../models/GameHistory");
const {
  handlePlayerError,
  handlePlayerSuccess,
} = require("../utils/gameLogic");

module.exports = (io, socket) => {
  // Helper: Get current session (real-time, not cached)
  const getSession = () => socket.request.session;

  // Helper: Check if user is admin
  const isAdmin = () => getSession()?.role === "admin";

  // Helper: Get username for logging
  const getUsername = () => getSession()?.username || "Unknown";

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
      state.matchNumber += 1; // Increment match number
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

      // Clear history of current match
      await GameHistory.deleteMany({ matchNumber: state.matchNumber });

      // End game - admin must manually start a new one
      await GameState.resetGame();

      // Broadcast to ALL clients
      const newState = await GameState.getSingleton();
      io.emit("game:updated", newState);
      io.emit("game:win", { winner: playerName });

      console.log(
        `🏆 ${playerName} thắng trận ${state.matchNumber}! Game ended.`
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
