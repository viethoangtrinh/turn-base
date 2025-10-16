const express = require("express");
const router = express.Router();
const Player = require("../models/Player");

// GET all active players
router.get("/", async (req, res) => {
  try {
    const players = await Player.find({ isActive: true }).sort("displayOrder");
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET player by ID
router.get("/:id", async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create new player
router.post("/", async (req, res) => {
  try {
    const { name, displayOrder } = req.body;
    const player = await Player.create({ name, displayOrder });
    res.status(201).json(player);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update player
router.put("/:id", async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }
    res.json(player);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE player (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }
    res.json({ message: "Player deleted", player });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
