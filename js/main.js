'use strict';

const Game = {
  sim: null,
  level: null,
  mode: 'menu',
  speed: 10,
  playing: false,
  phase: 0,
  unlocked: new Set(),
  doneLevels: new Set(),
  trails: null,
  orbitView: null,
  hrd: null,
  lc: null,
  lastFrame: 0,
  starMenuSel: null,

  init() {
    UI.init();
    this.orbitView = new OrbitView(document.getElementById('orbit-canvas'));
    this.lc = new LightCurve(document.getElementById('lc-canvas'));
    this.hrd = new HRD(document.getElementById('hrd-canvas'));
    try {
      const saved = JSON.parse(localStorage.getItem('binary-era-save') || '{}');
      (saved.unlocked || []).forEach((id) => this.unlocked.add(id));
      (saved.done || []).forEach((id) => this.doneLevels.add(id));
      this.settings = { showCards: false, showChoices: false, ...(saved.settings || {}) };
    } catch (e) {
      this.settings = { showCards: false, showChoices: false };
    }
    this.bindUI();
    this.renderMenu();
    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  },

  save() {
    try {
      localStorage.setItem('binary-era-save', JSON.stringify({
        unlocked: [...this.unlocked],
        done: [...this.doneLevels],
        settings: this.settings,
      }));
    } catch (e) { /* ignore */ }
  },

  bindUI() {
    UI.els.btnFree.onclick = () => this.openFree();
    UI.els.btnGallery.onclick = () => { UI.renderGallery(this.unlocked); UI.show('modalGallery'); };
    UI.els.btnGallery2.onclick = () => { UI.renderGallery(this.unlocked); UI.show('modalGallery'); };
    UI.els.galleryClose.onclick = () => UI.hide('modalGallery');
    UI.els.btnBack.onclick = () => { this.mode = 'menu'; this.playing = false; UI.hide('gameScreen'); UI.show('menuScreen'); this.renderMenu(); };
    UI.els.btnPlay.onclick = () => this.togglePlay();
    UI.els.btnRestart.onclick = () => this.startLevel(this.level, this.starMenuSel);
    UI.els.speedGroup.querySelectorAll('.speed').forEach((b) => {
      b.onclick = () => { this.speed = Number(b.dataset.v); UI.setSpeedUI(this.speed); };
    });
    UI.els.cardClose.onclick = () => { UI.hide('modalCard'); if (this.pendingAfterCard) { const f = this.pendingAfterCard; this.pendingAfterCard = null; f(); } };
    UI.els.optCards.checked = this.settings.showCards;
    UI.els.optChoices.checked = this.settings.showChoices;
    UI.els.optCards.onchange = () => { this.settings.showCards = UI.els.optCards.checked; this.save(); };
    UI.els.optChoices.onchange = () => { this.settings.showChoices = UI.els.optChoices.checked; this.save(); };
    UI.els.endRestart.onclick = () => { UI.hide('modalEnd'); this.startLevel(this.level, this.starMenuSel); };
    UI.els.endMenu.onclick = () => { UI.hide('modalEnd'); UI.els.btnBack.onclick(); };
    UI.els.freeStart.onclick = () => this.startFree();
    UI.els.freeCancel.onclick = () => UI.hide('modalFree');
    ['free-m1', 'free-m2', 'free-p', 'free-e', 'free-i'].forEach((id) => {
      document.getElementById(id).oninput = () => this.updateFreePreview();
    });
  },

  renderMenu() {
    UI.els.levelList.innerHTML = LEVELS.map((lv, i) => {
      const done = this.doneLevels.has(lv.id);
      const prev = i === 0 || this.doneLevels.has(LEVELS[i - 1].id);
      return `<div class="level-item ${prev ? '' : 'locked'}" data-lv="${lv.id}">
        <h3><span class="lv-tag">${lv.icon}</span>${lv.name}</h3>
        <p>${lv.brief}</p>
        ${done ? '<p class="lv-done">✓ 已通关</p>' : ''}
      </div>`;
    }).join('');
    UI.els.levelList.querySelectorAll('.level-item:not(.locked)').forEach((el) => {
      el.onclick = () => {
        const lv = LEVELS.find((l) => l.id === el.dataset.lv);
        if (lv.choice) {
          this.level = lv;
          this.showLevelChoice(lv);
        } else {
          this.startLevel(lv);
        }
      };
    });
  },

  showLevelChoice(lv) {
    UI.els.choiceTitle.textContent = lv.name + '：选择通道';
    UI.els.choiceDesc.textContent = lv.brief;
    UI.els.choiceOptions.innerHTML = '';
    lv.choice.forEach((opt) => {
      const b = document.createElement('button');
      b.className = 'choice-opt';
      b.innerHTML = `<b>${opt.label}</b><span>${opt.desc}</span>`;
      b.onclick = () => { UI.hide('modalChoice'); this.startLevel(lv, opt.id); };
      UI.els.choiceOptions.appendChild(b);
    });
    UI.show('modalChoice');
  },

  startLevel(level, choiceId) {
    this.level = level;
    this.starMenuSel = choiceId || null;
    let config = JSON.parse(JSON.stringify(level.config));
    if (level.choice && choiceId) {
      const opt = level.choice.find((c) => c.id === choiceId);
      config = JSON.parse(JSON.stringify(opt.config));
    }
    this.launch(config, level.cv || false);
    UI.els.hudLevelName.textContent = level.icon + ' ' + level.name;
    UI.els.hintText.textContent = '💡 ' + (level.hint || '');
    this.setGoals(level.goals.map((g) => ({ ...g, done: false })));
    UI.setSpeedUI(this.speed);
    UI.hide('menuScreen');
    UI.show('gameScreen');
    this.mode = 'game';
  },

  launch(config, isCv) {
    const handlers = {
      log: (msg, cls) => UI.addLog(msg, cls),
      onEvent: (evt) => this.onEvent(evt),
      onEnd: (end) => this.onEnd(end),
    };
    this.sim = new Simulation({
      ...config,
      handlers,
      defaultChoices: { 'mt-mode': 'cons', 'ce-alpha': 'a1', 'sn-kick': 'nokick' },
    });
    this._endShown = false;
    if (isCv) {
      this.sim.startCv();
    }
    this.hrd.reset();
    this.hrd.push(this.sim);
    UI.clearLog();
    this.playing = false;
    UI.els.btnPlay.textContent = '▶ 开始演化';
    UI.update(this.sim);
    this.lc.draw(this.sim);
    this.orbitView.draw(this.sim, 0, 0);
    this.hrd.draw(this.sim);
  },

  openFree() {
    UI.show('modalFree');
    this.updateFreePreview();
  },

  freeConfig() {
    const m1 = Number(document.getElementById('free-m1').value);
    const m2 = Number(document.getElementById('free-m2').value);
    const p = Math.pow(10, Number(document.getElementById('free-p').value));
    const e = Number(document.getElementById('free-e').value);
    const inc = Number(document.getElementById('free-i').value);
    return { m1, m2, p, e, inc };
  },

  updateFreePreview() {
    const { m1, m2, p, e, inc } = this.freeConfig();
    document.getElementById('out-m1').textContent = m1.toFixed(1);
    document.getElementById('out-m2').textContent = m2.toFixed(2);
    document.getElementById('out-p').textContent = p < 1 ? (p * 24).toFixed(2) + ' h' : p.toFixed(1);
    document.getElementById('out-e').textContent = e.toFixed(2);
    document.getElementById('out-i').textContent = inc.toFixed(0);
    const a = PHYS.keplerA_Rsun(m1, m2, p);
    const rl1 = PHYS.eggletonRL_over_a(m1 / m2) * a;
    const rl2 = PHYS.eggletonRL_over_a(m2 / m1) * a;
    const tms = PHYS.msLifetime_Myr(m1);
    const ecl = Math.sin((inc * Math.PI) / 180) > (PHYS.zamsRadius(m1) + PHYS.zamsRadius(m2)) / a;
    document.getElementById('free-preview').innerHTML =
      `<b>间距 a</b> ${a.toFixed(1)} R☉ ｜ <b>主星洛希瓣</b> ${rl1.toFixed(1)} R☉（半径 ${PHYS.zamsRadius(m1).toFixed(2)}）<br>` +
      `<b>主星主序寿命</b> ${(tms / 1000).toFixed(1)} Gyr ｜ ${ecl ? '<span style="color:var(--green)">会是食双星</span>' : '倾角下看不到食'}`;
  },

  startFree() {
    const { m1, m2, p, e, inc } = this.freeConfig();
    UI.hide('modalFree');
    this.level = { id: 'free', name: '自由模式', icon: '☆', goals: [], hint: '自由探索。试着亲手造一个激变变星、X 射线双星或双中子星！' };
    this.starMenuSel = null;
    this.launch({ star1: { m: Math.max(m1, m2) }, star2: { m: Math.min(m1, m2) }, pDays: p, e, inc }, false);
    UI.els.hudLevelName.textContent = '☆ 自由模式';
    UI.els.hintText.textContent = '💡 ' + this.level.hint;
    this.setGoals([]);
    UI.setSpeedUI(this.speed);
    UI.hide('menuScreen');
    UI.show('gameScreen');
    this.mode = 'game';
  },

  setGoals(goals) {
    this.goals = goals;
    UI.renderGoals(this.goals);
  },

  togglePlay() {
    if (this.sim.ended) return;
    this.playing = !this.playing;
    UI.els.btnPlay.textContent = this.playing ? '⏸ 暂停' : '▶ 继续';
  },

  resolveChoice(optId) {
    if (!this.sim) return;
    this.sim.resolve(optId);
    UI.update(this.sim);
  },

  onEvent(evt) {
    if (evt.cardId && !this.unlocked.has(evt.cardId)) {
      this.unlocked.add(evt.cardId);
      this.save();
      const card = KNOWLEDGE_MAP[evt.cardId];
      UI.toast(`📖 解锁知识卡 <b>《${card.title}》</b>（点击查看）`, () => {
        UI.showCard(card);
        UI.els.cardClose.textContent = '继续演化 →';
      });
      if (this.settings.showCards && this.mode === 'game' && !this.sim.pendingChoice && !this.sim.ended) {
        this.playing = false;
        UI.els.btnPlay.textContent = '▶ 继续';
        UI.showCard(card);
      }
    }
    if (this.goals) {
      let changed = false;
      this.goals.forEach((g) => {
        if (!g.done && g.ev === evt.id) { g.done = true; changed = true; }
      });
      if (changed) UI.renderGoals(this.goals);
    }
  },

  onEnd(end) {
    if (this._endShown) return;
    this._endShown = true;
    this.playing = false;
    UI.els.btnPlay.textContent = '▶ 已结束';
    if (this.level && this.level.id !== 'free') {
      const all = this.level.goals.every((g) => this.goals.find((x) => x.id === g.id).done);
      if (all) {
        this.doneLevels.add(this.level.id);
        this.save();
        UI.toast('🏆 关卡通关！新的关卡已解锁');
      }
    }
    if (end.type === 'ia') UI.toast('🌟 结局达成：<b>Ia 型超新星</b> —— 标准烛光照亮宇宙');
    if (end.type === 'kilonova') UI.toast('🥇 结局达成：<b>千新星</b> —— 宇宙炼出了金银');
    setTimeout(() => UI.showEnd(end, this.goals || []), 600);
  },

  fmtT(t) {
    if (t < 1) return (t * 1000).toFixed(0) + ' kyr';
    if (t < 1000) return t.toFixed(1) + ' Myr';
    return (t / 1000).toFixed(2) + ' Gyr';
  },

  loop(now) {
    const dtReal = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (this.mode === 'game' && this.sim) {
      if (this.playing && !this.sim.ended && !this.sim.hasPending()) {
        let dtMyr = dtReal * this.speed;
        let steps = 0;
        while (dtMyr > 0 && steps < 60 && !this.sim.ended && !this.sim.hasPending()) {
          const chunk = Math.min(dtMyr, Math.max(this.speed * dtReal / 30, 0.02));
          const ok = this.sim.advance(chunk);
          dtMyr -= chunk;
          steps++;
          if (!ok) break;
        }
        this.hrd.push(this.sim);
        if (this.sim.ended) this.onEnd(this.sim.endResult);
        else if (this.sim.hasPending()) {
          const c = this.sim.pendingChoice;
          if (this.settings.showChoices) {
            this.playing = false;
            UI.els.btnPlay.textContent = '▶ 继续';
            this.sim.pendingChoice = null;
            UI.showChoice(c);
            this.sim.pendingChoice = c;
          } else {
            this.sim.pendingChoice = null;
            const optId = this.sim.defaultChoices[c.id] || (c.options[0] && c.options[0].id);
            const opt = c.options.find((o) => o.id === optId) || c.options[0];
            UI.addLog(`⚙ ${c.title}：已自动选择「${opt.label}」（顶栏可开启决策弹窗）`, 'event');
            this.sim.resolve(opt.id);
            UI.update(this.sim);
          }
        }
      }
      this.phase = (this.phase + dtReal * 0.16) % 1;
      this.orbitView.draw(this.sim, this.phase, dtReal);
      this.lc.draw(this.sim);
      this.hrd.draw(this.sim);
      UI.update(this.sim);
    }
    requestAnimationFrame((t) => this.loop(t));
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => Game.init());
}
