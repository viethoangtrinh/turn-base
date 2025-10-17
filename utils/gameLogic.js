/**
 * Game Logic - Bida Đánh Đền
 *
 * Rules:
 * 1. Người lỗi → Người TRƯỚC được hưởng lợi (đánh lại)
 * 2. SWAP vị trí: Người lỗi xuống sau, người trước lên trước
 * 3. NGOẠI LỆ:
 *    - KHÔNG swap nếu người trước đã lỗi
 *    - KHÔNG swap nếu là lượt phá bi đầu tiên
 */

/**
 * Handle player error
 * @param {Object} state - Game state
 * @returns {Object} Updated state
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

  // Check if this is breaker's first move
  // Note: actedThisRound already includes current player (added by gameHandlers)
  // So first move means actedSet.size === 1 (only breaker)
  const isFirstMoveOfMatch =
    current === breakerPlayer && roundNumber === 1 && actedSet.size === 1; // Only breaker has acted (no one before)

  if (isFirstMoveOfMatch) {
    // NGOẠI LỆ: Phá bi lỗi → KHÔNG swap, chỉ advance
    state.currentIndex = (currentIndex + 1) % order.length;
  } else {
    // Tìm người trước (previous player in order)
    const prevIndex = (currentIndex - 1 + order.length) % order.length;
    const prevPlayer = order[prevIndex];

    // Check: Người trước đã lỗi chưa?
    const prevAlreadyErrored = erroredThisRound.includes(prevPlayer);

    if (!prevAlreadyErrored) {
      // SWAP: Người lỗi xuống, người trước lên
      const temp = order[prevIndex];
      order[prevIndex] = order[currentIndex];
      order[currentIndex] = temp;
      state.order = order;
      // currentIndex KHÔNG đổi (giờ trỏ người trước sau khi swap)
    } else {
      // Người trước đã lỗi → KHÔNG swap, advance bình thường
      state.currentIndex = (currentIndex + 1) % order.length;
    }
  }

  // Check round completion
  if (actedSet.size >= order.length) {
    state.roundNumber += 1;
    state.actedThisRound = [];
    state.erroredThisRound = []; // Clear errored list for new round
  }

  return state;
};

/**
 * Handle player success
 * @param {Object} state - Game state
 * @returns {Object} Updated state
 */
const handlePlayerSuccess = (state) => {
  const { order, currentIndex, actedThisRound } = state;

  // Advance to next player
  state.currentIndex = (currentIndex + 1) % order.length;

  // Check round completion
  const actedSet = new Set(actedThisRound);
  if (actedSet.size >= order.length) {
    state.roundNumber += 1;
    state.actedThisRound = [];
    state.erroredThisRound = []; // Clear errored list for new round
  }

  return state;
};

/**
 * Calculate next match order when a player wins
 * Winner becomes breaker, loser (player before winner) goes 2nd
 * @param {Array} currentOrder - Current player order
 * @param {Number} winnerIndex - Index of winner in current order
 * @returns {Array} New order for next match
 */
const calculateNextMatchOrder = (currentOrder, winnerIndex) => {
  const n = currentOrder.length;
  const winner = currentOrder[winnerIndex];
  const loserIndex = (winnerIndex - 1 + n) % n;
  const loser = currentOrder[loserIndex];

  // New order: winner, loser, then others after winner
  const newOrder = [winner, loser];

  for (let i = 1; i < n - 1; i++) {
    const idx = (winnerIndex + i) % n;
    if (idx !== loserIndex) {
      newOrder.push(currentOrder[idx]);
    }
  }

  return newOrder;
};

module.exports = {
  handlePlayerError,
  handlePlayerSuccess,
  calculateNextMatchOrder,
};
