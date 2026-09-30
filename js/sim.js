'use strict';

function makeStar(spec, id) {
  const m = spec.m;
  const s = {
    id,
    M0: m,
    M: m,
    stage: 'MS',
    msUsed: (spec.msFrac || 0) * PHYS.msLifetime_Myr(m),
    stageStart: 0,
    stageFrac: spec.msFrac || 0,
    R: PHYS.zamsRadius(m),
    Teff: PHYS.zamsTeff(m),
    L: PHYS.zamsLum(m),
    core: 0,
    wdType: spec.wdType || null,
    alive: true,
    type: 'star',
  };
  if (spec.kind && spec.kind !== 'ms') {
    s.stage = spec.kind === 'wd' ? 'WD' : spec.kind === 'ns' ? 'NS' : 'BH';
    s.type = s.stage;
  }
  s.core = donorCore(s) || 0;
  return s;
}

function donorCore(s) {
  switch (s.stage) {
    case 'MS':
      return Math.min(0.9 * s.M, 0.1 * Math.pow(s.M, 1.4));
    case 'HG':
      return 0.2 + (PHYS.heIgnitionCore(s.M0) - 0.2) * 0.3;
    case 'RGB':
      return 0.2 + (PHYS.heIgnitionCore(s.M0) - 0.2) * Math.min(1, s.stageFrac);
    case 'CHeB':
      return PHYS.heIgnitionCore(s.M0);
    case 'AGB':
      return PHYS.heIgnitionCore(s.M0) + 0.05;
    case 'HeMS':
      return s.M >= 1.6 ? PHYS.coWdFromHeStar(s.M) : Math.max(0.3, s.M - 0.02);
    case 'WD':
    case 'NS':
    case 'BH':
      return s.M;
    default:
      return 0;
  }
}

class Simulation {
  constructor(config) {
    this.handlers = config.handlers || {};
    this.defaultChoices = config.defaultChoices || {};
    this.t = 0;
    this.stars = [
      makeStar(config.star1 || { m: config.m1 }, 0),
      makeStar(config.star2 || { m: config.m2 }, 1),
    ];
    this.orbit = {
      a: PHYS.keplerA_Rsun(this.s1.M, this.s2.M, config.pDays),
      e: config.e || 0,
      inc: config.inc || 0,
      pDays: config.pDays,
    };
    this.mode = 'normal';
    this.ended = false;
    this.endResult = null;
    this.pendingChoice = null;
    this.rlof = null;
    this.flags = {};
    this.events = [];
    this.wdAccum = [0, 0];
    this.cv = null;
    this.gwJumpAt = null;
    this.refreshLook();
    this.log(`双星系统诞生：${this.s1.M.toFixed(2)} M☉ + ${this.s2.M.toFixed(2)} M☉，周期 ${this.fmtP(this.orbit.pDays)}，间距 ${this.orbit.a.toFixed(1)} R☉`, 'info');
    this.fireEvent('born', null, '系统诞生', '宇宙中约一半的恒星生活在双星系统里。两颗恒星在引力束缚下相互绕转，开始共同的一生。');
    if (this.stars.every((s) => s.type !== 'star')) {
      this.checkCompactPair();
    }
  }

  get s1() { return this.stars[0]; }
  get s2() { return this.stars[1]; }

  log(msg, cls) {
    if (this.handlers.log) this.handlers.log(msg, cls || 'info');
  }

  fireEvent(id, cardId, title, desc) {
    if (this.flags[id]) return;
    this.flags[id] = true;
    const evt = { id, cardId, title, desc, t: this.t };
    this.events.push(evt);
    if (this.handlers.onEvent) this.handlers.onEvent(evt);
  }

  fmtP(pDays) {
    if (pDays < 1) return (pDays * 24).toFixed(2) + ' 小时';
    if (pDays < 500) return pDays.toFixed(1) + ' 天';
    return (pDays / 365.25).toFixed(2) + ' 年';
  }

  fmtT(tMyr) {
    if (tMyr < 1) return (tMyr * 1000).toFixed(0) + ' kyr';
    if (tMyr < 1000) return tMyr.toFixed(1) + ' Myr';
    return (tMyr / 1000).toFixed(2) + ' Gyr';
  }

  rlOf(idx) {
    const d = this.stars[idx];
    const o = this.stars[1 - idx];
    const q = d.M / Math.max(o.M, 1e-3);
    return PHYS.eggletonRL_over_a(q) * this.orbit.a;
  }

  fillFactor(idx) {
    return this.stars[idx].R / Math.max(this.rlOf(idx), 1e-6);
  }

  structureBadge() {
    const f1 = this.fillFactor(0);
    const f2 = this.fillFactor(1);
    if (f1 >= 0.95 && f2 >= 0.95) return '相接 C';
    if (f1 >= 0.95 || f2 >= 0.95) return '半接 SD';
    return '分离 D';
  }

  isEclipsing() {
    // 几何判据:视线方向投影 a·cos i 小于两星半径之和时发生掩食
    const rSum = this.s1.R + this.s2.R;
    const cosi = Math.cos((this.orbit.inc * Math.PI) / 180);
    return cosi * this.orbit.a < rSum;
  }

  refreshLook() {
    for (const s of this.stars) {
      if (s.stage === 'MS' || s.stage === 'HeMS' || s.type !== 'star') {
        s.R = PHYS.stageRadius(s.stage, s.M, s.stage === 'MS' ? s.msUsed / Math.max(PHYS.msLifetime_Myr(s.M), 1e-6) : s.stageFrac, s.stageFrac);
      }
      s.Teff = PHYS.stageTeff(s.stage, s.M, s.stageFrac);
      s.L = PHYS.stageLum(s.stage, s.M, s.stage === 'MS' ? s.msUsed / Math.max(PHYS.msLifetime_Myr(s.M), 1e-6) : s.stageFrac, s.stageFrac);
      s.core = donorCore(s);
    }
  }

  stageDur(s) {
    return PHYS.stageDurations(s.M, PHYS.isMassive(s.M));
  }

