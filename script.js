const {
  LEVEL_RULE_TYPES,
  createInitialRoundState,
  evaluateMoneyMeterMove,
} = window.MoneyMeterGameLogic;

const LEVELS = Object.freeze([
  Object.freeze({
    id: "merry-go-round",
    name: "Merry-Go-Round",
    targetAmount: 10,
    overflowTolerance: 0,
    ruleType: LEVEL_RULE_TYPES.SAME_DENOMINATION,
    icon: "🎠",
    successScreenSrc: "assets/SuccessScreenMerrygoRound.png",
  }),
  Object.freeze({
    id: "rainbow-slide",
    name: "Rainbow-Slide",
    targetAmount: 13,
    overflowTolerance: 3,
    ruleType: LEVEL_RULE_TYPES.MIXED,
    icon: "🌈",
    successScreenSrc: "assets/SuccessScreenRainbowSlide.png",
  }),
  Object.freeze({
    id: "giant-wheel",
    name: "Giant-Wheel",
    targetAmount: 7,
    overflowTolerance: 3,
    ruleType: LEVEL_RULE_TYPES.MIXED,
    icon: "🎡",
    successScreenSrc: "assets/SuccessScreneGiantwheel.png",
  }),
  Object.freeze({
    id: "bumper-car",
    name: "Bumper-Car",
    targetAmount: 20,
    overflowTolerance: 3,
    ruleType: LEVEL_RULE_TYPES.MIXED,
    icon: "🚗",
    successScreenSrc: "assets/SuccessScreenBumperCar.png",
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
  "assets/Background2.png",
  "assets/RealMAchine.png",
  "assets/SuccessScreenMerrygoRound.png",
  "assets/SuccessScreenRainbowSlide.png",
  "assets/SuccessScreneGiantwheel.png",
  "assets/SuccessScreenBumperCar.png",
  "assets/banner.png",
  "assets/Dragarea.png",
  "assets/moneyContainer.png",
  "assets/CheckButton.png",
  "assets/UNdobutton.png",
  "assets/1.png",
  "assets/2.png",
  "assets/5.png",
  "assets/10Coin.png",
  "assets/10Note.png",
  "assets/20.png",
  "assets/ticket.png",
]);

let gameState = createInitialRoundState();
let activeLevelId = null;
let completedLevelIds = new Set();
let audioContext = null;
let confettiCleanupTimer = 0;
let ticketRevealTimer = 0;
let successPopupRevealTimer = 0;
let returnToSelectionTimer = 0;
let placedMoney = [];
let activeDragMoney = null;
let isRoundResolved = false;
let isRetryMode = false;
let isSuccessPopupOpen = false;

const pageShell = document.querySelector(".page-shell");
const gameTitle = document.getElementById("gameTitle");
const statusMessage = document.getElementById("statusMessage");
const selectionScreen = document.getElementById("selectionScreen");
const gameScreen = document.getElementById("gameScreen");
const rideList = document.getElementById("rideList");
const levelName = document.getElementById("levelName");
const selectionHint = document.getElementById("selectionHint");
const machineGoal = document.getElementById("machineGoal");
const machineImage = document.getElementById("machineImage");
const machineWrap = document.querySelector(".machine-wrap");
const machineTotal = document.getElementById("machineTotal");
const meterFill = document.getElementById("meterFill");
const machineMeter = document.getElementById("machineMeter");
const machineDropZone = document.getElementById("machineDropZone");
const dropZoneHint = document.getElementById("dropZoneHint");
const placedMoneyLayer = document.getElementById("placedMoneyLayer");
const backButton = document.getElementById("backButton");
const undoButton = document.getElementById("undoButton");
const checkButton = document.getElementById("checkButton");
const checkButtonLabel = document.getElementById("checkButtonLabel");
const confettiLayer = document.getElementById("confettiLayer");
const successPopup = document.getElementById("successPopup");
const successPopupImage = document.getElementById("successPopupImage");
const successPopupTitle = document.getElementById("successPopupTitle");
const successPopupSubtitle = document.getElementById("successPopupSubtitle");
const moneyButtons = [...document.querySelectorAll(".money-button")];
const moneyButtonByKind = new Map(
  moneyButtons.map((button) => [button.dataset.moneyKind, button]),
);
const moneyDefinitions = new Map(
  moneyButtons.map((button) => {
    const sprite = button.querySelector(".money-sprite");

    return [
      button.dataset.moneyKind,
      Object.freeze({
        kind: button.dataset.moneyKind,
        value: Number(button.dataset.value),
        label: button.getAttribute("aria-label") || formatDenomination(Number(button.dataset.value)),
        src: sprite instanceof HTMLImageElement ? sprite.getAttribute("src") || "" : "",
        isNote: button.classList.contains("money-button--note"),
      }),
    ];
  }),
);

function getActiveLevel() {
  return activeLevelId ? levelLookup.get(activeLevelId) ?? null : null;
}

function getMoneyDefinition(kind) {
  return moneyDefinitions.get(kind) ?? null;
}

function createMoneySelectionFromButton(button) {
  const definition = getMoneyDefinition(button.dataset.moneyKind);

  if (!definition) {
    return null;
  }

  return {
    kind: definition.kind,
    value: definition.value,
  };
}

function rebuildRoundStateFromPlacedMoney(level, items) {
  let nextState = createInitialRoundState(level);

  items.forEach((item) => {
    const move = evaluateMoneyMeterMove(nextState, item.value);
    nextState = move.accepted ? move.nextState : nextState;
  });

  return nextState;
}

function clearActiveDragState() {
  activeDragMoney = null;
  moneyButtons.forEach((button) => button.classList.remove("is-dragging"));

  if (machineDropZone) {
    machineDropZone.classList.remove("is-ready", "is-drop-target");
  }
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
  return value >= 10 ? `₹${value}` : `₹${value} coin`;
}

function getOverflowAmount(level, total) {
  if (!level) {
    return 0;
  }

  return Math.max(0, total - level.targetAmount);
}

function getRuleBadgeText(ruleType) {
  return "Any money allowed";
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
      <span class="ride-card__track" aria-hidden="true"></span>
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

  gameTitle.textContent =
    gameState.total > level.targetAmount
      ? "Oops ! That is too much."
      : gameState.isComplete || isRoundResolved
        ? "Perfect. Good job!"
        : `Make ${formatRupees(level.targetAmount)} using any money.`;
  levelName.textContent = level.name;
}

function refreshMessages(customStatusMessage = "") {
  const level = getActiveLevel();

  if (!level) {
    statusMessage.textContent = customStatusMessage || getSelectionScreenStatus();
    selectionHint.textContent = "Choose a ride to begin.";
    return;
  }

  if (isRetryMode) {
    statusMessage.textContent =
      customStatusMessage ||
      `Not the right price for ${level.name}. Press Try Again to restart this ride.`;
    selectionHint.textContent =
      "Wrong total. Press Try Again to clear the money and start this ride again.";
    return;
  }

  if (gameState.isComplete) {
    if (isRoundResolved) {
      statusMessage.textContent = `${level.name} complete! Returning to ride selection...`;
      selectionHint.textContent =
        "Ticket earned. This ride will be marked complete on the selection board.";
    } else {
      statusMessage.textContent = `Perfect total collected for ${level.name}. Press Check to finish the ride.`;
      selectionHint.textContent =
        "Use Check to confirm the total, or Undo to remove the last money item.";
    }
    return;
  }

  if (customStatusMessage) {
    statusMessage.textContent = customStatusMessage;
  } else if (gameState.total > level.targetAmount) {
    statusMessage.textContent = `${formatRupees(getOverflowAmount(level, gameState.total))} too much. Press Check to see the result, or Undo to fix it.`;
  } else {
    const remaining = level.targetAmount - gameState.total;
    statusMessage.textContent =
      gameState.total === 0
        ? `Drag or tap any money into the tray to reach ${formatRupees(level.targetAmount)}.`
        : `${formatRupees(remaining)} left. Add any money you want.`;
  }

  selectionHint.textContent =
    gameState.total > level.targetAmount
      ? "Overflow! The meter has gone past the target and turned red. Press Check or Undo the last money item."
      : "Add any money until you reach the target, then press Check.";
}

function refreshButtons() {
  const level = getActiveLevel();
  const isInteractionLocked = !level || isRoundResolved || isRetryMode;

  moneyButtons.forEach((button) => {
    button.classList.remove(
      "is-selected",
      "is-locked",
      "is-overflow-blocked",
      "is-complete-locked",
    );
    button.classList.toggle("is-inactive", Boolean(level) && isInteractionLocked);
    button.setAttribute("aria-pressed", "false");
    button.disabled = !level || isInteractionLocked;
    button.draggable = Boolean(level) && !isInteractionLocked;
  });
}

function refreshMeter() {
  const level = getActiveLevel();
  const targetAmount = level ? level.targetAmount : 10;
  const currentTotal = level ? gameState.total : 0;
  const fillAmount = level ? Math.min((currentTotal / targetAmount) * 100, 100) : 0;
  const isOverflowing = Boolean(level) && currentTotal > targetAmount;

  meterFill.style.height = `${fillAmount}%`;
  machineMeter.classList.toggle("is-overflowing", isOverflowing);
  machineMeter.setAttribute("aria-valuemax", String(targetAmount));
  machineMeter.setAttribute(
    "aria-valuenow",
    String(Math.min(currentTotal, targetAmount)),
  );
  machineMeter.setAttribute(
    "aria-valuetext",
    level
      ? isOverflowing
        ? `${formatRupees(currentTotal)} collected, ${formatRupees(currentTotal - targetAmount)} over the target of ${formatRupees(targetAmount)}`
        : `${formatRupees(currentTotal)} out of ${formatRupees(targetAmount)}`
      : "No ride selected",
  );
  if (machineGoal) {
    machineGoal.textContent = formatRupees(currentTotal);
  }
  machineTotal.textContent = formatRupees(currentTotal);
}

function refreshPhase() {
  const level = getActiveLevel();
  const isGameView = Boolean(level);
  const isComplete = isGameView && isRoundResolved;
  const completionRatio = isGameView ? gameState.total / level.targetAmount : 0;

  selectionScreen.hidden = isGameView;
  gameScreen.hidden = !isGameView;

  pageShell.classList.toggle("is-selection-view", !isGameView);
  pageShell.classList.toggle("is-game-view", isGameView);
  pageShell.classList.remove("is-success-view");
  pageShell.classList.toggle(
    "is-near-complete",
    isGameView &&
      !isComplete &&
      !gameState.isComplete &&
      completionRatio >= 0.8,
  );
  pageShell.classList.toggle("is-complete", isComplete);

  if (!isComplete) {
    pageShell.classList.remove("is-ticket-visible");
  }

  backButton.disabled = !isGameView || isSuccessPopupOpen;
}

function refreshDropZone() {
  const level = getActiveLevel();

  if (!machineDropZone || !dropZoneHint) {
    return;
  }

  machineDropZone.classList.toggle("has-money", placedMoney.length > 0);
  machineDropZone.setAttribute(
    "aria-disabled",
    String(!level || gameState.isComplete || isRetryMode),
  );

  if (!level) {
    dropZoneHint.textContent = "Drag or tap money to add it here";
    return;
  }

  if (isRetryMode) {
    dropZoneHint.textContent = "Wrong total. Press Try Again.";
    return;
  }

  if (gameState.isComplete) {
    dropZoneHint.textContent = isRoundResolved
      ? "Target reached. Ticket unlocked."
      : "Perfect total. Press Check.";
    return;
  }

  if (gameState.total > level.targetAmount) {
    dropZoneHint.textContent = `${formatRupees(getOverflowAmount(level, gameState.total))} too much in ${level.name}`;
    return;
  }

  const remaining = level.targetAmount - gameState.total;
  dropZoneHint.textContent =
    placedMoney.length === 0
      ? "Drag and Drop here"
      : `${formatRupees(remaining)} left in ${level.name}`;
}

function renderPlacedMoney() {
  if (!placedMoneyLayer) {
    return;
  }

  const fragment = document.createDocumentFragment();

  placedMoney.forEach((item) => {
    const definition = getMoneyDefinition(item.kind);

    if (!definition || !definition.src) {
      return;
    }

    const piece = document.createElement("span");
    const image = document.createElement("img");

    piece.className = "placed-money";
    image.className = definition.isNote
      ? "placed-money__sprite placed-money__sprite--note"
      : "placed-money__sprite placed-money__sprite--coin";
    image.src = definition.src;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");

    piece.appendChild(image);
    fragment.appendChild(piece);
  });

  placedMoneyLayer.replaceChildren(fragment);
}

function refreshUndoButton() {
  const level = getActiveLevel();

  if (!undoButton) {
    return;
  }

  undoButton.disabled =
    !level ||
    placedMoney.length === 0 ||
    isRoundResolved ||
    isRetryMode;
}

function refreshCheckButton() {
  const level = getActiveLevel();

  if (!checkButton) {
    return;
  }

  const canRetry = Boolean(level) && isRetryMode && !isRoundResolved;

  checkButton.classList.toggle("is-retry", canRetry);
  checkButton.setAttribute("aria-label", canRetry ? "Try Again" : "Check");

  if (checkButtonLabel) {
    checkButtonLabel.textContent = canRetry ? "Try Again" : "";
  }

  checkButton.disabled = canRetry
    ? false
    : !level || placedMoney.length === 0 || isRoundResolved;
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

function playWrongAnswerBuzz() {
  playTone({
    frequency: 168,
    duration: 0.11,
    type: "sawtooth",
    gainLevel: 0.08,
    sweepTo: 118,
  });

  window.setTimeout(() => {
    playTone({
      frequency: 154,
      duration: 0.11,
      type: "sawtooth",
      gainLevel: 0.082,
      sweepTo: 104,
    });
  }, 58);

  window.setTimeout(() => {
    playTone({
      frequency: 142,
      duration: 0.13,
      type: "sawtooth",
      gainLevel: 0.085,
      sweepTo: 94,
    });
  }, 116);

  window.setTimeout(() => {
    playTone({
      frequency: 128,
      duration: 0.16,
      type: "triangle",
      gainLevel: 0.062,
      sweepTo: 82,
    });
  }, 170);
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

  if (machineImage) {
    machineImage.src = "assets/RealMAchine.png";
  }
}

function clearSuccessPopup() {
  window.clearTimeout(successPopupRevealTimer);
  successPopupRevealTimer = 0;
  isSuccessPopupOpen = false;
  pageShell.classList.remove("is-success-popup-visible");

  if (!successPopup) {
    return;
  }

  successPopup.dataset.theme = "";
  successPopup.setAttribute("aria-hidden", "true");

  if (successPopupImage) {
    successPopupImage.removeAttribute("src");
    successPopupImage.alt = "";
  }
}

function clearReturnToSelection() {
  window.clearTimeout(returnToSelectionTimer);
  returnToSelectionTimer = 0;
}

function clearRoundEffects() {
  clearConfettiBurst();
  clearTicketReveal();
  clearSuccessPopup();
  clearReturnToSelection();
}

function showSuccessPopup(level) {
  if (
    !successPopup ||
    !successPopupTitle ||
    !successPopupSubtitle ||
    !successPopupImage ||
    !level
  ) {
    return;
  }

  isSuccessPopupOpen = true;
  successPopup.dataset.theme = level.id;
  successPopupImage.src = level.successScreenSrc || "";
  successPopupImage.alt = `${level.name} success screen`;
  successPopupTitle.textContent = "Great Job!";
  successPopupSubtitle.textContent = `${level.name} ticket unlocked!`;
  successPopup.setAttribute("aria-hidden", "false");

  pageShell.classList.remove("is-success-popup-visible");
  void successPopup.offsetWidth;
  pageShell.classList.add("is-success-popup-visible");
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
  const level = getActiveLevel();
  if (!level) {
    return;
  }

  clearTicketReveal();
  clearSuccessPopup();
  isSuccessPopupOpen = true;
  playSuccessChime();
  launchConfettiBurst();

  ticketRevealTimer = window.setTimeout(() => {
    pageShell.classList.add("is-ticket-visible");
    ticketRevealTimer = 0;
  }, 140);

  successPopupRevealTimer = window.setTimeout(() => {
    showSuccessPopup(level);
    successPopupRevealTimer = 0;
  }, 760);
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
  }, 4200);
}

function restartAnimation(element, className, duration = 320) {
  if (!element) {
    return;
  }

  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), duration);
}

