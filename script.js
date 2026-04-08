const {
  LEVEL_RULE_TYPES,
  createInitialRoundState,
  evaluateMoneyMeterMove,
} = window.MoneyMeterGameLogic;

const LEVELS = Object.freeze([
  Object.freeze({
    id: "merry-go-round",
    targetAmount: 10,
    overflowTolerance: 0,
    ruleType: LEVEL_RULE_TYPES.SAME_DENOMINATION,
    icon: "🎠",
    cardImageSrc: "assets/Goround.png",
    successScreenSrc: "assets/SuccessScreenMerrygoRound.png",
  }),
  Object.freeze({
    id: "rainbow-slide",
    targetAmount: 13,
    overflowTolerance: 3,
    ruleType: LEVEL_RULE_TYPES.MIXED,
    icon: "🌈",
    cardImageSrc: "assets/RainbowSlide.png",
    successScreenSrc: "assets/SuccessScreenRainbowSlide.png",
  }),
  Object.freeze({
    id: "giant-wheel",
    targetAmount: 7,
    overflowTolerance: 3,
    ruleType: LEVEL_RULE_TYPES.MIXED,
    icon: "🎡",
    cardImageSrc: "assets/GiantWheel.png",
    successScreenSrc: "assets/SuccessScreneGiantwheel.png",
  }),
  Object.freeze({
    id: "bumper-car",
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
  path: "audios/CorrectSound.ogg",
  fallbackDurationMs: 5643,
  volume: 0.92,
});

const successCheerAudioConfig = Object.freeze({
  path: "audios/mykelu-crowd-cheering-383111.ogg",
  fallbackDurationMs: 5112,
  volume: 0.9,
});
const instructionNarrationConfig = Object.freeze({
  en: Object.freeze({
    welcome: Object.freeze({
      path: "audios/WelcomeToCarnivalCoins.ogg",
      volume: 0.96,
    }),
    make10: Object.freeze({
      path: "audios/make10.ogg",
      volume: 0.96,
    }),
    make13: Object.freeze({
      path: "audios/make13.ogg",
      volume: 0.96,
    }),
    make7: Object.freeze({
      path: "audios/make7.ogg",
      volume: 0.96,
    }),
    make20: Object.freeze({
      path: "audios/make20.ogg",
      volume: 0.96,
    }),
    tooMuch: Object.freeze({
      path: "audios/thatisToomuch.ogg",
      volume: 0.96,
    }),
  }),
  hi: Object.freeze({
    hindiWelcome: Object.freeze({
      path: "audios/HindiWelcomeToCarnivalCoins.ogg",
      volume: 0.96,
    }),
    hindiMake10: Object.freeze({
      path: "audios/Hindimake10.ogg",
      volume: 0.96,
    }),
    hindiMake13: Object.freeze({
      path: "audios/Hindimake13.ogg",
      volume: 0.96,
    }),
    hindiMake7: Object.freeze({
      path: "audios/Hindimake7.ogg",
      volume: 0.96,
    }),
    hindiMake20: Object.freeze({
      path: "audios/Hindimake20.ogg",
      volume: 0.96,
    }),
    hindiTooMuch: Object.freeze({
      path: "audios/HindithatisToomuch.ogg",
      volume: 0.96,
    }),
  }),
});
const placedMoneyMeasureTolerancePx = 2;
const placedMoneyBoundaryPaddingPx = 36;
const placedMoneyRowTolerancePx = 6;
const placedMoneyMaxRows = 3;

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
let instructionNarrationAudio = null;
let lastInstructionNarrationSignature = "";
let confettiCanvas = null;
let confettiContext = null;
let confettiAnimationFrame = 0;
let confettiLastFrameTime = 0;
let confettiParticles = [];
let translations = {};
let currentLanguage = "en";
const languageStorageKey = "money-meter-language";

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
const successPopupEyebrow = document.getElementById("successPopupEyebrow");
const successPopupTitle = document.getElementById("successPopupTitle");
const successPopupSubtitle = document.getElementById("successPopupSubtitle");
const documentTitle = document.getElementById("documentTitle");
const selectionTitle = document.getElementById("selectionTitle");
const machineColumn = document.getElementById("machineColumn");
const ticketPrizeText = document.getElementById("ticketPrizeText");
const dropPanel = document.getElementById("dropPanel");
const controlsPanel = document.getElementById("controlsPanel");
const backButtonText = document.getElementById("backButtonText");
const undoButtonText = document.getElementById("undoButtonText");
const checkButtonSrText = document.getElementById("checkButtonSrText");
const landscapeLockTitle = document.getElementById("landscapeLockTitle");
const landscapeLockMessage = document.getElementById("landscapeLockMessage");
const languageToggle = document.getElementById("languageToggle");
const languageToggleEnglish = document.getElementById("languageToggleEnglish");
const languageToggleHindi = document.getElementById("languageToggleHindi");
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
        src: sprite instanceof HTMLImageElement ? sprite.getAttribute("src") || "" : "",
        isNote: button.classList.contains("money-button--note"),
      }),
    ];
  }),
);

