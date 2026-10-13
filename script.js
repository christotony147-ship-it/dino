/**
 * SNACK FRENZY VS THE HUNGRY HORSE
 * High performance clicker game logic with Synthesized Web Audio FX,
 * particles, and smooth requestAnimationFrame timer loop.
 */

// Snack Emoji Pool
const SNACK_EMOJIS = ['🍪', '🧁', '🍩', '🍰', '🍫', '🥨', '🍭', '🍓', '🍎', '🥐', '🍕', '🥞'];

// Game State
let totalSnacks = 30;
let remainingSnacks = [];
let gameDuration = 10.0; // 10 seconds challenge
let timeRemaining = 10.0;
let isGameRunning = false;
let gameTimerInterval = null;
let lastTimestamp = 0;
let clickTimestamps = [];
let maxCPS = 0;
let soundEnabled = true;

// Web Audio API Synthesizer (Zero external dependencies)
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Sound effects generator
function playChompSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Crunchy pitch sweep
  const now = ctx.currentTime;
  osc.type = 'triangle';
  const freq = 200 + Math.random() * 140;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);

  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.12);
}

function playNeighSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;

  // Horse whinny pitch fluctuation
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.linearRampToValueAtTime(480, now + 0.15);
  osc.frequency.linearRampToValueAtTime(380, now + 0.3);
  osc.frequency.linearRampToValueAtTime(540, now + 0.45);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.65);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.65);
}

function playWinFanfare() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [261.63, 329.63, 392.00, 523.25]; // C E G C
  notes.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime + index * 0.12;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  });
}

function playLoseSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [300, 260, 220, 160];
  notes.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime + index * 0.15;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  });
}

// DOM Elements
const timerVal = document.getElementById('timerVal');
const timerFill = document.getElementById('timerFill');
const snacksLeftVal = document.getElementById('snacksLeftVal');
const cpsVal = document.getElementById('cpsVal');
const horseMeterFill = document.getElementById('horseMeterFill');
const horsePercent = document.getElementById('horsePercent');
const horseEmoji = document.getElementById('horseEmoji');
const horseSpeech = document.getElementById('horseSpeech');
const horseWrap = document.getElementById('horseWrap');
const plateInner = document.getElementById('plateInner');
const plateOuter = document.getElementById('plateOuter');
const snacksContainer = document.getElementById('snacksContainer');
const fxLayer = document.getElementById('fxLayer');
const startModal = document.getElementById('startModal');
const endModal = document.getElementById('endModal');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const diffButtons = document.querySelectorAll('.diff-btn');

// Result fields
const resultTitle = document.getElementById('resultTitle');
const resultDesc = document.getElementById('resultDesc');
const resultEmoji = document.getElementById('resultEmoji');
const resTime = document.getElementById('resTime');
const resEaten = document.getElementById('resEaten');
const resMaxCps = document.getElementById('resMaxCps');
const resHighscore = document.getElementById('resHighscore');

// Difficulty settings
diffButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    diffButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    totalSnacks = parseInt(btn.dataset.count, 10);
    snacksLeftVal.textContent = totalSnacks;
  });
});

// Sound Toggle
soundToggleBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggleBtn.textContent = soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
});

// Initialize Plate with Snacks
function spawnSnacks() {
  snacksContainer.innerHTML = '';
  remainingSnacks = [];

  const radiusFraction = 0.38; // relative radius within circular plate
  const containerRect = snacksContainer.getBoundingClientRect();
  const width = containerRect.width || 340;
  const height = containerRect.height || 340;
  const cx = 50;
  const cy = 50;

  for (let i = 0; i < totalSnacks; i++) {
    const snackEl = document.createElement('div');
    snackEl.className = 'snack-item';
    const emoji = SNACK_EMOJIS[Math.floor(Math.random() * SNACK_EMOJIS.length)];
    snackEl.textContent = emoji;
    snackEl.dataset.index = i;

    // Distribute snacks uniformly inside plate circle
    const angle = (i * 137.5) * (Math.PI / 180); // Golden angle distribution
    const r = Math.sqrt((i + 1) / totalSnacks) * 40; // Max radius 40% from center
    const posX = cx + r * Math.cos(angle);
    const posY = cy + r * Math.sin(angle);

    snackEl.style.left = `${posX}%`;
    snackEl.style.top = `${posY}%`;
    snackEl.style.animationDelay = `${(Math.random() * 1.5).toFixed(2)}s`;

    // Click handler for individual snack
    snackEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      eatSnack(snackEl, e.clientX, e.clientY);
    });

    snacksContainer.appendChild(snackEl);
    remainingSnacks.push(snackEl);
  }

  snacksLeftVal.textContent = remainingSnacks.length;
}

