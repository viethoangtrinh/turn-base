const assert = require("assert");
const {
  handlePlayerError,
  handlePlayerSuccess,
} = require("../utils/gameLogic");

describe("Game Logic - Bida Đánh Đền Rules", () => {
  describe("Scenario: Phá bi lỗi (First move)", () => {
    it("should NOT swap when breaker errors - advance to next player", () => {
      const state = {
        order: ["1", "2", "3", "4", "5"],
        currentIndex: 0,
        roundNumber: 1,
        actedThisRound: ["1"],
        erroredThisRound: [],
        breakerPlayer: "1",
      };

      handlePlayerError(state);

      assert.deepStrictEqual(
        state.order,
        ["1", "2", "3", "4", "5"],
        "Order should NOT change on breaker error"
      );
      assert.strictEqual(state.currentIndex, 1, "Should advance to player 2");
      assert.strictEqual(state.roundNumber, 1);
    });
  });

  describe("Scenario: Player errors - previous player benefits", () => {
    it("should SWAP when player 3 errors (player 2 benefits)", () => {
      const state = {
        order: ["1", "2", "3", "4", "5"],
        currentIndex: 2, // Player 3's turn
        roundNumber: 1,
        actedThisRound: ["1", "2", "3"],
        erroredThisRound: ["1"], // Only player 1 errored (phá bi)
        breakerPlayer: "1",
      };

      handlePlayerError(state);

      assert.deepStrictEqual(
        state.order,
        ["1", "3", "2", "4", "5"],
        "3 and 2 should swap"
      );
      assert.strictEqual(
        state.currentIndex,
        2,
        "Should point to player 2 (who moved up)"
      );
    });
  });

  describe("Scenario: Previous player already errored - NO swap", () => {
    it("should NOT swap when player 2 errors (player 3 already errored)", () => {
      const state = {
        order: ["1", "3", "2", "4", "5"], // After previous swap
        currentIndex: 2, // Player 2's turn
        roundNumber: 1,
        actedThisRound: ["1", "3", "2"],
        erroredThisRound: ["1", "3"], // Player 3 already errored
        breakerPlayer: "1",
      };

      handlePlayerError(state);

      assert.deepStrictEqual(
        state.order,
        ["1", "3", "2", "4", "5"],
        "No swap - player 3 already errored"
      );
      assert.strictEqual(state.currentIndex, 3, "Should advance to player 4");
    });
  });

  describe("Scenario: Player 5 errors - player 4 benefits", () => {
    it("should SWAP when player 5 errors", () => {
      const state = {
        order: ["1", "3", "2", "4", "5"],
        currentIndex: 4, // Player 5's turn
        roundNumber: 1,
        actedThisRound: ["1", "3", "2", "4", "5"],
        erroredThisRound: ["1", "3", "2"],
        breakerPlayer: "1",
      };

      handlePlayerError(state);

      assert.deepStrictEqual(
        state.order,
        ["1", "3", "2", "5", "4"],
        "5 and 4 should swap"
      );
      assert.strictEqual(state.currentIndex, 4, "Should point to player 4");
    });
  });

  describe("Scenario: Round completion", () => {
    it("should advance to round 2 after all players acted", () => {
      const state = {
        order: ["1", "3", "2", "5", "4"],
        currentIndex: 4, // Player 4's turn (last in order)
        roundNumber: 1,
        actedThisRound: ["1", "3", "2", "5", "4"],
        erroredThisRound: ["1", "3", "2", "5"],
        breakerPlayer: "1",
      };

      // Player 4 finishes (success or error)
      handlePlayerSuccess(state);

      assert.strictEqual(state.currentIndex, 0, "Should wrap to first player");
      assert.strictEqual(state.roundNumber, 2, "Should advance to round 2");
      assert.deepStrictEqual(
        state.actedThisRound,
        [],
        "actedThisRound should reset"
      );
      assert.deepStrictEqual(
        state.erroredThisRound,
        [],
        "erroredThisRound should reset for new round"
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle wrap-around (last player errors, first player benefits)", () => {
      const state = {
        order: ["1", "2", "3", "4", "5"],
        currentIndex: 4, // Player 5's turn
        roundNumber: 1,
        actedThisRound: ["1", "2", "3", "4", "5"],
        erroredThisRound: [], // No one errored yet
        breakerPlayer: "1",
      };

      handlePlayerError(state);

      // Player 4 (index 3) should benefit, swap with 5
      assert.deepStrictEqual(
        state.order,
        ["1", "2", "3", "5", "4"],
        "Should swap 5 and 4"
      );
      assert.strictEqual(state.currentIndex, 4, "Should point to player 4");
    });

    it("should handle breaker not at index 0 after swaps", () => {
      const state = {
        order: ["2", "1", "3", "4", "5"], // Breaker at index 1
        currentIndex: 0, // Player 2's turn
        roundNumber: 2,
        actedThisRound: ["2"],
        erroredThisRound: [],
        breakerPlayer: "1",
      };

      handlePlayerError(state);

      // Player 2 errors, prev is player 5 (index 4, wrap-around)
      // Player 5 hasn't errored → SWAP
      assert.deepStrictEqual(
        state.order,
        ["5", "1", "3", "4", "2"],
        "2 and 5 should swap"
      );
      assert.strictEqual(state.currentIndex, 0, "Should point to player 5");
    });

    it("should handle breaker errors twice (Round 1 phá bi, Round 2 normal error)", () => {
      // Scenario: Việt Hoàng (breaker) errors on first move (phá bi)
      // Then all other players play
      // In Round 2, Việt Hoàng errors again - should swap with Tấn Đạt

      const state = {
        order: ["Việt Hoàng", "Hùng Anh", "Tân", "Duy Thuần", "Tấn Đạt"],
        currentIndex: 0, // Việt Hoàng's turn (first move)
        roundNumber: 1,
        actedThisRound: ["Việt Hoàng"],
        erroredThisRound: [],
        breakerPlayer: "Việt Hoàng",
      };

      // First error: Phá bi lỗi
      handlePlayerError(state);

      assert.deepStrictEqual(
        state.order,
        ["Việt Hoàng", "Hùng Anh", "Tân", "Duy Thuần", "Tấn Đạt"],
        "No swap on breaker's first error"
      );
      assert.strictEqual(state.currentIndex, 1, "Should advance to Hùng Anh");
      assert.strictEqual(state.roundNumber, 1);

      // Simulate other players playing (all succeed)
      state.actedThisRound.push("Hùng Anh", "Tân", "Duy Thuần", "Tấn Đạt");
      state.currentIndex = 0; // Back to Việt Hoàng for Round 2

      // At this point, all 5 players have acted, so next action will trigger round advancement
      // Let's manually advance the round and clear lists
      state.roundNumber = 2;
      state.actedThisRound = ["Việt Hoàng"]; // Only Việt Hoàng has acted in Round 2
      state.erroredThisRound = []; // Clear for new round

      // Second error: Việt Hoàng errors in Round 2
      handlePlayerError(state);

      // Now it should SWAP because:
      // - Not first move (roundNumber = 2)
      // - Previous player (Tấn Đạt) hasn't errored in Round 2
      assert.deepStrictEqual(
        state.order,
        ["Tấn Đạt", "Hùng Anh", "Tân", "Duy Thuần", "Việt Hoàng"],
        "Should swap Việt Hoàng and Tấn Đạt"
      );
      assert.strictEqual(state.currentIndex, 0, "Should point to Tấn Đạt");
      assert.strictEqual(state.roundNumber, 2);
    });
  });
});