  nextBoundaryT() {
    let next = Infinity;
    for (const s of this.stars) {
      if (!s.alive || s.type !== 'star') continue;
      const dur = this.stageDur(s);
      if (s.stage === 'MS') next = Math.min(next, this.t + Math.max(dur.MS - s.msUsed, 0));
      else if (s.stage === 'HG') next = Math.min(next, s.stageStart + dur.HG);
      else if (s.stage === 'RGB') next = Math.min(next, s.stageStart + dur.RGB);
      else if (s.stage === 'CHeB') next = Math.min(next, s.stageStart + dur.CHeB);
      else if (s.stage === 'AGB') next = Math.min(next, s.stageStart + Math.max(dur.AGB, 1));
      else if (s.stage === 'HeMS') next = Math.min(next, s.stageStart + PHYS.heStarLifetime_Myr(s.M));
    }
    if (this.rlof) next = Math.min(next, this.t + 0.5);
    return next;
  }

  timeToRlof() {
    let next = Infinity;
    for (let idx = 0; idx < 2; idx++) {
      const s = this.stars[idx];
      if (!s.alive || s.type !== 'star') continue;
      if (s.stage === 'CHeB' && PHYS.isMassive(s.M0)) continue;
      const rl = this.rlOf(idx);
      if (s.R >= 0.98 * rl - 1e-7) continue;
      const gapMyr = s.stage === 'MS' ? 0.01 * PHYS.msLifetime_Myr(s.M) : 0.01 * (this.stageDur(s)[s.stage] || 100);
      const frac = s.stage === 'MS' ? (s.msUsed + gapMyr) / PHYS.msLifetime_Myr(s.M) : s.stageFrac + 0.01;
      const r2 = PHYS.stageRadius(s.stage, s.M, frac, s.stageFrac + 0.01);
      const ratePerMyr = Math.max((r2 - s.R) / gapMyr, 1e-9);
      const tauAdj = Math.min(50, Math.max(0.05, 0.01 * PHYS.msLifetime_Myr(Math.max(s.M, 0.1))));
      const gap = 0.98 * rl - s.R;
      const dt = gap / (ratePerMyr + gap / tauAdj);
      if (dt > 0) next = Math.min(next, this.t + Math.min(dt, 1e5));
    }
    return next;
  }

  requestDt(dtWanted) {
    if (this.mode === 'compact' && this.gwJumpAt !== null) {
      const remain = this.gwJumpAt - this.t;
      if (remain <= dtWanted) return remain;
      return Math.min(dtWanted, remain / 40, 20);
    }
    const b = this.nextBoundaryT();
    const r = !this.rlof && this.mode === 'normal' ? this.timeToRlof() : Infinity;
    const span = Math.min(b - this.t, r - this.t);
    if (span <= dtWanted) return Math.max(span, 0);
    return Math.min(dtWanted, span * 0.5);
  }

  advance(dtWanted) {
    if (this.ended || this.pendingChoice) return false;
    const dt = this.requestDt(dtWanted);
    if (this.mode === 'compact' && this.gwJumpAt !== null && this.t + dt >= this.gwJumpAt - 1e-9) {
      this.t = this.gwJumpAt;
      this.doCompactMerge();
      return !this.ended;
    }
    if (dt <= 1e-12) {
      this.processBoundaries();
      return !this.ended;
    }
    let effDt = dt;
    if (this.rlof && this.mode === 'normal') {
      const d = this.stars[this.rlof.donorIdx];
      const tau = Math.max(0.15 * 0.05 * PHYS.msLifetime_Myr(Math.max(d.M, 0.1)), 1e-4);
      effDt = Math.min(dt, tau / 25);
    }
    this.t += effDt;
    if (this.mode === 'cv') {
      this.cvStep(effDt / 1000);
    } else {
      for (const s of this.stars) {
        if (!s.alive) continue;
        if (s.stage === 'MS') {
          s.msUsed += effDt;
        } else if (s.type === 'star') {
          const rEq = PHYS.stageRadius(s.stage, s.M, s.stageFrac, s.stageFrac);
          const tauAdj = Math.min(50, Math.max(0.05, 0.01 * PHYS.msLifetime_Myr(Math.max(s.M, 0.1))));
          s.R += (rEq - s.R) * Math.min(1, effDt / tauAdj);
        }
      }
      if (this.rlof) this.rlofStep(effDt);
    }
    this.refreshLook();
    this.updateStageFrac();
    this.processBoundaries();
    this.checkMerge();
    this.checkRlofStart();
    this.windAccretion(effDt);
    return !this.ended;
  }

  checkTransferAchievements(d, a) {
    if (a.stage === 'MS' && a.M - a.M0 > 0.2) {
      this.fireEvent('vampire', 'k-vampire', '吸血鬼恒星与蓝离散星', '吸积了同伴物质的恒星变重变蓝、寿命"重置"，在赫罗图上逆行到主序带上方——蓝离散星。它们像吸血鬼一样吸食同伴而返老还童。');
    }
    if (d.M < a.M && (d.stage === 'HG' || d.type === 'WD')) {
      this.fireEvent('algol', 'k-algol', '大陵五佯谬', '大陵五（Algol）中质量较小的星反而更演化——因为它是曾经的供体：把自己的包层送给了伴星。这一"悖论"是双星物质转移理论的判决性证据。');
      this.log('注意：质量小的子星反而演化得更靠前——大陵五佯谬出现了！', 'major');
    }
  }