// Plate click fallback: if user clicks plate background fast, eat the nearest snack!
plateOuter.addEventListener('pointerdown', (e) => {
  if (!isGameRunning || remainingSnacks.length === 0) return;
  // Eat first available snack to allow furious spam-clicking anywhere on the dish
  const firstAvailable = remainingSnacks[0];
  if (firstAvailable) {
    const rect = firstAvailable.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    eatSnack(firstAvailable, e.clientX || cx, e.clientY || cy);
  }
});

// Eating a snack logic
function eatSnack(element, clickX, clickY) {
  if (!isGameRunning) return;
  const idx = remainingSnacks.indexOf(element);
  if (idx === -1) return; // already eaten

  // Remove from remaining
  remainingSnacks.splice(idx, 1);
  snacksLeftVal.textContent = remainingSnacks.length;

  // Sound and feedback
  playChompSound();
  createCrumbs(clickX, clickY, element.textContent);
  createFloatingText(clickX, clickY, '+1 NOM!');

  // Remove element with pop animation
  element.style.transform = 'translate(-50%, -50%) scale(0) rotate(25deg)';
  element.style.opacity = '0';
  setTimeout(() => {
    if (element.parentElement) {
      element.remove();
    }
  }, 180);

  // Track CPS
  const now = performance.now();
  clickTimestamps.push(now);
  updateCPS(now);

  // Check victory
  if (remainingSnacks.length === 0) {
    endGame(true);
  }
}

// Particle crumb burst
function createCrumbs(x, y, emoji) {
  const count = 5;
  for (let i = 0; i < count; i++) {
    const crumb = document.createElement('span');
    crumb.className = 'crunch-crumb';
    crumb.textContent = ['✨', 'crumbs', '💥', '✨'][Math.floor(Math.random() * 4)];
    crumb.style.left = `${x}px`;
    crumb.style.top = `${y}px`;

    const angle = Math.random() * 2 * Math.PI;
    const dist = 30 + Math.random() * 55;
    const dx = Math.cos(angle) * dist + 'px';
    const dy = Math.sin(angle) * dist + 'px';
    const rot = (Math.random() * 360) + 'deg';

    crumb.style.setProperty('--dx', dx);
    crumb.style.setProperty('--dy', dy);
    crumb.style.setProperty('--rot', rot);

    fxLayer.appendChild(crumb);
    setTimeout(() => crumb.remove(), 700);
  }
}

// Floating +1 Nom text
function createFloatingText(x, y, text) {
  const floater = document.createElement('div');
  floater.className = 'float-score-text';
  floater.textContent = text;
  floater.style.left = `${x}px`;
  floater.style.top = `${y - 20}px`;
  fxLayer.appendChild(floater);
  setTimeout(() => floater.remove(), 600);
}

// Update Clicks Per Second calculation
function updateCPS(now) {
  clickTimestamps = clickTimestamps.filter(t => now - t <= 1000);
  const cps = clickTimestamps.length;
  cpsVal.textContent = cps.toFixed(1);
  if (cps > maxCPS) {
    maxCPS = cps;
  }
}

// Main Game Loop (RAF based precision timer)
function startGame() {
  getAudioContext();
  startModal.classList.remove('active');
  endModal.classList.remove('active');

  timeRemaining = gameDuration;
  clickTimestamps = [];
  maxCPS = 0;
  isGameRunning = true;
  lastTimestamp = performance.now();

  horseEmoji.className = 'horse-avatar trotting';
  horseEmoji.textContent = '🐴';
  horseSpeech.textContent = `"NEIGH! I smell fresh snacks! Trot trot!"`;

  spawnSnacks();
  playNeighSound();

  requestAnimationFrame(gameLoop);
}

