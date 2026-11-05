"use strict";

const STORAGE_KEY = "mindspark-progress-v1";
const TOTAL_ROUNDS = 5;
const DIFFICULTY_SETTINGS = {
  easy: { seconds: 75, points: 100, bonusLimit: 25 },
  medium: { seconds: 60, points: 150, bonusLimit: 40 },
  hard: { seconds: 45, points: 200, bonusLimit: 60 }
};
const COLORS = [
  { name: "RED", value: "#ff5e7d" },
  { name: "BLUE", value: "#59b8ff" },
  { name: "GREEN", value: "#63dfad" },
  { name: "YELLOW", value: "#ffd166" },
  { name: "PURPLE", value: "#c89bff" }
];
const GAME_INFO = {
  memory: { title: "Memory Matrix", category: "MEMORY", radar: "memory" },
  number: { title: "Number Detective", category: "LOGIC", radar: "logic" },
  color: { title: "Color Confusion", category: "FOCUS", radar: "focus" },
  reflex: { title: "Reflex Challenge", category: "SPEED", radar: "speed" },
  pattern: { title: "Pattern Master", category: "LOGIC", radar: "logic" }
};
const NUMBER_QUESTIONS = [
  { sequence: "2, 4, 8, 16, ?", answers: ["24", "30", "32", "34"], correct: "32", explanation: "Each number doubles." },
  { sequence: "3, 6, 9, 12, ?", answers: ["14", "15", "16", "18"], correct: "15", explanation: "Add 3 each time." },
  { sequence: "1, 4, 9, 16, ?", answers: ["20", "24", "25", "36"], correct: "25", explanation: "These are square numbers: 1², 2², 3², 4², then 5²." },
  { sequence: "20, 17, 14, 11, ?", answers: ["6", "7", "8", "9"], correct: "8", explanation: "Subtract 3 each time." },
  { sequence: "1, 1, 2, 3, 5, ?", answers: ["6", "7", "8", "10"], correct: "8", explanation: "Each number is the sum of the previous two." },
  { sequence: "5, 10, 20, 40, ?", answers: ["60", "70", "80", "100"], correct: "80", explanation: "Each number doubles." },
  { sequence: "2, 5, 10, 17, ?", answers: ["24", "25", "26", "27"], correct: "26", explanation: "The differences are 3, 5, 7, then 9." }
];
const PATTERN_QUESTIONS = [
  { sequence: "▲   ●   ▲   ●   ?", answers: ["▲", "●", "■", "◆"], correct: "▲", explanation: "The triangle and circle alternate." },
  { sequence: "◆   ◆◆   ◆◆◆   ?", answers: ["◆", "◆◆", "◆◆◆◆", "●●●●"], correct: "◆◆◆◆", explanation: "One diamond is added each time." },
  { sequence: "↑   →   ↓   ←   ?", answers: ["↑", "→", "↓", "←"], correct: "↑", explanation: "The arrow turns clockwise each step." },
  { sequence: "●   ●●   ●●●   ?", answers: ["●●", "●●●", "●●●●", "●●●●●"], correct: "●●●●", explanation: "The pattern adds one dot each time." },
  { sequence: "1   3   5   7   ?", answers: ["8", "9", "10", "11"], correct: "9", explanation: "These are consecutive odd numbers." },
  { sequence: "A   C   E   G   ?", answers: ["H", "I", "J", "K"], correct: "I", explanation: "Skip one letter each time." },
  { sequence: "■   ▲   ■■   ▲▲   ?", answers: ["■", "■■", "■■■", "▲▲▲"], correct: "■■■", explanation: "The shapes alternate, and each group grows by one." }
];

