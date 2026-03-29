const {
  LEVEL_RULE_TYPES,
  VALID_DENOMINATIONS,
  createInitialRoundState,
  evaluateMoneyMeterMove,
  isMoneyMeterSelectionLocked,
} = window.MoneyMeterGameLogic;

const LEVELS = Object.freeze([
  Object.freeze({
    id: "merry-go-round",
    name: "Merry-Go-Round",
    targetAmount: 10,
    ruleType: LEVEL_RULE_TYPES.SAME_DENOMINATION,
    icon: "🎠",
  }),
  Object.freeze({
    id: "rainbow-slide",
    name: "Rainbow-Slide",
    targetAmount: 13,
    ruleType: LEVEL_RULE_TYPES.MIXED,
    icon: "🌈",
  }),
  Object.freeze({
    id: "giant-wheel",
    name: "Giant-Wheel",
    targetAmount: 7,
    ruleType: LEVEL_RULE_TYPES.MIXED,
    icon: "🎡",
  }),
  Object.freeze({
    id: "bumper-car",
    name: "Bumper-Car",
    targetAmount: 20,
    ruleType: LEVEL_RULE_TYPES.MIXED,
    icon: "🚗",
  }),
]);

const levelLookup = new Map(LEVELS.map((level) => [level.id, level]));

const confettiColors = Object.freeze([
  "#ff6b35",
  "#ffd447",
  "#58d36a",
  "#49b8ff",
  "#ff7ac6",
]);

const assetPaths = Object.freeze([
  "assets/Background.png",
  "assets/RealMAchine.png",
  "assets/banner.png",
  "assets/₹1.png",
  "assets/₹2.png",
  "assets/₹5.png",
  "assets/₹10Coin.png",
  "assets/₹10Note.png",
  "assets/ticket.png",
]);

let gameState = createInitialRoundState();
let activeLevelId = null;
let completedLevelIds = new Set();
let audioContext = null;
let confettiCleanupTimer = 0;
let ticketRevealTimer = 0;
let returnToSelectionTimer = 0;

const pageShell = document.querySelector(".page-shell");
const gameTitle = document.getElementById("gameTitle");
const statusMessage = document.getElementById("statusMessage");
const selectionScreen = document.getElementById("selectionScreen");
const gameScreen = document.getElementById("gameScreen");
const rideList = document.getElementById("rideList");
const levelName = document.getElementById("levelName");
const selectionHint = document.getElementById("selectionHint");
const machineTotal = document.getElementById("machineTotal");
const meterFill = document.getElementById("meterFill");
const machineMeter = document.getElementById("machineMeter");
const backButton = document.getElementById("backButton");
const restartButton = document.getElementById("restartButton");
const confettiLayer = document.getElementById("confettiLayer");
const moneyButtons = [...document.querySelectorAll(".money-button")];

function getActiveLevel() {
  return activeLevelId ? levelLookup.get(activeLevelId) ?? null : null;
}

function preloadAssets() {
  assetPaths.forEach((src) => {
    const image = new Image();
    image.src = src;
  });
}

function formatRupees(value) {
  return `₹${value}`;
}

function formatDenomination(value) {
  return value === 10 ? "₹10" : `₹${value} coin`;
}

function getRuleBadgeText(ruleType) {
  return ruleType === LEVEL_RULE_TYPES.MIXED ? "Mix Coins" : "Same Coin Only";
}

function getSelectionScreenStatus() {
  if (completedLevelIds.size === LEVELS.length) {
    return "Every ride is complete. Refresh the page if you want to play the carnival again.";
  }

  if (completedLevelIds.size === 0) {
    return "Choose a ride to start the next level.";
  }

  const rideWord = completedLevelIds.size === 1 ? "ride" : "rides";
  return `${completedLevelIds.size} ${rideWord} complete. Choose another ride.`;
}

function getAvailableMoves(state) {
  return VALID_DENOMINATIONS.filter(
    (value) => evaluateMoneyMeterMove(state, value).accepted,
  );
}

function isRoundStuck() {
  const level = getActiveLevel();
  if (!level || gameState.isComplete) {
    return false;
  }

  return getAvailableMoves(gameState).length === 0;
}