function interpolate(template, variables = {}) {
  return Object.entries(variables).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, String(value));
  }, String(template ?? ""));
}

function getLanguagePack() {
  return translations[currentLanguage] || translations.en || {};
}

function getTranslationValue(path) {
  return path.split(".").reduce((value, key) => {
    if (value && typeof value === "object" && key in value) {
      return value[key];
    }

    return undefined;
  }, getLanguagePack());
}

function t(path, variables = {}) {
  const value = getTranslationValue(path);

  if (typeof value === "string") {
    return interpolate(value, variables);
  }

  return value;
}

function getLevelDisplayName(level) {
  if (!level) {
    return "";
  }

  return t(`levels.${level.id}.name`) || level.id;
}

function getSelectionCardTitle(level) {
  if (!level) {
    return t("selection.cardFallbackTitle") || "";
  }

  return t(`levels.${level.id}.selectionName`) || getLevelDisplayName(level);
}

function getRideWord(count) {
  return count === 1 ? t("selection.rideWordOne") : t("selection.rideWordOther");
}

function getDenominationTranslationKey(kind) {
  return kind.replace("-", "_");
}

function getDenominationLabel(kind, value) {
  return t(`denominations.${getDenominationTranslationKey(kind)}`) || formatDenomination(value);
}

function getEmbeddedTranslations() {
  const element = document.getElementById("translationsData");

  if (!element) {
    return null;
  }

  try {
    return JSON.parse(element.textContent || "");
  } catch (_error) {
    return null;
  }
}

