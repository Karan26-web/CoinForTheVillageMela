const {
  LEVEL_RULE_TYPES,
  createInitialRoundState,
  evaluateMoneyMeterMove,
} = window.MoneyMeterGameLogic;

const LEVELS = Object.freeze([
  Object.freeze({
    id: "merry-go-round",
    name: "Merry-Go-Round",
    selectionName: "Carousel",
    targetAmount: 10,
    overflowTolerance: 0,
    ruleType: LEVEL_RULE_TYPES.SAME_DENOMINATION,
    icon: "🎠",
    cardImageSrc: "assets/Goround.png",
    successScreenSrc: "assets/SuccessScreenMerrygoRound.png",
  }),
  Object.freeze({
    id: "rainbow-slide",
    name: "Rainbow-Slide",
    selectionName: "Roller Ride",
    targetAmount: 13,
    overflowTolerance: 3,
    ruleType: LEVEL_RULE_TYPES.MIXED,
    icon: "🌈",
    cardImageSrc: "assets/RainbowSlide.png",
    successScreenSrc: "assets/SuccessScreenRainbowSlide.png",
  }),
  Object.freeze({
    id: "giant-wheel",
    name: "Giant-Wheel",
    selectionName: "Ferris Wheel",
    targetAmount: 7,
    overflowTolerance: 3,
    ruleType: LEVEL_RULE_TYPES.MIXED,
    icon: "🎡",
    cardImageSrc: "assets/GiantWheel.png",
    successScreenSrc: "assets/SuccessScreneGiantwheel.png",
  }),
  Object.freeze({
    id: "bumper-car",
    name: "Bumper-Car",
    selectionName: "Car Ride",
    targetAmount: 20,
    overflowTolerance: 3,
    ruleType: LEVEL_RULE_TYPES.MIXED,
    icon: "🚗",
    cardImageSrc: "assets/BumperCar.png",
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

const successCueAudioConfig = Object.freeze({
  path: "audios/Correct tap11.mp3",
  fallbackDurationMs: 5643,
  cheerLeadInMs: 850,
  volume: 0.92,
});

const successCheerAudioConfig = Object.freeze({
  path: "audios/mykelu-crowd-cheering-383111.mp3",
  fallbackDurationMs: 5112,
  volume: 0.9,
});

const assetPaths = Object.freeze([
  "assets/TransitionScreenBG.png",
  "assets/Background.png",
  "assets/Background2.png",
  "assets/RealMAchine.png",
  "assets/SuccessScreenMerrygoRound.png",
  "assets/SuccessScreenRainbowSlide.png",
  "assets/SuccessScreneGiantwheel.png",
  "assets/SuccessScreenBumperCar.png",
  "assets/banner.png",
  "assets/Goround.png",
  "assets/RainbowSlide.png",
  "assets/GiantWheel.png",
  "assets/BumperCar.png",
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
let confettiWaveTimer = 0;
let ticketRevealTimer = 0;
let successPopupRevealTimer = 0;
let successCheerTimer = 0;
let returnToSelectionTimer = 0;
let placedMoney = [];
let activeDragMoney = null;
let isRoundResolved = false;
let isRetryMode = false;
let isSuccessPopupOpen = false;
let successCueAudio = null;
let successCheerAudio = null;
let confettiCanvas = null;
let confettiContext = null;
let confettiAnimationFrame = 0;
let confettiLastFrameTime = 0;
let confettiParticles = [];

const pageShell = document.querySelector(".page-shell");
const landscapeLock = document.getElementById("landscapeLock");
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

function isPortraitViewport() {
  return window.innerHeight > window.innerWidth;
}

function updateLandscapeLockState() {
  const isPortrait = isPortraitViewport();

  document.body.classList.toggle("is-portrait-locked", isPortrait);
  pageShell?.setAttribute("aria-hidden", isPortrait ? "true" : "false");
  landscapeLock?.setAttribute("aria-hidden", isPortrait ? "false" : "true");

  if (pageShell && "inert" in pageShell) {
    pageShell.inert = isPortrait;
  }
}

async function tryLockLandscapeOrientation() {
  if (!screen.orientation || typeof screen.orientation.lock !== "function") {
    return;
  }

  try {
    await screen.orientation.lock("landscape");
  } catch (_error) {
    // Browsers can reject orientation locking outside app/standalone contexts.
  }
}

function syncLandscapeMode() {
  updateLandscapeLockState();
  resizeConfettiCanvas();
  void tryLockLandscapeOrientation();
}

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

  getSuccessCueAudio()?.load();
  getSuccessCrowdAudio()?.load();
}

function formatRupees(value) {
  return `₹${value}`;
}

function formatDenomination(value) {
  return value >= 10 ? `₹${value}` : `₹${value} coin`;
}

function getSelectionCardTitle(level) {
  return level?.selectionName || level?.name || "Carnival Ride";
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

  LEVELS.forEach((level, index) => {
    const button = document.createElement("button");
    const isCompleted = completedLevelIds.has(level.id);
    const ruleLabel = getRuleBadgeText(level.ruleType);
    const selectionTitle = getSelectionCardTitle(level);

    button.type = "button";
    button.className = "ride-card";
    button.dataset.levelId = level.id;
    button.disabled = isCompleted;
    button.style.setProperty("--card-delay", `${index * 90}ms`);
    button.setAttribute("role", "listitem");
    button.setAttribute(
      "aria-label",
      `${selectionTitle}, target ${formatRupees(level.targetAmount)}, ${ruleLabel}`,
    );

    if (isCompleted) {
      button.classList.add("is-completed");
    }

    button.innerHTML = `
      <span class="ride-card__panel">
        <span class="ride-card__media" aria-hidden="true">
          <img
            class="ride-card__image"
            src="${level.cardImageSrc}"
            alt=""
            decoding="async"
          />
        </span>
        ${isCompleted ? '<span class="ride-card__badge" aria-hidden="true">Done</span>' : ""}
      </span>
      <span class="sr-only">${selectionTitle} ${formatRupees(level.targetAmount)}</span>
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

function getAudioContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) {
    return null;
  }

  audioContext = audioContext || new AudioCtor();

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

function playTone({ frequency, duration, type = "triangle", gainLevel = 0.07, sweepTo }) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);

  if (sweepTo) {
    oscillator.frequency.exponentialRampToValueAtTime(sweepTo, now + duration);
  }

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(gainLevel, now + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playNoiseBurst({
  startDelay = 0,
  duration = 0.18,
  gainLevel = 0.032,
  centerFrequency = 1800,
  q = 1.1,
}) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }

  const source = context.createBufferSource();
  const bandPass = context.createBiquadFilter();
  const highPass = context.createBiquadFilter();
  const gainNode = context.createGain();
  const now = context.currentTime + startDelay;

  source.buffer = buffer;
  bandPass.type = "bandpass";
  bandPass.frequency.setValueAtTime(centerFrequency, now);
  bandPass.Q.setValueAtTime(q, now);
  highPass.type = "highpass";
  highPass.frequency.setValueAtTime(700, now);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(gainLevel, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(bandPass);
  bandPass.connect(highPass);
  highPass.connect(gainNode);
  gainNode.connect(context.destination);

  source.start(now);
  source.stop(now + duration);
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

function createManagedAudio({ path, volume }) {
  if (typeof Audio === "undefined") {
    return null;
  }

  const audio = new Audio(encodeURI(path));
  audio.preload = "auto";
  audio.volume = volume;
  return audio;
}

function getSuccessCueAudio() {
  if (!successCueAudio) {
    successCueAudio = createManagedAudio(successCueAudioConfig);
  }

  return successCueAudio;
}

function getSuccessCrowdAudio() {
  if (!successCheerAudio) {
    successCheerAudio = createManagedAudio(successCheerAudioConfig);
  }

  return successCheerAudio;
}

function getAudioDurationMs(audio, fallbackDurationMs) {
  if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
    return Math.round(audio.duration * 1000);
  }

  return fallbackDurationMs;
}

function getSuccessCueToCheerDelayMs(audio = getSuccessCueAudio()) {
  const cueDurationMs = getAudioDurationMs(
    audio,
    successCueAudioConfig.fallbackDurationMs,
  );

  return Math.max(0, cueDurationMs - successCueAudioConfig.cheerLeadInMs);
}

function resetManagedAudio(audio) {
  if (!audio) {
    return;
  }

  audio.onended = null;
  audio.pause();

  try {
    audio.currentTime = 0;
  } catch (_error) {
    // Some browsers can reject currentTime resets while metadata is pending.
  }
}

function clearSuccessAudioPlayback() {
  resetManagedAudio(successCueAudio);
  resetManagedAudio(successCheerAudio);
}

function playFallbackSuccessCheer() {
  playSuccessChime();

  [
    {
      frequency: 622.25,
      duration: 0.28,
      type: "triangle",
      gainLevel: 0.028,
      sweepTo: 830.61,
    },
    {
      frequency: 698.46,
      duration: 0.24,
      type: "sine",
      gainLevel: 0.024,
      sweepTo: 932.33,
    },
    {
      frequency: 783.99,
      duration: 0.26,
      type: "triangle",
      gainLevel: 0.022,
      sweepTo: 1046.5,
    },
  ].forEach((tone, index) => {
    window.setTimeout(() => {
      playTone(tone);
    }, 110 + index * 70);
  });

  [
    { startDelay: 0.02, duration: 0.16, gainLevel: 0.022, centerFrequency: 2100 },
    { startDelay: 0.14, duration: 0.2, gainLevel: 0.026, centerFrequency: 1700 },
    { startDelay: 0.26, duration: 0.18, gainLevel: 0.02, centerFrequency: 2400 },
    { startDelay: 0.38, duration: 0.22, gainLevel: 0.028, centerFrequency: 1500 },
  ].forEach((burst) => {
    playNoiseBurst(burst);
  });
}

function playSuccessCue() {
  const audio = getSuccessCueAudio();
  const cueToCheerDelayMs = getSuccessCueToCheerDelayMs(audio);
  const fallbackChimeDurationMs = 320;

  if (!audio) {
    playSuccessChime();
    successCheerTimer = window.setTimeout(() => {
      playSuccessCheer();
      successCheerTimer = 0;
    }, fallbackChimeDurationMs);
    return fallbackChimeDurationMs;
  }

  resetManagedAudio(audio);
  let cheerStarted = false;

  const finishCue = () => {
    if (cheerStarted) {
      return;
    }

    cheerStarted = true;
    audio.onended = null;
    window.clearTimeout(successCheerTimer);
    successCheerTimer = 0;
    audio.pause();
    playSuccessCheer();
  };

  audio.onended = finishCue;
  successCheerTimer = window.setTimeout(finishCue, cueToCheerDelayMs);

  const playPromise = audio.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      cheerStarted = true;
      audio.onended = null;
      window.clearTimeout(successCheerTimer);
      successCheerTimer = 0;
      playSuccessChime();
      successCheerTimer = window.setTimeout(() => {
        playSuccessCheer();
        successCheerTimer = 0;
      }, fallbackChimeDurationMs);
    });
  }

  return cueToCheerDelayMs;
}

function playSuccessCheer() {
  const audio = getSuccessCrowdAudio();
  const durationMs = getAudioDurationMs(
    audio,
    successCheerAudioConfig.fallbackDurationMs,
  );

  if (!audio) {
    playFallbackSuccessCheer();
    return durationMs;
  }

  resetManagedAudio(audio);

  const playPromise = audio.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      playFallbackSuccessCheer();
    });
  }

  return durationMs;
}

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function ensureConfettiCanvas() {
  if (!confettiLayer) {
    return null;
  }

  if (!(confettiCanvas instanceof HTMLCanvasElement)) {
    confettiCanvas = document.createElement("canvas");
    confettiCanvas.className = "confetti-layer__canvas";
    confettiCanvas.setAttribute("aria-hidden", "true");
    confettiLayer.replaceChildren(confettiCanvas);
    confettiContext = confettiCanvas.getContext("2d");
  }

  if (!confettiContext) {
    confettiContext = confettiCanvas.getContext("2d");
  }

  if (!confettiContext) {
    return null;
  }

  resizeConfettiCanvas();
  return confettiContext;
}

function resizeConfettiCanvas() {
  if (!confettiLayer || !confettiCanvas || !confettiContext) {
    return;
  }

  const rect = confettiLayer.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scaledWidth = Math.round(width * dpr);
  const scaledHeight = Math.round(height * dpr);

  if (confettiCanvas.width !== scaledWidth || confettiCanvas.height !== scaledHeight) {
    confettiCanvas.width = scaledWidth;
    confettiCanvas.height = scaledHeight;
    confettiCanvas.style.width = `${width}px`;
    confettiCanvas.style.height = `${height}px`;
  }

  confettiContext.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function createFireworkParticle(x, y, velocityScale = 1) {
  const angle = randomInRange(0, Math.PI * 2);
  const speed = randomInRange(180, 380) * velocityScale;

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - randomInRange(30, 110),
    gravity: randomInRange(240, 340),
    drag: randomInRange(0.974, 0.988),
    size: randomInRange(6, 14),
    rotation: randomInRange(0, Math.PI * 2),
    spin: randomInRange(-10, 10),
    life: randomInRange(0.95, 1.45),
    age: 0,
    wobble: randomInRange(-10, 10),
    wobbleSpeed: randomInRange(7, 14),
    color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
    shape: Math.random() < 0.22 ? "circle" : "rect",
  };
}

function drawFireworkParticle(particle) {
  if (!confettiContext) {
    return;
  }

  const lifeProgress = particle.age / particle.life;
  const alpha = Math.max(0, 1 - lifeProgress);

  confettiContext.save();
  confettiContext.translate(
    particle.x + Math.sin(particle.wobble) * 6,
    particle.y + Math.cos(particle.wobble * 0.9) * 2,
  );
  confettiContext.rotate(particle.rotation);
  confettiContext.globalAlpha = alpha;
  confettiContext.fillStyle = particle.color;

  if (particle.shape === "circle") {
    confettiContext.beginPath();
    confettiContext.arc(0, 0, particle.size * 0.46, 0, Math.PI * 2);
    confettiContext.fill();
  } else {
    confettiContext.fillRect(
      -particle.size * 0.45,
      -particle.size * 0.72,
      particle.size * 0.9,
      particle.size * 1.44,
    );
  }

  confettiContext.restore();
}

function stepConfettiAnimation(timestamp) {
  if (!confettiContext || !confettiCanvas) {
    confettiAnimationFrame = 0;
    return;
  }

  const width = confettiCanvas.width / Math.min(window.devicePixelRatio || 1, 2);
  const height = confettiCanvas.height / Math.min(window.devicePixelRatio || 1, 2);
  const deltaSeconds = Math.min(
    0.033,
    Math.max(0.016, (timestamp - confettiLastFrameTime) / 1000 || 0.016),
  );

  confettiLastFrameTime = timestamp;
  confettiContext.clearRect(0, 0, width, height);

  confettiParticles = confettiParticles.filter((particle) => {
    particle.age += deltaSeconds;

    if (particle.age >= particle.life) {
      return false;
    }

    particle.vx *= Math.pow(particle.drag, deltaSeconds * 60);
    particle.vy = particle.vy * Math.pow(particle.drag, deltaSeconds * 60) + particle.gravity * deltaSeconds;
    particle.x += particle.vx * deltaSeconds;
    particle.y += particle.vy * deltaSeconds;
    particle.rotation += particle.spin * deltaSeconds;
    particle.wobble += particle.wobbleSpeed * deltaSeconds;

    if (particle.y > height + 120 || particle.x < -120 || particle.x > width + 120) {
      return false;
    }

    drawFireworkParticle(particle);
    return true;
  });

  if (confettiParticles.length > 0) {
    confettiAnimationFrame = window.requestAnimationFrame(stepConfettiAnimation);
    return;
  }

  confettiAnimationFrame = 0;
}

function spawnFireworkCannon({
  originXRange = [0.1, 0.3],
  originYRange = [-0.18, 0.18],
  particleCount = 32,
  velocityScale = 1,
} = {}) {
  const context = ensureConfettiCanvas();

  if (!context || !confettiCanvas) {
    return;
  }

  const rect = confettiCanvas.getBoundingClientRect();
  const originX = randomInRange(originXRange[0], originXRange[1]) * rect.width;
  const originY = randomInRange(originYRange[0], originYRange[1]) * rect.height;

  for (let index = 0; index < particleCount; index += 1) {
    confettiParticles.push(createFireworkParticle(originX, originY, velocityScale));
  }

  if (!confettiAnimationFrame) {
    confettiLastFrameTime = window.performance.now();
    confettiAnimationFrame = window.requestAnimationFrame(stepConfettiAnimation);
  }
}

function clearConfettiBurst() {
  window.clearTimeout(confettiCleanupTimer);
  window.clearInterval(confettiWaveTimer);
  window.cancelAnimationFrame(confettiAnimationFrame);
  confettiCleanupTimer = 0;
  confettiWaveTimer = 0;
  confettiAnimationFrame = 0;
  confettiParticles = [];

  if (!confettiContext || !confettiCanvas) {
    return;
  }

  resizeConfettiCanvas();
  confettiContext.clearRect(
    0,
    0,
    confettiCanvas.width / Math.min(window.devicePixelRatio || 1, 2),
    confettiCanvas.height / Math.min(window.devicePixelRatio || 1, 2),
  );
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

function clearSuccessCheerTimer() {
  window.clearTimeout(successCheerTimer);
  successCheerTimer = 0;
}

function clearReturnToSelection() {
  window.clearTimeout(returnToSelectionTimer);
  returnToSelectionTimer = 0;
}

function clearRoundEffects() {
  clearConfettiBurst();
  clearSuccessAudioPlayback();
  clearTicketReveal();
  clearSuccessPopup();
  clearSuccessCheerTimer();
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

function launchConfettiBurst({ duration = 5000 } = {}) {
  clearConfettiBurst();

  if (!ensureConfettiCanvas()) {
    return;
  }

  const animationEnd = Date.now() + duration;

  const fireWave = () => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      window.clearInterval(confettiWaveTimer);
      confettiWaveTimer = 0;
      confettiCleanupTimer = window.setTimeout(clearConfettiBurst, 1500);
      return;
    }

    const particleCount = Math.max(16, Math.round(50 * (timeLeft / duration)));

    spawnFireworkCannon({
      originXRange: [0.08, 0.28],
      originYRange: [-0.18, 0.22],
      particleCount,
      velocityScale: 1,
    });

    spawnFireworkCannon({
      originXRange: [0.72, 0.92],
      originYRange: [-0.18, 0.22],
      particleCount,
      velocityScale: 1,
    });
  };

  fireWave();
  confettiWaveTimer = window.setInterval(fireWave, 250);
}

function runSuccessSequence() {
  const level = getActiveLevel();
  if (!level) {
    return 4200;
  }

  clearTicketReveal();
  clearSuccessPopup();
  clearSuccessAudioPlayback();
  isSuccessPopupOpen = true;
  const cueDurationMs = playSuccessCue();
  const cheerDurationMs = getAudioDurationMs(
    getSuccessCrowdAudio(),
    successCheerAudioConfig.fallbackDurationMs,
  );
  const totalDurationMs = cueDurationMs + cheerDurationMs;
  const successPopupDelayMs = Math.min(
    320,
    Math.max(180, Math.round(cueDurationMs * 0.08)),
  );

  launchConfettiBurst({ duration: totalDurationMs + 800 });

  ticketRevealTimer = window.setTimeout(() => {
    pageShell.classList.add("is-ticket-visible");
    ticketRevealTimer = 0;
  }, 140);

  successPopupRevealTimer = window.setTimeout(() => {
    showSuccessPopup(level);
    successPopupRevealTimer = 0;
  }, successPopupDelayMs);

  return totalDurationMs;
}

function scheduleReturnToSelection(delayMs = 4200) {
  clearReturnToSelection();

  returnToSelectionTimer = window.setTimeout(() => {
    const completedLevel = getActiveLevel();
    if (!completedLevel) {
      return;
    }

    completedLevelIds.add(completedLevel.id);
    showSelectionScreen(`${completedLevel.name} is complete! Choose another ride.`);
  }, delayMs);
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
    const successSequenceDurationMs = runSuccessSequence();
    updateGame(`${level.name} complete! Returning to ride selection...`);
    scheduleReturnToSelection(successSequenceDurationMs + 180);
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
  syncLandscapeMode();
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

  window.addEventListener("resize", syncLandscapeMode, { passive: true });
  window.addEventListener("orientationchange", syncLandscapeMode, { passive: true });
  window.visualViewport?.addEventListener("resize", syncLandscapeMode, { passive: true });
  window.addEventListener("pointerdown", () => {
    void tryLockLandscapeOrientation();
  }, { passive: true });

  const orientationQuery = window.matchMedia?.("(orientation: portrait)");

  if (orientationQuery) {
    if (typeof orientationQuery.addEventListener === "function") {
      orientationQuery.addEventListener("change", syncLandscapeMode);
    } else if (typeof orientationQuery.addListener === "function") {
      orientationQuery.addListener(syncLandscapeMode);
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      syncLandscapeMode();
    }
  });
}

init();