function renderRideList() {
  const fragment = document.createDocumentFragment();

  LEVELS.forEach((level) => {
    const button = document.createElement("button");
    const isCompleted = completedLevelIds.has(level.id);
    const ruleLabel = getRuleBadgeText(level.ruleType);

    button.type = "button";
    button.className = "ride-card";
    button.dataset.levelId = level.id;
    button.disabled = isCompleted;
    button.setAttribute("role", "listitem");
    button.setAttribute(
      "aria-label",
      `${level.name}, target ${formatRupees(level.targetAmount)}, ${ruleLabel}`,
    );

    if (isCompleted) {
      button.classList.add("is-completed");
    }

    button.innerHTML = `
      <span class="ride-card__icon-shell" aria-hidden="true">
        <span class="ride-card__icon">${level.icon}</span>
      </span>
      <span class="ride-card__copy">
        <span class="ride-card__name">${level.name}</span>
      </span>
      <span class="ride-card__target">${formatRupees(level.targetAmount)}</span>
    `;

    fragment.appendChild(button);
  });

  rideList.replaceChildren(fragment);
}

function refreshHeader() {
  const level = getActiveLevel();

  if (!level) {
    gameTitle.textContent = "Welcome to the Carnival Coins!";
    return;
  }

  gameTitle.textContent = `Help Aru make ${formatRupees(level.targetAmount)}`;
  levelName.textContent = level.name;
}

function refreshMessages(customStatusMessage = "") {
  const level = getActiveLevel();

  if (!level) {
    statusMessage.textContent = customStatusMessage || getSelectionScreenStatus();
    selectionHint.textContent = "Choose a ride to begin.";
    return;
  }

  if (gameState.isComplete) {
    statusMessage.textContent = `${level.name} complete! Returning to ride selection...`;
    selectionHint.textContent =
      "Ticket earned. This ride will be marked complete on the selection board.";
    return;
  }

  if (customStatusMessage) {
    statusMessage.textContent = customStatusMessage;
  } else if (level.ruleType === LEVEL_RULE_TYPES.MIXED) {
    const remaining = level.targetAmount - gameState.total;
    statusMessage.textContent =
      gameState.total === 0
        ? `Mix any coins to reach ${formatRupees(level.targetAmount)}.`
        : `${formatRupees(remaining)} left. You can use any combination of coins.`;
  } else if (gameState.selectedDenomination === null) {
    statusMessage.textContent =
      "Tap any valid coin to begin. That first coin will lock the whole ride.";
  } else if (isRoundStuck()) {
    const remaining = level.targetAmount - gameState.total;
    statusMessage.textContent = `${formatRupees(remaining)} left, but another ${formatRupees(gameState.selectedDenomination)} would go over. Restart this ride and choose a different first coin.`;
  } else {
    const remaining = level.targetAmount - gameState.total;

    statusMessage.textContent =
      remaining === gameState.selectedDenomination
        ? `So close! One more ${formatRupees(gameState.selectedDenomination)} gets you to ${formatRupees(level.targetAmount)}.`
        : `${formatRupees(remaining)} left. Keep using only the ${formatDenomination(gameState.selectedDenomination)}.`;
  }

  selectionHint.textContent =
    level.ruleType === LEVEL_RULE_TYPES.MIXED
      ? "Mixed ride: every denomination stays available until you hit the target."
      : gameState.selectedDenomination === null
        ? "Same Coin Only ride: the first valid coin decides the only denomination you can keep using."
        : `Locked to ${formatDenomination(gameState.selectedDenomination)} for this ride.`;
}

function refreshButtons() {
  const level = getActiveLevel();

  moneyButtons.forEach((button) => {
    const value = Number(button.dataset.value);
    const preview = level
      ? evaluateMoneyMeterMove(gameState, value)
      : { accepted: false, reason: "inactive" };
    const isRuleLocked = level
      ? isMoneyMeterSelectionLocked(gameState, value)
      : true;
    const isOverflowBlocked =
      Boolean(level) && !preview.accepted && preview.reason === "overflow";
    const isSelected =
      Boolean(level) &&
      level.ruleType === LEVEL_RULE_TYPES.SAME_DENOMINATION &&
      !gameState.isComplete &&
      gameState.selectedDenomination === value;

    button.classList.toggle("is-selected", isSelected);
    button.classList.toggle("is-locked", isRuleLocked);
    button.classList.toggle("is-overflow-blocked", isOverflowBlocked);
    button.classList.toggle(
      "is-complete-locked",
      Boolean(level) && gameState.isComplete,
    );
    button.setAttribute("aria-pressed", String(isSelected));
    button.disabled = !preview.accepted;
  });
}