  windAccretion(dt) {
    if (this.mode !== 'normal' || this.rlof || this.ended) return;
    const compact = this.stars.find((s) => s.type === 'NS' || s.type === 'WD');
    const giant = this.stars.find((s) => s.type === 'star' && (s.stage === 'RGB' || s.stage === 'AGB'));
    if (!compact || !giant) return;
    const env = Math.max(0, giant.M - giant.core);
    if (env <= 0) return;
    const dur = this.stageDur(giant)[giant.stage] || 100;
    const captured = Math.min((env / dur) * 3 * 0.1 * dt, env * 0.5);
    compact.M += captured;
    if (!this.flags['xrb']) {
      this.fireEvent('xrb', 'k-xrb', 'X 射线双星与爱丁顿极限', '致密天体吸积伴星物质（星风或洛希瓣流），引力能以 X 射线释放。吸积率受爱丁顿极限限制。X 射线双星分大质量（HMXB）与小质量（LMXB）两族，人类正是通过它们第一次证实黑洞存在。');
      this.log(`【${this.starName(compact)}】捕获伴星的星风物质——共生 X 射线双星阶段！`, 'major');
    }
    if (compact.type === 'NS' && !this.flags['mspsr']) {
      this.wdAccum[compact.id] += captured;
      if (this.wdAccum[compact.id] > 0.05) {
        this.fireEvent('mspsr', 'k-mspsr', '毫秒脉冲星（回收脉冲星）', '老脉冲星通过星风或洛希瓣流吸积伴星物质，自转被重新加速到毫秒周期——"回收"的脉冲星。球状星团中大量毫秒脉冲星正是这一通道的证据。');
        this.log('中子星已吸积足够物质，自转加速到毫秒周期——毫秒脉冲星"回收"完成！', 'major');
      }
    }
  }

  checkRlofStart() {
    if (this.rlof || this.mode !== 'normal' || this.ended || this.pendingChoice) return;
    for (let i = 0; i < 2; i++) {
      const s = this.stars[i];
      if (s.type === 'star' && s.R >= 0.98 * this.rlOf(i)) {
        this.offerRlof(i);
        return;
      }
    }
  }

  updateStageFrac() {
    for (const s of this.stars) {
      if (!s.alive || s.type !== 'star') continue;
      const dur = this.stageDur(s);
      switch (s.stage) {
        case 'MS':
          s.stageFrac = Math.min(1, s.msUsed / dur.MS);
          break;
        case 'HG':
          s.stageFrac = Math.min(1, (this.t - s.stageStart) / dur.HG);
          break;
        case 'RGB':
          s.stageFrac = Math.min(1, (this.t - s.stageStart) / dur.RGB);
          break;
        case 'CHeB':
          s.stageFrac = Math.min(1, (this.t - s.stageStart) / dur.CHeB);
          break;
        case 'AGB':
          s.stageFrac = Math.min(1, (this.t - s.stageStart) / Math.max(dur.AGB, 1));
          break;
        default:
          s.stageFrac = 0;
      }
    }
  }

  processBoundaries() {
    const EPS = 1e-9;
    for (const s of this.stars) {
      if (!s.alive || s.type !== 'star') continue;
      const dur = this.stageDur(s);
      if (s.stage === 'MS' && s.msUsed >= dur.MS - EPS) {
        this.toStage(s, 'HG', '主序结束：核心氢耗尽，恒星进入赫氏空隙，开始快速膨胀。');
      } else if (s.stage === 'HG' && this.t - s.stageStart >= dur.HG - EPS) {
        this.toStage(s, 'RGB', '进入红巨星支：壳层氢燃烧点燃，外包层剧烈膨胀。');
      } else if (s.stage === 'RGB' && this.t - s.stageStart >= dur.RGB - EPS) {
        this.toStage(s, 'CHeB', PHYS.isMassive(s.M0) ? '核心氦点燃：平稳的氦燃烧阶段开始。' : '氦闪之后核心氦平稳燃烧。');
      } else if (s.stage === 'CHeB' && this.t - s.stageStart >= dur.CHeB - EPS) {
        if (PHYS.isMassive(s.M)) this.doSupernova(s);
        else this.toStage(s, 'AGB', '进入渐近巨星支（AGB）：氦壳层与氢壳层双壳层燃烧。');
      } else if (s.stage === 'AGB' && this.t - s.stageStart >= Math.max(dur.AGB, 1) - EPS) {
        this.toWhiteDwarf(s, PHYS.ifmrWd(s.M0), 'CO');
      } else if (s.stage === 'HeMS' && this.t - s.stageStart >= PHYS.heStarLifetime_Myr(s.M) - EPS) {
        if (s.M >= 8) this.doSupernova(s);
        else if (s.M >= 1.6) this.toWhiteDwarf(s, PHYS.coWdFromHeStar(s.M), 'CO');
        else this.toWhiteDwarf(s, Math.max(0.3, s.M), 'He');
      }
    }
    this.checkCompactPair();
  }

  toStage(s, stage, msg) {
    s.stage = stage;
    s.stageStart = this.t;
    s.stageFrac = 0;
    this.refreshLook();
    this.log(`【${this.starName(s)}】${msg}`, 'stage');
    if (stage === 'HG') this.fireEvent('hg', 'k-hg', '亚巨星：赫氏空隙', '核心氢耗尽后，恒星在赫罗图上快速穿过赫氏空隙，半径成倍增长。这一阶段极短，所以赫氏空隙上的恒星很少。');
    if (stage === 'RGB') this.fireEvent('rgb', 'k-rgb', '红巨星与壳层燃烧', '核心氢烧完后，氢在核心周围的壳层继续燃烧。外包层膨胀到几十至上百倍太阳半径，表面冷却变红。');
    if (stage === 'CHeB') this.fireEvent('cheb', 'k-cheb', '核心氦燃烧', '氦聚变为碳和氧。太阳质量恒星经由氦闪进入水平支，大质量恒星平稳点燃氦。');
    if (stage === 'AGB') this.fireEvent('agb', 'k-agb', '渐近巨星支 AGB', '双壳层燃烧使恒星再次膨胀变亮，剧烈的脉动与星风正在抛掉外包层。');
  }

  starName(s) {
    return s.id === 0 ? '主星' : '伴星';
  }

