const test = require("node:test");
const assert = require("node:assert/strict");

const {
  LEVEL_RULE_TYPES,
  createInitialRoundState,
  evaluateMoneyMeterMove,
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

test("same-denomination levels now accept mixed money and can win exactly", () => {
  const result = applySequence(
    {
      targetAmount: 10,
      ruleType: LEVEL_RULE_TYPES.SAME_DENOMINATION,
    },
    [2, 5, 2, 1],
  );

  assert.equal(result.moves.every((move) => move.accepted), true);
  assert.equal(result.state.total, 10);
  assert.equal(result.state.isComplete, true);
  assert.equal(result.moves.at(-1).reason, "win");
});

test("exact totals can still be exceeded before the round is checked", () => {
  const result = applySequence(
    {
      targetAmount: 10,
      ruleType: LEVEL_RULE_TYPES.SAME_DENOMINATION,
    },
    [5, 5, 1],
  );

  assert.equal(result.moves.at(-1).accepted, true);
  assert.equal(result.moves.at(-1).reason, "overflow");
  assert.equal(result.state.total, 11);
  assert.equal(result.state.isComplete, false);
  assert.equal(result.state.isOverflowing, true);
});

test("mixed levels allow any combination to reach the target", () => {
  const result = applySequence(
    {
      targetAmount: 13,
      overflowTolerance: 3,
      ruleType: LEVEL_RULE_TYPES.MIXED,
    },
    [10, 2, 1],
  );

  assert.equal(result.state.total, 13);
  assert.equal(result.state.isComplete, true);
  assert.equal(result.moves.at(-1).reason, "win");
});

test("levels no longer lock the tray to a single denomination", () => {
  const state = createInitialRoundState({
    targetAmount: 20,
    overflowTolerance: 3,
    ruleType: LEVEL_RULE_TYPES.SAME_DENOMINATION,
  });

  [1, 2, 5, 10, 20].forEach((value) => {
    const move = evaluateMoneyMeterMove(state, value);
    assert.equal(move.accepted, true);
  });
});

test("overflow is accepted immediately and marked as overflow", () => {
  const move = evaluateMoneyMeterMove(
    {
      targetAmount: 7,
      ruleType: LEVEL_RULE_TYPES.MIXED,
      total: 0,
    },
    10,
  );

  assert.equal(move.accepted, true);
  assert.equal(move.reason, "overflow");
  assert.equal(move.nextState.total, 10);
  assert.equal(move.nextState.isComplete, false);
  assert.equal(move.nextState.isOverflowing, true);
});

test("overflow keeps accepting more money beyond the old tolerance", () => {
  const move = evaluateMoneyMeterMove(
    {
      targetAmount: 13,
      overflowTolerance: 3,
      ruleType: LEVEL_RULE_TYPES.MIXED,
      total: 12,
    },
    5,
  );

  assert.equal(move.accepted, true);
  assert.equal(move.reason, "overflow");
  assert.equal(move.nextState.total, 17);
  assert.equal(move.nextState.isOverflowing, true);
});

test("invalid denominations are still rejected", () => {
  const move = evaluateMoneyMeterMove(
    {
      targetAmount: 13,
      ruleType: LEVEL_RULE_TYPES.MIXED,
      total: 4,
    },
    3,
  );

  assert.equal(move.accepted, false);
  assert.equal(move.reason, "invalid-denomination");
  assert.equal(move.nextState.total, 4);
  assert.equal(move.nextState.isComplete, false);
});