function updateGame(customStatusMessage = "") {
  renderRideList();
  refreshHeader();
  refreshMeter();
  refreshMessages(customStatusMessage);
  refreshButtons();
  refreshPhase();
  renderPlacedMoney();
  refreshDropZone();
  refreshUndoButton();
  refreshCheckButton();
}

function startLevel(levelId) {
  const level = levelLookup.get(levelId);

  if (!level || completedLevelIds.has(levelId)) {
    return;
  }

  clearRoundEffects();
  clearActiveDragState();
  activeLevelId = levelId;
  placedMoney = [];
  isRoundResolved = false;
  isRetryMode = false;
  gameState = createInitialRoundState(level);
  updateGame(
    `Collect exactly ${formatRupees(level.targetAmount)} for ${level.name}. Drag or tap any money you like.`,
  );
}

function showSelectionScreen(customStatusMessage = "") {
  clearRoundEffects();
  clearActiveDragState();
  activeLevelId = null;
  placedMoney = [];
  isRoundResolved = false;
  isRetryMode = false;
  gameState = createInitialRoundState();
  updateGame(customStatusMessage || getSelectionScreenStatus());
}

function restartActiveLevel() {
  const level = getActiveLevel();
  if (!level) {
    return;
  }

  clearRoundEffects();
  clearActiveDragState();
  placedMoney = [];
  isRoundResolved = false;
  isRetryMode = false;
  gameState = createInitialRoundState(level);
  updateGame(
    `${level.name} restarted. Drag or tap any money to reach ${formatRupees(level.targetAmount)}.`,
  );
}

