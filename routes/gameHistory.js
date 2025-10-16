const express = require("express");
const router = express.Router();
const GameHistory = require("../models/GameHistory");
const GameState = require("../models/GameState");

// GET history của match hiện tại
router.get("/", async (req, res) => {
  try {
    const { matchNumber, limit = 50 } = req.query;
    const state = await GameState.getSingleton();
    const targetMatch = matchNumber || state.matchNumber;

    const history = await GameHistory.getMatchHistory(
      targetMatch,
      parseInt(limit)
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create history entry
router.post("/", async (req, res) => {
  try {
    const { eventType, playerName, stateBefore, stateAfter, description } =
      req.body;

    const state = await GameState.getSingleton();

    const entry = await GameHistory.create({
      eventType,
      playerName,
      stateBefore,
      stateAfter,
      description,
      matchNumber: state.matchNumber,
    });

    res.status(201).json(entry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST undo last action
router.post("/undo", async (req, res) => {
  try {
    const state = await GameState.getSingleton();

    // Get latest history entry for current match
    const lastEntry = await GameHistory.findOne({
      matchNumber: state.matchNumber,
    }).sort({ createdAt: -1 });

    if (!lastEntry) {
      return res.status(400).json({ error: "No history to undo" });
    }

    // Restore state before
    const stateBefore = lastEntry.stateBefore;
    Object.keys(stateBefore).forEach((key) => {
      state[key] = stateBefore[key];
    });

    await state.save();

    // Delete this history entry (hoặc mark as undone)
    await GameHistory.deleteOne({ _id: lastEntry._id });

    res.json({ message: "Undo successful", state });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE clear history của match hiện tại
router.delete("/", async (req, res) => {
  try {
    const state = await GameState.getSingleton();
    await GameHistory.clearCurrentMatch(state.matchNumber);
    res.json({ message: "History cleared" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