function gameLoop(currentTimestamp) {
  if (!isGameRunning) return;

  const delta = (currentTimestamp - lastTimestamp) / 1000;
  lastTimestamp = currentTimestamp;

  timeRemaining = Math.max(0, timeRemaining - delta);

  // Update UI Elements
  timerVal.textContent = timeRemaining.toFixed(1) + 's';
  const progressPercent = (timeRemaining / gameDuration) * 100;
  timerFill.style.width = `${progressPercent}%`;

  // Timer warning colors
  if (timeRemaining <= 3.0) {
    timerVal.className = 'stat-value danger';
  } else if (timeRemaining <= 6.0) {
    timerVal.className = 'stat-value warning';
  } else {
    timerVal.className = 'stat-value';
  }

  // Horse progression (0% to 100%)
  const horseProgress = Math.min(100, ((gameDuration - timeRemaining) / gameDuration) * 100);
  horseMeterFill.style.width = `${horseProgress}%`;
  horsePercent.textContent = `${Math.floor(horseProgress)}%`;

  // Horse behavior escalation
  if (timeRemaining <= 3.5) {
    horseEmoji.className = 'horse-avatar galloping';
    horseEmoji.textContent = '🐎💨';
    horseSpeech.textContent = `"I'M AT FULL SPEED! 3 SECONDS LEFT!! ⚡"`;
  } else if (timeRemaining <= 6.5) {
    horseEmoji.className = 'horse-avatar galloping';
    horseEmoji.textContent = '🐴💨';
    horseSpeech.textContent = `"GALLOPING CLOSER! Almost at the plate!"`;
  }

  // Periodic CPS decay if not clicking
  updateCPS(currentTimestamp);

  // Time expired?
  if (timeRemaining <= 0) {
    endGame(false);
    return;
  }

  requestAnimationFrame(gameLoop);
}

// Game Over / Victory
function endGame(isVictory) {
  isGameRunning = false;
  const timeTaken = (gameDuration - timeRemaining).toFixed(2);
  const snacksEaten = totalSnacks - remainingSnacks.length;

  if (isVictory) {
    playWinFanfare();
    horseEmoji.className = 'horse-avatar';
    horseEmoji.textContent = '🐴💦';
    horseSpeech.textContent = `"NOOO! You ate everything! I only got plate crumbs! 😭"`;

    resultTitle.textContent = "VICTORY! ALL SNACKS GONE!";
    resultTitle.style.background = 'linear-gradient(135deg, #06d6a0 0%, #ffbe0b 100%)';
    resultTitle.style.webkitBackgroundClip = 'text';
    resultEmoji.textContent = '👑';
    resultDesc.textContent = `Incredible speed! You clicked like a machine and saved all snacks in ${timeTaken}s!`;

    // Local storage high score
    const bestTime = localStorage.getItem('snack_best_time');
    if (!bestTime || parseFloat(timeTaken) < parseFloat(bestTime)) {
      localStorage.setItem('snack_best_time', timeTaken);
      resHighscore.textContent = `${timeTaken}s (NEW!)`;
    } else {
      resHighscore.textContent = `${bestTime}s`;
    }
  } else {
    playLoseSound();
    horseEmoji.className = 'horse-avatar munching';
    horseEmoji.textContent = '🐴😋';
    horseSpeech.textContent = `"CHOMP CHOMP! MINE ALL MINE! *GULP* 🐴🌾"`;

    resultTitle.textContent = "THE HORSE ATE THEM ALL!";
    resultTitle.style.background = 'linear-gradient(135deg, #ef233c 0%, #ffbe0b 100%)';
    resultTitle.style.webkitBackgroundClip = 'text';
    resultEmoji.textContent = '🐴';
    resultDesc.textContent = `Time's up! The stallion dashed in and gobbled up the remaining ${remainingSnacks.length} snacks!`;

    const bestTime = localStorage.getItem('snack_best_time');
    resHighscore.textContent = bestTime ? `${bestTime}s` : '--';

    // Horse visually devours whatever remains on the plate
    remainingSnacks.forEach((snack, idx) => {
      setTimeout(() => {
        snack.style.transform = 'translate(-50%, -50%) scale(0) translateY(-60px)';
        snack.style.opacity = '0';
      }, idx * 40);
    });
  }

  resTime.textContent = `${timeTaken}s`;
  resEaten.textContent = `${snacksEaten}/${totalSnacks}`;
  resMaxCps.textContent = maxCPS.toFixed(1);

  setTimeout(() => {
    endModal.classList.add('active');
  }, 600);
}

// Event Listeners for Buttons
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initialize plate placeholder on load
window.addEventListener('DOMContentLoaded', () => {
  spawnSnacks();
});