const elements = {
  dashboard: document.querySelector("#dashboard"),
  gameScreen: document.querySelector("#game-screen"),
  dailyButton: document.querySelector("#daily-button"),
  dailyCaption: document.querySelector("#daily-caption"),
  difficulty: document.querySelector("#difficulty"),
  totalScore: document.querySelector("#total-score"),
  bestScore: document.querySelector("#best-score"),
  completedCount: document.querySelector("#completed-count"),
  homeButton: document.querySelector("#home-button"),
  gameTitle: document.querySelector("#game-title"),
  gameCategory: document.querySelector("#game-category"),
  gameDifficulty: document.querySelector("#game-difficulty"),
  currentScore: document.querySelector("#current-score"),
  currentAccuracy: document.querySelector("#current-accuracy"),
  timeLeft: document.querySelector("#time-left"),
  roundLabel: document.querySelector("#round-label"),
  progressValue: document.querySelector("#progress-value"),
  progressFill: document.querySelector("#progress-fill"),
  gameContent: document.querySelector("#game-content"),
  feedback: document.querySelector("#feedback")
};

function emptyProgress() {
  return {
    totalPoints: 0,
    bestScore: 0,
    completedChallenges: 0,
    radar: {
      memory: { attempts: 0, correct: 0 },
      logic: { attempts: 0, correct: 0 },
      focus: { attempts: 0, correct: 0 },
      speed: { attempts: 0, correct: 0 }
    }
  };
}

function readProgress() {
  const fallback = emptyProgress();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return fallback;
    const numberOrZero = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
    const result = {
      totalPoints: numberOrZero(saved.totalPoints),
      bestScore: numberOrZero(saved.bestScore),
      completedChallenges: numberOrZero(saved.completedChallenges),
      radar: fallback.radar
    };
    for (const key of Object.keys(result.radar)) {
      const savedRadar = saved.radar && saved.radar[key];
      if (savedRadar && typeof savedRadar === "object") {
        result.radar[key] = {
          attempts: numberOrZero(savedRadar.attempts),
          correct: Math.min(numberOrZero(savedRadar.correct), numberOrZero(savedRadar.attempts))
        };
      }
    }
    return result;
  } catch (error) {
    console.warn("MindSpark could not read saved progress; starting with a fresh score.", error);
    return fallback;
  }
}

let progress = readProgress();
let activeGame = null;
let sessionToken = 0;
let timerId = null;
let revealTimeouts = [];

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.warn("MindSpark could not save progress in this browser.", error);
  }
}

