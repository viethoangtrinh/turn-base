const assert = require("assert");
const {
  handlePlayerError,
  handlePlayerSuccess,
} = require("../utils/gameLogic");

describe("Game Logic - Turn & Round Management", () => {
  describe("handlePlayerError", () => {
    it("should advance turn to next player on error", () => {
      const state = {
        order: ["A", "B", "C"],
        currentIndex: 0,
        roundNumber: 1,
        actedThisRound: ["A"],
        erroredThisRound: ["A"],
        breakerPlayer: "A",
      };

      handlePlayerError(state);

      assert.strictEqual(
        state.currentIndex,
        1,
        "Should advance to next player"
      ); // A → B
      assert.strictEqual(state.roundNumber, 1, "Should stay in round 1"); // Still round 1
    });

    it("should advance to round 2 when all players have acted", () => {
      const state = {
        order: ["A", "B", "C"],
        currentIndex: 2, // C's turn
        roundNumber: 1,
        actedThisRound: ["A", "B", "C"], // All 3 acted
        erroredThisRound: [],
        breakerPlayer: "A",
      };

      handlePlayerError(state);

      assert.strictEqual(state.currentIndex, 0, "Should wrap to first player");
      assert.strictEqual(state.roundNumber, 2, "Round should advance to 2");
      assert.deepStrictEqual(
        state.actedThisRound,
        [],
        "actedThisRound should reset"
      );
    });

    it("should swap positions on first move by breaker if error", () => {
      const state = {
        order: ["A", "B", "C"],
        currentIndex: 0,
        roundNumber: 1,
        actedThisRound: ["A"], // Only breaker acted
        erroredThisRound: [],
        breakerPlayer: "A",
      };

      handlePlayerError(state);

      assert.deepStrictEqual(
        state.order,
        ["B", "A", "C"],
        "A and B should swap"
      );
      assert.strictEqual(
        state.currentIndex,
        0,
        "Index should stay at 0 (points to B now)"
      );
    });

    it("should NOT swap if breaker errors but not first move", () => {
      const state = {
        order: ["A", "B", "C"],
        currentIndex: 0, // A's turn again
        roundNumber: 2, // Round 2, not first move
        actedThisRound: ["A"],
        erroredThisRound: [],
        breakerPlayer: "A",
      };

      handlePlayerError(state);

      assert.deepStrictEqual(
        state.order,
        ["A", "B", "C"],
        "No swap should occur"
      );
      assert.strictEqual(state.currentIndex, 1, "Should advance normally");
    });
  });

  describe("handlePlayerSuccess", () => {
    it("should advance turn to next player on success", () => {
      const state = {
        order: ["A", "B", "C"],
        currentIndex: 0,
        roundNumber: 1,
        actedThisRound: ["A"],
        erroredThisRound: [],
        breakerPlayer: "A",
      };

      handlePlayerSuccess(state);

      assert.strictEqual(state.currentIndex, 1, "Should advance to B");
      assert.strictEqual(state.roundNumber, 1, "Should stay in round 1");
    });

    it("should advance to round 2 after all players succeed", () => {
      const state = {
        order: ["A", "B", "C"],
        currentIndex: 2,
        roundNumber: 1,
        actedThisRound: ["A", "B", "C"], // All acted
        erroredThisRound: [],
        breakerPlayer: "A",
      };

      handlePlayerSuccess(state);

      assert.strictEqual(state.currentIndex, 0);
      assert.strictEqual(state.roundNumber, 2);
      assert.deepStrictEqual(state.actedThisRound, []);
    });
  });

  describe("Round Management Edge Cases", () => {
    it("should handle 5 players completing round 1", () => {
      const state = {
        order: ["A", "B", "C", "D", "E"],
        currentIndex: 4, // E's turn (last player)
        roundNumber: 1,
        actedThisRound: ["A", "B", "C", "D", "E"], // All 5 acted
        erroredThisRound: [],
        breakerPlayer: "A",
      };

      handlePlayerError(state);

      assert.strictEqual(state.currentIndex, 0, "Should wrap to A");
      assert.strictEqual(state.roundNumber, 2, "Should advance to round 2");
      assert.strictEqual(
        state.actedThisRound.length,
        0,
        "actedThisRound should be empty"
      );
    });

    it("should NOT advance round if only 4 out of 5 acted", () => {
      const state = {
        order: ["A", "B", "C", "D", "E"],
        currentIndex: 3, // D's turn
        roundNumber: 1,
        actedThisRound: ["A", "B", "C", "D"], // Only 4 acted
        erroredThisRound: [],
        breakerPlayer: "A",
      };

      handlePlayerError(state);

      assert.strictEqual(state.currentIndex, 4, "Should advance to E");
      assert.strictEqual(state.roundNumber, 1, "Should stay in round 1");
      assert.strictEqual(state.actedThisRound.length, 4);
    });
  });
});
