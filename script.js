const GOAL_TOTAL = 10;

const assetPaths = Object.freeze([
  "assets/Background.png",
  "assets/RealMAchine.png",
  "assets/banner.png",
  "assets/₹1.png",
  "assets/₹2.png",
  "assets/₹5.png",
  "assets/₹10Coin.png",
  "assets/₹10Note.png",
]);

let total = 0;
let selectedDenomination = null;
let audioContext = null;

const pageShell = document.querySelector(".page-shell");
const gameTitle = document.getElementById("gameTitle");
const statusMessage = document.getElementById("statusMessage");
const selectionHint = document.getElementById("selectionHint");
const machineTotal = document.getElementById("machineTotal");
const currentTotal = document.getElementById("currentTotal");
const meterFill = document.getElementById("meterFill");
const machineMeter = document.getElementById("machineMeter");
const nextButton = document.getElementById("nextButton");
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
  if (total === GOAL_TOTAL) {
    gameTitle.textContent = "Amazing! you did it";
    statusMessage.textContent = "Amazing! you did it";
    selectionHint.textContent = "Aru reached ₹10. Tap Next to start a fresh round.";
    return;
  }

  gameTitle.textContent = "Help Aru make ₹10";

  if (selectedDenomination === null) {
    statusMessage.textContent =
      customStartMessage || "Choose one coin or note to start the round.";
    selectionHint.textContent =
      "Tap any denomination to lock it in for this round.";
    return;
  }

  const remaining = GOAL_TOTAL - total;

  if (remaining === selectedDenomination) {
    statusMessage.textContent = `So close! One more ${formatRupees(selectedDenomination)} tap gets Aru to ₹10.`;
  } else {
    statusMessage.textContent = `${formatRupees(remaining)} left. Keep using only the ${formatDenomination(selectedDenomination)}.`;
  }

  selectionHint.textContent = `Locked to ${formatDenomination(selectedDenomination)} until Aru reaches ₹10.`;
}

function refreshButtons() {
  const isComplete = total === GOAL_TOTAL;

  moneyButtons.forEach((button) => {
    const value = Number(button.dataset.value);
    const isSelected = selectedDenomination === value;
    const isLocked = selectedDenomination !== null && value !== selectedDenomination;

    button.classList.toggle("is-selected", isSelected);
    button.classList.toggle("is-locked", isLocked);
    button.classList.toggle("is-complete-choice", isComplete && isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
    button.disabled = isComplete;
  });
}

function refreshMeter() {
  const fillAmount = (total / GOAL_TOTAL) * 100;

  meterFill.style.height = `${fillAmount}%`;
  machineMeter.setAttribute("aria-valuenow", String(total));
  machineTotal.textContent = formatRupees(total);
  currentTotal.textContent = `${formatRupees(total)} / ₹10`;
}

function refreshPhase() {
  const isComplete = total === GOAL_TOTAL;

  pageShell.classList.toggle("is-near-complete", total >= 8 && total < GOAL_TOTAL);
  pageShell.classList.toggle("is-complete", isComplete);
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

  if (total === GOAL_TOTAL) {
    return;
  }

  if (selectedDenomination !== null && clickedValue !== selectedDenomination) {
    playDeniedSound();
    restartAnimation(button, "is-denied");
    return;
  }

  if (total + clickedValue > GOAL_TOTAL) {
    playDeniedSound();
    restartAnimation(button, "is-denied");
    return;
  }

  if (selectedDenomination === null) {
    selectedDenomination = clickedValue;
  }

  total += clickedValue;
  playTapSound(clickedValue);
  updateGame();
  restartAnimation(button, "is-bouncing");

  if (total === GOAL_TOTAL) {
    playSuccessChime();
  }
}

function resetGame() {
  total = 0;
  selectedDenomination = null;
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
