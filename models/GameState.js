const mongoose = require("mongoose");

const gameStateSchema = new mongoose.Schema(
  {
    // Singleton pattern - chỉ có 1 doc duy nhất
    singleton: {
      type: Boolean,
      default: true,
      unique: true,
    },

    // Current game state
    order: {
      type: [String],
      required: true,
      default: [],
    },
    currentIndex: {
      type: Number,
      required: true,
      default: 0,
    },

    // Round/Match tracking
    roundNumber: {
      type: Number,
      required: true,
      default: 1,
    },
    matchNumber: {
      type: Number,
      required: true,
      default: 1,
    },
    movesCount: {
      type: Number,
      default: 0,
    },

    // Players state
    actedThisRound: {
      type: [String],
      default: [],
    },
    erroredThisRound: {
      type: [String],
      default: [],
    },

    // Tracking
    breakerPlayer: String, // Người phá bi
    lastActedPlayer: String,
    roundStarterName: String,

    // Game status
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Static method để get hoặc create singleton
gameStateSchema.statics.getSingleton = async function () {
  let state = await this.findOne({ singleton: true });
  if (!state) {
    state = await this.create({ singleton: true });
  }
  return state;
};

// Static method để reset game
gameStateSchema.statics.resetGame = async function () {
  const state = await this.getSingleton();
  state.order = [];
  state.currentIndex = 0;
  state.roundNumber = 1;
  state.matchNumber = 1;
  state.movesCount = 0;
  state.actedThisRound = [];
  state.erroredThisRound = [];
  state.breakerPlayer = null;
  state.lastActedPlayer = null;
  state.roundStarterName = null;
  state.isActive = false;
  await state.save();
  return state;
};

module.exports = mongoose.model("GameState", gameStateSchema);
