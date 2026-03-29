const test = require("node:test");
const assert = require("node:assert/strict");

const {
  LEVEL_RULE_TYPES,
  createInitialRoundState,
  evaluateMoneyMeterMove,
  isMoneyMeterSelectionLocked,
} = require("./gameLogic.js");

function applySequence(levelConfig, values) {
  let state = createInitialRoundState(levelConfig);
  const moves = [];

  for (const value of values) {
    const move = evaluateMoneyMeterMove(state, value);
    moves.push(move);

    if (move.accepted) {
      state = move.nextState;
    }
  }

  return {
    state,
    moves,
  };
}

test("same-denomination levels lock to the first coin and can win exactly", () => {
  const result = applySequence(
    {
      targetAmount: 10,
      ruleType: LEVEL_RULE_TYPES.SAME_DENOMINATION,
    },
    [2, 2, 2, 2, 2],
  );

  assert.equal(result.state.total, 10);
  assert.equal(result.state.selectedDenomination, 2);
  assert.equal(result.state.isComplete, true);
  assert.equal(result.moves[0].reason, "locked-denomination");
  assert.equal(result.moves.at(-1).reason, "win");
});

test("same-denomination levels reject mixed coins after the first valid tap", () => {
  const result = applySequence(
    {
      targetAmount: 7,
      ruleType: LEVEL_RULE_TYPES.SAME_DENOMINATION,
    },
    [2, 5, 2],
  );

  assert.equal(result.moves[0].accepted, true);
  assert.equal(result.moves[1].accepted, false);
  assert.equal(result.moves[1].reason, "mixed-denomination");
  assert.equal(result.state.total, 4);
  assert.equal(result.state.selectedDenomination, 2);
});

test("mixed levels allow any combination to reach the target", () => {
  const result = applySequence(
    {
      targetAmount: 13,
      ruleType: LEVEL_RULE_TYPES.MIXED,
    },
    [10, 2, 1],
  );

  assert.equal(result.state.total, 13);
  assert.equal(result.state.selectedDenomination, null);
  assert.equal(result.state.isComplete, true);
  assert.equal(result.moves.at(-1).reason, "win");
});

test("mixed levels keep every denomination available until completion", () => {
  const state = createInitialRoundState({
    targetAmount: 20,
    ruleType: LEVEL_RULE_TYPES.MIXED,
  });

  assert.equal(isMoneyMeterSelectionLocked(state, 1), false);
  assert.equal(isMoneyMeterSelectionLocked(state, 2), false);
  assert.equal(isMoneyMeterSelectionLocked(state, 5), false);
  assert.equal(isMoneyMeterSelectionLocked(state, 10), false);
});

test("overflow is rejected against the active level target", () => {
  const move = evaluateMoneyMeterMove(
    {
      targetAmount: 13,
      ruleType: LEVEL_RULE_TYPES.MIXED,
      total: 12,
      selectedDenomination: null,
    },
    2,
  );

  assert.equal(move.accepted, false);
  assert.equal(move.reason, "overflow");
  assert.equal(move.nextState.total, 12);
  assert.equal(move.nextState.isComplete, false);
});