function handleRideSelection(event) {
  const button = event.target.closest(".ride-card");
  if (!button || !(button instanceof HTMLButtonElement)) {
    return;
  }

  startLevel(button.dataset.levelId);
}

function attemptMoneyPlacement(moneySelection, sourceButton) {
  const level = getActiveLevel();
  const button = sourceButton || moneyButtonByKind.get(moneySelection?.kind) || null;

  if (!level || !moneySelection || isRetryMode || isRoundResolved) {
    return;
  }

  const move = evaluateMoneyMeterMove(gameState, moneySelection.value);

  if (!move.accepted) {
    playDeniedSound();
    if (button) {
      restartAnimation(button, "is-denied");
    }
    return;
  }

  placedMoney = [...placedMoney, moneySelection];
  gameState = move.nextState;
  playTapSound(moneySelection.value);
  updateGame();

  if (button) {
    restartAnimation(button, "is-bouncing");
  }

  if (gameState.total > level.targetAmount) {
    updateGame(
      `Oops! That's ${formatRupees(getOverflowAmount(level, gameState.total))} too much for ${level.name}. Press Check or Undo.`,
    );
  } else if (gameState.isComplete) {
    updateGame(`Perfect total for ${level.name}. Press Check to finish the ride.`);
  }
}

function handleMoneyClick(event) {
  const button = event.currentTarget;
  attemptMoneyPlacement(createMoneySelectionFromButton(button), button);
}

