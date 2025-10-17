require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");
const connectDB = require("./config/database");
const playersRouter = require("./routes/players");
const gameStateRouter = require("./routes/gameState");
const gameHistoryRouter = require("./routes/gameHistory");
const authRouter = require("./routes/auth");
const gameHandlers = require("./sockets/gameHandlers");
const User = require("./models/User");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB().then(async () => {
  // Clear all sessions on server start
  try {
    const sessionsCollection = mongoose.connection.collection("sessions");
    const result = await sessionsCollection.deleteMany({});
    console.log(`🧹 Cleared ${result.deletedCount} old sessions`);

    // Clear all activeSessionId from users
    await User.updateMany({}, { activeSessionId: null });
    console.log(`🧹 Cleared all active admin sessions`);

    // Reset any active game (prevent zombie games)
    const GameState = require("./models/GameState");
    const gameState = await GameState.getSingleton();
    if (gameState.isActive) {
      await GameState.resetGame();
      console.log(`🧹 Reset zombie game (was active on server restart)`);
    }
  } catch (error) {
    console.error("⚠️  Failed to clear sessions:", error.message);
  }
});

// Session middleware (dùng chung cho Express và Socket.IO)
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "turn-base-secret-key",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60, // 1 day
  }),
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    httpOnly: true,
    secure: false, // Set to true if using HTTPS
  },
});

app.use(sessionMiddleware);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/players", playersRouter);
app.use("/api/game", gameStateRouter);
app.use("/api/history", gameHistoryRouter);

// Static files
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Share session with Socket.IO
io.engine.use(sessionMiddleware);

// Socket.IO connection handler
io.on("connection", (socket) => {
  const session = socket.request.session;
  const userId = session?.userId;
  const username = session?.username || "Guest";
  const role = session?.role || "guest";

  console.log(`🔌 ${username} (${role}) connected [${socket.id}]`);

  // Send current user info to client
  socket.emit("auth:status", { username, role });

  // Register game event handlers
  gameHandlers(io, socket);

  // Disconnect handler
  socket.on("disconnect", () => {
    console.log(`❌ ${username} disconnected [${socket.id}]`);
  });
});

// Make io accessible to routes
app.set("io", io);

// Check for timed out games every 1 minute
setInterval(async () => {
  try {
    const GameState = require("./models/GameState");
    await GameState.checkAndEndTimedOutGame(io);
  } catch (error) {
    console.error("⚠️  Error checking game timeout:", error.message);
  }
}, 60 * 1000); // 1 minute

httpServer.listen(PORT, () => {
  console.log(`Turn-base app running on http://localhost:${PORT}`);
  console.log(`Socket.IO enabled for real-time sync`);
});