async function loadTranslations() {
  let payload = getEmbeddedTranslations();

  if (!payload) {
    try {
      const response = await fetch("translations.json", { cache: "no-cache" });
      payload = await response.json();
    } catch (_error) {
      payload = {
        defaultLanguage: "en",
        en: {
          meta: { title: "Money Meter" },
          language: {
            toggleHindiButton: "हिंदी",
            toggleEnglishButton: "English",
            toggleButtonLabel: "Switch language to {language}"
          },
          banner: { welcome: "Welcome to the Carnival Coins!" },
          status: {
            chooseNextLevel: "Choose a ride to start the next level.",
            chooseRideBegin: "Choose a ride to begin."
          },
          selection: {
            screenLabel: "Ride levels",
            title: "Choose a carnival ride",
            cardFallbackTitle: "Carnival Ride",
            ruleBadge: "Any money allowed",
            doneBadge: "Done",
            targetLabel: "target",
            rideWordOne: "ride",
            rideWordOther: "rides"
          },
          controls: {
            back: "Back",
            undo: "Undo",
            undoLastDrop: "Undo last drop",
            check: "Check",
            tryAgain: "Try Again",
            chooseDenomination: "Choose a denomination"
          },
          machine: {
            columnLabel: "Money meter machine",
            imageAlt: "Money meter machine",
            ticketLabel: "TICKET",
            dropPanelLabel: "Drop money here",
            dropZoneLabel: "Drop money into the machine",
            dropHintDefault: "Drag and Drop here",
            dropHintAddHere: "Drag or tap money to add it here",
            meterNoRideSelected: "No ride selected"
          },
          hints: {
            addMoneyThenCheck: "Add any money until you reach the target, then press Check."
          },
          successPopup: {
            eyebrow: "Unlocked",
            title: "Great Job!",
            subtitle: "{rideName} ready!",
            imageAlt: "{rideName} success screen"
          },
          orientation: {
            title: "Landscape Mode Only",
            message: "Rotate your device sideways to continue playing the carnival game."
          },
          aria: {
            rideCard: "{selectionTitle}, {targetLabel} {amount}, {ruleLabel}"
          },
          denominations: {
            coin_1: "₹1 coin",
            coin_2: "₹2 coin",
            coin_5: "₹5 coin",
            coin_10: "₹10 coin",
            note_10: "₹10 note",
            note_20: "₹20 note"
          },
          levels: {
            "merry-go-round": { name: "Merry-Go-Round", selectionName: "Carousel" },
            "rainbow-slide": { name: "Rainbow-Slide", selectionName: "Roller Ride" },
            "giant-wheel": { name: "Giant-Wheel", selectionName: "Ferris Wheel" },
            "bumper-car": { name: "Bumper-Car", selectionName: "Car Ride" }
          }
        },
        hi: {
          meta: { title: "मनी मीटर" },
          language: {
            toggleHindiButton: "हिंदी",
            toggleEnglishButton: "English",
            toggleButtonLabel: "भाषा {language} में बदलें"
          },
          banner: { welcome: "कार्निवल कॉइन्स में आपका स्वागत है!" },
          status: {
            chooseNextLevel: "अगला स्तर शुरू करने के लिए कोई राइड चुनें।",
            chooseRideBegin: "शुरू करने के लिए कोई राइड चुनें।"
          },
          selection: {
            screenLabel: "राइड स्तर",
            title: "कोई कार्निवल राइड चुनें",
            cardFallbackTitle: "कार्निवल राइड",
            ruleBadge: "कोई भी पैसा मान्य है",
            doneBadge: "पूरा",
            targetLabel: "लक्ष्य",
            rideWordOne: "राइड",
            rideWordOther: "राइड"
          },
          controls: {
            back: "वापस",
            undo: "पूर्ववत",
            undoLastDrop: "आखिरी ड्रॉप पूर्ववत करें",
            check: "जांचें",
            tryAgain: "फिर से कोशिश करें",
            chooseDenomination: "कोई राशि चुनें"
          },
          machine: {
            columnLabel: "मनी मीटर मशीन",
            imageAlt: "मनी मीटर मशीन",
            ticketLabel: "टिकट",
            dropPanelLabel: "पैसा यहां डालें",
            dropZoneLabel: "पैसा मशीन में डालें",
            dropHintDefault: "खींचकर यहां छोड़ें",
            dropHintAddHere: "पैसा जोड़ने के लिए यहां खींचें या टैप करें",
            meterNoRideSelected: "कोई राइड चयनित नहीं है"
          },
          hints: {
            addMoneyThenCheck: "लक्ष्य तक पहुंचने तक पैसा जोड़ें, फिर जांचें दबाएं।"
          },
          successPopup: {
            eyebrow: "अनलॉक",
            title: "बहुत बढ़िया!",
            subtitle: "{rideName} तैयार!",
            imageAlt: "{rideName} सफलता स्क्रीन"
          },
          orientation: {
            title: "केवल लैंडस्केप मोड",
            message: "कार्निवल गेम खेलना जारी रखने के लिए अपने डिवाइस को घुमाएं।"
          },
          aria: {
            rideCard: "{selectionTitle}, {targetLabel} {amount}, {ruleLabel}"
          },
          denominations: {
            coin_1: "₹1 का सिक्का",
            coin_2: "₹2 का सिक्का",
            coin_5: "₹5 का सिक्का",
            coin_10: "₹10 का सिक्का",
            note_10: "₹10 का नोट",
            note_20: "₹20 का नोट"
          },
          levels: {
            "merry-go-round": { name: "मेरी-गो-राउंड", selectionName: "कैरोसेल" },
            "rainbow-slide": { name: "रेनबो-स्लाइड", selectionName: "रोलर राइड" },
            "giant-wheel": { name: "जायंट-व्हील", selectionName: "फेरिस व्हील" },
            "bumper-car": { name: "बम्पर-कार", selectionName: "कार राइड" }
          }
        }
      };
    }
  }

  translations = payload || {};
  const defaultLanguage = payload.defaultLanguage || "en";
  const savedLanguage = window.localStorage?.getItem(languageStorageKey);
  currentLanguage =
    savedLanguage && payload[savedLanguage]
      ? savedLanguage
      : defaultLanguage;
}

function setDocumentLanguage() {
  document.documentElement.lang = currentLanguage;
}

function refreshLanguageToggle() {
  if (!languageToggle || !languageToggleEnglish || !languageToggleHindi) {
    return;
  }

  const isEnglish = currentLanguage === "en";

  languageToggleEnglish.textContent = t("language.toggleEnglishButton");
  languageToggleHindi.textContent = t("language.toggleHindiButton");
  languageToggle.dataset.language = currentLanguage;
  languageToggleEnglish.classList.toggle("is-active", isEnglish);
  languageToggleHindi.classList.toggle("is-active", !isEnglish);
  languageToggle.setAttribute(
    "aria-label",
    isEnglish
      ? t("language.toggleButtonLabel", {
        language: t("language.toggleHindiButton"),
      })
      : t("language.toggleButtonLabel", {
        language: t("language.toggleEnglishButton"),
      }),
  );
}

