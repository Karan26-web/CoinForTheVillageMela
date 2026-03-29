const test = require("node:test");
const assert = require("node:assert/strict");

const {
  GOAL_TOTAL,
  createInitialMoneyMeterState,
  evaluateMoneyMeterMove,
  isMoneyMeterSelectionLocked,
} = require("./gameLogic.js");

function applySequence(values) {
  let state = createInitialMoneyMeterState();
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

test("valid single-denomination rounds reach exactly ₹10", () => {
  const scenarios = [
    { denomination: 1, taps: 10 },
    { denomination: 2, taps: 5 },
    { denomination: 5, taps: 2 },
    { denomination: 10, taps: 1 },
  ];

  for (const scenario of scenarios) {
    const values = Array.from({ length: scenario.taps }, () => scenario.denomination);
    const result = applySequence(values);

    assert.equal(result.state.total, GOAL_TOTAL);
    assert.equal(result.state.selectedDenomination, scenario.denomination);
    assert.equal(result.state.isComplete, true);
    assert.equal(result.moves.at(-1).reason, "win");
  }
});

test("mixed denominations are rejected after the first selection locks the round", () => {
  const firstMove = evaluateMoneyMeterMove(createInitialMoneyMeterState(), 5);
  const secondMove = evaluateMoneyMeterMove(firstMove.nextState, 2);

  assert.equal(firstMove.accepted, true);
  assert.equal(firstMove.reason, "locked-denomination");
  assert.equal(secondMove.accepted, false);
  assert.equal(secondMove.reason, "mixed-denomination");
  assert.equal(secondMove.nextState.total, 5);
  assert.equal(secondMove.nextState.selectedDenomination, 5);
});

test("overflow is rejected even when the denomination matches", () => {
  const overflowMove = evaluateMoneyMeterMove(
    {
      total: 9,
      selectedDenomination: 2,
    },
    2,
  );

  assert.equal(overflowMove.accepted, false);
  assert.equal(overflowMove.reason, "overflow");
  assert.equal(overflowMove.nextState.total, 9);
  assert.equal(overflowMove.nextState.selectedDenomination, 2);
  assert.equal(overflowMove.nextState.isComplete, false);
});

test("locked selection helper only leaves the chosen denomination enabled", () => {
  const firstMove = evaluateMoneyMeterMove(createInitialMoneyMeterState(), 2);
  const lockedState = firstMove.nextState;

  assert.equal(isMoneyMeterSelectionLocked(lockedState, 1), true);
  assert.equal(isMoneyMeterSelectionLocked(lockedState, 5), true);
  assert.equal(isMoneyMeterSelectionLocked(lockedState, 10), true);
  assert.equal(isMoneyMeterSelectionLocked(lockedState, 2), false);
});