  toWhiteDwarf(s, mWd, wdType) {
    const wasAGB = s.stage === 'AGB';
    s.stage = 'WD';
    s.type = 'WD';
    s.M = mWd;
    s.wdType = wdType;
    this.refreshLook();
    if (wasAGB) {
      this.log(`【${this.starName(s)}】外包层抛射形成行星状星云，裸露的核心成为一颗 ${wdType === 'CO' ? '碳氧' : '氦'}白矮星（${s.M.toFixed(2)} M☉）。`, 'major');
      this.fireEvent('pn', 'k-pn', '行星状星云', 'AGB 星的包层被脉动与星风抛出，形成发光的气体壳——行星状星云。中心裸露的碳氧核心就是白矮星，它将永久冷却下去。');
    } else {
      this.log(`【${this.starName(s)}】演化为 ${wdType === 'CO' ? '碳氧' : '氦'}白矮星（${s.M.toFixed(2)} M☉）。`, 'major');
    }
    this.fireEvent('wd-born', 'k-wd', '白矮星', '中小质量恒星的终局：靠电子简并压对抗引力的致密残骸，质量越大半径越小。钱德拉塞卡发现它存在约 1.44 M☉ 的质量上限。');
  }

  doSupernova(s) {
    const rem = PHYS.snRemnant(s.M);
    const mBefore = s.M;
    const isBH = rem.type === 'BH';
    this.log(`【${this.starName(s)}】核心坍缩！超新星爆发，留下${isBH ? '一个黑洞' : '一颗中子星'}（${rem.m.toFixed(1)} M☉）。`, 'major');
    s.stage = isBH ? 'BH' : 'NS';
    s.type = s.stage;
    s.M = rem.m;
    s.wdType = null;
    this.refreshLook();
    this.fireEvent(isBH ? 'bh-born' : 'ns-born', isBH ? 'k-bh' : 'k-ns', isBH ? '黑洞' : '中子星', isBH ? '大质量恒星核心坍缩的产物，引力强到连光都无法逃逸。通过 X 射线双星，人类第一次证实了黑洞的存在。' : '半径约 10 千米、由中子简并压支撑的致密星。磁化的快速自转中子星就是脉冲星。');
    this.fireEvent('sn-cc', 'k-sncc', '核坍缩超新星', '大质量恒星演化到铁核后无法再产能，铁核超过钱德拉塞卡极限时坍缩成中子星或黑洞，反弹激波把外壳炸开——亮度可达太阳的百亿倍。');
    this.pendingChoice = {
      id: 'sn-kick',
      title: '超新星爆发！',
      desc: `${this.starName(s)}爆发了。抛射带走质量，可能让双星解体。选择爆发方式：`,
      meta: { kind: 'sn', dmLost: mBefore - rem.m, mTot: this.stars[1 - s.id].M + mBefore },
      options: [
        { id: 'nokick', label: '对称爆发（无反冲踢）', desc: '轨道按质量损失公式响应：偏心率增大；抛射超过系统总质量一半则解体。' },
        { id: 'kick', label: '沿轨道方向踢 ~100 km/s', desc: '理想化"补偿踢"（教学简化）：系统保持束缚，偏心率小幅增加。' },
      ],
    };
    this._snPending = { s, mBefore, rem };
  }

  resolveSn(optId) {
    const { s, mBefore, rem } = this._snPending;
    const other = this.stars[1 - s.id];
    const dmLost = mBefore - rem.m;
    const mTotBefore = other.M + mBefore;
    const mTotAfter = other.M + rem.m;
    let res;
    if (optId === 'kick' && dmLost < 0.5 * mTotBefore) {
      res = { bound: true, a: this.orbit.a * (mTotBefore / mTotAfter), e: Math.min(0.9, this.orbit.e + 0.15) };
    } else {
      res = PHYS.snPostOrbit(mTotBefore, dmLost, this.orbit.a, this.orbit.e);
    }
    this.orbit.a = res.a;
    this.orbit.e = res.e;
    this.orbit.pDays = PHYS.keplerP_days(this.orbit.a, this.s1.M, this.s2.M);
    if (!res.bound) {
      this.log('质量损失超过系统总质量的一半——双星解体！两颗天体将各自飞散。', 'major');
      this.fireEvent('unbind', null, '系统解体', '爆发抛射的质量超过总质量一半时，引力不足以束缚双星，两颗致密天体分道扬镳——这也是许多脉冲星"独行"的原因。');
      this.end({ type: 'unbind', title: '双星解体', desc: '系统在超新星爆发中解体。' });
      return;
    }
    this.log(`系统保持束缚：新轨道 a=${this.orbit.a.toFixed(1)} R☉，e=${this.orbit.e.toFixed(2)}，P=${this.fmtP(this.orbit.pDays)}`, 'info');
    this.checkCompactPair();
  }

  checkCompactPair() {
    if (this.mode === 'compact' || this.ended) return;
    const both = this.stars.every((s) => s.type === 'WD' || s.type === 'NS' || s.type === 'BH');
    if (!both) return;
    const [a, b] = this.stars;
    const tau = PHYS.gwMergeTime_Myr(a.M, b.M, this.orbit.a, this.orbit.e);
    this.mode = 'compact';
    this.fireEvent('double-compact', 'k-gw', '双致密星与引力波', '双白矮星、双中子星、双黑洞以引力波形式持续损失能量，轨道缓慢收缩。赫尔斯-泰勒脉冲双星（1974）首次间接证实引力波存在，LIGO 于 2015 年直接探测到双黑洞并合 GW150914。');
    if (tau < PHYS.CONST.HUBBLE_MYR) {
      this.gwJumpAt = this.t + tau;
      this.log(`双致密星形成！引力波辐射使轨道缓慢收缩，并合时标约 ${this.fmtT(tau)}——在宇宙年龄之内。时间快进中……`, 'major');
    } else {
      this.log(`双致密星形成。并合时标约 ${this.fmtT(tau)}，超过宇宙年龄（13.8 Gyr）——系统将安静地共存下去。`, 'info');
      this.fireEvent('double-quiet', 'k-gw', '双致密星与引力波', '并非所有双致密星都能在宇宙年龄内并合。并合时标对间距极其敏感（∝a⁴），只有靠得足够近的一对才能成为引力波源。');
      this.end({ type: 'quiet', title: '致密残骸的安宁', desc: '两颗致密天体将在宇宙年龄内各自安静地冷却、旋转。' });
    }
  }

