const express = require("express");
const router = express.Router();
const User = require("../models/User");
const GameState = require("../models/GameState");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // Find user
    const user = await User.findOne({ username, isActive: true });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // If admin and has active session → kick old session
    const io = req.app.get("io");
    if (user.role === "admin" && user.activeSessionId && io) {
      const oldSessionId = user.activeSessionId;

      // Find and disconnect all sockets with old session
      const sockets = await io.fetchSockets();
      for (const socket of sockets) {
        const socketSession = socket.request.session;
        if (socketSession && socketSession.id === oldSessionId) {
          socket.emit("admin:force-logout", {
            reason: "Admin khác đã đăng nhập từ thiết bị khác",
          });
          // Force disconnect after a delay to ensure message is sent
          setTimeout(() => socket.disconnect(true), 100);
        }
      }
    }

    // Create new session
    req.session.userId = user._id.toString();
    req.session.username = user.username;
    req.session.role = user.role;

    // Save new session ID to database
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const newSessionId = req.session.id;
    user.activeSessionId = newSessionId;
    user.lastLoginAt = new Date();
    await user.save();

    res.json({
      message: "Login successful",
      user: {
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  const userId = req.session.userId;
  const sessionId = req.session.id;
  const role = req.session.role;

  try {
    // Clear activeSessionId from database if this is admin
    if (userId) {
      const user = await User.findById(userId);
      if (user && user.activeSessionId === sessionId) {
        user.activeSessionId = null;
        await user.save();
      }
    }

    // If admin logs out, end any active game
    if (role === "admin") {
      const gameState = await GameState.getSingleton();
      if (gameState.isActive) {
        await GameState.resetGame();
        const io = req.app.get("io");
        if (io) {
          io.emit("game:updated", await GameState.getSingleton());
        }
      }
    }

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  res.json({
    username: req.session.username,
    role: req.session.role,
  });
});

module.exports = router;