function undoLastDrop() {
  const level = getActiveLevel();

  if (
    !level ||
    placedMoney.length === 0 ||
    isRoundResolved ||
    isRetryMode
  ) {
    return;
  }

  clearRoundEffects();
  placedMoney = placedMoney.slice(0, -1);
  isRoundResolved = false;
  gameState = rebuildRoundStateFromPlacedMoney(level, placedMoney);

  updateGame(
    placedMoney.length === 0
      ? "Last drop removed. Drag or tap a denomination to start again."
      : `Last drop removed. ${formatRupees(level.targetAmount - gameState.total)} left in ${level.name}.`,
  );
}

function getDragSelection(event) {
  if (activeDragMoney) {
    return activeDragMoney;
  }

  if (!event.dataTransfer) {
    return null;
  }

  const rawPayload = event.dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsedPayload = JSON.parse(rawPayload);
    const definition = getMoneyDefinition(parsedPayload.kind);

    if (!definition) {
      return null;
    }

    return {
      kind: definition.kind,
      value: definition.value,
    };
  } catch {
    return null;
  }
}

function handleMoneyDragStart(event) {
  const button = event.currentTarget;

  if (!(button instanceof HTMLButtonElement) || button.disabled) {
    event.preventDefault();
    return;
  }

  const selection = createMoneySelectionFromButton(button);

  if (!selection) {
    event.preventDefault();
    return;
  }

  activeDragMoney = selection;
  button.classList.add("is-dragging");

  if (machineDropZone) {
    machineDropZone.classList.add("is-ready");
  }

  if (!event.dataTransfer) {
    return;
  }

  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", JSON.stringify(selection));

  const sprite = button.querySelector(".money-sprite");

  if (sprite instanceof HTMLImageElement) {
    event.dataTransfer.setDragImage(
      sprite,
      sprite.clientWidth / 2 || 40,
      sprite.clientHeight / 2 || 40,
    );
  }
}

