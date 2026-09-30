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
      incSlider: $('inc-slider'),
      incOut: $('inc-out'),
      eclHint: $('ecl-hint'),
      ageFill: $('age-fill'),
      ageBar: $('age-bar'),
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
      choiceMeta: $('choice-meta'),
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
    const dotColor = idx === 0 ? '#ffca6a' : '#7ab8ff';
    return `<div class="star-card">
      <h4><span class="dot" style="background:${dotColor}"></span>${idx === 0 ? '★ 主星' : '☆ 伴星'} <span class="stage-tag">${stage}</span></h4>
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
    let body =
      `<b>间距 a</b> ${o.a >= 100 ? o.a.toFixed(0) : o.a.toFixed(2)} R☉<br>` +
      `<b>周期 P</b> ${sim.fmtP(o.pDays)}<br>` +
      `<b>偏心率 e</b> ${o.e.toFixed(3)}`;
    if (sim.rlof && sim.rlof.mdot > 0) {
      body += `<br><b>转移速率 Ṁ</b> <span style="color:var(--gold)">${fmtMdot(sim.rlof.mdot)}</span>`;
    }
    this.els.orbitParams.innerHTML = body;
    this.els.timeDisplay.textContent = 't = ' + sim.fmtT(sim.t);
    // 宇宙年龄进度(13.8 Gyr)
    const hubble = PHYS.CONST.HUBBLE_MYR;
    const frac = Math.min(1, sim.t / hubble);
    this.els.ageFill.style.width = (frac * 100).toFixed(1) + '%';
    this.els.ageBar.classList.toggle('over', sim.t > hubble);
    // 演化阶段:药丸式排版,经过的阶段变蓝,当前阶段金底,终态金色边框
    const names = ['主序', '赫氏空隙', '红巨星', '氦燃烧', 'AGB', '白矮星'];
    const order = ['MS', 'HG', 'RGB', 'CHeB', 'AGB', 'WD'];
    const tracks = [];
    for (let i = 0; i < 2; i++) {
      const s = sim.stars[i];
      const tag = `<span class="dot" style="background:${STAR_ID_COLORS[i]}"></span>`;
      if (s.type === 'star') {
        if (s.stage === 'HeMS') {
          tracks.push(`<div>${tag}<span class="pill past">主序</span>→<span class="pill now">氦星（剥裸）</span>→<span class="pill">白矮星</span></div>`);
        } else {
          const cur = order.indexOf(s.stage);
          tracks.push(`<div>${tag}` + order.map((st, k) => {
            const cls = k < cur ? 'past' : k === cur ? 'now' : '';
            return `<span class="pill ${cls}">${names[k]}</span>`;
          }).join('→') + `</div>`);
        }
      } else {
        tracks.push(`<div>${tag}<span class="pill now final">${this.stageName(s)}（终局）</span></div>`);
      }
    }
    this.els.stageTrack.innerHTML = tracks.join('');
    // 倾角提示
    this.updateIncUI(sim);
  },

  updateIncUI(sim) {
    const v = Number(this.els.incSlider.value);
    this.els.incOut.textContent = v + '°';
    if (!sim) { this.els.eclHint.textContent = ''; this.els.eclHint.className = 'ecl-hint'; return; }
    if (sim.isEclipsing()) {
      this.els.eclHint.textContent = '🌗 食双星——光变曲线显示掩食';
      this.els.eclHint.className = 'ecl-hint good';
    } else {
      this.els.eclHint.textContent = '当前倾角看不到食——光变曲线无变化';
      this.els.eclHint.className = 'ecl-hint';
    }
  },

  setInc(v) {
    this.els.incSlider.value = Math.round(Number(v) || 0);
    this.updateIncUI(Game.sim);
  },

  renderGoals(goals) {
    this.els.hudGoals.innerHTML = goals.map((g) =>
      `<span class="goal ${g.done ? 'done' : ''}" title="${g.text}">${g.done ? '✓ ' : '○ '}${g.text}</span>`).join('');
  },

  showChoice(choice) {
    this.els.choiceTitle.textContent = choice.title;
    this.els.choiceDesc.textContent = choice.desc;
    this.renderChoiceMeta(choice.meta);
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

  clearChoiceMeta() { this.els.choiceMeta.innerHTML = ''; },

  // 为决策弹窗提供直观可视化:RLOF 的 q vs q_crit、CE 的 E_bind vs αE_orb、SN 的 ΔM vs 解体线
  renderChoiceMeta(meta) {
    const el = this.els.choiceMeta;
    if (!meta) { el.innerHTML = ''; return; }
    if (meta.kind === 'q') {
      const qmax = Math.max(meta.q, meta.qcrit) * 1.35;
      const qp = Math.min(100, (meta.q / qmax) * 100);
      const cp = Math.min(100, (meta.qcrit / qmax) * 100);
      const stable = meta.q <= meta.qcrit;
      el.innerHTML =
        `<div class="meta-title">质量比判据 q = M_供体 / M_伴星（绿色区为稳定区）</div>` +
        `<div class="meta-bar"><div class="meta-zone ok" style="width:${cp}%"></div>` +
        `<div class="meta-mark" style="left:${qp}%"></div></div>` +
        `<div class="meta-legend"><span>q = ${meta.q.toFixed(2)}</span>` +
        `<span class="${stable ? 'good' : 'bad'}">q_crit = ${meta.qcrit} → ${stable ? '稳定转移' : '动力学失稳→共有包层'}</span></div>`;
    } else if (meta.kind === 'energy') {
      const rows = [
        ['α = 1.0（乐观）', meta.ratios.a1, meta.outcomes.a1],
        ['α = 0.3（悲观）', meta.ratios.a03, meta.outcomes.a03],
      ];
      let h = `<div class="meta-title">能量预算 E_bind / (α·|E_orb|)：<span class="good">≤1</span> 完全抛射, <span class="mid">1–2</span> 部分抛射, <span class="bad">>2</span> 并合</div>`;
      rows.forEach(([label, r, oc]) => {
        const w = Math.min(100, (r / 2) * 100);
        const cls = oc === 'eject' ? 'ok' : oc === 'partial' ? 'mid' : 'bad';
        const txt = oc === 'eject' ? '包层抛射' : oc === 'partial' ? '部分抛射' : '并合';
        h += `<div class="meta-row"><span class="meta-label">${label}</span>` +
          `<div class="meta-bar"><div class="meta-fill ${cls}" style="width:${w}%"></div>` +
          `<div class="meta-mark" style="left:50%"></div></div>` +
          `<span class="meta-val ${cls}">${r.toFixed(2)} · ${txt}</span></div>`;
      });
      el.innerHTML = h;
    } else if (meta.kind === 'sn') {
      const ratio = meta.dmLost / (0.5 * meta.mTot);
      const w = Math.min(100, ratio * 50);
      const bound = ratio < 1;
      el.innerHTML =
        `<div class="meta-title">对称爆发：抛射质量 vs 解体线（系统总质量一半）</div>` +
        `<div class="meta-bar"><div class="meta-fill ${bound ? 'ok' : 'bad'}" style="width:${w}%"></div>` +
        `<div class="meta-mark" style="left:50%"></div></div>` +
        `<div class="meta-legend"><span>ΔM = ${meta.dmLost.toFixed(2)} M☉, M_tot = ${meta.mTot.toFixed(2)} M☉</span>` +
        `<span class="${bound ? 'good' : 'bad'}">${bound ? '系统保持束缚' : '将解体'}</span></div>`;
    } else {
      el.innerHTML = '';
    }
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
// STAR_ID_COLORS 在 render.js 中已声明为全局 const(主星金/伴星蓝),这里直接引用
function fmtL(l) {
  if (l >= 1000) return l.toExponential(2) + ' L☉';
  if (l >= 0.01) return l.toFixed(2) + ' L☉';
  return l.toExponential(1) + ' L☉';
}
// 把 M☉/Myr 换算为人类可读的 M☉/yr,用上标数字
function fmtMdot(mdotMyr) {
  const perYr = mdotMyr / 1e6;
  if (!isFinite(perYr) || perYr <= 0) return '0';
  const exp = Math.floor(Math.log10(perYr));
  const man = perYr / Math.pow(10, exp);
  const supMap = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sup = String(exp).split('').map((c) => c === '-' ? '⁻' : supMap[Number(c)]).join('');
  return `${man.toFixed(1)}×10${sup} M☉/yr`;
}

if (typeof window !== 'undefined') {
  window.UI = UI;
  window.fmtMdot = fmtMdot;
}