function refreshMeter() {
  const level = getActiveLevel();
  const targetAmount = level ? level.targetAmount : 10;
  const currentTotal = level ? gameState.total : 0;
  const fillAmount = level ? (currentTotal / targetAmount) * 100 : 0;

  meterFill.style.height = `${fillAmount}%`;
  machineMeter.setAttribute("aria-valuemax", String(targetAmount));
  machineMeter.setAttribute("aria-valuenow", String(currentTotal));
  machineMeter.setAttribute(
    "aria-valuetext",
    level
      ? `${formatRupees(currentTotal)} out of ${formatRupees(targetAmount)}`
      : "No ride selected",
  );
  machineTotal.textContent = formatRupees(currentTotal);
}

function refreshPhase() {
  const level = getActiveLevel();
  const isGameView = Boolean(level);
  const isComplete = isGameView && gameState.isComplete;
  const completionRatio = isGameView ? gameState.total / level.targetAmount : 0;

  selectionScreen.hidden = isGameView;
  gameScreen.hidden = !isGameView;

  pageShell.classList.toggle("is-selection-view", !isGameView);
  pageShell.classList.toggle("is-game-view", isGameView);
  pageShell.classList.toggle(
    "is-near-complete",
    isGameView && !isComplete && completionRatio >= 0.8,
  );
  pageShell.classList.toggle("is-complete", isComplete);

  if (!isComplete) {
    pageShell.classList.remove("is-ticket-visible");
  }

  backButton.disabled = !isGameView;
  restartButton.disabled = !isGameView;
}

function clearReturnToSelection() {
  window.clearTimeout(returnToSelectionTimer);
  returnToSelectionTimer = 0;
}

function playTone({ frequency, duration, type = "triangle", gainLevel = 0.07, sweepTo }) {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) {
    return;
  }

  audioContext = audioContext || new AudioCtor();

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);

  if (sweepTo) {
    oscillator.frequency.exponentialRampToValueAtTime(sweepTo, now + duration);
  }

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(gainLevel, now + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playTapSound(value) {
  playTone({
    frequency: 260 + value * 38,
    duration: 0.13,
    type: "triangle",
    gainLevel: 0.06,
    sweepTo: 180 + value * 20,
  });
}

function playDeniedSound() {
  playTone({
    frequency: 170,
    duration: 0.1,
    type: "sawtooth",
    gainLevel: 0.035,
    sweepTo: 120,
  });
}

function playSuccessChime() {
  playTone({
    frequency: 523.25,
    duration: 0.18,
    type: "triangle",
    gainLevel: 0.07,
    sweepTo: 659.25,
  });

  window.setTimeout(() => {
    playTone({
      frequency: 659.25,
      duration: 0.22,
      type: "sine",
      gainLevel: 0.05,
      sweepTo: 783.99,
    });
  }, 90);
}

function clearConfettiBurst() {
  if (!confettiLayer) {
    return;
  }

  window.clearTimeout(confettiCleanupTimer);
  confettiCleanupTimer = 0;
  confettiLayer.replaceChildren();
}

function clearTicketReveal() {
  window.clearTimeout(ticketRevealTimer);
  ticketRevealTimer = 0;
  pageShell.classList.remove("is-ticket-visible");
}

function clearRoundEffects() {
  clearConfettiBurst();
  clearTicketReveal();
  clearReturnToSelection();
}

function launchConfettiBurst() {
  if (!confettiLayer) {
    return;
  }

  clearConfettiBurst();

  const particleCount = 14;
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < particleCount; index += 1) {
    const piece = document.createElement("span");
    const spreadProgress = particleCount === 1 ? 0.5 : index / (particleCount - 1);
    const angle = (-130 + spreadProgress * 80) * (Math.PI / 180);
    const distance = 58 + Math.random() * 84;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance - 26;

    piece.className = "confetti-piece";

    if (index % 4 === 0) {
      piece.classList.add("confetti-piece--dot");
    }

    piece.style.setProperty("--tx", `${x.toFixed(1)}px`);
    piece.style.setProperty("--ty", `${y.toFixed(1)}px`);
    piece.style.setProperty("--rot", `${(-180 + Math.random() * 360).toFixed(1)}deg`);
    piece.style.setProperty("--size", `${(8 + Math.random() * 7).toFixed(1)}px`);
    piece.style.setProperty("--delay", `${Math.round(Math.random() * 110)}ms`);
    piece.style.setProperty(
      "--color",
      confettiColors[index % confettiColors.length],
    );

    fragment.appendChild(piece);
  }

  confettiLayer.appendChild(fragment);
  confettiCleanupTimer = window.setTimeout(clearConfettiBurst, 1200);
}