  doCompactMerge() {
    const [a, b] = this.stars;
    const mTot = a.M + b.M;
    const bothWd = a.type === 'WD' && b.type === 'WD';
    if (bothWd && mTot >= PHYS.CONST.CH) {
      this.log('两颗白矮星并合！总质量超过钱德拉塞卡极限，失控碳燃烧引发 Ia 型超新星——系统灰飞烟灭。', 'major');
      this.fireEvent('ia', 'k-ia', 'Ia 型超新星', '碳氧白矮星达到 1.44 M☉ 钱德拉塞卡极限时发生失控热核爆炸。亮度极高且性质均匀，是测量宇宙学距离的标准烛光——正是它揭示了宇宙加速膨胀与暗能量。');
      this.fireEvent('ch', 'k-ch', '钱德拉塞卡极限', '白矮星质量越大半径越小。钱德拉塞卡 1930 年用相对论性电子简并压算出：超过约 1.44 M☉ 时简并压失效。这一上限预示了中子星与黑洞的存在，也终结了"宁静宇宙"的旧观念。');
      this.end({ type: 'ia', title: 'Ia 型超新星！', desc: '双白矮星并合，总质量越过钱德拉塞卡极限。' });
      return;
    }
    if (a.type === 'NS' && b.type === 'NS') {
      this.log('双中子星并合！并合抛出的物质合成出金、银、铂——千新星诞生。', 'major');
      this.fireEvent('kilonova', 'k-kn', '千新星与 r-过程核合成', '双中子星并合抛出的中子丰富物质通过快中子俘获（r-过程）合成比铁重的元素。宇宙中的金、银、铂主要来自这类并合。GW170817（2017）首次同时看到引力波与千新星。');
      this.end({ type: 'kilonova', title: '千新星！', desc: '双中子星并合——宇宙炼金炉炼出了金银。' });
      return;
    }
    this.log(`两颗致密天体并合为质量 ${mTot.toFixed(1)} M☉ 的致密天体。`, 'major');
    this.end({ type: 'compact-merge', title: '致密并合', desc: '两颗致密天体在引力波中并合。' });
  }

  checkMerge() {
    if (this.ended || this.mode === 'cv' || this.mode === 'compact') return;
    const f1 = this.fillFactor(0);
    const f2 = this.fillFactor(1);
    if (f1 >= 0.999 && f2 >= 0.999) {
      this.log('两星都充满洛希瓣——相接并合！轨道能被包层耗散，两星融合为一颗快速自转的单星。', 'major');
      this.fireEvent('merger', 'k-merge', '并合成快速自转单星', '共有包层未能抛射或双星直接相触时，两星并合，产物是一颗快速自转的单星——部分蓝离散星可能正来自这类并合。');
      this.end({ type: 'merge', title: '并合', desc: '两星并合为一颗快速自转的单星。' });
    }
  }

  end(result) {
    this.ended = true;
    this.endResult = result;
    this.fireEvent('model', 'k-model', '关于本作物理模型', '本作采用参数化简化模型：单星寿命/半径/光度为拟合式（量级正确）；RLOF 速率放慢到可视化量级；共有包层用 αλ 能量判据（λ 偏乐观）；超新星默认无踢。完整理论需求解恒星结构五大方程组（质量守恒、动量守恒、能量转移、能量变化、化学组成变化）。');
    if (this.handlers.onEnd) this.handlers.onEnd(result);
  }

  offerRlof(donorIdx) {
    const d = this.stars[donorIdx];
    const a = this.stars[1 - donorIdx];
    const q = d.M / a.M;
    const qcrit = PHYS.qCritFor(d.stage);
    const caseId = PHYS.caseOf(d.stage);
    this.log(`【${this.starName(d)}】充满洛希瓣！物质正通过内拉格朗日点 L1 流向伴星（Case ${caseId}，q=${q.toFixed(2)}，q_crit=${qcrit}）。`, 'major');
    this.fireEvent(`rlof-${caseId}`, 'k-rlof', `洛希瓣溢出 · Case ${caseId}`, '当恒星膨胀超过洛希瓣，表面物质经内拉格朗日点 L1 流向伴星。按供体演化阶段分为 Case A（主序）、Case B（赫氏空隙/红巨星）、Case C（AGB）。');
    this.fireEvent('roche', 'k-roche', '洛希瓣与内拉格朗日点', '在旋转参考系中，双星的有效势能面在两星周围各形成一个"花瓣"——洛希瓣。两瓣相接处是内拉格朗日点 L1，那里引力与离心力平衡，物质由此流过。');
    if (q > qcrit) {
      this.log(`q=${q.toFixed(2)} 超过临界值——转移失稳！供体膨胀→转移更快→更膨胀的正反馈将形成共有包层。`, 'warn');
      this.offerCE(donorIdx);
      return;
    }
    this.pendingChoice = {
      id: 'mt-mode',
      title: `Case ${caseId} 物质转移开始`,
      desc: `q=${q.toFixed(2)} 低于临界值 ${qcrit}，转移可稳定进行（热时标）。选择角动量处理方式：`,
      meta: { kind: 'q', q, qcrit },
      options: [
        { id: 'cons', label: '守恒转移', desc: '物质全部落到伴星，总质量与总角动量守恒。轨道响应：dln a = -2 dln M_d (1 - M_d/M_a) 形式，q 跨越 1 时轨道最收缩。' },
        { id: 'noncons', label: '非守恒（一半被星风带走）', desc: '50% 物质带走角动量离开系统（β=0.5，各向同性再入近似）。' },
      ],
    };
    this._rlofPending = { donorIdx };
  }

