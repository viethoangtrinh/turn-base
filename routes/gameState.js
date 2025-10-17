const express = require("express");
const router = express.Router();
const GameState = require("../models/GameState");
const { isAdmin } = require("../middleware/auth");

// GET current game state (public - cho guest xem)
router.get("/", async (req, res) => {
  try {
    const state = await GameState.getSingleton();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST/PUT update game state (admin only)
router.post("/", isAdmin, async (req, res) => {
  try {
    const state = await GameState.getSingleton();

    // Update fields
    Object.keys(req.body).forEach((key) => {
      if (key !== "singleton" && key !== "_id") {
        state[key] = req.body[key];
      }
    });

    await state.save();
    res.json(state);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST reset game (admin only)
router.post("/reset", isAdmin, async (req, res) => {
  try {
    const state = await GameState.resetGame();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST start game with initial order (admin only)
router.post("/start", isAdmin, async (req, res) => {
  try {
    const { order } = req.body;

    if (!order || !Array.isArray(order) || order.length < 3) {
      return res
        .status(400)
        .json({ error: "Order must be an array with at least 3 players" });
    }

    const state = await GameState.getSingleton();
    state.order = order;
    state.currentIndex = 0;
    state.roundNumber = 1;
    state.matchNumber = 1;
    state.movesCount = 0;
    state.actedThisRound = [];
    state.erroredThisRound = [];
    state.breakerPlayer = order[0];
    state.roundStarterName = order[0];
    state.isActive = true;

    await state.save();

    // Broadcast to Socket.IO clients
    const io = req.app.get("io");
    if (io) io.emit("game:updated", state);

    res.json(state);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST handle player error (admin only)
router.post("/error", isAdmin, async (req, res) => {
  try {
    const { playerName } = req.body;
    const state = await GameState.getSingleton();

    if (!state.isActive) {
      return res.status(400).json({ error: "Game is not active" });
    }

    if (!state.erroredThisRound.includes(playerName)) {
      state.erroredThisRound.push(playerName);
    }

    if (!state.actedThisRound.includes(playerName)) {
      state.actedThisRound.push(playerName);
    }

    state.movesCount += 1;
    state.lastActedPlayer = playerName;

    await state.save();

    // Broadcast to Socket.IO clients
    const io = req.app.get("io");
    if (io) io.emit("game:updated", state);

    res.json(state);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST handle player success (admin only)
router.post("/success", isAdmin, async (req, res) => {
  try {
    const { playerName } = req.body;
    const state = await GameState.getSingleton();

    if (!state.isActive) {
      return res.status(400).json({ error: "Game is not active" });
    }

    if (!state.actedThisRound.includes(playerName)) {
      state.actedThisRound.push(playerName);
    }

    // Remove from errored list if present
    state.erroredThisRound = state.erroredThisRound.filter(
      (p) => p !== playerName
    );

    state.movesCount += 1;
    state.lastActedPlayer = playerName;

    await state.save();

    // Broadcast to Socket.IO clients
    const io = req.app.get("io");
    if (io) io.emit("game:updated", state);

    res.json(state);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
