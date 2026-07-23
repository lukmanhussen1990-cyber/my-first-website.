(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // Maze data (28 cols x 31 rows, 16px tiles) -- generated & verified as
  // fully connected before being hard-coded here.
  // # = wall, . = pellet, o = power pellet, (space) = empty path
  // ---------------------------------------------------------------------
  const RAW_MAZE = [
    "############################",
    "#..........................#",
    "#.o......................o.#",
    "#..##..##..##..##..##..##..#",
    "#..##..##..##..##..##..##..#",
    "#..........................#",
    "#..........................#",
    "#..##..##..##..##..##..##..#",
    "#..##..##..##..##..##..##..#",
    "#..........................#",
    "#..........................#",
    "#..##..##..........##..##..#",
    "#..##..##..........##..##..#",
    "#..........######..........#",
    "#..........######..........#",
    "...##..##..######..##..##...",
    "#..##..##..######..##..##..#",
    "#..........................#",
    "#..........................#",
    "#..##..##..##..##..##..##..#",
    "#..##..##..##..##..##..##..#",
    "#..........................#",
    "#..........................#",
    "#..##..##..##..##..##..##..#",
    "#..##..##..##..##..##..##..#",
    "#..........................#",
    "#..........................#",
    "#..........................#",
    "#.o......................o.#",
    "#..........................#",
    "############################",
  ];

  const TILE = 16;
  const COLS = RAW_MAZE[0].length;
  const ROWS = RAW_MAZE.length;
  const TUNNEL_ROW = 15;

  const HOUSE = { r0: 13, r1: 16, c0: 11, c1: 16 };

  const DIR = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
    NONE: { x: 0, y: 0 },
  };

  function sameDir(a, b) {
    return a.x === b.x && a.y === b.y;
  }
  function isOpposite(a, b) {
    return a.x === -b.x && a.y === -b.y;
  }

  // ---------------------------------------------------------------------
  // Canvas / HUD setup
  // ---------------------------------------------------------------------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("high-score");
  const livesEl = document.getElementById("lives");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMessage = document.getElementById("overlay-message");
  const startBtn = document.getElementById("start-btn");
  const mobileToggle = document.getElementById("mobile-toggle");
  const touchControls = document.getElementById("touch-controls");

  let highScore = Number(localStorage.getItem("pacman-high-score") || 0);
  highScoreEl.textContent = highScore;

  // ---------------------------------------------------------------------
  // Maze grid state (mutable copy so pellets can be eaten)
  // ---------------------------------------------------------------------
  let grid, totalPellets;

  function resetGrid() {
    grid = RAW_MAZE.map((row) => row.split(""));
    totalPellets = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === "." || grid[r][c] === "o") totalPellets++;
      }
    }
  }

  function wrapCol(c) {
    return ((c % COLS) + COLS) % COLS;
  }

  function isWall(col, row) {
    if (row < 0 || row >= ROWS) return true;
    col = wrapCol(col);
    return grid[row][col] === "#";
  }

  // ---------------------------------------------------------------------
  // Entities
  // ---------------------------------------------------------------------
  const PAC_SPAWN = { col: 13, row: 23 };
  const GHOST_SPAWNS = [
    { col: 12, row: 12 },
    { col: 13, row: 12 },
    { col: 14, row: 12 },
    { col: 15, row: 12 },
  ];
  const CORNERS = {
    topLeft: { col: 1, row: 1 },
    topRight: { col: COLS - 2, row: 1 },
    bottomLeft: { col: 1, row: ROWS - 2 },
    bottomRight: { col: COLS - 2, row: ROWS - 2 },
  };

  const GHOST_DEFS = [
    { name: "blinky", color: "#ff0000", scatter: CORNERS.topRight, spawn: GHOST_SPAWNS[0] },
    { name: "pinky", color: "#ffb8ff", scatter: CORNERS.topLeft, spawn: GHOST_SPAWNS[1] },
    { name: "inky", color: "#00ffff", scatter: CORNERS.bottomRight, spawn: GHOST_SPAWNS[2] },
    { name: "clyde", color: "#ffb852", scatter: CORNERS.bottomLeft, spawn: GHOST_SPAWNS[3] },
  ];

  const NORMAL_SPEED = 2;
  const FRIGHTENED_SPEED = 1;
  const EATEN_SPEED = 4;

  let pacman, ghosts;
  let score, lives, comboMultiplier;
  let frightenedTimer = 0;
  let modeIndex, modeTimer;
  const MODE_SCHEDULE = [
    { mode: "scatter", duration: 7000 },
    { mode: "chase", duration: 20000 },
    { mode: "scatter", duration: 7000 },
    { mode: "chase", duration: 20000 },
    { mode: "scatter", duration: 5000 },
    { mode: "chase", duration: 20000 },
    { mode: "scatter", duration: 5000 },
    { mode: "chase", duration: Infinity },
  ];

  function newPacman() {
    return {
      col: PAC_SPAWN.col,
      row: PAC_SPAWN.row,
      x: PAC_SPAWN.col * TILE,
      y: PAC_SPAWN.row * TILE,
      dir: DIR.NONE,
      nextDir: DIR.NONE,
      speed: NORMAL_SPEED,
      mouthPhase: 0,
      alive: true,
    };
  }

  function newGhosts() {
    return GHOST_DEFS.map((def) => ({
      ...def,
      col: def.spawn.col,
      row: def.spawn.row,
      x: def.spawn.col * TILE,
      y: def.spawn.row * TILE,
      dir: DIR.LEFT,
      state: "scatter",
      frightenedFlash: false,
    }));
  }

  function resetPositions() {
    pacman = newPacman();
    ghosts = newGhosts();
    frightenedTimer = 0;
    modeIndex = 0;
    modeTimer = MODE_SCHEDULE[0].duration;
    for (const g of ghosts) g.state = MODE_SCHEDULE[0].mode;
    comboMultiplier = 1;
  }

  function resetGame() {
    resetGrid();
    resetPositions();
    score = 0;
    lives = 3;
    scoreEl.textContent = score;
    livesEl.textContent = lives;
  }

  // ---------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------
  let paused = false;
  let running = false;

  const KEY_DIR = {
    ArrowUp: DIR.UP,
    ArrowDown: DIR.DOWN,
    ArrowLeft: DIR.LEFT,
    ArrowRight: DIR.RIGHT,
    w: DIR.UP,
    s: DIR.DOWN,
    a: DIR.LEFT,
    d: DIR.RIGHT,
    W: DIR.UP,
    S: DIR.DOWN,
    A: DIR.LEFT,
    D: DIR.RIGHT,
  };

  window.addEventListener("keydown", (e) => {
    if (e.key === "p" || e.key === "P") {
      togglePause();
      return;
    }
    const dir = KEY_DIR[e.key];
    if (dir) {
      e.preventDefault();
      if (!running) startGame();
      pacman.nextDir = dir;
    }
  });

  function bindTouch(selector, dir) {
    const btn = document.querySelector(selector);
    btn.addEventListener("click", () => {
      if (!running) startGame();
      pacman.nextDir = dir;
    });
  }
  bindTouch(".tc-up", DIR.UP);
  bindTouch(".tc-down", DIR.DOWN);
  bindTouch(".tc-left", DIR.LEFT);
  bindTouch(".tc-right", DIR.RIGHT);

  mobileToggle.addEventListener("click", () => {
    const hidden = touchControls.classList.toggle("hidden");
    mobileToggle.textContent = hidden ? "show touch controls" : "hide touch controls";
  });

  startBtn.addEventListener("click", startGame);

  function togglePause() {
    if (!running) return;
    paused = !paused;
    overlay.classList.toggle("hidden", !paused);
    overlayTitle.textContent = "PAUSED";
    overlayMessage.textContent = "Press P to resume";
    startBtn.classList.add("hidden");
  }

  function startGame() {
    resetGame();
    running = true;
    paused = false;
    overlay.classList.add("hidden");
    startBtn.classList.remove("hidden");
  }

  function endGame(won) {
    running = false;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("pacman-high-score", String(highScore));
      highScoreEl.textContent = highScore;
    }
    overlay.classList.remove("hidden");
    overlayTitle.textContent = won ? "YOU WIN!" : "GAME OVER";
    overlayMessage.textContent = won
      ? `You cleared the board with a score of ${score}!`
      : `Final score: ${score}. Give it another shot!`;
    startBtn.textContent = "Play Again";
    startBtn.classList.remove("hidden");
  }

  // ---------------------------------------------------------------------
  // Movement helpers (grid-aligned stepping)
  // ---------------------------------------------------------------------
  function atTileCenter(entity) {
    return entity.x % TILE === 0 && entity.y % TILE === 0;
  }

  function canGo(col, row, dir) {
    return !isWall(col + dir.x, row + dir.y);
  }

  function stepEntity(entity, speed) {
    entity.x += entity.dir.x * speed;
    entity.y += entity.dir.y * speed;
    // tunnel wrap - add/subtract an exact multiple of TILE so tile
    // alignment (x % TILE === 0) is preserved through the wrap.
    const maxX = COLS * TILE;
    if (entity.x <= -TILE) entity.x += maxX;
    if (entity.x >= maxX) entity.x -= maxX;
  }

  // ---------------------------------------------------------------------
  // Pac-Man update
  // ---------------------------------------------------------------------
  function updatePacman() {
    if (atTileCenter(pacman)) {
      pacman.col = wrapCol(Math.round(pacman.x / TILE));
      pacman.row = Math.round(pacman.y / TILE);

      if (pacman.nextDir !== DIR.NONE && canGo(pacman.col, pacman.row, pacman.nextDir)) {
        pacman.dir = pacman.nextDir;
      } else if (!canGo(pacman.col, pacman.row, pacman.dir)) {
        pacman.dir = DIR.NONE;
      }

      // eat pellet
      const cell = grid[pacman.row][pacman.col];
      if (cell === "." || cell === "o") {
        grid[pacman.row][pacman.col] = " ";
        totalPellets--;
        if (cell === ".") {
          score += 10;
        } else {
          score += 50;
          triggerFrightened();
        }
        scoreEl.textContent = score;
        if (totalPellets <= 0) {
          endGame(true);
        }
      }
    }
    if (pacman.dir !== DIR.NONE) {
      stepEntity(pacman, pacman.speed);
      pacman.mouthPhase += 0.25;
    }
  }

  function triggerFrightened() {
    comboMultiplier = 1;
    frightenedTimer = 7000;
    for (const g of ghosts) {
      if (g.state !== "eaten") {
        g.state = "frightened";
        g.dir = { x: -g.dir.x, y: -g.dir.y };
      }
    }
  }

  // ---------------------------------------------------------------------
  // Ghost AI
  // ---------------------------------------------------------------------
  function tileDist(aCol, aRow, bCol, bRow) {
    const dx = aCol - bCol;
    const dy = aRow - bRow;
    return dx * dx + dy * dy;
  }

  function ghostTarget(g) {
    if (g.state === "eaten") {
      return { col: HOUSE.c0 + 2, row: HOUSE.r0 };
    }
    if (g.state === "scatter") {
      return g.scatter;
    }
    if (g.state === "frightened") {
      return null; // handled separately (flee)
    }
    // chase
    const pDir = pacman.dir === DIR.NONE ? DIR.LEFT : pacman.dir;
    switch (g.name) {
      case "blinky":
        return { col: pacman.col, row: pacman.row };
      case "pinky":
        return { col: pacman.col + pDir.x * 4, row: pacman.row + pDir.y * 4 };
      case "inky": {
        const blinky = ghosts.find((gh) => gh.name === "blinky");
        const aheadCol = pacman.col + pDir.x * 2;
        const aheadRow = pacman.row + pDir.y * 2;
        return {
          col: aheadCol + (aheadCol - blinky.col),
          row: aheadRow + (aheadRow - blinky.row),
        };
      }
      case "clyde": {
        const d = tileDist(g.col, g.row, pacman.col, pacman.row);
        if (d > 64) return { col: pacman.col, row: pacman.row };
        return g.scatter;
      }
      default:
        return { col: pacman.col, row: pacman.row };
    }
  }

  function chooseGhostDirection(g) {
    const dirs = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT].filter((d) => {
      if (isOpposite(d, g.dir) && g.state !== "eaten") return false;
      return canGo(g.col, g.row, d);
    });
    if (dirs.length === 0) {
      // dead end - allow reversal
      const reverse = { x: -g.dir.x, y: -g.dir.y };
      if (canGo(g.col, g.row, reverse)) return reverse;
      return g.dir;
    }
    if (g.state === "frightened") {
      return dirs[Math.floor(Math.random() * dirs.length)];
    }
    const target = ghostTarget(g);
    let best = dirs[0];
    let bestDist = Infinity;
    for (const d of dirs) {
      const nc = g.col + d.x;
      const nr = g.row + d.y;
      const dist = tileDist(nc, nr, target.col, target.row);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return best;
  }

  function updateGhost(g) {
    if (atTileCenter(g)) {
      g.col = wrapCol(Math.round(g.x / TILE));
      g.row = Math.round(g.y / TILE);

      if (g.state === "eaten" && g.col === HOUSE.c0 + 2 && Math.abs(g.row - HOUSE.r0) <= 1) {
        g.state = MODE_SCHEDULE[modeIndex].mode;
      }

      g.dir = chooseGhostDirection(g);
    }
    let speed = NORMAL_SPEED;
    if (g.state === "frightened") speed = FRIGHTENED_SPEED;
    if (g.state === "eaten") speed = EATEN_SPEED;
    stepEntity(g, speed);
  }

  function updateModeTimer(dt) {
    if (frightenedTimer > 0) {
      frightenedTimer -= dt;
      if (frightenedTimer <= 0) {
        frightenedTimer = 0;
        for (const g of ghosts) {
          if (g.state === "frightened") g.state = MODE_SCHEDULE[modeIndex].mode;
        }
      }
      return;
    }
    modeTimer -= dt;
    if (modeTimer <= 0) {
      modeIndex = Math.min(modeIndex + 1, MODE_SCHEDULE.length - 1);
      modeTimer = MODE_SCHEDULE[modeIndex].duration;
      for (const g of ghosts) {
        if (g.state === "scatter" || g.state === "chase") {
          g.state = MODE_SCHEDULE[modeIndex].mode;
          g.dir = { x: -g.dir.x, y: -g.dir.y };
        }
      }
    }
  }

  function checkCollisions() {
    for (const g of ghosts) {
      const dx = g.x - pacman.x;
      const dy = g.y - pacman.y;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < (TILE * 0.6) * (TILE * 0.6)) {
        if (g.state === "frightened") {
          g.state = "eaten";
          score += 200 * comboMultiplier;
          comboMultiplier *= 2;
          scoreEl.textContent = score;
        } else if (g.state !== "eaten") {
          loseLife();
          return;
        }
      }
    }
  }

  function loseLife() {
    lives--;
    livesEl.textContent = lives;
    if (lives <= 0) {
      endGame(false);
    } else {
      resetPositions();
    }
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------
  function drawMaze() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = grid[r][c];
        const x = c * TILE;
        const y = r * TILE;
        if (cell === "#") {
          const inHouse = r >= HOUSE.r0 && r <= HOUSE.r1 && c >= HOUSE.c0 && c <= HOUSE.c1;
          ctx.fillStyle = inHouse ? "#0b0b2a" : "#1919c9";
          ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
          if (inHouse) {
            ctx.strokeStyle = "#ff9dce";
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
          }
        } else if (cell === ".") {
          ctx.fillStyle = "#ffd9a0";
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (cell === "o") {
          const pulse = 2.6 + Math.sin(Date.now() / 150) * 1.2;
          ctx.fillStyle = "#ffd9a0";
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, pulse, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawPacman() {
    const x = pacman.x + TILE / 2;
    const y = pacman.y + TILE / 2;
    const r = TILE / 2 - 1;
    let angle = 0;
    if (sameDir(pacman.dir, DIR.LEFT)) angle = Math.PI;
    else if (sameDir(pacman.dir, DIR.UP)) angle = -Math.PI / 2;
    else if (sameDir(pacman.dir, DIR.DOWN)) angle = Math.PI / 2;

    const mouth = Math.abs(Math.sin(pacman.mouthPhase)) * 0.28 * Math.PI;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "#ffd400";
    ctx.beginPath();
    if (pacman.dir === DIR.NONE) {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    } else {
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, mouth, Math.PI * 2 - mouth);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGhost(g) {
    const x = g.x + TILE / 2;
    const y = g.y + TILE / 2;
    const r = TILE / 2 - 1;
    let bodyColor = g.color;
    if (g.state === "frightened") {
      const flashing = frightenedTimer < 2000 && Math.floor(Date.now() / 200) % 2 === 0;
      bodyColor = flashing ? "#ffffff" : "#2222ff";
    }

    if (g.state !== "eaten") {
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(x, y - 1, r, Math.PI, 0, false);
      ctx.lineTo(x + r, y + r);
      const waves = 3;
      for (let i = 0; i < waves; i++) {
        const wx = x + r - (i * 2 + 1) * (r / waves);
        ctx.lineTo(wx, i % 2 === 0 ? y + r - 4 : y + r);
      }
      ctx.lineTo(x - r, y + r);
      ctx.closePath();
      ctx.fill();
    }

    // eyes
    const eyeOffsetX = g.dir.x * 2;
    const eyeOffsetY = g.dir.y * 2;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x - 3, y - 2, 2.6, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 2, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0033aa";
    ctx.beginPath();
    ctx.arc(x - 3 + eyeOffsetX, y - 2 + eyeOffsetY, 1.3, 0, Math.PI * 2);
    ctx.arc(x + 3 + eyeOffsetX, y - 2 + eyeOffsetY, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function render() {
    drawMaze();
    drawPacman();
    for (const g of ghosts) drawGhost(g);
  }

  // ---------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------
  let lastTime = performance.now();

  function loop(now) {
    const dt = now - lastTime;
    lastTime = now;

    if (running && !paused) {
      updateModeTimer(dt);
      updatePacman();
      for (const g of ghosts) updateGhost(g);
      checkCollisions();
      render();
    } else if (!running) {
      // idle animation frame behind the start overlay
      render();
    }
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  resetGame();
  render();
  requestAnimationFrame(loop);
})();
