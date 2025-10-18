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

    // Save OLD session ID before creating new one
    const oldSessionId = user.activeSessionId;
    console.log(
      `[Login] User: ${user.username}, OldSessionId: ${oldSessionId}`
    );

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
    console.log(`[Login] NewSessionId: ${newSessionId}`);

    user.activeSessionId = newSessionId;
    user.lastLoginAt = new Date();
    await user.save();

    // THEN kick old session (if exists) - IMMEDIATELY, don't wait
    const io = req.app.get("io");
    if (
      user.role === "admin" &&
      oldSessionId &&
      oldSessionId !== newSessionId &&
      io
    ) {
      // Kick immediately without delay
      setImmediate(async () => {
        try {
          const sockets = await io.fetchSockets();
          for (const socket of sockets) {
            const socketSession = socket.request.session;
            // Double check: only kick if session ID matches OLD session
            if (
              socketSession &&
              socketSession.id === oldSessionId &&
              socketSession.id !== newSessionId
            ) {
              console.log(
                `[Kick] Found old admin socket: ${socket.id}, SessionId: ${socketSession.id}`
              );

              // Emit force-logout event
              socket.emit("admin:force-logout", {
                reason: "Admin khác đã đăng nhập từ thiết bị khác",
              });

              // Wait a bit to ensure message is delivered before disconnect
              setTimeout(() => {
                console.log(`[Kick] Disconnecting socket: ${socket.id}`);

                // Destroy old session from database
                socketSession.destroy((err) => {
                  if (err) {
                    console.error("Failed to destroy old session:", err);
                  }
                });

                // Force disconnect (allow reconnect)
                socket.disconnect();
              }, 200);
            }
          }
        } catch (error) {
          console.error("Error kicking old admin session:", error);
        }
      });
    }

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
    // Check if this admin session is still active (not replaced by another admin)
    let isActiveAdminSession = false;
    if (userId && role === "admin") {
      const user = await User.findById(userId);
      if (user && user.activeSessionId === sessionId) {
        isActiveAdminSession = true;
        user.activeSessionId = null;
        await user.save();
      }
    }

    // Only reset game if this is the ACTIVE admin session
    // (Not when admin was kicked by another admin)
    if (isActiveAdminSession) {
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
