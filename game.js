const canvas = document.getElementById('maze-canvas');
const ctx = canvas.getContext('2d');

const LEVELS = [
  null, // index 0 unused
  { size: 10, timer: 0,  fog: false, fakeExits: 0 },
  { size: 12, timer: 60, fog: false, fakeExits: 0 },
  { size: 15, timer: 55, fog: false, fakeExits: 0 },
  { size: 18, timer: 50, fog: false, fakeExits: 2 },
  { size: 20, timer: 45, fog: false, fakeExits: 2 },
  { size: 22, timer: 40, fog: true,  fakeExits: 0 },
  { size: 25, timer: 35, fog: true,  fakeExits: 0 },
  { size: 28, timer: 30, fog: true,  fakeExits: 3 },
  { size: 30, timer: 25, fog: true,  fakeExits: 3 },
  { size: 35, timer: 20, fog: true,  fakeExits: 3 },
];

function getLevelConfig(level) {
  if (level <= 10) return LEVELS[level];
  return {
    size: 35 + (level - 10) * 3,
    timer: Math.max(15, 20 - (level - 10)),
    fog: true,
    fakeExits: 3,
  };
}

let currentLevel, config, maze, player, steps, timeLeft, timerInterval;
let fakeExitCells = [];
let visitedFog = [];
let bestLevel = parseInt(localStorage.getItem('maze-best') || '1');

// --- Maze generation: Recursive Backtracker ---
function generateMaze(size) {
  // Each cell has walls: [top, right, bottom, left]
  const grid = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ walls: [true, true, true, true], visited: false }))
  );

  function carve(r, c) {
    grid[r][c].visited = true;
    const dirs = shuffle([[0,1,1,3],[1,0,2,0],[ 0,-1,3,1],[-1,0,0,2]]);
    for (const [dr, dc, wall, opp] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && !grid[nr][nc].visited) {
        grid[r][c].walls[wall] = false;
        grid[nr][nc].walls[opp] = false;
        carve(nr, nc);
      }
    }
  }

  carve(0, 0);
  return grid;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- Setup level ---
function startLevel(level) {
  currentLevel = level;
  config = getLevelConfig(level);
  maze = generateMaze(config.size);
  player = { r: 0, c: 0 };
  steps = 0;
  timeLeft = config.timer;
  fakeExitCells = [];
  visitedFog = Array.from({ length: config.size }, () => Array(config.size).fill(false));

  // Place fake exits at random dead-ends (not exit cell)
  if (config.fakeExits > 0) {
    const deadEnds = [];
    for (let r = 0; r < config.size; r++) {
      for (let c = 0; c < config.size; c++) {
        if (r === config.size - 1 && c === config.size - 1) continue;
        const walls = maze[r][c].walls;
        const wallCount = walls.filter(Boolean).length;
        if (wallCount === 3) deadEnds.push({ r, c });
      }
    }
    shuffle(deadEnds);
    fakeExitCells = deadEnds.slice(0, config.fakeExits);
  }

  // HUD
  document.getElementById('level-display').textContent = level;
  document.getElementById('steps-display').textContent = 0;
  document.getElementById('best-display').textContent = bestLevel;

  const timerBox = document.getElementById('timer-box');
  if (config.timer > 0) {
    timerBox.style.display = 'flex';
    updateTimerDisplay();
    clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
  } else {
    timerBox.style.display = 'none';
    clearInterval(timerInterval);
  }

  resizeCanvas();
  markFog();
  render();
}

function tick() {
  timeLeft--;
  updateTimerDisplay();
  if (timeLeft <= 0) {
    clearInterval(timerInterval);
    showGameOver();
  }
}

function updateTimerDisplay() {
  const el = document.getElementById('timer-display');
  el.textContent = timeLeft;
  el.className = timeLeft <= 5 ? 'danger' : '';
}

function markFog() {
  if (!config.fog) return;
  const r = player.r, c = player.c;
  const radius = 3;
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < config.size && nc >= 0 && nc < config.size) {
        if (Math.abs(dr) + Math.abs(dc) <= radius) visitedFog[nr][nc] = true;
      }
    }
  }
}

// --- Rendering ---
function resizeCanvas() {
  const maxSize = Math.min(window.innerWidth - 32, 620);
  const cell = Math.floor(maxSize / config.size);
  canvas.width = cell * config.size;
  canvas.height = cell * config.size;
}

