// Web Audio Synthesizer for retro 8-bit sounds
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playJump() {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch(e) {}
  }

  playScore() {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [587.33, 880].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const start = now + (idx * 0.08);
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.16);
      });
    } catch(e) {}
  }

  playHit() {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    } catch(e) {}
  }
}

// Particle system for running dust and jump sparks
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawn(x, y, color = '#64748b', count = 4, speedFactor = 1) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() * -2 - 1) * speedFactor,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3.5 + 1.5,
        color: color,
        alpha: 0.8,
        life: 0.8
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= dt * 1.5;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.restore();
  }

  reset() {
    this.particles = [];
  }
}

// Main Dino Game Class
class DinoGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.sound = new SoundFX();
    this.particles = new ParticleSystem();

    // DOM UI
    this.currentScoreEl = document.getElementById('current-score');
    this.highScoreEl = document.getElementById('high-score');
    this.overlay = document.getElementById('game-overlay');
    this.overlayTitle = document.getElementById('overlay-title');
    this.overlayDesc = document.getElementById('overlay-desc');
    this.statusBadge = document.getElementById('status-badge');
    this.startBtn = document.getElementById('start-btn');
    this.muteBtn = document.getElementById('mute-btn');
    this.themeBtn = document.getElementById('theme-btn');
    this.touchDuck = document.getElementById('touch-duck');
    this.touchJump = document.getElementById('touch-jump');

    // Canvas Virtual Dimensions
    this.width = 800;
    this.height = 300;
    this.groundY = 240;

    // High Score
    this.highScore = parseInt(localStorage.getItem('dino_hi_score') || '0', 10);
    this.updateScoreDisplay();

    // Game state
    this.state = 'IDLE'; // 'IDLE', 'RUNNING', 'GAMEOVER'
    this.score = 0;
    this.distance = 0;
    this.baseSpeed = 6;
    this.currentSpeed = 6;
    this.nextMilestone = 100;

    // Dino Player
    this.dino = {
      x: 60,
      y: this.groundY - 48,
      w: 44,
      h: 48,
      vy: 0,
      gravity: 0.85,
      jumpForce: -13.5,
      isGrounded: true,
      isDucking: false,
      legCycle: 0,
      normalH: 48,
      duckH: 28,
      normalW: 44,
      duckW: 56
    };

    // Obstacles and clouds
    this.obstacles = [];
    this.clouds = [
      { x: 150, y: 50, speed: 0.6, scale: 1 },
      { x: 420, y: 75, speed: 0.4, scale: 0.8 },
      { x: 700, y: 40, speed: 0.5, scale: 1.2 }
    ];
    this.groundPoints = [];
    this.initGround();

    // Timing
    this.lastTime = 0;
    this.obstacleTimer = 0;
    this.minObstacleSpacing = 80;

    // Theme state
    this.isRetro = false;

    this.bindEvents();
    this.render();
  }

  initGround() {
    this.groundPoints = [];
    for (let x = 0; x < this.width + 100; x += 18) {
      if (Math.random() > 0.4) {
        this.groundPoints.push({
          x: x,
          y: this.groundY + Math.floor(Math.random() * 4) + 1,
          w: Math.floor(Math.random() * 8) + 2
        });
      }
    }
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        this.sound.init();
        if (this.state === 'IDLE' || this.state === 'GAMEOVER') {
          this.start();
        } else if (this.state === 'RUNNING') {
          this.jump();
        }
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (this.state === 'RUNNING') {
          this.duck(true);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowDown') {
        if (this.state === 'RUNNING') {
          this.duck(false);
        }
      }
    });

    this.startBtn.addEventListener('click', () => {
      this.sound.init();
      this.start();
    });

    // Sound toggle
    this.muteBtn.addEventListener('click', () => {
      this.sound.init();
      this.sound.enabled = !this.sound.enabled;
      this.muteBtn.textContent = this.sound.enabled ? '🔊' : '🔇';
    });

    // Theme toggle
    this.themeBtn.addEventListener('click', () => {
      this.isRetro = !this.isRetro;
      document.body.setAttribute('data-theme', this.isRetro ? 'retro' : 'dark');
      this.themeBtn.textContent = this.isRetro ? '☀️' : '🌙';
    });

    // Mobile touch
    this.touchJump.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.sound.init();
      if (this.state !== 'RUNNING') this.start();
      else this.jump();
    });
    this.touchJump.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.sound.init();
      if (this.state !== 'RUNNING') this.start();
      else this.jump();
    });

    this.touchDuck.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.state === 'RUNNING') this.duck(true);
    });
    this.touchDuck.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (this.state === 'RUNNING') this.duck(false);
    });
    this.touchDuck.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (this.state === 'RUNNING') this.duck(true);
    });
    this.touchDuck.addEventListener('mouseup', (e) => {
      e.preventDefault();
      if (this.state === 'RUNNING') this.duck(false);
    });
  }

  jump() {
    if (this.dino.isGrounded) {
      this.dino.vy = this.dino.jumpForce;
      this.dino.isGrounded = false;
      this.sound.playJump();
      this.particles.spawn(this.dino.x + 10, this.groundY, '#38bdf8', 6, 0.5);
    }
  }

  duck(isDucking) {
    if (this.dino.isDucking === isDucking) return;
    this.dino.isDucking = isDucking;
    if (isDucking) {
      this.dino.h = this.dino.duckH;
      this.dino.w = this.dino.duckW;
      if (this.dino.isGrounded) {
        this.dino.y = this.groundY - this.dino.duckH;
      }
    } else {
      this.dino.h = this.dino.normalH;
      this.dino.w = this.dino.normalW;
      if (this.dino.isGrounded) {
        this.dino.y = this.groundY - this.dino.normalH;
      }
    }
  }

  start() {
    this.state = 'RUNNING';
    this.score = 0;
    this.distance = 0;
    this.currentSpeed = this.baseSpeed;
    this.nextMilestone = 100;
    this.obstacles = [];
    this.obstacleTimer = 0;
    this.particles.reset();

    this.dino.y = this.groundY - this.dino.normalH;
    this.dino.w = this.dino.normalW;
    this.dino.h = this.dino.normalH;
    this.dino.vy = 0;
    this.dino.isGrounded = true;
    this.dino.isDucking = false;

    this.overlay.classList.add('hidden');
    this.updateScoreDisplay();

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  gameOver() {
    this.state = 'GAMEOVER';
    this.sound.playHit();

    if (this.score > this.highScore) {
      this.highScore = Math.floor(this.score);
      localStorage.setItem('dino_hi_score', this.highScore);
    }
    this.updateScoreDisplay();

    // Show Overlay
    this.statusBadge.textContent = 'GAME OVER';
    this.statusBadge.className = 'badge game-over';
    this.overlayTitle.textContent = `SCORE: ${Math.floor(this.score)}`;
    this.overlayDesc.textContent = `High score: ${this.highScore}. Press SPACE or click restart to try again!`;
    this.startBtn.textContent = 'PLAY AGAIN';
    this.overlay.classList.remove('hidden');

    this.particles.spawn(this.dino.x + 20, this.dino.y + 20, '#f43f5e', 20, 1.2);
  }

  updateScoreDisplay() {
    const pad = (num, size) => {
      let s = num + '';
      while (s.length < size) s = '0' + s;
      return s;
    };
    this.currentScoreEl.textContent = pad(Math.floor(this.score), 5);
    this.highScoreEl.textContent = pad(Math.floor(this.highScore), 5);
  }

  gameLoop(currentTime) {
    if (this.state !== 'RUNNING') {
      this.render();
      return;
    }

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    if (this.state === 'RUNNING') {
      requestAnimationFrame((t) => this.gameLoop(t));
    }
  }

  update(dt) {
    // Dynamic Speed scaling
    this.currentSpeed = this.baseSpeed + Math.min(Math.floor(this.score / 150) * 0.8, 8.5);

    // Score increment
    this.distance += this.currentSpeed * dt * 10;
    this.score += dt * 10;
    this.updateScoreDisplay();

    // Milestone sound
    if (this.score >= this.nextMilestone) {
      this.sound.playScore();
      this.nextMilestone += 100;
    }

    // Dino Physics
    if (!this.dino.isGrounded) {
      this.dino.vy += this.dino.gravity;
      // Faster drop when ducking mid-air
      if (this.dino.isDucking) {
        this.dino.vy += this.dino.gravity * 0.8;
      }
      this.dino.y += this.dino.vy;

      const targetY = this.dino.isDucking ? (this.groundY - this.dino.duckH) : (this.groundY - this.dino.normalH);
      if (this.dino.y >= targetY) {
        this.dino.y = targetY;
        this.dino.vy = 0;
        this.dino.isGrounded = true;
      }
    } else {
      // Dust particles while running
      if (Math.random() < 0.25) {
        this.particles.spawn(this.dino.x + 4, this.groundY - 2, '#64748b', 1, 0.4);
      }
    }

    this.dino.legCycle += dt * 14;

    // Ground scrolling
    for (const pt of this.groundPoints) {
      pt.x -= this.currentSpeed;
      if (pt.x < -20) {
        pt.x = this.width + Math.random() * 20;
        pt.y = this.groundY + Math.floor(Math.random() * 4) + 1;
      }
    }

    // Cloud drifting
    for (const c of this.clouds) {
      c.x -= c.speed * (this.currentSpeed * 0.2 + 0.8);
      if (c.x < -80) {
        c.x = this.width + Math.random() * 100;
        c.y = 30 + Math.random() * 60;
      }
    }

    // Spawn Obstacles
    this.obstacleTimer += dt;
    const spawnInterval = Math.max(1.1, 2.5 - (this.score / 600));
    if (this.obstacleTimer > spawnInterval) {
      this.spawnObstacle();
      this.obstacleTimer = 0;
    }

    // Update Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= this.currentSpeed;

      // Bird wing flap animation
      if (obs.type === 'bird') {
        obs.wingTimer = (obs.wingTimer || 0) + dt * 8;
      }

      // Check Collision with hitboxes
      if (this.checkCollision(this.dino, obs)) {
        this.gameOver();
        return;
      }

      // Remove offscreen
      if (obs.x + obs.w < -20) {
        this.obstacles.splice(i, 1);
      }
    }

    // Update particles
    this.particles.update(dt);
  }

  spawnObstacle() {
    // Only spawn birds after score 150
    const canSpawnBird = this.score > 150 && Math.random() < 0.35;

    if (canSpawnBird) {
      // Birds fly at ducking height or mid jump height
      const flyHeights = [
        this.groundY - 32, // duck to avoid
        this.groundY - 55  // jump over
      ];
      const y = flyHeights[Math.floor(Math.random() * flyHeights.length)];
      this.obstacles.push({
        type: 'bird',
        x: this.width + 20,
        y: y,
        w: 36,
        h: 24,
        wingTimer: 0
      });
    } else {
      // Cactus: single, double, or big
      const cactusTypes = [
        { w: 20, h: 42, count: 1 },
        { w: 38, h: 42, count: 2 },
        { w: 28, h: 52, count: 'tall' }
      ];
      const choice = cactusTypes[Math.floor(Math.random() * cactusTypes.length)];
      this.obstacles.push({
        type: 'cactus',
        x: this.width + 20,
        y: this.groundY - choice.h,
        w: choice.w,
        h: choice.h,
        cactusKind: choice.count
      });
    }
  }

  checkCollision(dino, obs) {
    // Inner box tolerance padding for fair arcade hitbox
    const padX = 6;
    const padY = 4;
    return (
      dino.x + padX < obs.x + obs.w - padX &&
      dino.x + dino.w - padX > obs.x + padX &&
      dino.y + padY < obs.y + obs.h - padY &&
      dino.y + dino.h - padY > obs.y + padY
    );
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw background elements (clouds & distant sun/moon)
    this.drawSky();

    // Draw Ground
    this.drawGround();

    // Draw Particles
    this.particles.draw(this.ctx);

    // Draw Obstacles
    for (const obs of this.obstacles) {
      if (obs.type === 'bird') {
        this.drawBird(obs);
      } else {
        this.drawCactus(obs);
      }
    }

    // Draw Dino
    this.drawDino();
  }

  drawSky() {
    const isRetro = document.body.getAttribute('data-theme') === 'retro';

    // Sun / Moon
    this.ctx.save();
    this.ctx.fillStyle = isRetro ? 'rgba(251, 191, 36, 0.4)' : 'rgba(56, 189, 248, 0.2)';
    this.ctx.beginPath();
    this.ctx.arc(720, 60, 26, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // Clouds
    this.ctx.save();
    this.ctx.fillStyle = isRetro ? 'rgba(148, 163, 184, 0.45)' : 'rgba(71, 85, 105, 0.4)';
    for (const c of this.clouds) {
      this.ctx.beginPath();
      this.ctx.arc(c.x, c.y, 14 * c.scale, 0, Math.PI * 2);
      this.ctx.arc(c.x + 15 * c.scale, c.y - 6 * c.scale, 18 * c.scale, 0, Math.PI * 2);
      this.ctx.arc(c.x + 35 * c.scale, c.y, 13 * c.scale, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawGround() {
    const isRetro = document.body.getAttribute('data-theme') === 'retro';
    this.ctx.save();
    this.ctx.strokeStyle = isRetro ? '#535353' : '#475569';
    this.ctx.lineWidth = 2;

    // Horizon line
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.groundY);
    this.ctx.lineTo(this.width, this.groundY);
    this.ctx.stroke();

    // Small pixel ground gravel
    this.ctx.fillStyle = isRetro ? '#737373' : '#64748b';
    for (const pt of this.groundPoints) {
      this.ctx.fillRect(pt.x, pt.y, pt.w, 2);
    }
    this.ctx.restore();
  }

  drawDino() {
    const isRetro = document.body.getAttribute('data-theme') === 'retro';
    const mainColor = isRetro ? '#535353' : '#34d399';
    const eyeColor = isRetro ? '#ffffff' : '#0f172a';

    const d = this.dino;
    this.ctx.save();
    this.ctx.fillStyle = mainColor;

    if (!d.isDucking) {
      // Upright T-Rex Pixel Art
      const x = d.x;
      const y = d.y;

      // Head
      this.ctx.fillRect(x + 22, y, 22, 16);
      // Snout extension
      this.ctx.fillRect(x + 32, y + 6, 12, 10);
      // Eye
      this.ctx.fillStyle = eyeColor;
      this.ctx.fillRect(x + 28, y + 4, 4, 4);
      this.ctx.fillStyle = mainColor;

      // Neck & Body
      this.ctx.fillRect(x + 18, y + 16, 16, 18);
      this.ctx.fillRect(x + 10, y + 20, 20, 16);

      // Tail
      this.ctx.fillRect(x + 2, y + 22, 10, 6);
      this.ctx.fillRect(x, y + 18, 6, 6);

      // Tiny Arms
      this.ctx.fillRect(x + 34, y + 22, 6, 4);

      // Legs animation
      const legFrame = Math.floor(d.legCycle) % 2;
      if (!d.isGrounded) {
        // Jumping legs (bent)
        this.ctx.fillRect(x + 14, y + 36, 6, 8);
        this.ctx.fillRect(x + 24, y + 36, 6, 8);
      } else {
        // Running leg animation
        if (legFrame === 0) {
          this.ctx.fillRect(x + 14, y + 36, 6, 12);
          this.ctx.fillRect(x + 24, y + 36, 6, 6);
        } else {
          this.ctx.fillRect(x + 14, y + 36, 6, 6);
          this.ctx.fillRect(x + 24, y + 36, 6, 12);
        }
      }
    } else {
      // Ducking elongated Dino
      const x = d.x;
      const y = d.y;

      // Elongated body
      this.ctx.fillRect(x + 8, y + 6, 36, 14);
      // Tail
      this.ctx.fillRect(x, y + 8, 8, 8);
      // Head lowered
      this.ctx.fillRect(x + 36, y + 2, 20, 14);
      // Snout
      this.ctx.fillRect(x + 46, y + 8, 10, 8);

      // Eye
      this.ctx.fillStyle = eyeColor;
      this.ctx.fillRect(x + 42, y + 4, 3, 3);
      this.ctx.fillStyle = mainColor;

      // Ducking legs
      const legFrame = Math.floor(d.legCycle) % 2;
      if (legFrame === 0) {
        this.ctx.fillRect(x + 18, y + 20, 8, 8);
        this.ctx.fillRect(x + 30, y + 20, 8, 4);
      } else {
        this.ctx.fillRect(x + 18, y + 20, 8, 4);
        this.ctx.fillRect(x + 30, y + 20, 8, 8);
      }
    }

    this.ctx.restore();
  }

  drawCactus(c) {
    const isRetro = document.body.getAttribute('data-theme') === 'retro';
    this.ctx.save();
    this.ctx.fillStyle = isRetro ? '#535353' : '#38bdf8';

    if (c.cactusKind === 1) {
      // Single Cactus
      const cx = c.x;
      const cy = c.y;
      this.ctx.fillRect(cx + 6, cy, 8, c.h); // stem
      this.ctx.fillRect(cx, cy + 12, 6, 12); // left arm
      this.ctx.fillRect(cx, cy + 12, 10, 4);
      this.ctx.fillRect(cx + 14, cy + 16, 6, 12); // right arm
      this.ctx.fillRect(cx + 10, cy + 24, 8, 4);
    } else if (c.cactusKind === 2) {
      // Double Cactus cluster
      this.ctx.fillRect(c.x + 4, c.y + 4, 8, c.h - 4);
      this.ctx.fillRect(c.x, c.y + 14, 6, 8);
      this.ctx.fillRect(c.x + 20, c.y, 10, c.h);
      this.ctx.fillRect(c.x + 28, c.y + 14, 6, 12);
    } else {
      // Tall Cactus
      this.ctx.fillRect(c.x + 8, c.y, 12, c.h);
      this.ctx.fillRect(c.x, cy = c.y + 16, 8, 14);
      this.ctx.fillRect(c.x + 20, c.y + 20, 8, 14);
    }

    this.ctx.restore();
  }

  drawBird(b) {
    const isRetro = document.body.getAttribute('data-theme') === 'retro';
    this.ctx.save();
    this.ctx.fillStyle = isRetro ? '#535353' : '#f43f5e';

    const wingUp = Math.floor(b.wingTimer) % 2 === 0;

    // Bird body
    this.ctx.fillRect(b.x + 10, b.y + 8, 18, 8);
    // Head & Beak
    this.ctx.fillRect(b.x, b.y + 6, 10, 8);
    this.ctx.fillRect(b.x - 4, b.y + 9, 4, 3); // beak tip

    // Flapping wings
    if (wingUp) {
      this.ctx.fillRect(b.x + 14, b.y, 8, 8); // wing up
    } else {
      this.ctx.fillRect(b.x + 14, b.y + 16, 8, 8); // wing down
    }

    this.ctx.restore();
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  new DinoGame();
});