function runSuccessSequence() {
  clearTicketReveal();
  playSuccessChime();
  launchConfettiBurst();
  ticketRevealTimer = window.setTimeout(() => {
    pageShell.classList.add("is-ticket-visible");
    ticketRevealTimer = 0;
  }, 1080);
}

function scheduleReturnToSelection() {
  clearReturnToSelection();

  returnToSelectionTimer = window.setTimeout(() => {
    const completedLevel = getActiveLevel();
    if (!completedLevel) {
      return;
    }

    completedLevelIds.add(completedLevel.id);
    showSelectionScreen(`${completedLevel.name} is complete! Choose another ride.`);
  }, 2200);
}

function restartAnimation(button, className) {
  button.classList.remove(className);
  void button.offsetWidth;
  button.classList.add(className);
  window.setTimeout(() => button.classList.remove(className), 320);
}

function updateGame(customStatusMessage = "") {
  renderRideList();
  refreshHeader();
  refreshMeter();
  refreshMessages(customStatusMessage);
  refreshButtons();
  refreshPhase();
}

function startLevel(levelId) {
  const level = levelLookup.get(levelId);

  if (!level || completedLevelIds.has(levelId)) {
    return;
  }

  clearRoundEffects();
  activeLevelId = levelId;
  gameState = createInitialRoundState(level);
  updateGame(
    level.ruleType === LEVEL_RULE_TYPES.MIXED
      ? `Collect exactly ${formatRupees(level.targetAmount)} for ${level.name}. Mix any coins you like.`
      : `Collect exactly ${formatRupees(level.targetAmount)} for ${level.name}. Your first valid coin will lock the ride.`,
  );
}

function showSelectionScreen(customStatusMessage = "") {
  clearRoundEffects();
  activeLevelId = null;
  gameState = createInitialRoundState();
  updateGame(customStatusMessage || getSelectionScreenStatus());
}

function restartActiveLevel() {
  const level = getActiveLevel();
  if (!level) {
    return;
  }

  clearRoundEffects();
  gameState = createInitialRoundState(level);
  updateGame(
    level.ruleType === LEVEL_RULE_TYPES.MIXED
      ? `${level.name} restarted. Mix any coins to reach ${formatRupees(level.targetAmount)}.`
      : `${level.name} restarted. Pick a first coin carefully because it will lock the whole ride.`,
  );
}

function handleRideSelection(event) {
  const button = event.target.closest(".ride-card");
  if (!button || !(button instanceof HTMLButtonElement)) {
    return;
  }

  startLevel(button.dataset.levelId);
}

function handleMoneyClick(event) {
  const level = getActiveLevel();
  const button = event.currentTarget;
  const clickedValue = Number(button.dataset.value);

  if (!level) {
    return;
  }

  const move = evaluateMoneyMeterMove(gameState, clickedValue);

  if (!move.accepted) {
    playDeniedSound();
    restartAnimation(button, "is-denied");
    return;
  }

  gameState = move.nextState;
  playTapSound(clickedValue);
  updateGame();
  restartAnimation(button, "is-bouncing");

  if (gameState.isComplete) {
    runSuccessSequence();
    scheduleReturnToSelection();
  } else if (isRoundStuck()) {
    updateGame(
      `That choice locked the ride to ${formatDenomination(gameState.selectedDenomination)}. Restart this ride to try a different first coin.`,
    );
  }
}

function init() {
  preloadAssets();
  updateGame();

  rideList.addEventListener("click", handleRideSelection);

  moneyButtons.forEach((button) => {
    button.addEventListener("click", handleMoneyClick);
  });

  backButton.addEventListener("click", () => {
    showSelectionScreen("Choose another ride when you are ready.");
  });

  restartButton.addEventListener("click", restartActiveLevel);
}

init();
