import { Player } from './Player.js';
import { Input } from './input.js';
import { aabb, resolvePlatforms } from './collision.js';

export const STATE = {
  SELECT: 'select',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  WON: 'won',
  LOST: 'lost'
};

export class Game {
  constructor(canvas, images) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.images = images;
    this.input = new Input();

    this.worldW = 2600;
    this.camX = 0;

    this.selectedChar = null;
    this.player = new Player(80, 500, this._charImgs('pten1'));

    this.state = STATE.SELECT;
    this.wormsCollected = 0;
    this.time = 0;
    this.best = this.loadBest();
    this.unlockedSecrets = this.loadSecrets(); // ['secret1', ...]
    this.totalWins = this.loadWins(); // всего побед
    this.lastTime = 0;
    this.running = false;
    this.projectiles = [];
    this.shootCd = 0;
    this._hazardsBase = null;

    // Пол (floor) — высота под новый спрайт ~48–55
    this.platforms = [
      { x: 0, y: 585, w: 2600, h: 55, floor: true },
      // Платформы — рисуем целиком, без обрезки краёв
      { x: 260, y: 455, w: 160, h: 36 },
      { x: 500, y: 370, w: 150, h: 36 },
      { x: 760, y: 450, w: 140, h: 36 },
      { x: 1030, y: 330, w: 160, h: 36 },
      { x: 1300, y: 410, w: 150, h: 36 },
      { x: 1580, y: 290, w: 170, h: 36 },
      { x: 1880, y: 390, w: 160, h: 36 },
      { x: 2180, y: 310, w: 180, h: 36 }
    ];

    // Препятствия "let" — можно перепрыгнуть, касание = смерть
    this.hazards = [
      { x: 420, y: 549, w: 56, h: 36 },
      { x: 900, y: 549, w: 56, h: 36 },
      { x: 1480, y: 549, w: 60, h: 36 },
      { x: 2050, y: 549, w: 56, h: 36 }
    ];
    this._hazardsBase = this.hazards.map(h => ({ ...h }));

    // 5 червяков
    this.worms = [
      { x: 310, y: 415, w: 28, h: 26, collected: false },
      { x: 545, y: 330, w: 28, h: 26, collected: false },
      { x: 1085, y: 290, w: 28, h: 26, collected: false },
      { x: 1635, y: 250, w: 28, h: 26, collected: false },
      { x: 2240, y: 270, w: 28, h: 26, collected: false }
    ];
    this._wormsBase = this.worms.map(w => ({ x: w.x, y: w.y, w: w.w, h: w.h }));

    // Финиш — зона в конце уровня
    this.finish = { x: 2450, y: 505, w: 100, h: 80 };