  offerCE(donorIdx) {
    const d = this.stars[donorIdx];
    const acc = this.stars[1 - donorIdx];
    const core = donorCore(d);
    const env = d.M - core;
    const lambda = d.stage === 'AGB' ? PHYS.CONST.LAMBDA_AGB : PHYS.CONST.LAMBDA_RGB;
    // 提前算出两种 α 下的能量预算,供决策弹窗可视化
    const b1 = PHYS.ceOutcome(d.M, acc.M, core, env, d.R, this.orbit.a, 1.0, lambda);
    const b03 = PHYS.ceOutcome(d.M, acc.M, core, env, d.R, this.orbit.a, 0.3, lambda);
    this.pendingChoice = {
      id: 'ce-alpha',
      title: '共有包层（Common Envelope）',
      desc: `失稳转移使伴星浸没在${this.starName(d)}的外包层中。两星在共有包层内旋进，摩擦把轨道能转化为抛射包层的动能。能量判据：E_bind(λ=${lambda}) 与 α×E_orb 之比决定结局。`,
      meta: {
        kind: 'energy',
        ratios: { a1: b1.ratio, a03: b03.ratio },
        outcomes: { a1: b1.outcome, a03: b03.outcome },
      },
      options: [
        { id: 'a1', label: '乐观：α = 1.0', desc: '假设轨道能高效转化为包层动能（允许部分抛射结局）。' },
        { id: 'a03', label: '悲观：α = 0.3', desc: '转化效率低，包层更难抛射，旋进更深。' },
      ],
    };
    this._cePending = { donorIdx, core, env, lambda };
  }

  resolveCE(optId) {
    const { donorIdx, core, env, lambda } = this._cePending;
    const d = this.stars[donorIdx];
    const a = this.stars[1 - donorIdx];
    const alpha = optId === 'a1' ? 1.0 : 0.3;
    this.fireEvent('ce', 'k-ce', '共有包层演化', '失稳转移后两星共处一个包层，摩擦使轨道急速收缩（旋进），释放的轨道能用于抛射包层：成功→短周期双星；失败→并合成快速自转单星。CE 是形成激变变星、X 射线双星与双致密星的关键阶段。');
    const out = PHYS.ceOutcome(d.M, a.M, core, env, d.R, this.orbit.a, alpha, lambda);
    this.log(`能量预算：E_bind = ${out.eBind.toExponential(2)} J，α×|E_orb| = ${(out.eOrbI * alpha).toExponential(2)} J，比值 = ${out.ratio.toFixed(2)}`, 'info');
    if (out.outcome === 'merge') {
      this.log('包层无法抛射——两星在包层中并合为一颗快速自转的单星。', 'major');
      this.end({ type: 'ce-merge', title: '共有包层并合', desc: '轨道能不足以抛射包层，两星并合。' });
      return;
    }
    const partial = out.outcome === 'partial';
    const mDonorF = partial ? core + env * 0.5 : core;
    d.M = mDonorF;
    d.stage = 'HeMS';
    d.stageStart = this.t;
    d.stageFrac = 0;
    d.type = 'star';
    if (mDonorF < 0.3) {
      this.toWhiteDwarf(d, mDonorF, 'He');
    } else {
      this.refreshLook();
      this.log(`包层${partial ? '部分' : '全部'}被抛射！${this.starName(d)}裸露出 ${mDonorF.toFixed(2)} M☉ 的氦核，成为一颗剥裸氦星。轨道收缩至 a=${out.aF.toFixed(2)} R☉。`, 'major');
      this.fireEvent('hestar', 'k-sd', '热亚矮星与剥裸氦星', '被共有包层或稳定转移剥掉包层的恒星核心裸露为氦星；0.3–0.5 M☉ 的极端剥离核就是热亚矮星（sdB），是紫外波段的重要亮源。');
    }
    this.orbit.a = out.aF;
    this.orbit.e = 0;
    this.orbit.pDays = PHYS.keplerP_days(this.orbit.a, this.s1.M, this.s2.M);
    this.log(`新轨道：P = ${this.fmtP(this.orbit.pDays)}`, 'info');
    if (this.stars.every((s) => s.type !== 'star')) this.checkCompactPair();
  }

  resolveMT(optId) {
    const { donorIdx } = this._rlofPending;
    this.rlof = { donorIdx, beta: optId === 'cons' ? 1 : 0.5 };
    if (this.rlof.beta < 1) {
      this.fireEvent('noncons', 'k-orbit', '角动量与轨道响应', '物质若带走角动量离开系统，轨道会额外收缩或膨胀。守恒转移下，轨道在质量比反转（q 过 1）时最收缩，随后重新变宽。');
    }
    this.fireEvent('tide', 'k-tide', '潮汐与轨道圆化', '近距离双星的潮汐作用把轨道圆化（e→0）并使自转与公转同步。RLOF 发生时，我们近似潮汐已把轨道抹圆。');
    if (this.orbit.e > 0.01) {
      this.orbit.e = 0;
      this.log('潮汐作用将轨道圆化：e → 0。', 'info');
    }
    const acc = this.stars[1 - donorIdx];
    if (acc.type === 'WD' || acc.type === 'NS') {
      this.log(`致密天体开始吸积——X 射线双星阶段！吸积率被爱丁顿极限（约 0.015 M☉/Myr）封顶。`, 'major');
      this.fireEvent('xrb', 'k-xrb', 'X 射线双星与爱丁顿极限', '致密天体吸积伴星物质，引力能以 X 射线释放。爱丁顿极限决定最大吸积率——超过它辐射压会把物质吹走。X 射线双星分为大质量（HMXB）与小质量（LMXB）两族，人类正是通过它们第一次证实黑洞存在。');
    }
  }