function handleMoneyDragEnd() {
  clearActiveDragState();
}

function handleDropZoneDragOver(event) {
  if (!getActiveLevel() || isRetryMode || isRoundResolved) {
    return;
  }

  const selection = getDragSelection(event);

  if (!selection) {
    return;
  }

  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }

  machineDropZone?.classList.add("is-drop-target");
}

function handleDropZoneDragLeave(event) {
  const nextTarget = event.relatedTarget;

  if (nextTarget instanceof Node && machineDropZone?.contains(nextTarget)) {
    return;
  }

  machineDropZone?.classList.remove("is-drop-target");
}

function handleDropZoneDrop(event) {
  const selection = getDragSelection(event);

  clearActiveDragState();

  if (!selection) {
    return;
  }

  event.preventDefault();
  attemptMoneyPlacement(selection, moneyButtonByKind.get(selection.kind));
}

function handleCheck() {
  const level = getActiveLevel();

  if (!level || isRoundResolved) {
    return;
  }

  if (isRetryMode) {
    restartActiveLevel();
    return;
  }

  if (placedMoney.length === 0) {
    return;
  }

  if (gameState.isComplete) {
    isRoundResolved = true;
    isRetryMode = false;
    runSuccessSequence();
    updateGame(`${level.name} complete! Returning to ride selection...`);
    scheduleReturnToSelection();
    return;
  }

  isRetryMode = true;
  playWrongAnswerBuzz();
  restartAnimation(machineWrap, "is-wrong-answer", 440);

  if (gameState.total > level.targetAmount) {
    updateGame(
      `${formatRupees(getOverflowAmount(level, gameState.total))} too much for ${level.name}. Press Try Again.`,
    );
    return;
  }

  updateGame(
    `${formatRupees(level.targetAmount)} was needed, but this total is ${formatRupees(gameState.total)}. Press Try Again.`,
  );
}

function init() {
  preloadAssets();
  updateGame();

  rideList.addEventListener("click", handleRideSelection);

  moneyButtons.forEach((button) => {
    button.addEventListener("click", handleMoneyClick);
    button.addEventListener("dragstart", handleMoneyDragStart);
    button.addEventListener("dragend", handleMoneyDragEnd);
  });

  machineDropZone?.addEventListener("dragover", handleDropZoneDragOver);
  machineDropZone?.addEventListener("dragleave", handleDropZoneDragLeave);
  machineDropZone?.addEventListener("drop", handleDropZoneDrop);

  backButton.addEventListener("click", () => {
    showSelectionScreen("Choose another ride when you are ready.");
  });

  undoButton?.addEventListener("click", undoLastDrop);
  checkButton?.addEventListener("click", handleCheck);
}

init();