    this._bindUI();
    this._setupCharSelect();
    this._updateShootBtn();
    this._updateHUD();
    this.render();
  }

  _charImgs(name) {
    const imgs = this.images;
    const map = {
      pten1:   { idle: imgs.pten1,   open: imgs.pten1_1,   jump: imgs.pten1_jump,   jumpOpen: imgs.pten1_jump_1 },
      pten2:   { idle: imgs.pten2,   open: imgs.pten2_1,   jump: imgs.pten2_jump_1, jumpOpen: imgs.pten2_jump_1 },
      pten3:   { idle: imgs.pten3,   open: imgs.pten3_1,   jump: imgs.pten3_jump,   jumpOpen: imgs.pten3_jump },
      secret1: { idle: imgs.secret1, open: imgs.secret1_1, jump: imgs.secret1_jump, jumpOpen: imgs.secret1_jump_1 },
      secret2: { idle: imgs.secret2, open: imgs.secret2, jump: imgs.secret2_jump, jumpOpen: imgs.secret2_jump },
      secret3: { idle: imgs.secret3, open: imgs.secret3_1, jump: imgs.secret3_jump, jumpOpen: imgs.secret3_jump_1 }
    };
    return map[name] || map.pten1;
  }

  _setupCharSelect() {
    this._refreshSecretCards();

    const selectChar = (card) => {
      if (card.hidden || card.classList.contains('locked')) return;
      document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      this.selectedChar = card.dataset.char;
      this.player.setImages(this._charImgs(this.selectedChar));
      this._drawCharPreviews();
      this._updateShootBtn();
    };

    document.querySelectorAll('.char-card').forEach(card => {
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectChar(card);
      };
      card.addEventListener('click', handler);
      card.addEventListener('touchend', handler, { passive: false });
    });

    const btnPlay = document.getElementById('btn-select-play');
    if (btnPlay) {
      const playHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.start();
      };
      btnPlay.addEventListener('click', playHandler);
      btnPlay.addEventListener('touchend', playHandler, { passive: false });
    }

    const rouletteOk = document.getElementById('roulette-ok');
    if (rouletteOk) {
      rouletteOk.addEventListener('click', () => this._closeRoulette());
      rouletteOk.addEventListener('touchend', (e) => { e.preventDefault(); this._closeRoulette(); }, { passive: false });
    }

    document.querySelector('.char-card[data-char="pten1"]').classList.add('selected');
    this.selectedChar = 'pten1';
    this._drawCharPreviews();
  }

  _refreshSecretCards() {
    for (const id of ['secret1', 'secret2', 'secret3']) {
      const card = document.querySelector(`.char-card[data-char="${id}"]`);
      if (!card) continue;
      if (this.unlockedSecrets.includes(id)) {
        card.hidden = false;
        card.classList.remove('locked');
      } else {
        card.hidden = true;
        card.classList.add('locked');
      }
    }
    const hint = document.getElementById('secret-hint');
    if (hint) {
      const left = 3 - this.unlockedSecrets.length;
      if (left <= 0) {
        hint.textContent = 'Все секретные джамперы открыты! ✦';
      } else if (this.totalWins === 0) {
        hint.textContent = `Первая победа откроет рулетку! (осталось секретов: ${left})`;
      } else {
        const until3 = 3 - (this.totalWins % 3);
        const need = until3 === 3 ? 3 : until3;
        hint.textContent =
          `Рулетка: новый рекорд или ещё ${need} побед(ы). Секретов осталось: ${left}`;
      }
    }
  }

  _drawCharPreviews() {
    const previews = document.querySelectorAll('.char-preview');
    previews.forEach(cv => {
      const name = cv.dataset.char;
      const img = this.images[name];
      if (!img) return;
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      // Вписываем с сохранением пропорций
      const scale = Math.min(cv.width / img.width, cv.height / img.height) * 0.92;
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = (cv.width - dw) / 2;
      const dy = (cv.height - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    });
  }

  _bindUI() {
    this.btnStart = document.getElementById('btn-start');
    this.btnPause = document.getElementById('btn-pause');
    this.btnRestart = document.getElementById('btn-restart');
    this.overlay = document.getElementById('overlay');
    this.overlayTitle = document.getElementById('overlay-title');
    this.overlayMsg = document.getElementById('overlay-message');
    this.overlayRestart = document.getElementById('overlay-restart');
    this.charSelect = document.getElementById('char-select');

    const bestEl = document.getElementById('best');
    if (bestEl) {
      bestEl.addEventListener('click', () => this._resetRecord());
      bestEl.addEventListener('touchend', (e) => { e.preventDefault(); this._resetRecord(); }, { passive: false });
    }

    this.btnStart.addEventListener('click', () => this.start());
    this.btnPause.addEventListener('click', () => this.togglePause());
    this.btnRestart.addEventListener('click', () => this.restart());
    this.overlayRestart.addEventListener('click', () => this.restart());

    const bindHold = (el, on, off) => {
      if (!el) return;
      el.addEventListener('touchstart', e => { e.preventDefault(); on(); }, { passive: false });
      el.addEventListener('touchend', e => { e.preventDefault(); off(); }, { passive: false });
      el.addEventListener('touchcancel', off);
      el.addEventListener('mousedown', on);
      el.addEventListener('mouseup', off);
      el.addEventListener('mouseleave', off);
    };
    bindHold(document.getElementById('btn-left'), () => this.input.setLeft(true), () => this.input.setLeft(false));
    bindHold(document.getElementById('btn-right'), () => this.input.setRight(true), () => this.input.setRight(false));
    bindHold(document.getElementById('btn-jump'), () => this.input.setJump(true), () => this.input.setJump(false));
    bindHold(document.getElementById('btn-shoot'), () => this.input.setShoot(true), () => this.input.setShoot(false));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === STATE.PLAYING) this.pause();
    });
  }

  _updateShootBtn() {
    const btn = document.getElementById('btn-shoot');
    if (!btn) return;
    if (this.selectedChar === 'secret2') btn.classList.remove('hidden');
    else btn.classList.add('hidden');
  }

  loadBest() {
    try {
      const v = localStorage.getItem('djapmeryBestTime');
      if (v == null || v === '') return null;
      const n = parseFloat(v);
      // отсекаем битые/нулевые/нереальные значения
      if (!Number.isFinite(n) || n < 1 || n > 3600) {
        localStorage.removeItem('djapmeryBestTime');
        return null;
      }
      return n;
    } catch { return null; }
  }

  saveBest() {
    try {
      if (this.best != null) localStorage.setItem('djapmeryBestTime', String(this.best));
    } catch {}
  }

  loadSecrets() {
    try {
      const v = localStorage.getItem('djapmerySecrets');
      return v ? JSON.parse(v) : [];
    } catch { return []; }
  }

  saveSecrets() {
    try {
      localStorage.setItem('djapmerySecrets', JSON.stringify(this.unlockedSecrets));
    } catch {}
  }

  loadWins() {
    try {
      const v = localStorage.getItem('djapmeryWins');
      return v ? parseInt(v, 10) || 0 : 0;
    } catch { return 0; }
  }

  saveWins() {
    try {
      localStorage.setItem('djapmeryWins', String(this.totalWins));
    } catch {}
  }

  start() {
    if (this.state === STATE.PLAYING) return;
    if (!this.selectedChar) return;

    if (this.state === STATE.SELECT || this.state === STATE.READY || this.state === STATE.WON || this.state === STATE.LOST) {
      this._resetLevel();
    }
    this.state = STATE.PLAYING;
    this.charSelect.classList.add('hidden');
    this.btnStart.disabled = true;
    this.btnPause.disabled = false;
    this.btnPause.textContent = 'ПАУЗА';
    this.overlay.classList.add('hidden');
    this.input.clearAll();
    this.lastTime = 0;
    if (!this.running) {
      this.running = true;
      requestAnimationFrame(t => this.loop(t));
    }
    this._updateHUD();
  }

  pause() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.PAUSED;
    this.btnPause.textContent = 'ПРОДОЛЖИТЬ';
    this.btnStart.disabled = false;
    this.input.clearAll();
    this._updateHUD();
  }

  togglePause() {
    if (this.state === STATE.PLAYING) this.pause();
    else if (this.state === STATE.PAUSED) this.start();
  }

  restart() {
    this._resetLevel();
    this.state = STATE.SELECT;
    this.charSelect.classList.remove('hidden');
    this.btnStart.disabled = false;
    this.btnPause.disabled = true;
    this.btnPause.textContent = 'ПАУЗА';
    this.overlay.classList.add('hidden');
    this.input.clearAll();
    this.camX = 0;
    this._updateHUD();
    this.render();
  }

  _resetLevel() {
    this.player.reset();
    this.player.setImages(this._charImgs(this.selectedChar || 'pten1'));
    this.wormsCollected = 0;
    this.time = 0;
    this.camX = 0;
    this.projectiles = [];
    this.shootCd = 0;
    if (this._hazardsBase) {
      this.hazards = this._hazardsBase.map(h => ({ ...h }));
    }
    if (this._wormsBase) {
      this.worms = this._wormsBase.map(w => ({
        x: w.x, y: w.y, w: w.w, h: w.h, collected: false
      }));
    } else {
      for (const w of this.worms) w.collected = false;
    }
    this._updateShootBtn();
  }

  _updateHUD() {
    document.getElementById('worms').textContent = 'ЧЕРВЯКИ: ' + this.wormsCollected + '/5';
    document.getElementById('timer').textContent = 'ВРЕМЯ: ' + this.time.toFixed(1);
    document.getElementById('best').textContent =
      this.best != null ? 'РЕКОРД: ' + this.best.toFixed(1) + 'с' : 'РЕКОРД: --';
    const map = {
      [STATE.SELECT]: 'ВЫБОР',
      [STATE.READY]: 'ГОТОВ',
      [STATE.PLAYING]: 'ИГРА',
      [STATE.PAUSED]: 'ПАУЗА',
      [STATE.WON]: 'ЕССС ПОБЕДА!',
      [STATE.LOST]: 'Eх... неудача(((('
    };
    document.getElementById('status').textContent = map[this.state] || '';
  }

  loop(ts) {
    if (!this.running) return;
    if (this.state === STATE.PLAYING) {
      if (this.lastTime === 0) this.lastTime = ts;
      let dt = (ts - this.lastTime) / 1000;
      this.lastTime = ts;
      if (dt > 0.05) dt = 0.05;
      this.update(dt);
    } else {
      this.lastTime = ts;
    }
    this.render();
    requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    this.time += dt;
    const prevX = this.player.x;
    const prevY = this.player.y;

    this.player.update(dt, this.input);

    if (this.player.x < 0) this.player.x = 0;
    if (this.player.x + this.player.w > this.worldW) {
      this.player.x = this.worldW - this.player.w;
    }

    this.player.grounded = resolvePlatforms(this.player, this.platforms, prevX, prevY);

    // камера
    const target = this.player.x - this.W * 0.35;
    this.camX += (target - this.camX) * Math.min(1, dt * 6);
    if (this.camX < 0) this.camX = 0;
    if (this.camX > this.worldW - this.W) this.camX = Math.max(0, this.worldW - this.W);



    // Андрэ: стрельба
    if (this.shootCd > 0) this.shootCd -= dt;
    if (!this.projectiles) this.projectiles = [];
    if (
      this.selectedChar === 'secret2' &&
      this.input.keys &&
      this.input.keys.shootPressed &&
      this.shootCd <= 0
    ) {
      const dir = this.player.facing >= 0 ? 1 : -1;
      this.projectiles.push({
        x: this.player.x + (dir > 0 ? this.player.w - 6 : -10),
        y: this.player.y + this.player.h * 0.42,
        w: 14,
        h: 10,
        vx: dir * 520,
        life: 1.4
      });
      this.shootCd = 0.28;
    }
    if (typeof this.input.clearShootPressed === 'function') {
      this.input.clearShootPressed();
    } else if (this.input.keys) {
      this.input.keys.shootPressed = false;
    }

    // пули vs let
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const b = this.projectiles[i];
      b.x += b.vx * dt;
      b.life -= dt;
      let hit = false;
      for (let j = this.hazards.length - 1; j >= 0; j--) {
        if (aabb(b, this.hazards[j])) {
          this.hazards.splice(j, 1);
          hit = true;
          break;
        }
      }
      if (hit || b.life <= 0 || b.x < this.camX - 60 || b.x > this.camX + this.W + 60) {
        this.projectiles.splice(i, 1);
      }
    }

    // Андрэ: притяжение червяков
    if (this.selectedChar === 'secret2') {
      const px = this.player.x + this.player.w / 2;
      const py = this.player.y + this.player.h / 2;
      const range = 220;
      for (const w of this.worms) {
        if (w.collected) continue;
        const wx = w.x + w.w / 2;
        const wy = w.y + w.h / 2;
        const dx = px - wx;
        const dy = py - wy;
        const dist = Math.hypot(dx, dy);
        if (dist < range && dist > 1) {
          const pull = (1 - dist / range) * 280 * dt;
          w.x += (dx / dist) * pull;
          w.y += (dy / dist) * pull;
        }
      }
    }

    // препятствия let
    for (const h of this.hazards) {
      if (aabb(this.player, h)) {
        this._lose('｡°(°¯᷄◠¯᷅°)°｡');
        return;
      }
    }

    // червяки
    for (const w of this.worms) {
      if (!w.collected && aabb(this.player, w)) {
        w.collected = true;
        this.wormsCollected++;
        this._updateHUD();
      }
    }

    // победа: все червяки + финиш
    if (this.wormsCollected >= 5 && aabb(this.player, this.finish)) {
      this._win();
    }

    this._updateHUD();
  }

  _win() {
    if (this.state === STATE.WON || this.state === STATE.LOST) return;
    this.state = STATE.WON;

    const isFirstWin = this.totalWins === 0;
    const isNewRecord = this.time >= 1 && (this.best == null || this.time < this.best - 0.05);
    if (isNewRecord) {
      this.best = this.time;
      this.saveBest();
    }

    this.totalWins += 1;
    this.saveWins();

    // Рулетка: 1-я победа ИЛИ новый рекорд ИЛИ каждая 3-я победа
    const everyThird = this.totalWins % 3 === 0;
    const shouldSpin = isFirstWin || isNewRecord || everyThird;

    this.btnStart.disabled = false;
    this.btnPause.disabled = true;
    this.overlayTitle.textContent = 'ЕССС ПОБЕДА!';
    let msg =
      'Все червяки собраны!\nВремя: ' + this.time.toFixed(1) + 'с\nРекорд: ' + (this.best != null ? this.best.toFixed(1) + 'с' : '--');
    if (isNewRecord) msg += '\n★ Новый рекорд!';
    this.overlayMsg.textContent = msg;
    this.overlay.classList.remove('hidden');
    this._updateHUD();
    this._refreshSecretCards();

    const locked = ['secret1', 'secret2', 'secret3'].filter(
      id => !this.unlockedSecrets.includes(id)
    );
    if (shouldSpin && locked.length > 0) {
      setTimeout(() => this._startRoulette(locked), 600);
    }
  }

  _startRoulette(pool) {
    const panel = document.getElementById('roulette');
    const resultEl = document.getElementById('roulette-result');
    const okBtn = document.getElementById('roulette-ok');
    const strip = document.getElementById('roulette-strip');
    const track = document.getElementById('roulette-track');
    const title = document.getElementById('roulette-title');
    if (!panel || !strip || !track) return;

    panel.classList.remove('hidden');
    okBtn.classList.add('hidden');
    resultEl.textContent = 'Крутим…';
    this.overlay.classList.add('hidden');
    if (title) title.textContent = 'РУЛЕТКА';

    const names = {
      secret1: '✦ мявк',
      secret2: '✦ андрэ',
      secret3: '✦ зибзибиди'
    };
    const fullNames = {
      secret1: '✦ мявк',
      secret2: '✦ андрэ',
      secret3: '✦ зибзибиди'
    };

    // Всегда показываем ВСЕХ трёх секретов в ленте (как в CS)
    const displayPool = ['secret1', 'secret2', 'secret3'];
    // Победитель — только из ещё не открытых (pool)
    const winner = pool[Math.floor(Math.random() * pool.length)];

    // Длинная лента: много повторов + winner ближе к концу
    const ITEM_W = 100;
    const repeats = 12;
    const items = [];
    for (let r = 0; r < repeats; r++) {
      for (const id of displayPool) items.push(id);
    }
    // индекс, на котором остановимся (в последней трети ленты)
    const minIdx = Math.floor(items.length * 0.65);
    let landIdx = minIdx + Math.floor(Math.random() * Math.floor(items.length * 0.25));
    // ставим winner на landIdx
    items[landIdx] = winner;

    strip.innerHTML = '';
    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0px)';

    items.forEach((id, i) => {
      const cell = document.createElement('div');
      cell.className = 'roulette-item';
      cell.dataset.id = id;
      const cv = document.createElement('canvas');
      cv.width = 72;
      cv.height = 60;
      const ctx = cv.getContext('2d');
      const img = this.images[id];
      if (img) {
        const scale = Math.min(cv.width / img.width, cv.height / img.height) * 0.92;
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.drawImage(img, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
      }
      const lab = document.createElement('span');
      lab.textContent = names[id] || id;
      cell.appendChild(cv);
      cell.appendChild(lab);
      strip.appendChild(cell);
    });

    // Центрируем выбранный слот под указателем
    const trackW = track.clientWidth || 400;
    const targetX = trackW / 2 - (landIdx * ITEM_W + ITEM_W / 2);

    // небольшой рандом внутри слота
    const jitter = (Math.random() - 0.5) * 30;
    const finalX = targetX + jitter;

    requestAnimationFrame(() => {
      strip.style.transition = 'transform 4.5s cubic-bezier(0.12, 0.75, 0.12, 1)';
      strip.style.transform = 'translateX(' + finalX + 'px)';
    });

    let finished = false;
    const onEnd = () => {
      if (finished) return;
      finished = true;
      strip.removeEventListener('transitionend', onEnd);
      const cells = strip.querySelectorAll('.roulette-item');
      if (cells[landIdx]) cells[landIdx].classList.add('winner');
      resultEl.textContent = 'Выпал: ' + (fullNames[winner] || winner) + '!';
      okBtn.classList.remove('hidden');
      if (!this.unlockedSecrets.includes(winner)) {
        this.unlockedSecrets.push(winner);
        this.saveSecrets();
        this._refreshSecretCards();
      }
    };
    strip.addEventListener('transitionend', onEnd);
    setTimeout(onEnd, 4800);
  }

  _closeRoulette() {
    const panel = document.getElementById('roulette');
    if (panel) panel.classList.add('hidden');
    this.overlay.classList.remove('hidden');
    this._drawCharPreviews();
  }

  _resetRecord() {
    if (!confirm('Сбросить рекорд времени?')) return;
    this.best = null;
    try { localStorage.removeItem('djapmeryBestTime'); } catch {}
    this._updateHUD();
  }

  _lose(reason) {
    this.state = STATE.LOST;
    this.btnStart.disabled = false;
    this.btnPause.disabled = true;
    this.overlayTitle.textContent = 'Eх... неудача((((';
    this.overlayMsg.textContent = reason + '\nдавай еще раз!';
    this.overlay.classList.remove('hidden');
    this._updateHUD();
  }

  render() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const cam = this.camX;

    // Фон (backround.png)
    const bg = this.images.bg;
    const bgScale = H / bg.height;
    const bgW = bg.width * bgScale;
    const bgX = -((cam * 0.3) % bgW);
    ctx.drawImage(bg, bgX, 0, bgW, H);
    if (bgX + bgW < W) {
      ctx.drawImage(bg, bgX + bgW, 0, bgW, H);
    }

    // Платформы и пол
    for (const p of this.platforms) {
      const dx = p.x - cam;
      if (dx + p.w < -40 || dx > W + 40) continue;
      if (p.floor) {
        // Пол тайлим по горизонтали без обрезки краёв
        this._drawTiled(ctx, this.images.floor, dx, p.y, p.w, p.h);
      } else {
        // Платформа — целиком один спрайт (бесшовный), без нарезки
        ctx.drawImage(
          this.images.platform,
          Math.round(dx),
          Math.round(p.y),
          Math.round(p.w),
          Math.round(p.h)
        );
      }
    }

    // Препятствия let
    for (const h of this.hazards) {
      const dx = h.x - cam;
      if (dx + h.w < -10 || dx > W + 10) continue;
      ctx.drawImage(this.images.let, Math.round(dx), Math.round(h.y), h.w, h.h);
    }

    // Пули Андрэ
    for (const b of (this.projectiles || [])) {
      const dx = b.x - cam;
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.ellipse(dx + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8c8';
      ctx.beginPath();
      ctx.ellipse(dx + b.w / 2 - 2, b.y + b.h / 2 - 1, 3, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Червяки
    for (const w of this.worms) {
      if (w.collected) continue;
      const dx = w.x - cam;
      if (dx + w.w < -10 || dx > W + 10) continue;
      const bob = Math.sin(this.time * 3.5 + w.x * 0.04) * 4;
      ctx.drawImage(this.images.worm, Math.round(dx), Math.round(w.y + bob), w.w, w.h);
    }

    // Финиш
    {
      const dx = this.finish.x - cam;
      if (dx + this.finish.w > -20 && dx < W + 20) {
        ctx.fillStyle = 'rgba(122, 176, 255, 0.28)';
        ctx.fillRect(Math.round(dx), Math.round(this.finish.y), this.finish.w, this.finish.h);
        ctx.strokeStyle = '#7ab0ff';
        ctx.lineWidth = 3;
        ctx.strokeRect(Math.round(dx), Math.round(this.finish.y), this.finish.w, this.finish.h);
        ctx.fillStyle = '#a8c4ff';
        ctx.font = '22px ZeroCool, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ФИНИШ', Math.round(dx + this.finish.w / 2), Math.round(this.finish.y + 30));
      }
    }

    // Игрок
    if (this.state !== STATE.SELECT) {
      this.player.draw(ctx, cam);
    }

    // Оверлеи на канвасе
    if (this.state === STATE.PAUSED) {
      ctx.fillStyle = 'rgba(26, 34, 56, 0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#a8c4ff';
      ctx.font = '36px ZeroCool, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ПАУЗА  ❙❙', W / 2, H / 2 - 18);
      ctx.font = '22px ZeroCool, sans-serif';
      ctx.fillText('стоп стоп', W / 2, H / 2 + 22);
    }

    if (this.state === STATE.READY) {
      ctx.fillStyle = 'rgba(26, 34, 56, 0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#a8c4ff';
      ctx.font = '28px ZeroCool, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('НАЖМИ «СТАРТ»', W / 2, H / 2 - 14);
      ctx.font = '20px ZeroCool, sans-serif';
      ctx.fillStyle = '#c8d8ff';
      ctx.fillText('Собери 5 червяков и дойди до финиша', W / 2, H / 2 + 20);
    }
  }

  _drawTiled(ctx, img, x, y, w, h) {
    const iw = img.width;
    const ih = img.height;
    // Масштабируем по высоте, тайлим по ширине целиком (без обрезки «рваных» краёв)
    const scale = h / ih;
    const tileW = iw * scale;
    let left = w;
    let cx = x;
    while (left > 0.5) {
      const tw = Math.min(tileW, left);
      // берём пропорциональную часть исходника, чтобы край не «срезался» странно
      const srcW = (tw / tileW) * iw;
      ctx.drawImage(img, 0, 0, srcW, ih, Math.round(cx), Math.round(y), Math.round(tw), Math.round(h));
      cx += tw;
      left -= tw;
    }
  }
}
