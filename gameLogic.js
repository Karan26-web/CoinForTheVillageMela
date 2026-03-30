(function attachMoneyMeterGameLogic(globalScope) {
  const DEFAULT_TARGET_AMOUNT = 10;
  const DEFAULT_OVERFLOW_TOLERANCE = 0;
  const VALID_DENOMINATIONS = Object.freeze([1, 2, 5, 10, 20]);
  const LEVEL_RULE_TYPES = Object.freeze({
    SAME_DENOMINATION: "same-denomination",
    MIXED: "mixed",
  });

  function sanitizeDenomination(value) {
    const numericValue = Number(value);
    return Number.isInteger(numericValue) ? numericValue : Number.NaN;
  }

  function sanitizeTargetAmount(value) {
    const numericValue = Number(value);
    return Number.isInteger(numericValue) && numericValue > 0
      ? numericValue
      : DEFAULT_TARGET_AMOUNT;
  }

  function sanitizeOverflowTolerance(value) {
    const numericValue = Number(value);
    return Number.isInteger(numericValue) && numericValue >= 0
      ? numericValue
      : DEFAULT_OVERFLOW_TOLERANCE;
  }

  function isValidDenomination(value) {
    return VALID_DENOMINATIONS.includes(value);
  }

  function isValidRuleType(value) {
    return Object.values(LEVEL_RULE_TYPES).includes(value);
  }

  function createRoundState({
    targetAmount = DEFAULT_TARGET_AMOUNT,
    overflowTolerance = DEFAULT_OVERFLOW_TOLERANCE,
    ruleType = LEVEL_RULE_TYPES.SAME_DENOMINATION,
    total = 0,
    selectedDenomination = null,
  } = {}) {
    return Object.freeze({
      targetAmount,
      overflowTolerance,
      ruleType,
      total,
      selectedDenomination,
      isComplete: total === targetAmount,
      isOverflowing: total > targetAmount,
    });
  }

  function normalizeRoundState(state) {
    const targetAmount = sanitizeTargetAmount(state && state.targetAmount);
    const overflowTolerance = sanitizeOverflowTolerance(
      state && state.overflowTolerance,
    );
    const total = Number(state && state.total);
    const rawRuleType = state && state.ruleType;
    const ruleType = isValidRuleType(rawRuleType)
      ? rawRuleType
      : LEVEL_RULE_TYPES.SAME_DENOMINATION;
    const rawDenomination =
      state && state.selectedDenomination !== undefined
        ? state.selectedDenomination
        : null;
    const selectedDenomination =
      rawDenomination === null ? null : sanitizeDenomination(rawDenomination);

    return createRoundState({
      targetAmount,
      overflowTolerance,
      ruleType,
      total: Number.isInteger(total) && total >= 0 ? total : 0,
      selectedDenomination:
        ruleType === LEVEL_RULE_TYPES.SAME_DENOMINATION &&
        isValidDenomination(selectedDenomination)
          ? selectedDenomination
          : null,
    });
  }

  function createInitialRoundState(levelConfig = {}) {
    return normalizeRoundState(levelConfig);
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
    const currentState = normalizeRoundState(state);
    const denomination = sanitizeDenomination(clickedValue);
    const usesStrictRule =
      currentState.ruleType === LEVEL_RULE_TYPES.SAME_DENOMINATION;
    const allowedMaximum =
      currentState.targetAmount + currentState.overflowTolerance;

    if (currentState.isComplete) {
      return buildRejectedMove(currentState, "complete");
    }

    if (!isValidDenomination(denomination)) {
      return buildRejectedMove(currentState, "invalid-denomination");
    }

    if (
      usesStrictRule &&
      currentState.selectedDenomination !== null &&
      denomination !== currentState.selectedDenomination
    ) {
      return buildRejectedMove(currentState, "mixed-denomination");
    }

    if (currentState.total + denomination > allowedMaximum) {
      return buildRejectedMove(currentState, "overflow");
    }

    const nextTotal = currentState.total + denomination;
    const nextState = createRoundState({
      targetAmount: currentState.targetAmount,
      overflowTolerance: currentState.overflowTolerance,
      ruleType: currentState.ruleType,
      total: nextTotal,
      selectedDenomination: usesStrictRule
        ? currentState.selectedDenomination ?? denomination
        : null,
    });

    return buildAcceptedMove(
      nextState,
      nextState.isComplete
        ? "win"
        : usesStrictRule && currentState.selectedDenomination === null
          ? "locked-denomination"
          : "progress",
    );
  }

  function isMoneyMeterSelectionLocked(state, clickedValue) {
    const currentState = normalizeRoundState(state);
    const denomination = sanitizeDenomination(clickedValue);

    if (currentState.isComplete) {
      return true;
    }

    if (!isValidDenomination(denomination)) {
      return true;
    }

    if (currentState.ruleType !== LEVEL_RULE_TYPES.SAME_DENOMINATION) {
      return false;
    }

    if (currentState.selectedDenomination === null) {
      return false;
    }

    return denomination !== currentState.selectedDenomination;
  }

  const api = Object.freeze({
    DEFAULT_TARGET_AMOUNT,
    GOAL_TOTAL: DEFAULT_TARGET_AMOUNT,
    VALID_DENOMINATIONS,
    LEVEL_RULE_TYPES,
    createInitialRoundState,
    createInitialMoneyMeterState: createInitialRoundState,
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
