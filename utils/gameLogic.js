/**
 * Game Logic Utilities
 * Contains all game rules and state transitions
 */

/**
 * Handle player error and update game state
 * @param {Object} state - Current game state
 * @param {String} playerName - Name of player who errored
 * @returns {Object} Updated state with game logic applied
 */
const handlePlayerError = (state) => {
  const {
    order,
    currentIndex,
    roundNumber,
    actedThisRound,
    erroredThisRound,
    breakerPlayer,
  } = state;

  const current = order[currentIndex];
  const actedSet = new Set(actedThisRound);

  // Special case: First move of match by breaker - swap ONLY if breaker's FIRST error
  // (not if breaker already errored before)
  const isFirstMoveOfMatch =
    current === breakerPlayer &&
    roundNumber === 1 &&
    actedSet.size === 1 && // Only breaker has acted
    !erroredThisRound.includes(breakerPlayer); // Breaker hasn't errored yet

  if (isFirstMoveOfMatch) {
    // First player errors → swap positions with 2nd player
    if (order.length >= 2) {
      const temp = order[0];
      order[0] = order[1];
      order[1] = temp;
      state.order = order;
      // currentIndex stays 0, but now points to new player
    }
  } else {
    // Normal error: advance to next player
    state.currentIndex = (currentIndex + 1) % order.length;
  }

  // Check if round is complete
  if (actedSet.size >= order.length) {
    // Everyone has acted → advance round
    state.roundNumber += 1;
    state.actedThisRound = [];
    // erroredThisRound persists across rounds until fixed
  }

  return state;
};

/**
 * Handle player success and update game state
 * @param {Object} state - Current game state
 * @param {String} playerName - Name of player who succeeded
 * @returns {Object} Updated state with game logic applied
 */
const handlePlayerSuccess = (state) => {
  const { order, currentIndex, actedThisRound } = state;

  // Advance to next player
  state.currentIndex = (currentIndex + 1) % order.length;

  // Check if round is complete
  const actedSet = new Set(actedThisRound);
  if (actedSet.size >= order.length) {
    // Everyone has acted → advance round
    state.roundNumber += 1;
    state.actedThisRound = [];
    // erroredThisRound persists across rounds until fixed
  }

  return state;
};

/**
 * Get current player name
 * @param {Object} state - Current game state
 * @returns {String} Current player's name
 */
const getCurrentPlayer = (state) => {
  return state.order[state.currentIndex];
};

/**
 * Check if a player has acted this round
 * @param {Object} state - Current game state
 * @param {String} playerName - Player name to check
 * @returns {Boolean}
 */
const hasActedThisRound = (state, playerName) => {
  return state.actedThisRound.includes(playerName);
};

/**
 * Check if round is complete (everyone has acted)
 * @param {Object} state - Current game state
 * @returns {Boolean}
 */
const isRoundComplete = (state) => {
  return state.actedThisRound.length >= state.order.length;
};

module.exports = {
  handlePlayerError,
  handlePlayerSuccess,
  getCurrentPlayer,
  hasActedThisRound,
  isRoundComplete,
};