function render() {
  const size = config.size;
  const cell = canvas.width / size;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const x = c * cell, y = r * cell;

      // Fog
      if (config.fog) {
        if (!visitedFog[r][c]) {
          ctx.fillStyle = '#05050d';
          ctx.fillRect(x, y, cell, cell);
          continue;
        }
        const isNear = Math.abs(r - player.r) + Math.abs(c - player.c) <= 3;
        ctx.fillStyle = isNear ? '#1a1a2e' : '#0d0d1a';
        ctx.fillRect(x, y, cell, cell);
      } else {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(x, y, cell, cell);
      }

      // Exit
      if (r === size - 1 && c === size - 1) {
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      }

      // Fake exits
      const isFake = fakeExitCells.some(f => f.r === r && f.c === c);
      if (isFake && (!config.fog || visitedFog[r][c])) {
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      }

      // Walls
      ctx.strokeStyle = '#6d28d9';
      ctx.lineWidth = 2;
      const walls = maze[r][c].walls;
      if (walls[0]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cell, y); ctx.stroke(); }
      if (walls[1]) { ctx.beginPath(); ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); ctx.stroke(); }
      if (walls[2]) { ctx.beginPath(); ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); ctx.stroke(); }
      if (walls[3]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cell); ctx.stroke(); }
    }
  }

  // Player
  const px = player.c * cell + cell / 2;
  const py = player.r * cell + cell / 2;
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.arc(px, py, cell * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

// --- Movement ---
function move(dr, dc) {
  const { r, c } = player;
  const nr = r + dr, nc = c + dc;
  if (nr < 0 || nr >= config.size || nc < 0 || nc >= config.size) return;

  // Check wall between current and next
  // dr=-1 → top(0), dr=1 → bottom(2), dc=1 → right(1), dc=-1 → left(3)
  const wallIdx = dr === -1 ? 0 : dr === 1 ? 2 : dc === 1 ? 1 : 3;
  if (maze[r][c].walls[wallIdx]) return;

  player.r = nr;
  player.c = nc;
  steps++;
  document.getElementById('steps-display').textContent = steps;
  markFog();
  render();
  checkWin();
}

function checkWin() {
  const { r, c } = player;
  const size = config.size;

  // Fake exit — show a message briefly but don't advance
  const isFake = fakeExitCells.some(f => f.r === r && f.c === c);
  if (isFake) {
    // Flash the canvas red briefly
    ctx.fillStyle = 'rgba(255,0,0,0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setTimeout(() => render(), 300);
    return;
  }

  // Real exit
  if (r === size - 1 && c === size - 1) {
    clearInterval(timerInterval);
    if (currentLevel >= bestLevel) {
      bestLevel = currentLevel + 1;
      localStorage.setItem('maze-best', bestLevel);
    }
    showLevelComplete();
  }
}

// --- Overlays ---
function showLevelComplete() {
  document.getElementById('complete-title').textContent =
    currentLevel >= 10 ? `Level ${currentLevel} — Endless!` : `Level ${currentLevel} Complete!`;
  document.getElementById('complete-steps').textContent = `Steps taken: ${steps}`;
  document.getElementById('complete-time').textContent =
    config.timer > 0 ? `Time left: ${timeLeft}s` : '';
  document.getElementById('level-complete').style.display = 'flex';
}

function showGameOver() {
  document.getElementById('gameover-level').textContent = `You were on Level ${currentLevel}`;
  document.getElementById('game-over-screen').style.display = 'flex';
}

// --- Controls ---
document.addEventListener('keydown', e => {
  const map = {
    ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1],
    W: [-1, 0], S: [1, 0], A: [0, -1], D: [0, 1],
  };
  if (map[e.key]) { e.preventDefault(); move(...map[e.key]); }
});

// Swipe
let tx, ty;
canvas.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; });
canvas.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tx;
  const dy = e.changedTouches[0].clientY - ty;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) move(0, dx > 0 ? 1 : -1);
  else move(dy > 0 ? 1 : -1, 0);
});

// Buttons
document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('start-screen').style.display = 'none';
  startLevel(1);
});

document.getElementById('next-btn').addEventListener('click', () => {
  document.getElementById('level-complete').style.display = 'none';
  startLevel(currentLevel + 1);
});

document.getElementById('retry-btn').addEventListener('click', () => {
  document.getElementById('game-over-screen').style.display = 'none';
  startLevel(currentLevel);
});

window.addEventListener('resize', () => { resizeCanvas(); render(); });

// Init best display
document.getElementById('best-display').textContent = bestLevel;