function refreshSuccessPopupCopy() {
  const level = getActiveLevel();

  if (!isSuccessPopupOpen || !level) {
    return;
  }

  if (successPopupEyebrow) {
    successPopupEyebrow.textContent = t("successPopup.eyebrow");
  }

  if (successPopupTitle) {
    successPopupTitle.textContent = t("successPopup.title");
  }

  if (successPopupSubtitle) {
    successPopupSubtitle.textContent = t("successPopup.subtitle", {
      rideName: getLevelDisplayName(level),
    });
  }

  if (successPopupImage) {
    successPopupImage.alt = t("successPopup.imageAlt", {
      rideName: getLevelDisplayName(level),
    });
  }
}

function setLanguage(language) {
  if (!translations[language]) {
    return;
  }

  currentLanguage = language;
  window.localStorage?.setItem(languageStorageKey, language);
  lastInstructionNarrationSignature = "";
  resetInstructionNarrationAudio();
  setDocumentLanguage();
  applyStaticTranslations();
  refreshLanguageToggle();
  updateGame();
  refreshSuccessPopupCopy();
}

function applyStaticTranslations() {
  setDocumentLanguage();
  document.title = t("meta.title");

  if (documentTitle) {
    documentTitle.textContent = t("meta.title");
  }

  if (selectionScreen) {
    selectionScreen.setAttribute("aria-label", t("selection.screenLabel"));
  }

  if (selectionTitle) {
    selectionTitle.textContent = t("selection.title");
  }

  if (backButton) {
    backButton.setAttribute("aria-label", t("controls.back"));
  }

  if (backButtonText) {
    backButtonText.textContent = t("controls.back");
  }

  if (machineColumn) {
    machineColumn.setAttribute("aria-label", t("machine.columnLabel"));
  }

  if (machineImage) {
    machineImage.alt = t("machine.imageAlt");
  }

  if (ticketPrizeText) {
    ticketPrizeText.textContent = t("machine.ticketLabel");
  }

  if (dropPanel) {
    dropPanel.setAttribute("aria-label", t("machine.dropPanelLabel"));
  }

  if (machineDropZone) {
    machineDropZone.setAttribute("aria-label", t("machine.dropZoneLabel"));
  }

  if (undoButton) {
    undoButton.setAttribute("aria-label", t("controls.undoLastDrop"));
  }

  if (undoButtonText) {
    undoButtonText.textContent = t("controls.undo");
  }

  if (controlsPanel) {
    controlsPanel.setAttribute("aria-label", t("controls.chooseDenomination"));
  }

  moneyButtons.forEach((button) => {
    button.setAttribute(
      "aria-label",
      getDenominationLabel(button.dataset.moneyKind, Number(button.dataset.value)),
    );
  });

  if (checkButton) {
    checkButton.setAttribute("aria-label", t("controls.check"));
  }

  if (checkButtonSrText) {
    checkButtonSrText.textContent = t("controls.check");
  }

  if (successPopupEyebrow) {
    successPopupEyebrow.textContent = t("successPopup.eyebrow");
  }

  if (successPopupTitle) {
    successPopupTitle.textContent = t("successPopup.title");
  }

  if (landscapeLockTitle) {
    landscapeLockTitle.textContent = t("orientation.title");
  }

  if (landscapeLockMessage) {
    landscapeLockMessage.textContent = t("orientation.message");
  }

  refreshLanguageToggle();
}

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
    isNote: definition.isNote,
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
  Object.values(instructionNarrationConfig).forEach((languageConfig) => {
    Object.values(languageConfig).forEach((config) => {
      createManagedAudio(config)?.load();
    });
  });
}

function formatRupees(value) {
  return `₹${value}`;
}

function formatDenomination(value) {
  return `₹${value}`;
}

function getOverflowAmount(level, total) {
  if (!level) {
    return 0;
  }

  return Math.max(0, total - level.targetAmount);
}

function getRuleBadgeText(ruleType) {
  return t("selection.ruleBadge");
}

function getLockedMoneyKind(level = getActiveLevel()) {
  if (
    !level ||
    level.ruleType !== LEVEL_RULE_TYPES.SAME_DENOMINATION ||
    placedMoney.length === 0
  ) {
    return null;
  }

  return placedMoney[0]?.kind ?? null;
}

function isSelectionAllowedForLevel(level, moneySelection) {
  if (!level || !moneySelection) {
    return false;
  }

  const lockedMoneyKind = getLockedMoneyKind(level);

  return !lockedMoneyKind || moneySelection.kind === lockedMoneyKind;
}

