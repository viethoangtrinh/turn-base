const mongoose = require("mongoose");

const gameHistorySchema = new mongoose.Schema(
  {
    // Event type
    eventType: {
      type: String,
      enum: ["START", "ERROR", "SUCCESS", "WIN", "RESET"],
      required: true,
    },

    // Player involved
    playerName: {
      type: String,
    },

    // Game state snapshot BEFORE this action
    stateBefore: {
      order: [String],
      currentIndex: Number,
      roundNumber: Number,
      matchNumber: Number,
      movesCount: Number,
      actedThisRound: [String],
      erroredThisRound: [String],
      breakerPlayer: String,
      lastActedPlayer: String,
      roundStarterName: String,
    },

    // Game state snapshot AFTER this action
    stateAfter: {
      order: [String],
      currentIndex: Number,
      roundNumber: Number,
      matchNumber: Number,
      movesCount: Number,
      actedThisRound: [String],
      erroredThisRound: [String],
      breakerPlayer: String,
      lastActedPlayer: String,
      roundStarterName: String,
    },

    // Metadata
    description: String,
    matchNumber: Number,
  },
  {
    timestamps: true,
  }
);

// Index để query nhanh
gameHistorySchema.index({ matchNumber: 1, createdAt: -1 });

// Static method: clear history của match hiện tại
gameHistorySchema.statics.clearCurrentMatch = async function (matchNumber) {
  await this.deleteMany({ matchNumber });
};

// Static method: get history của match hiện tại
gameHistorySchema.statics.getMatchHistory = async function (
  matchNumber,
  limit = 50
) {
  return this.find({ matchNumber }).sort({ createdAt: -1 }).limit(limit);
};

module.exports = mongoose.model("GameHistory", gameHistorySchema);