  rlofStep(dt) {
    const { donorIdx, beta } = this.rlof;
    const d = this.stars[donorIdx];
    const a = this.stars[1 - donorIdx];
    if (!d.alive || d.type !== 'star') {
      this.rlof = null;
      return;
    }
    if (d.R < 0.85 * this.rlOf(donorIdx)) {
      this.rlof = null;
      this.log(`【${this.starName(d)}】缩回洛希瓣内，物质转移暂停。`, 'info');
      this.checkTransferAchievements(d, a);
      return;
    }
    const core = donorCore(d);
    const env = Math.max(0, d.M - core);
    const tauKH = 0.05 * PHYS.msLifetime_Myr(Math.max(d.M0, d.M, 0.1));
    const tau = Math.max(0.15 * tauKH, 1e-4);
    let dMd = -Math.min(env, (env / tau) * dt);
    if (d.stage === 'MS') dMd = -Math.min(d.M * 0.5, (env / tau) * dt);
    this.rlof.mdot = dt > 0 ? -dMd / dt : 0; // M☉/Myr,供界面显示转移速率
    let dMa = -dMd * beta;
    let dMlost = -dMd - dMa;
    if (a.type === 'WD' || a.type === 'NS') {
      const capped = Math.min(dMa, PHYS.CONST.ETA_MAX_ACCRET_MYR * dt);
      dMlost += dMa - capped;
      dMa = capped;
      this.wdAccum[a.id] += dMa;
      if (a.type === 'WD' && this.wdAccum[a.id] > 0.05 && a.M < 1.43) {
        this.wdAccum[a.id] = 0;
        this.log('白矮星表面氢层达到临界厚度——新星爆发！表面被炸飞，白矮星本身幸存。', 'event');
        this.fireEvent('nova', 'k-nova', '新星（Nova）', '吸积白矮星表面的氢层被压缩加热到点火温度，失控氢燃烧把表面炸掉——亮度骤增数万倍而白矮星不毁。古代文献中的"客星"多为此类。');
      }
      if (a.type === 'NS' && this.wdAccum[a.id] > 0.1) {
        this.wdAccum[a.id] = 0;
        this.fireEvent('mspsr', 'k-mspsr', '毫秒脉冲星（回收脉冲星）', '老脉冲星在双星中吸积伴星物质，自转被重新加速到毫秒周期——"回收"的脉冲星。球状星团中大量毫秒脉冲星正是这一通道的证据。');
        this.log('中子星已吸积足够物质，自转加速到毫秒周期——毫秒脉冲星"回收"完成！', 'major');
      }
    }
    let daOverA;
    if (dMlost < 1e-12) {
      daOverA = PHYS.conservativeDaOverA(dMd, d.M, a.M);
    } else {
      daOverA = PHYS.nonConservativeDaOverA(dMd, d.M, a.M, beta);
    }
    d.M += dMd;
    a.M += dMa;
    if (a.stage === 'MS' && dMa > 0) {
      const tOld = PHYS.msLifetime_Myr(Math.max(a.M - dMa, 0.05));
      const tNew = PHYS.msLifetime_Myr(Math.max(a.M, 0.05));
      a.msUsed = Math.min(a.msUsed * (tNew / tOld), 0.98 * tNew);
    }
    this.orbit.a *= Math.max(0.5, Math.min(2, 1 + daOverA));
    this.orbit.pDays = PHYS.keplerP_days(this.orbit.a, this.s1.M, this.s2.M);
    if (a.M >= PHYS.CONST.CH && a.type === 'WD' && a.wdType === 'CO') {
      this.doIa(a);
      return;
    }
    const envLeft = Math.max(0, d.M - donorCore(d));
    const canReverse = d.stage === 'MS' || d.stage === 'HG';
    if (canReverse && envLeft > 0.1 * d.M0 && d.M < a.M && d.R < 0.9 * this.rlOf(donorIdx)) {
      this.rlof = null;
      if (d.stage === 'MS') d.msUsed = Math.min(d.msUsed, PHYS.msLifetime_Myr(d.M) * 0.98);
      this.log(`质量比反转，${this.starName(d)}缩回洛希瓣内——转移暂停。新组态：${d.M.toFixed(2)} + ${a.M.toFixed(2)} M☉，P = ${this.fmtP(this.orbit.pDays)}`, 'major');
      this.checkTransferAchievements(d, a);
      return;
    }
    if (envLeft <= Math.max(0.02 * d.M, 0.02)) {
      this.rlof = null;
      const wasAGB = d.stage === 'AGB';
      const mCore = donorCore(d);
      if (d.stage === 'MS' || d.stage === 'HG') {
        d.stage = 'HeMS';
        d.stageStart = this.t;
        d.M = Math.max(mCore, Math.min(d.M, 0.6));
        this.refreshLook();
        this.log(`包层耗尽：${this.starName(d)}裸露为 ${d.M.toFixed(2)} M☉ 的氦星。`, 'major');
        this.fireEvent('hestar', 'k-sd', '热亚矮星与剥裸氦星', '被共有包层或稳定转移剥掉包层的恒星核心裸露为氦星。0.3–0.5 M☉ 的极端剥离核即热亚矮星（sdB）。');
      } else if (PHYS.isMassive(d.M0) && mCore >= 2) {
        d.stage = 'HeMS';
        d.stageStart = this.t;
        this.refreshLook();
        this.log(`包层耗尽：${this.starName(d)}成为 ${mCore.toFixed(1)} M☉ 的沃尔夫-拉叶型氦星。`, 'major');
      } else if (mCore >= 0.44) {
        this.toWhiteDwarf(d, mCore, mCore >= 0.5 ? 'CO' : 'He');
      } else {
        d.stage = 'HeMS';
        d.stageStart = this.t;
        this.refreshLook();
        this.log(`包层耗尽：${this.starName(d)}裸露为 ${mCore.toFixed(2)} M☉ 的氦星。`, 'major');
        this.fireEvent('hestar', 'k-sd', '热亚矮星与剥裸氦星', '被共有包层或稳定转移剥掉包层的恒星核心裸露为氦星。0.3–0.5 M☉ 的极端剥离核即热亚矮星（sdB）。');
      }
      if (wasAGB) {
        this.fireEvent('pn', 'k-pn', '行星状星云', 'AGB 包层被转移或抛出后形成发光气体壳——行星状星云，中心是裸露的白矮星。');
      }
      this.log(`转移结束：${this.s1.M.toFixed(2)} + ${this.s2.M.toFixed(2)} M☉，P = ${this.fmtP(this.orbit.pDays)}`, 'info');
      const donorNow = d;
      if (donorNow.M < a.M && donorNow.type === 'WD') {
        this.fireEvent('algol', 'k-algol', '大陵五佯谬', '大陵五中质量较小的星反而更演化——它是曾经的供体，把包层送给了伴星。');
        this.log('大陵五佯谬：质量小的子星反而演化得更靠前！', 'major');
      }
      if (a.type === 'WD' || a.type === 'NS') this.checkCompactPair();
      return;
    }
  }