function getSelectionScreenStatus() {
  if (completedLevelIds.size === LEVELS.length) {
    return t("status.allRidesComplete");
  }

  if (completedLevelIds.size === 0) {
    return t("status.chooseNextLevel");
  }

  return t("status.rideCompleteCount", {
    count: completedLevelIds.size,
    rideWord: getRideWord(completedLevelIds.size),
  });
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
      t("aria.rideCard", {
        selectionTitle,
        targetLabel: t("selection.targetLabel"),
        amount: formatRupees(level.targetAmount),
        ruleLabel,
      }),
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
        ${isCompleted ? '<span class="ride-card__badge" aria-hidden="true">&#10003;</span>' : ""}
      </span>
      <span class="sr-only">${selectionTitle} ${formatRupees(level.targetAmount)}</span>
    `;

    fragment.appendChild(button);
  });

  rideList.replaceChildren(fragment);
}

function refreshHeader() {
  const level = getActiveLevel();
  let nextNarrationKey = "";

  if (!level) {
    gameTitle.textContent = t("banner.welcome");
    nextNarrationKey = getWelcomeNarrationKey();
  } else if (gameState.total > level.targetAmount) {
    gameTitle.textContent = t("status.oopsTooMuchHeader");
    nextNarrationKey = getTooMuchNarrationKey();
  } else if (gameState.isComplete || isRoundResolved) {
    gameTitle.textContent = t("status.perfectGoodJobHeader");
  } else {
    gameTitle.textContent = t("status.makeAmountUsingAnyMoney", {
      amount: formatRupees(level.targetAmount),
    });
    nextNarrationKey = getInstructionNarrationKeyForLevel(level);
  }

  if (level) {
    levelName.textContent = getLevelDisplayName(level);
  }

  syncInstructionNarration(nextNarrationKey);
}

function refreshMessages(customStatusMessage = "") {
  const level = getActiveLevel();

  if (!level) {
    statusMessage.textContent = customStatusMessage || getSelectionScreenStatus();
    selectionHint.textContent = t("status.chooseRideBegin");
    return;
  }

  if (isRetryMode) {
    statusMessage.textContent =
      customStatusMessage ||
      t("status.wrongPriceRestartRide", {
        rideName: getLevelDisplayName(level),
      });
    selectionHint.textContent =
      t("hints.wrongTotalRestart");
    return;
  }

  if (gameState.isComplete) {
    if (isRoundResolved) {
      statusMessage.textContent = t("status.rideCompleteReturning", {
        rideName: getLevelDisplayName(level),
      });
      selectionHint.textContent =
        t("hints.ticketEarnedSelectionBoard");
    } else {
      statusMessage.textContent = t("status.perfectTotalCollected", {
        rideName: getLevelDisplayName(level),
      });
      selectionHint.textContent =
        t("hints.useCheckOrUndo");
    }
    return;
  }

  if (customStatusMessage) {
    statusMessage.textContent = customStatusMessage;
  } else if (gameState.total > level.targetAmount) {
    statusMessage.textContent = t("status.overflowCheckOrUndo", {
      amount: formatRupees(getOverflowAmount(level, gameState.total)),
    });
  } else {
    const remaining = level.targetAmount - gameState.total;
    statusMessage.textContent =
      gameState.total === 0
        ? t("status.dragToReachTarget", {
          amount: formatRupees(level.targetAmount),
        })
        : t("status.amountLeftAddAny", {
          amount: formatRupees(remaining),
        });
  }

  selectionHint.textContent =
    gameState.total > level.targetAmount
      ? t("hints.overflowMeterRed")
      : t("hints.addMoneyThenCheck");
}

function refreshButtons() {
  const level = getActiveLevel();
  const isInteractionLocked =
    !level || isRoundResolved || isRetryMode || isDropZoneAtCapacity();
  const lockedMoneyKind = getLockedMoneyKind(level);

  moneyButtons.forEach((button) => {
    const selection = createMoneySelectionFromButton(button);
    const isLockedToOtherDenomination =
      Boolean(lockedMoneyKind) && selection?.kind !== lockedMoneyKind;
    const wouldOverflow =
      Boolean(level) && !isInteractionLocked && Boolean(selection) &&
      willPlacedMoneyOverflow([...placedMoney, selection]);
    const isButtonDisabled =
      !level || isInteractionLocked || isLockedToOtherDenomination || wouldOverflow;

    button.classList.remove(
      "is-selected",
      "is-locked",
      "is-overflow-blocked",
      "is-complete-locked",
    );
    button.classList.toggle("is-inactive", Boolean(level) && isButtonDisabled);
    button.setAttribute("aria-pressed", "false");
    button.disabled = isButtonDisabled;
    button.draggable = Boolean(level) && !isButtonDisabled;
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
        ? t("machine.meterValueOverflow", {
          current: formatRupees(currentTotal),
          overflow: formatRupees(currentTotal - targetAmount),
          target: formatRupees(targetAmount),
        })
        : t("machine.meterValueProgress", {
          current: formatRupees(currentTotal),
          target: formatRupees(targetAmount),
        })
      : t("machine.meterNoRideSelected"),
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
  const hasPlacedMoney = placedMoney.length > 0;

  if (!machineDropZone || !dropZoneHint) {
    return;
  }

  machineDropZone.classList.toggle("has-money", hasPlacedMoney);
  machineDropZone.classList.toggle("is-full", isDropZoneAtCapacity());
  dropZoneHint.hidden = hasPlacedMoney;
  dropZoneHint.style.display = hasPlacedMoney ? "none" : "";
  dropZoneHint.style.visibility = hasPlacedMoney ? "hidden" : "visible";
  dropZoneHint.setAttribute("aria-hidden", String(hasPlacedMoney));
  dropZoneHint.textContent = t("machine.dropHintDefault");

  machineDropZone.setAttribute(
    "aria-disabled",
    String(!level || gameState.isComplete || isRetryMode || isDropZoneAtCapacity()),
  );
}

function createPlacedMoneyFragment(items) {
  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const definition = getMoneyDefinition(item.kind);

    if (!definition || !definition.src) {
      return;
    }

    const piece = document.createElement("span");
    const image = document.createElement("img");

    piece.className = "placed-money";
    piece.classList.add(
      definition.isNote ? "placed-money--note" : "placed-money--coin",
    );
    image.className = definition.isNote
      ? "placed-money__sprite placed-money__sprite--note"
      : "placed-money__sprite placed-money__sprite--coin";
    image.src = definition.src;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");

    piece.appendChild(image);
    fragment.appendChild(piece);
  });

  return fragment;
}

function renderPlacedMoney() {
  if (!placedMoneyLayer) {
    return;
  }

  placedMoneyLayer.replaceChildren(createPlacedMoneyFragment(placedMoney));
}

function getPlacedMoneySpan(item) {
  const definition = getMoneyDefinition(item?.kind);

  return definition?.isNote ? 2 : 1;
}

function getPlacedMoneyColumnCount() {
  if (!placedMoneyLayer) {
    return 8;
  }

  const resolvedValue = Number.parseInt(
    getComputedStyle(placedMoneyLayer).getPropertyValue("--game-drop-columns"),
    10,
  );

  return Number.isFinite(resolvedValue) && resolvedValue > 0 ? resolvedValue : 8;
}

function getPlacedMoneyRowCount(nextItems) {
  const columnCount = getPlacedMoneyColumnCount();
  let rowCount = nextItems.length > 0 ? 1 : 0;
  let usedSlotsInRow = 0;

  for (const item of nextItems) {
    const span = Math.min(getPlacedMoneySpan(item), columnCount);

    if (usedSlotsInRow + span > columnCount) {
      rowCount += 1;
      usedSlotsInRow = 0;
    }

    usedSlotsInRow += span;
  }

  return rowCount;
}

function willPlacedMoneyOverflow(nextItems) {
  return getPlacedMoneyRowCount(nextItems) > placedMoneyMaxRows;
}

function canPlaceMoneySelection(moneySelection) {
  const level = getActiveLevel();

  if (!level || !moneySelection || !isSelectionAllowedForLevel(level, moneySelection)) {
    return false;
  }

  return !willPlacedMoneyOverflow([...placedMoney, moneySelection]);
}

function hasAnyPlaceableMoney() {
  return moneyButtons.some((button) =>
    canPlaceMoneySelection(createMoneySelectionFromButton(button)),
  );
}

function isDropZoneAtCapacity() {
  if (placedMoney.length === 0) {
    return false;
  }

  // When 3 rows are already in use, check if the last row has only 1 slot
  // remaining. Notes (span=2) leave a 1-slot gap per row that coins could
  // technically fill, but visually the grid looks full — so disable everything.
  if (getPlacedMoneyRowCount(placedMoney) >= placedMoneyMaxRows) {
    const columnCount = getPlacedMoneyColumnCount();
    let usedSlotsInRow = 0;
    for (const item of placedMoney) {
      const span = Math.min(getPlacedMoneySpan(item), columnCount);
      if (usedSlotsInRow + span > columnCount) {
        usedSlotsInRow = 0;
      }
      usedSlotsInRow += span;
    }
    if (usedSlotsInRow >= columnCount - 1) {
      return true;
    }
  }

  return !hasAnyPlaceableMoney();
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
  checkButton.setAttribute(
    "aria-label",
    canRetry ? t("controls.tryAgain") : t("controls.check"),
  );

  if (checkButtonLabel) {
    checkButtonLabel.textContent = canRetry ? t("controls.tryAgain") : "";
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
    audioContext.resume().catch(() => { });
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

function playCoinTouchSound(value) {
  playTone({
    frequency: 980 + value * 14,
    duration: 0.045,
    type: "triangle",
    gainLevel: 0.05,
    sweepTo: 760 + value * 10,
  });

  window.setTimeout(() => {
    playTone({
      frequency: 1420 + value * 12,
      duration: 0.06,
      type: "sine",
      gainLevel: 0.03,
      sweepTo: 1080 + value * 8,
    });
  }, 18);

  window.setTimeout(() => {
    playTone({
      frequency: 620 + value * 10,
      duration: 0.075,
      type: "triangle",
      gainLevel: 0.022,
      sweepTo: 420 + value * 8,
    });
  }, 32);
}

function playNoteTouchSound(value) {
  playTone({
    frequency: 320 + value * 10,
    duration: 0.08,
    type: "triangle",
    gainLevel: 0.032,
    sweepTo: 240 + value * 8,
  });

  window.setTimeout(() => {
    playTone({
      frequency: 540 + value * 6,
      duration: 0.055,
      type: "sine",
      gainLevel: 0.018,
      sweepTo: 420 + value * 4,
    });
  }, 22);
}

function playTapSound(moneySelection) {
  if (moneySelection?.isNote) {
    playNoteTouchSound(moneySelection.value);
    return;
  }

  playCoinTouchSound(moneySelection?.value ?? 0);
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
  [0, 44, 88, 132, 176].forEach((delay, index) => {
    window.setTimeout(() => {
      playTone({
        frequency: 196 - index * 12,
        duration: 0.075,
        type: "sawtooth",
        gainLevel: 0.068,
        sweepTo: 138 - index * 10,
      });
    }, delay);
  });

  window.setTimeout(() => {
    playTone({
      frequency: 122,
      duration: 0.18,
      type: "triangle",
      gainLevel: 0.05,
      sweepTo: 84,
    });
  }, 210);
}

function vibrateMachine(durationPattern = [80, 40, 80]) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }

  navigator.vibrate(durationPattern);
}

function triggerWrongAnswerFeedback() {
  playWrongAnswerBuzz();
  vibrateMachine([80, 30, 90, 30, 80]);
  restartAnimation(machineWrap, "is-wrong-answer", 560);
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

function getInstructionNarrationKeyForLevel(level) {
  if (!level) {
    return "";
  }

  return currentLanguage === "hi"
    ? `hindiMake${level.targetAmount}`
    : `make${level.targetAmount}`;
}

function getWelcomeNarrationKey() {
  return currentLanguage === "hi" ? "hindiWelcome" : "welcome";
}

function getTooMuchNarrationKey() {
  return currentLanguage === "hi" ? "hindiTooMuch" : "tooMuch";
}

function getInstructionNarrationConfig(narrationKey) {
  const languageConfig = instructionNarrationConfig[currentLanguage] || instructionNarrationConfig.en;
  return languageConfig[narrationKey] || null;
}

function resetInstructionNarrationAudio() {
  if (!instructionNarrationAudio) {
    return;
  }

  instructionNarrationAudio.onended = null;
  instructionNarrationAudio.pause();

  try {
    instructionNarrationAudio.currentTime = 0;
  } catch (_error) {
    // Ignore media state reset failures while metadata is still loading.
  }

  instructionNarrationAudio = null;
}

function playInstructionNarration(narrationKey) {
  const config = getInstructionNarrationConfig(narrationKey);

  if (!config) {
    return;
  }

  resetInstructionNarrationAudio();
  instructionNarrationAudio = createManagedAudio(config);

  if (!instructionNarrationAudio) {
    return;
  }

  const playPromise = instructionNarrationAudio.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

function syncInstructionNarration(narrationKey) {
  const narrationSignature = narrationKey ? `${currentLanguage}:${narrationKey}` : "";

  if (lastInstructionNarrationSignature === narrationSignature) {
    return;
  }

  lastInstructionNarrationSignature = narrationSignature;

  if (!narrationKey) {
    resetInstructionNarrationAudio();
    return;
  }

  playInstructionNarration(narrationKey);
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
  return getAudioDurationMs(audio, successCueAudioConfig.fallbackDurationMs);
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

function playSuccessCue() {
  resetInstructionNarrationAudio();
  lastInstructionNarrationSignature = "";
  const audio = getSuccessCueAudio();
  const cueToCheerDelayMs = getSuccessCueToCheerDelayMs(audio);

  if (!audio) {
    playSuccessCheer();
    return 0;
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
      playSuccessCheer();
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
    return durationMs;
  }

  resetManagedAudio(audio);

  const playPromise = audio.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => { });
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
  successPopupImage.alt = t("successPopup.imageAlt", {
    rideName: getLevelDisplayName(level),
  });
  successPopupTitle.textContent = t("successPopup.title");
  successPopupSubtitle.textContent = t("successPopup.subtitle", {
    rideName: getLevelDisplayName(level),
  });
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
    showSelectionScreen(
      t("status.rideCompletedChooseAnother", {
        rideName: getLevelDisplayName(completedLevel),
      }),
    );
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
    t("status.collectExactForRide", {
      amount: formatRupees(level.targetAmount),
      rideName: getLevelDisplayName(level),
    }),
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
    t("status.rideRestarted", {
      rideName: getLevelDisplayName(level),
      amount: formatRupees(level.targetAmount),
    }),
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

  if (!canPlaceMoneySelection(moneySelection)) {
    playDeniedSound();
    if (button) {
      restartAnimation(button, "is-denied");
    }
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
  playTapSound(moneySelection);
  updateGame();

  if (button) {
    restartAnimation(button, "is-bouncing");
  }

  if (gameState.total > level.targetAmount) {
    updateGame(
      t("status.oopsTooMuchForRide", {
        amount: formatRupees(getOverflowAmount(level, gameState.total)),
        rideName: getLevelDisplayName(level),
      }),
    );
  } else if (gameState.isComplete) {
    updateGame(
      t("status.perfectTotalForRide", {
        rideName: getLevelDisplayName(level),
      }),
    );
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
      ? t("status.lastDropRemovedStartAgain")
      : t("status.lastDropRemovedAmountLeft", {
        amount: formatRupees(level.targetAmount - gameState.total),
        rideName: getLevelDisplayName(level),
      }),
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
      isNote: definition.isNote,
    };
  } catch {
    return null;
  }
}

function handleMoneyDragStart(event) {
  const button = event.currentTarget;

  if (
    !(button instanceof HTMLButtonElement) ||
    button.disabled ||
    isDropZoneAtCapacity()
  ) {
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

  // Hide the browser drag preview by using a transparent 1x1 canvas as the drag image.
  // This avoids the visible ghost copy while still allowing drag/drop to work.
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    if (canvas.getContext) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 1, 1);
      event.dataTransfer.setDragImage(canvas, 0, 0);
    } else if (sprite instanceof HTMLImageElement) {
      // Fallback to using the sprite if canvas isn't supported
      event.dataTransfer.setDragImage(
        sprite,
        sprite.clientWidth / 2 || 40,
        sprite.clientHeight / 2 || 40,
      );
    }
  } catch (_err) {
    if (sprite instanceof HTMLImageElement) {
      event.dataTransfer.setDragImage(
        sprite,
        sprite.clientWidth / 2 || 40,
        sprite.clientHeight / 2 || 40,
      );
    }
  }
}

function handleMoneyDragEnd() {
  clearActiveDragState();
}

function handleDropZoneDragOver(event) {
  if (!getActiveLevel() || isRetryMode || isRoundResolved || isDropZoneAtCapacity()) {
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

  if (!selection || !canPlaceMoneySelection(selection)) {
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
    updateGame(
      t("status.rideCompleteReturning", {
        rideName: getLevelDisplayName(level),
      }),
    );
    scheduleReturnToSelection(successSequenceDurationMs + 180);
    return;
  }

  isRetryMode = true;
  triggerWrongAnswerFeedback();

  if (gameState.total > level.targetAmount) {
    updateGame(
      t("status.tooMuchPressTryAgain", {
        amount: formatRupees(getOverflowAmount(level, gameState.total)),
        rideName: getLevelDisplayName(level),
      }),
    );
    return;
  }

  updateGame(
    t("status.neededButTotal", {
      needed: formatRupees(level.targetAmount),
      total: formatRupees(gameState.total),
    }),
  );
}

async function init() {
  await loadTranslations();
  applyStaticTranslations();
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
    showSelectionScreen(t("status.chooseRideReady"));
  });

  languageToggle?.addEventListener("click", () => {
    setLanguage(currentLanguage === "en" ? "hi" : "en");
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

void init();
