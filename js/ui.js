'use strict';

const UI = {
  els: {},
  init() {
    const $ = (id) => document.getElementById(id);
    this.els = {
      menuScreen: $('menu-screen'),
      gameScreen: $('game-screen'),
      levelList: $('level-list'),
      btnFree: $('btn-free'),
      btnGallery: $('btn-gallery'),
      btnGallery2: $('btn-gallery2'),
      btnBack: $('btn-back'),
      hudLevelName: $('hud-level-name'),
      hudGoals: $('hud-goals'),
      hudBadge: $('hud-badge'),
      optCards: $('opt-cards'),
      optChoices: $('opt-choices'),
      starCards: $('star-cards'),
      orbitParams: $('orbit-params-body'),
      eventLog: $('event-log'),
      stageTrack: $('stage-track'),
      timeDisplay: $('time-display'),
      btnPlay: $('btn-play'),
      speedGroup: $('speed-group'),
      btnRestart: $('btn-restart'),
      hintText: $('hint-text'),
      modalChoice: $('modal-choice'),
      choiceTitle: $('choice-title'),
      choiceDesc: $('choice-desc'),
      choiceOptions: $('choice-options'),
      modalCard: $('modal-card'),
      cardIcon: $('card-icon'),
      cardTitle: $('card-title'),
      cardSimple: $('card-simple'),
      cardBody: $('card-body'),
      cardRef: $('card-ref'),
      cardClose: $('card-close'),
      modalEnd: $('modal-end'),
      endTitle: $('end-title'),
      endDesc: $('end-desc'),
      endGoals: $('end-goals'),
      endRestart: $('end-restart'),
      endMenu: $('end-menu'),
      modalGallery: $('modal-gallery'),
      galleryList: $('gallery-list'),
      galleryClose: $('gallery-close'),
      modalFree: $('modal-free'),
      freeStart: $('free-start'),
      freeCancel: $('free-cancel'),
      toastWrap: $('toast-wrap'),
    };
  },

  show(id) { this.els[id].classList.remove('hidden'); },
  hide(id) { this.els[id].classList.add('hidden'); },

  toast(html, onclick) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = html;
    if (onclick) {
      el.style.cursor = 'pointer';
      el.onclick = onclick;
    }
    this.els.toastWrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.5s'; }, 3400);
    setTimeout(() => el.remove(), 4000);
  },

  clearLog() { this.els.eventLog.innerHTML = ''; },

  addLog(msg, cls) {
    const p = document.createElement('p');
    p.className = cls || 'info';
    const t = Game.sim ? Game.sim.t : 0;
    p.innerHTML = `<b style="color:#5a6c96">${Game.fmtT(t)}</b> ${msg}`;
    this.els.eventLog.appendChild(p);
    this.els.eventLog.scrollTop = this.els.eventLog.scrollHeight;
  },

  stageName(s) {
    const map = {
      MS: '主序星', HG: '亚巨星', RGB: '红巨星', CHeB: '氦燃烧', AGB: 'AGB 星',
      HeMS: '氦星', WD: '白矮星', NS: '中子星', BH: '黑洞',
    };
    return map[s.stage] || s.stage;
  },

  starCard(sim, idx) {
    const s = sim.stars[idx];
    const fill = sim.fillFactor(idx);
    const pct = Math.min(100, fill * 100);
    const hot = fill >= 0.95 ? ' hot' : '';
    const stage = s.type === 'WD' ? `${s.wdType === 'CO' ? '碳氧' : '氦'}白矮星` : this.stageName(s);
    const compact = s.type === 'NS' || s.type === 'BH';
    return `<div class="star-card">
      <h4>${idx === 0 ? '★ 主星' : '☆ 伴星'} <span class="stage-tag">${stage}</span></h4>
      <div class="kv">
        <b>质量</b> ${s.M.toFixed(compact ? 2 : 3)} M☉　<b>半径</b> ${s.R >= 0.1 ? s.R.toFixed(2) : (s.R * CONST_LABLE_R).toFixed(compact ? 1 : 0) + ' km'}<br>
        <b>温度</b> ${s.Teff >= 30000 ? (s.Teff / 1000).toFixed(0) + 'k K' : s.Teff.toFixed(0) + ' K'}　<b>光度</b> ${fmtL(s.L)}<br>
        <b>洛希瓣填充率</b> ${(fill * 100).toFixed(0)}%
        <div class="fill-bar${hot}"><div style="width:${pct}%"></div></div>
      </div>
    </div>`;
  },

  update(sim) {
    this.els.starCards.innerHTML = this.starCard(sim, 0) + this.starCard(sim, 1);
    this.els.hudBadge.textContent = sim.structureBadge();
    const o = sim.orbit;
    const ecl = sim.isEclipsing();
    this.els.orbitParams.innerHTML =
      `<b>间距 a</b> ${o.a.toFixed(2)} R☉<br>` +
      `<b>周期 P</b> ${sim.fmtP(o.pDays)}<br>` +
      `<b>偏心率 e</b> ${o.e.toFixed(3)}<br>` +
      `<b>倾角 i</b> ${o.inc.toFixed(0)}°${ecl ? ' <span style="color:var(--green)">（食双星！）</span>' : ''}<br>` +
      `<b>结构</b> ${sim.structureBadge()}`;
    this.els.timeDisplay.textContent = 't = ' + sim.fmtT(sim.t);
    const track = [];
    const names = ['主序', '赫氏空隙', '红巨星', '氦燃烧', 'AGB', '白矮星'];
    const order = ['MS', 'HG', 'RGB', 'CHeB', 'AGB', 'WD'];
    for (let i = 0; i < 2; i++) {
      const s = sim.stars[i];
      if (s.type === 'star' || s.type === 'HeMS') {
        const cur = order.indexOf(s.stage);
        track.push(`<div>${i === 0 ? '★' : '☆'} ` + order.map((st, k) =>
          `<span class="${k === cur ? 'now' : ''}">${names[k]}${k === cur ? ' ◂' : ''}</span>`).join(' → ') + `</div>`);
      } else {
        track.push(`<div>${i === 0 ? '★' : '☆'} <span class="now">${this.stageName(s)}（终局）</span></div>`);
      }
    }
    this.els.stageTrack.innerHTML = track.join('');
  },

  renderGoals(goals) {
    this.els.hudGoals.innerHTML = goals.map((g) =>
      `<span class="goal ${g.done ? 'done' : ''}" title="${g.text}">${g.done ? '✓ ' : '○ '}${g.text}</span>`).join('');
  },

  showChoice(choice) {
    this.els.choiceTitle.textContent = choice.title;
    this.els.choiceDesc.textContent = choice.desc;
    this.els.choiceOptions.innerHTML = '';
    choice.options.forEach((opt) => {
      const b = document.createElement('button');
      b.className = 'choice-opt';
      b.innerHTML = `<b>${opt.label}</b><span>${opt.desc}</span>`;
      b.onclick = () => { this.hide('modalChoice'); Game.resolveChoice(opt.id); };
      this.els.choiceOptions.appendChild(b);
    });
    this.show('modalChoice');
  },

  showCard(card) {
    this.els.cardIcon.textContent = card.icon;
    this.els.cardTitle.textContent = card.title;
    this.els.cardSimple.textContent = '💡 ' + card.simple;
    this.els.cardBody.textContent = card.body;
    this.els.cardRef.textContent = '📖 ' + card.ref;
    this.show('modalCard');
  },

  showEnd(end, goals) {
    this.els.endTitle.textContent = end.title;
    this.els.endDesc.textContent = end.desc;
    const done = goals.filter((g) => g.done).length;
    this.els.endGoals.innerHTML =
      `<div>目标达成：${done} / ${goals.length}</div>` +
      goals.map((g) => `<div class="${g.done ? 'ok' : 'no'}">${g.done ? '✓' : '✗'} ${g.text}</div>`).join('');
    this.show('modalEnd');
  },

  renderGallery(unlocked) {
    const mods = { A: 'A 轨道基础', B: 'B 单星演化', C: 'C 物质转移', D: 'D 致密天体' };
    this.els.galleryList.innerHTML = KNOWLEDGE_CARDS.map((c) => {
      const un = unlocked.has(c.id);
      return `<div class="g-card ${un ? '' : 'locked'}" data-card="${c.id}">
        <div class="g-mod">${mods[c.module]}</div>
        <h4>${un ? c.icon + ' ' + c.title : '🔒 ？？？'}</h4>
        ${un ? `<div class="g-body"><p>${c.simple}</p><p>${c.body}</p><p style="color:#5a6c96">📖 ${c.ref}</p></div>` : '<div class="g-body">继续演化以解锁此卡片</div>'}
      </div>`;
    }).join('');
    this.els.galleryList.querySelectorAll('.g-card:not(.locked)').forEach((el) => {
      el.onclick = () => el.classList.toggle('open');
    });
  },

  setSpeedUI(v) {
    this.els.speedGroup.querySelectorAll('.speed').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.v) === v);
    });
  },
};

const CONST_LABLE_R = PHYS.CONST.RSUN / 1000;
function fmtL(l) {
  if (l >= 1000) return l.toExponential(2) + ' L☉';
  if (l >= 0.01) return l.toFixed(2) + ' L☉';
  return l.toExponential(1) + ' L☉';
}

if (typeof window !== 'undefined') {
  window.UI = UI;
}