function renderDashboard() {
  elements.totalScore.textContent = progress.totalPoints.toLocaleString();
  elements.bestScore.textContent = progress.bestScore.toLocaleString();
  elements.completedCount.textContent = progress.completedChallenges.toLocaleString();
  for (const [key, record] of Object.entries(progress.radar)) {
    const percentage = record.attempts ? Math.round((record.correct / record.attempts) * 100) : null;
    document.querySelector(`#score-${key}`).textContent = percentage === null ? "—" : `${percentage}%`;
    document.querySelector(`#meter-${key}`).style.width = percentage === null ? "0%" : `${percentage}%`;
  }
  const daily = getDailyChallenge();
  elements.dailyCaption.textContent = `Today's pick: ${GAME_INFO[daily.game].title} · ${capitalize(daily.difficulty)}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getDailyChallenge() {
  const date = new Date();
  const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  let seed = 0;
  for (const character of dateKey) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  const gameKeys = Object.keys(GAME_INFO);
  const difficulties = Object.keys(DIFFICULTY_SETTINGS);
  return {
    game: gameKeys[seed % gameKeys.length],
    difficulty: difficulties[Math.floor(seed / gameKeys.length) % difficulties.length]
  };
}

function clearGameTimers() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
  clearRevealTimeouts();
}

function clearRevealTimeouts() {
  revealTimeouts.forEach(timeout => window.clearTimeout(timeout));
  revealTimeouts = [];
}

function showDashboard() {
  clearGameTimers();
  sessionToken += 1;
  activeGame = null;
  elements.gameScreen.hidden = true;
  elements.dashboard.hidden = false;
  renderDashboard();
  document.querySelector("#welcome-title").focus?.();
}

function startGame(gameKey, selectedDifficulty = elements.difficulty.value) {
  if (!GAME_INFO[gameKey]) return;
  clearGameTimers();
  sessionToken += 1;
  const settings = DIFFICULTY_SETTINGS[selectedDifficulty] || DIFFICULTY_SETTINGS.easy;
  activeGame = {
    key: gameKey,
    difficulty: DIFFICULTY_SETTINGS[selectedDifficulty] ? selectedDifficulty : "easy",
    score: 0,
    round: 0,
    attempts: 0,
    correct: 0,
    secondsLeft: settings.seconds,
    roundLocked: false,
    question: null,
    sequence: [],
    sequenceInput: [],
    reflexReady: false
  };
  elements.dashboard.hidden = true;
  elements.gameScreen.hidden = false;
  elements.gameTitle.textContent = GAME_INFO[gameKey].title;
  elements.gameCategory.textContent = `${GAME_INFO[gameKey].category} CHALLENGE`;
  elements.gameDifficulty.textContent = `${capitalize(activeGame.difficulty)} difficulty`;
  elements.feedback.textContent = "";
  elements.feedback.className = "feedback";
  updateGameStats();
  startCountdown(sessionToken);
  beginRound();
  document.querySelector("#home-button").focus();
}

function startCountdown(token) {
  timerId = window.setInterval(() => {
    if (!activeGame || token !== sessionToken) return;
    activeGame.secondsLeft -= 1;
    elements.timeLeft.textContent = `${activeGame.secondsLeft}s`;
    if (activeGame.secondsLeft <= 10) elements.timeLeft.classList.add("time-warning");
    if (activeGame.secondsLeft <= 0) finishGame(true);
  }, 1000);
}

function updateGameStats() {
  if (!activeGame) return;
  elements.currentScore.textContent = activeGame.score.toLocaleString();
  elements.currentAccuracy.textContent = activeGame.attempts
    ? `${Math.round(activeGame.correct / activeGame.attempts * 100)}%`
    : "—";
  elements.timeLeft.textContent = `${activeGame.secondsLeft}s`;
  elements.timeLeft.classList.toggle("time-warning", activeGame.secondsLeft <= 10);
  const completed = activeGame.round;
  elements.roundLabel.textContent = `ROUND ${Math.min(completed + 1, TOTAL_ROUNDS)} OF ${TOTAL_ROUNDS}`;
  const percentage = Math.round(completed / TOTAL_ROUNDS * 100);
  elements.progressValue.textContent = `${percentage}%`;
  elements.progressFill.style.width = `${percentage}%`;
}

function beginRound() {
  if (!activeGame) return;
  if (activeGame.round >= TOTAL_ROUNDS) {
    finishGame(false);
    return;
  }
  activeGame.roundLocked = false;
  activeGame.roundStartedAt = Date.now();
  activeGame.question = null;
  activeGame.sequenceInput = [];
  elements.feedback.textContent = "";
  elements.feedback.className = "feedback";
  updateGameStats();

  switch (activeGame.key) {
    case "memory": showMemoryRound(); break;
    case "number": showChoiceRound(NUMBER_QUESTIONS, false); break;
    case "color": showColorRound(); break;
    case "reflex": showReflexRound(); break;
    case "pattern": showChoiceRound(PATTERN_QUESTIONS, true); break;
    default: finishGame(false);
  }
}

function createInstruction(text) {
  const instruction = document.createElement("p");
  instruction.className = "instruction";
  instruction.textContent = text;
  return instruction;
}

function showChoiceRound(questionBank, isPattern) {
  const question = questionBank[Math.floor(Math.random() * questionBank.length)];
  activeGame.question = question;
  const instruction = createInstruction(isPattern
    ? "Choose the item that completes the pattern."
    : "Study the sequence, then choose the next number.");
  const prompt = document.createElement("p");
  prompt.className = "question-text";
  prompt.textContent = question.sequence;
  const options = document.createElement("div");
  options.className = "options-grid";
  options.setAttribute("role", "group");
  options.setAttribute("aria-label", "Answer choices");
  question.answers.forEach(answer => {
    const button = document.createElement("button");
    button.className = "answer-button";
    button.type = "button";
    button.textContent = answer;
    button.dataset.correct = String(answer === question.correct);
    button.addEventListener("click", () => submitChoice(button, answer === question.correct, question.explanation));
    options.append(button);
  });
  elements.gameContent.replaceChildren(instruction, prompt, options);
  options.querySelector("button").focus();
}

function submitChoice(selectedButton, isCorrect, explanation) {
  if (!activeGame || activeGame.roundLocked) return;
  activeGame.roundLocked = true;
  activeGame.attempts += 1;
  if (isCorrect) activeGame.correct += 1;
  const settings = DIFFICULTY_SETTINGS[activeGame.difficulty];
  const elapsedSeconds = Math.floor((Date.now() - activeGame.roundStartedAt) / 1000);
  const bonus = isCorrect
    ? Math.max(0, Math.round(settings.bonusLimit * (1 - Math.min(elapsedSeconds, settings.bonusLimit) / settings.bonusLimit)))
    : 0;
  const gained = isCorrect ? settings.points + bonus : 0;
  activeGame.score += gained;
  markChoices(selectedButton);
  setFeedback(isCorrect ? `Correct! ${explanation} +${gained} points.` : `Not quite. ${explanation}`, isCorrect);
  finishRoundAfterFeedback();
}

function markChoices(selectedButton) {
  const buttons = elements.gameContent.querySelectorAll(".answer-button");
  buttons.forEach(button => {
    button.disabled = true;
    if (button === selectedButton && !isCorrect) button.classList.add("wrong-answer");
    if (button.dataset.correct === "true") button.classList.add("correct-answer");
  });
}

function showColorRound() {
  const word = COLORS[Math.floor(Math.random() * COLORS.length)];
  let ink = COLORS[Math.floor(Math.random() * COLORS.length)];
  while (ink.name === word.name) ink = COLORS[Math.floor(Math.random() * COLORS.length)];
  activeGame.question = { correct: ink.name, explanation: `The letters were printed in ${capitalize(ink.name.toLowerCase())}.` };
  const instruction = createInstruction("Ignore the word itself. Which color is the text printed in?");
  const wordDisplay = document.createElement("p");
  wordDisplay.className = "color-word";
  wordDisplay.textContent = word.name;
  wordDisplay.style.color = ink.value;
  wordDisplay.setAttribute("aria-label", `The word ${word.name}, shown in ${ink.name.toLowerCase()} text`);
  const options = document.createElement("div");
  options.className = "options-grid";
  options.setAttribute("role", "group");
  options.setAttribute("aria-label", "Choose the font color");
  COLORS.slice().sort(() => Math.random() - .5).forEach(color => {
    const button = document.createElement("button");
    button.className = "answer-button";
    button.type = "button";
    button.textContent = capitalize(color.name.toLowerCase());
    button.dataset.correct = String(color.name === ink.name);
    button.addEventListener("click", () => submitChoice(button, color.name === ink.name, activeGame.question.explanation));
    options.append(button);
  });
  elements.gameContent.replaceChildren(instruction, wordDisplay, options);
  options.querySelector("button").focus();
}

function showMemoryRound() {
  const difficultyExtra = activeGame.difficulty === "hard" ? 1 : 0;
  const sequenceLength = Math.min(7, activeGame.round + 2 + difficultyExtra);
  activeGame.sequence = Array.from({ length: sequenceLength }, () => Math.floor(Math.random() * 9));
  const instruction = createInstruction("Watch the glowing tiles, then repeat them in the same order.");
  const display = document.createElement("div");
  display.className = "sequence-display";
  display.setAttribute("aria-live", "polite");
  display.setAttribute("aria-label", "Sequence playback");
  const grid = document.createElement("div");
  grid.className = "matrix-grid";
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", "Memory matrix, 3 by 3");
  const tiles = Array.from({ length: 9 }, (_, index) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "matrix-tile";
    tile.setAttribute("aria-label", `Tile ${index + 1}`);
    tile.disabled = true;
    tile.addEventListener("click", () => chooseMemoryTile(index, tile));
    grid.append(tile);
    return tile;
  });
  elements.gameContent.replaceChildren(instruction, display, grid);

  const token = sessionToken;
  let delay = 450;
  activeGame.sequence.forEach((tileIndex, sequenceIndex) => {
    revealTimeouts.push(window.setTimeout(() => {
      if (!activeGame || token !== sessionToken || activeGame.roundLocked) return;
      tiles[tileIndex].classList.add("lit");
      display.textContent = `${sequenceIndex + 1} / ${activeGame.sequence.length}`;
    }, delay));
    delay += 400;
    revealTimeouts.push(window.setTimeout(() => tiles[tileIndex]?.classList.remove("lit"), delay));
    delay += 200;
  });
  revealTimeouts.push(window.setTimeout(() => {
    if (!activeGame || token !== sessionToken || activeGame.roundLocked) return;
    display.textContent = "Your turn";
    tiles.forEach(tile => { tile.disabled = false; });
    tiles[0].focus();
  }, delay + 100));
}

function chooseMemoryTile(index, tile) {
  if (!activeGame || activeGame.roundLocked) return;
  const position = activeGame.sequenceInput.length;
  tile.classList.add("selected");
  activeGame.sequenceInput.push(index);
  const isCorrect = index === activeGame.sequence[position];
  if (!isCorrect) {
    activeGame.roundLocked = true;
    activeGame.attempts += 1;
    setFeedback("Not quite—that sequence was a tricky one. Let's move on.", false);
    disableMemoryTiles();
    finishRoundAfterFeedback();
    return;
  }
  if (activeGame.sequenceInput.length === activeGame.sequence.length) {
    activeGame.roundLocked = true;
    activeGame.attempts += 1;
    activeGame.correct += 1;
    const gained = DIFFICULTY_SETTINGS[activeGame.difficulty].points + activeGame.sequence.length * 10;
    activeGame.score += gained;
    setFeedback(`Sequence complete! +${gained} points.`, true);
    disableMemoryTiles();
    finishRoundAfterFeedback();
  }
}

function disableMemoryTiles() {
  elements.gameContent.querySelectorAll(".matrix-tile").forEach(tile => { tile.disabled = true; });
}

function showReflexRound() {
  const instruction = createInstruction("Tap the target as soon as it turns green. Tapping early will cost this round.");
  const target = document.createElement("button");
  target.type = "button";
  target.className = "reflex-target waiting";
  target.textContent = "Wait for green…";
  target.setAttribute("aria-label", "Reflex target, waiting for green");
  target.addEventListener("click", () => {
    if (!activeGame || activeGame.roundLocked) return;
    if (!activeGame.reflexReady) {
      activeGame.roundLocked = true;
      activeGame.attempts += 1;
      target.disabled = true;
      setFeedback("Too soon! Wait for the target to turn green.", false);
      finishRoundAfterFeedback();
      return;
    }
    activeGame.roundLocked = true;
    activeGame.reflexReady = false;
    activeGame.attempts += 1;
    activeGame.correct += 1;
    const reaction = Math.max(1, Date.now() - activeGame.reactionStartedAt);
    const gained = DIFFICULTY_SETTINGS[activeGame.difficulty].points +
      Math.max(0, Math.round((900 - Math.min(reaction, 900)) / 30));
    activeGame.score += gained;
    target.disabled = true;
    target.classList.remove("ready");
    target.textContent = `${reaction} ms`;
    setFeedback(`Quick reaction! +${gained} points.`, true);
    finishRoundAfterFeedback();
  });
  elements.gameContent.replaceChildren(instruction, target);
  const token = sessionToken;
  const wait = 1000 + Math.random() * (activeGame.difficulty === "hard" ? 2400 : 3500);
  revealTimeouts.push(window.setTimeout(() => {
    if (!activeGame || token !== sessionToken || activeGame.roundLocked) return;
    activeGame.reflexReady = true;
    activeGame.reactionStartedAt = Date.now();
    target.classList.remove("waiting");
    target.classList.add("ready");
    target.textContent = "TAP NOW!";
    target.setAttribute("aria-label", "Target is green. Tap now!");
    target.focus();
  }, wait));
}

function finishRoundAfterFeedback() {
  if (!activeGame) return;
  clearRevealTimeouts();
  updateGameStats();
  const token = sessionToken;
  revealTimeouts.push(window.setTimeout(() => {
    if (!activeGame || token !== sessionToken) return;
    activeGame.round += 1;
    beginRound();
  }, 1250));
}

function setFeedback(message, isSuccess) {
  elements.feedback.textContent = message;
  elements.feedback.className = `feedback ${isSuccess ? "success" : "error"}`;
  updateGameStats();
}

function saveRadarProgress() {
  if (!activeGame) return;
  const radarKey = GAME_INFO[activeGame.key].radar;
  const record = progress.radar[radarKey];
  record.attempts += activeGame.attempts;
  record.correct += activeGame.correct;
  progress.totalPoints += activeGame.score;
  progress.bestScore = Math.max(progress.bestScore, activeGame.score);
  progress.completedChallenges += 1;
}

function finishGame(timedOut) {
  if (!activeGame) return;
  clearGameTimers();
  activeGame.round = Math.min(activeGame.round, TOTAL_ROUNDS);
  saveRadarProgress();
  saveProgress();
  renderDashboard();
  elements.progressValue.textContent = timedOut ? "Time" : "100%";
  elements.progressFill.style.width = timedOut ? `${Math.round(activeGame.round / TOTAL_ROUNDS * 100)}%` : "100%";
  elements.roundLabel.textContent = timedOut ? "TIME'S UP" : "CHALLENGE COMPLETE";
  const score = activeGame.score;
  const accuracy = activeGame.attempts ? Math.round(activeGame.correct / activeGame.attempts * 100) : 0;
  const title = timedOut ? "Time's up!" : "Nicely done!";
  const summary = timedOut
    ? `You completed ${activeGame.round} of ${TOTAL_ROUNDS} rounds with ${accuracy}% accuracy.`
    : `You finished all ${TOTAL_ROUNDS} rounds with ${accuracy}% accuracy.`;
  const completion = document.createElement("div");
  completion.className = "completion";
  const icon = document.createElement("div");
  icon.className = "completion-icon";
  icon.textContent = timedOut ? "◷" : "✦";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const description = document.createElement("p");
  description.textContent = summary;
  const scoreDisplay = document.createElement("div");
  scoreDisplay.className = "completion-score";
  scoreDisplay.textContent = `${score.toLocaleString()} pts`;
  const actions = document.createElement("div");
  actions.className = "completion-actions";
  const restart = document.createElement("button");
  restart.className = "button button-primary";
  restart.type = "button";
  restart.textContent = "Play again";
  restart.addEventListener("click", () => startGame(activeGame.key, activeGame.difficulty));
  const dashboardButton = document.createElement("button");
  dashboardButton.className = "button button-secondary";
  dashboardButton.type = "button";
  dashboardButton.textContent = "Back to dashboard";
  dashboardButton.addEventListener("click", showDashboard);
  actions.append(restart, dashboardButton);
  completion.append(icon, heading, description, scoreDisplay, actions);
  elements.gameContent.replaceChildren(completion);
  elements.feedback.textContent = "";
  elements.currentScore.textContent = score.toLocaleString();
  elements.currentAccuracy.textContent = `${accuracy}%`;
  elements.timeLeft.textContent = timedOut ? "0s" : `${activeGame.secondsLeft}s`;
  document.querySelector(".completion-actions .button-primary").focus();
}

document.querySelectorAll(".game-card").forEach(card => {
  card.addEventListener("click", () => startGame(card.dataset.game));
});
elements.dailyButton.addEventListener("click", () => {
  const daily = getDailyChallenge();
  startGame(daily.game, daily.difficulty);
});
elements.homeButton.addEventListener("click", showDashboard);
document.querySelector("[data-home]").addEventListener("click", event => {
  event.preventDefault();
  showDashboard();
});

renderDashboard();