  doIa(wd) {
    this.log('白矮星质量达到 1.44 M☉ 钱德拉塞卡极限——碳被点燃，失控热核爆炸！Ia 型超新星！', 'major');
    this.fireEvent('ia', 'k-ia', 'Ia 型超新星', '碳氧白矮星吸积达到钱德拉塞卡极限时失控碳燃烧，整星炸碎。亮度均匀使它成为宇宙标准烛光——1998 年两个团队用它发现宇宙加速膨胀，暗能量由此进入物理学。');
    this.fireEvent('ch', 'k-ch', '钱德拉塞卡极限', '白矮星质量越大半径越小。钱德拉塞卡 1930 年用相对论性电子简并压算出：超过约 1.44 M☉ 时简并压失效。这一上限预示了中子星与黑洞的存在，也终结了"宁静宇宙"的旧观念。');
    this.end({ type: 'ia', title: 'Ia 型超新星！', desc: '白矮星越过 1.44 M☉，失控碳燃烧将它彻底炸碎。' });
  }

  startCv() {
    this.mode = 'cv';
    this.rlof = { donorIdx: 1, beta: 1 };
    this.cv = { novaAcc: 0 };
    this.s2.msUsed = 0.5 * PHYS.msLifetime_Myr(this.s2.M);
    this.log('激变变星模式：白矮星持续吸积主序伴星。磁制动与引力波正在收缩轨道……', 'major');
    this.fireEvent('cv', 'k-cv', '激变变星（CV）', '白矮星+充满洛希瓣的低质量主序星，物质经吸积盘落到白矮星。CV 的周期分布在 2–3 小时存在"周期空缺"，最短周期约 80 分钟处发生"周期反弹"。');
  }

  cvStep(dtGyr) {
    if (!this.cv || this.ended) return;
    const d = this.s2;
    const w = this.s1;
    const p = this.orbit.pDays;
    let pdot;
    if (d.M > 0.3) {
      if (p > 0.125) pdot = -1.2;
      else if (p > 0.09) pdot = -0.15;
      else pdot = -0.05;
      if (p > 0.125 && p * (1 + pdot * dtGyr) <= 0.125 && !this.flags['gap']) {
        this.log('轨道周期进入 2–3 小时区间：伴星完全对流，磁制动关闭，CV 从观测上"消失"——周期空缺。', 'event');
        this.fireEvent('gap', 'k-gap', '周期空缺（Period Gap）', '观测的 CV 周期分布在 2–3 小时空缺。主流解释：伴星到完全对流点后磁制动骤停，系统暂时分离、无法吸积，直到引力波再次把两者拉回接触。');
      }
    } else {
      if (!this.flags['bounce']) {
        this.flags['bounce'] = true;
        this.fireEvent('bounce', 'k-bounce', '周期最小值与周期反弹', '当伴星质量降到约 0.3 M☉，它近乎简并、半径不再随失重明显缩小，转移率骤降，轨道反而重新膨胀——周期在约 80 分钟处触底反弹。');
        this.log('周期反弹！轨道周期在约 80 分钟处触底，转为增长。', 'major');
        this.orbit.pDays = Math.max(this.orbit.pDays, 0.055);
      }
      pdot = 0.5 * Math.max(0, 1 - this.orbit.pDays / 0.09);
    }
    this.orbit.pDays *= 1 + pdot * dtGyr;
    this.orbit.a = PHYS.keplerA_Rsun(w.M, d.M, this.orbit.pDays);
    const dm = -d.M * (d.M > 0.3 ? 0.18 : 0.3) * dtGyr;
    d.M += dm;
    if (this.rlof) this.rlof.mdot = dtGyr > 0 ? -dm / (dtGyr * 1000) : 0;
    const accGross = Math.min(-dm, PHYS.CONST.ETA_MAX_ACCRET_MYR * (dtGyr * 1000));
    w.M += accGross * 0.3;
    this.cv.novaAcc += accGross;
    if (this.cv.novaAcc > 0.05 && w.M < 1.43) {
      this.cv.novaAcc = 0;
      this.log('新星爆发！白矮星表面氢闪清空了吸积层。', 'event');
      this.fireEvent('nova', 'k-nova', '新星（Nova）', '吸积白矮星表面的氢层失控燃烧，亮度骤增而白矮星幸存。反复新星可能缓慢把白矮星推向钱德拉塞卡极限。');
    }
    if (w.M >= PHYS.CONST.CH && w.wdType === 'CO') {
      this.doIa(w);
      return;
    }
    if (d.M <= 0.12) {
      this.log(`伴星退化为 ${d.M.toFixed(2)} M☉ 的氦白矮星——系统成为双白矮星（AM CVn 型的前身）。`, 'major');
      d.stage = 'WD';
      d.type = 'WD';
      d.wdType = 'He';
      this.rlof = null;
      this.mode = 'normal';
      this.checkCompactPair();
      return;
    }
    d.R = Math.min(this.rlOf(1), PHYS.stageRadius('MS', d.M, 0.5, 0.5));
  }

  resolve(optId) {
    if (!this.pendingChoice) return;
    const choice = this.pendingChoice;
    this.pendingChoice = null;
    if (choice.id === 'mt-mode') this.resolveMT(optId);
    else if (choice.id === 'ce-alpha') this.resolveCE(optId);
    else if (choice.id === 'sn-kick') this.resolveSn(optId);
  }

  hasPending() {
    return !!this.pendingChoice;
  }
}

if (typeof window !== 'undefined') {
  window.Simulation = Simulation;
}
