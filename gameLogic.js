(function attachMoneyMeterGameLogic(globalScope) {
  const GOAL_TOTAL = 10;
  const VALID_DENOMINATIONS = Object.freeze([1, 2, 5, 10]);

  function sanitizeDenomination(value) {
    const numericValue = Number(value);
    return Number.isInteger(numericValue) ? numericValue : Number.NaN;
  }

  function isValidDenomination(value) {
    return VALID_DENOMINATIONS.includes(value);
  }

  function createState(total, selectedDenomination) {
    return Object.freeze({
      total,
      selectedDenomination,
      isComplete: total === GOAL_TOTAL,
    });
  }

  function normalizeState(state) {
    const total = Number(state && state.total);
    const rawDenomination =
      state && state.selectedDenomination !== undefined
        ? state.selectedDenomination
        : null;
    const selectedDenomination =
      rawDenomination === null ? null : sanitizeDenomination(rawDenomination);

    return createState(
      Number.isInteger(total) && total >= 0 ? total : 0,
      isValidDenomination(selectedDenomination) ? selectedDenomination : null,
    );
  }

  function createInitialMoneyMeterState() {
    return createState(0, null);
  }

  function buildAcceptedMove(nextState, reason) {
    return Object.freeze({
      accepted: true,
      reason,
      nextState,
    });
  }

  function buildRejectedMove(state, reason) {
    return Object.freeze({
      accepted: false,
      reason,
      nextState: state,
    });
  }

  function evaluateMoneyMeterMove(state, clickedValue) {
    const currentState = normalizeState(state);
    const denomination = sanitizeDenomination(clickedValue);

    if (currentState.isComplete) {
      return buildRejectedMove(currentState, "complete");
    }

    if (!isValidDenomination(denomination)) {
      return buildRejectedMove(currentState, "invalid-denomination");
    }

    // The first selection locks the round to a single denomination.
    if (
      currentState.selectedDenomination !== null &&
      denomination !== currentState.selectedDenomination
    ) {
      return buildRejectedMove(currentState, "mixed-denomination");
    }

    if (currentState.total + denomination > GOAL_TOTAL) {
      return buildRejectedMove(currentState, "overflow");
    }

    const nextTotal = currentState.total + denomination;
    const nextDenomination = currentState.selectedDenomination ?? denomination;
    const nextState = createState(nextTotal, nextDenomination);

    return buildAcceptedMove(
      nextState,
      nextState.isComplete
        ? "win"
        : currentState.selectedDenomination === null
          ? "locked-denomination"
          : "progress",
    );
  }

  function isMoneyMeterSelectionLocked(state, clickedValue) {
    const currentState = normalizeState(state);
    const denomination = sanitizeDenomination(clickedValue);

    if (currentState.isComplete) {
      return true;
    }

    if (!isValidDenomination(denomination)) {
      return true;
    }

    if (currentState.selectedDenomination === null) {
      return false;
    }

    return denomination !== currentState.selectedDenomination;
  }

  const api = Object.freeze({
    GOAL_TOTAL,
    VALID_DENOMINATIONS,
    createInitialMoneyMeterState,
    evaluateMoneyMeterMove,
    isMoneyMeterSelectionLocked,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (globalScope) {
    globalScope.MoneyMeterGameLogic = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
