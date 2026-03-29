const {
  GOAL_TOTAL,
  createInitialMoneyMeterState,
  evaluateMoneyMeterMove,
  isMoneyMeterSelectionLocked,
} = window.MoneyMeterGameLogic;
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

let gameState = createInitialMoneyMeterState();
let audioContext = null;
let confettiCleanupTimer = 0;
let ticketRevealTimer = 0;

const pageShell = document.querySelector(".page-shell");
const gameTitle = document.getElementById("gameTitle");
const statusMessage = document.getElementById("statusMessage");
const selectionHint = document.getElementById("selectionHint");
const machineTotal = document.getElementById("machineTotal");
const meterFill = document.getElementById("meterFill");
const machineMeter = document.getElementById("machineMeter");
const nextButton = document.getElementById("nextButton");
const confettiLayer = document.getElementById("confettiLayer");
const moneyButtons = [...document.querySelectorAll(".money-button")];

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

function refreshMessages(customStartMessage = "") {
  if (gameState.isComplete) {
    gameTitle.textContent = "Amazing! you did it";
    statusMessage.textContent = "Amazing! you did it";
    selectionHint.textContent = "Aru reached ₹10. Tap Next to start a fresh round.";
    return;
  }

  gameTitle.textContent = "Help Aru make ₹10";

  if (gameState.selectedDenomination === null) {
    statusMessage.textContent =
      customStartMessage || "Choose one coin or note to start the round.";
    selectionHint.textContent =
      "Tap any denomination to lock it in for this round.";
    return;
  }

  const remaining = GOAL_TOTAL - gameState.total;

  if (remaining === gameState.selectedDenomination) {
    statusMessage.textContent = `So close! One more ${formatRupees(gameState.selectedDenomination)} tap gets Aru to ₹10.`;
  } else {
    statusMessage.textContent = `${formatRupees(remaining)} left. Keep using only the ${formatDenomination(gameState.selectedDenomination)}.`;
  }

  selectionHint.textContent = `Locked to ${formatDenomination(gameState.selectedDenomination)} until Aru reaches ₹10.`;
}

function refreshButtons() {
  const isComplete = gameState.isComplete;

  moneyButtons.forEach((button) => {
    const value = Number(button.dataset.value);
    const isSelected = !isComplete && gameState.selectedDenomination === value;
    const isLocked = isMoneyMeterSelectionLocked(gameState, value);

    button.classList.toggle("is-selected", isSelected);
    button.classList.toggle("is-locked", isLocked);
    button.classList.toggle("is-complete-locked", isComplete);
    button.setAttribute("aria-pressed", String(isSelected));
    button.disabled = isLocked;
  });
}

function refreshMeter() {
  const fillAmount = (gameState.total / GOAL_TOTAL) * 100;

  meterFill.style.height = `${fillAmount}%`;
  machineMeter.setAttribute("aria-valuenow", String(gameState.total));
  machineTotal.textContent = formatRupees(gameState.total);
}

function refreshPhase() {
  const isComplete = gameState.isComplete;

  pageShell.classList.toggle(
    "is-near-complete",
    gameState.total >= 8 && !isComplete,
  );
  pageShell.classList.toggle("is-complete", isComplete);

  if (!isComplete) {
    pageShell.classList.remove("is-ticket-visible");
  }

  nextButton.disabled = !isComplete;
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

function restartAnimation(button, className) {
  button.classList.remove(className);
  void button.offsetWidth;
  button.classList.add(className);
  window.setTimeout(() => button.classList.remove(className), 320);
}

function updateGame(customStartMessage = "") {
  refreshMeter();
  refreshMessages(customStartMessage);
  refreshButtons();
  refreshPhase();
}

function handleMoneyClick(event) {
  const button = event.currentTarget;
  const clickedValue = Number(button.dataset.value);
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
  }
}

function resetGame() {
  clearConfettiBurst();
  clearTicketReveal();
  gameState = createInitialMoneyMeterState();
  updateGame("Pick a new denomination for the next round.");
}

function init() {
  preloadAssets();
  updateGame();

  moneyButtons.forEach((button) => {
    button.addEventListener("click", handleMoneyClick);
  });

  nextButton.addEventListener("click", resetGame);
}

init();
