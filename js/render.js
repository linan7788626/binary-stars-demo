'use strict';

// 按 devicePixelRatio 设置画布后备尺寸,保证 Retina 屏清晰;返回以 CSS 像素为单位的上下文
function fitDpr(canvas, w, h) {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const bw = Math.max(1, Math.round(w * dpr));
  const bh = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

// 星体标识色(与星体卡、赫罗图图例一致):主星金色、伴星蓝色
const STAR_ID_COLORS = ['#ffca6a', '#7ab8ff'];

class OrbitView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.t = 0;
    this.W = 640;
    this.H = 480;
    this.smoothScale = 0;
    this.lobeCache = { key: '', paths: [[], []] };
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (r.width > 40 && r.height > 40) {
      this.W = Math.round(r.width);
      this.H = Math.round(r.height);
    }
    this.ctx = fitDpr(this.canvas, this.W, this.H);
  }

  rocheLobePath(starIdx, d, m1, m2) {
    const key = `${starIdx}|${d.toFixed(2)}|${m1.toFixed(3)}|${m2.toFixed(3)}`;
    if (this.lobeCache.key === key) return this.lobeCache.paths[starIdx];
    const mm = [m1, m2];
    const r1 = -(d * m2) / (m1 + m2);
    const r2 = (d * m1) / (m1 + m2);
    const centers = [r1, r2];
    const l1x = d * (0.5 - 0.227 * Math.log10(m1 / m2));
    const phiL1 = -mm[0] / Math.abs(l1x - r1) - mm[1] / Math.abs(l1x - r2) - 0.5 * (mm[0] + mm[1]) * l1x * l1x;
    const paths = [];
    for (let si = 0; si < 2; si++) {
      const cx = centers[si];
      const other = centers[1 - si];
      const pts = [];
      const N = 56;
      for (let i = 0; i <= N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        let lo = 0.02 * d;
        let hi = Math.abs(cx - other) * 0.98;
        const cap = si === 0 ? l1x - cx : cx - l1x;
        hi = Math.min(hi, Math.abs(cap) * 1.02);
        for (let it = 0; it < 24; it++) {
          const r = (lo + hi) / 2;
          const x = cx + r * dx;
          const y = r * dy;
          const phi = -mm[0] / Math.hypot(x - r1, y) - mm[1] / Math.hypot(x - r2, y) - 0.5 * (mm[0] + mm[1]) * (x * x + y * y);
          if (phi < phiL1) lo = r;
          else hi = r;
        }
        pts.push([cx + lo * dx, lo * dy]);
      }
      paths.push(pts);
    }
    this.lobeCache = { key, paths };
    return paths[starIdx];
  }

  // M: 平近点角(rad)。视线取惯性系俯视,连线随轨道相位旋转;偏心率大时近星点明显加速(开普勒第二定律)
  draw(sim, M, dtFrame) {
    this.resize();
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    this.t += dtFrame;
    ctx.fillStyle = '#070b16';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = ((i * 977) % 1000) / 1000 * W;
      const y = ((i * 613) % 1000) / 1000 * H;
      const s = (i % 3) * 0.4 + 0.4;
      ctx.fillStyle = `rgba(255,255,255,${0.1 + (i % 5) * 0.045})`;
      ctx.fillRect(x, y, s, s);
    }

    const s1 = sim.s1;
    const s2 = sim.s2;
    const a = Math.max(sim.orbit.a, 1e-3);
    const e = Math.min(Math.max(sim.orbit.e || 0, 0), 0.95);
    const nu = PHYS.trueAnomaly(M || 0, e);
    const d = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
    const m1 = Math.max(s1.M, 1e-3);
    const m2 = Math.max(s2.M, 1e-3);
    const mt = m1 + m2;
    const cx = W / 2;
    const cy = H / 2;

    // 视野跨度:容纳整条轨道(远星点)与膨胀的恒星;平滑过渡避免跳变
    const maxR = Math.max(s1.R, s2.R);
    const span = Math.max(a * (1 + e) * 1.06, maxR * 2.4, 0.6);
    const target = (Math.min(W, H) * 0.44) / span;
    this.smoothScale = this.smoothScale
      ? this.smoothScale + (target - this.smoothScale) * Math.min(1, dtFrame * 3)
      : target;
    const scale = this.smoothScale;

    const cosn = Math.cos(nu);
    const sinn = Math.sin(nu);
    // 旋转参考系局部坐标(连线为 x 轴)→ 屏幕坐标
    const rot = (x, y) => [cx + (x * cosn - y * sinn) * scale, cy + (x * sinn + y * cosn) * scale];

    // 两星各自的轨道椭圆(惯性系,质心为焦点,颜色对应两星)
    const a1 = (a * m2) / mt;
    const a2 = (a * m1) / mt;
    const bFac = Math.sqrt(Math.max(1 - e * e, 0.01));
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = 'rgba(255,202,106,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx + a1 * e * scale, cy, a1 * scale, a1 * bFac * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(122,184,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx - a2 * e * scale, cy, a2 * scale, a2 * bFac * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 质心标记
    ctx.strokeStyle = 'rgba(200,210,240,0.55)';
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
    ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
    ctx.stroke();

    // 洛希瓣:常显淡描边,填充率越高越亮,接近充满时变红(关键教学信号)
    for (let si = 0; si < 2; si++) {
      const s = si === 0 ? s1 : s2;
      if (s.type !== 'star') continue;
      const path = this.rocheLobePath(si, d, m1, m2);
      const fill = sim.fillFactor(si);
      const near = fill >= 0.9;
      ctx.beginPath();
      path.forEach((p, i) => {
        const pt = rot(p[0], p[1]);
        if (i === 0) ctx.moveTo(pt[0], pt[1]);
        else ctx.lineTo(pt[0], pt[1]);
      });
      ctx.closePath();
      ctx.fillStyle = near ? 'rgba(255,122,106,0.10)' : 'rgba(90,120,255,0.05)';
      ctx.fill();
      ctx.strokeStyle = near
        ? 'rgba(255,140,110,0.8)'
        : `rgba(120,150,255,${(0.15 + Math.min(fill, 1) * 0.4).toFixed(2)})`;
      ctx.lineWidth = near ? 1.4 : 1;
      ctx.stroke();
    }

    // 内拉格朗日点 L1
    if (s1.type === 'star' || s2.type === 'star') {
      const l1x = d * (0.5 - 0.227 * Math.log10(m1 / m2));
      const lp = rot(l1x, 0);
      ctx.fillStyle = 'rgba(255,210,120,0.95)';
      ctx.beginPath();
      ctx.arc(lp[0], lp[1], 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '10px sans-serif';
      ctx.fillText('L1', lp[0] + 5, lp[1] - 5);
    }

    // 两星位置(屏幕坐标)
    const p1 = rot(-(d * m2) / mt, 0);
    const p2 = rot((d * m1) / mt, 0);

    // 物质流:供体表面 → L1 → 伴星的弧形粒子流;致密伴星带吸积盘
    if (sim.rlof || sim.mode === 'cv') {
      const donorIdx = sim.rlof ? sim.rlof.donorIdx : 1;
      const donor = sim.stars[donorIdx];
      const acc = sim.stars[1 - donorIdx];
      const from = donorIdx === 0 ? p1 : p2;
      const to = donorIdx === 0 ? p2 : p1;
      const l1x = d * (0.5 - 0.227 * Math.log10(m1 / m2));
      const lp = rot(l1x, 0);
      const dpx = Math.max(3, Math.min(donor.R * scale, Math.min(W, H) * 0.4));
      const angS = Math.atan2(lp[1] - from[1], lp[0] - from[0]);
      const sx = from[0] + Math.cos(angS) * dpx;
      const sy = from[1] + Math.sin(angS) * dpx;
      // 二次贝塞尔:经 L1 附近弯向吸积星
      const cpx = lp[0] + (lp[1] - sy) * 0.25;
      const cpy = lp[1] - (lp[0] - sx) * 0.25 - 10;
      const NPART = 12;
      for (let i = 0; i < NPART; i++) {
        const f = (this.t * 0.55 + i / NPART) % 1;
        const u = 1 - f;
        const bx = u * u * sx + 2 * u * f * cpx + f * f * to[0];
        const by = u * u * sy + 2 * u * f * cpy + f * f * to[1];
        ctx.fillStyle = `rgba(255,170,90,${(0.9 - f * 0.55).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (acc.type === 'WD' || acc.type === 'NS' || acc.type === 'BH') {
        ctx.strokeStyle = 'rgba(255,180,110,0.85)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(to[0], to[1], 11, 4, -0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,220,160,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(to[0], to[1], 15, 5.5, -0.4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    this.drawStar(ctx, p1[0], p1[1], s1, scale, '主星');
    this.drawStar(ctx, p2[0], p2[1], s2, scale, '伴星');

    // 比例尺
    const targetPx = W * 0.2;
    const rawVal = targetPx / scale;
    const pow = Math.pow(10, Math.floor(Math.log10(Math.max(rawVal, 1e-6))));
    const nice = [1, 2, 5, 10].map((n) => n * pow).find((v) => v * scale <= targetPx * 1.2) || pow;
    const barPx = nice * scale;
    const by0 = H - 14;
    ctx.strokeStyle = 'rgba(200,210,240,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, by0); ctx.lineTo(12 + barPx, by0);
    ctx.moveTo(12, by0 - 3); ctx.lineTo(12, by0 + 3);
    ctx.moveTo(12 + barPx, by0 - 3); ctx.lineTo(12 + barPx, by0 + 3);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,210,240,0.65)';
    ctx.font = '10px sans-serif';
    ctx.fillText(`${nice >= 1 ? nice : nice.toFixed(2)} R☉`, 12 + barPx / 2 - 12, by0 - 6);
    ctx.fillStyle = 'rgba(200,210,240,0.4)';
    ctx.fillText('俯视惯性系 · 十字为质心 · 虚线为两星轨道', 12, 16);
  }

  drawStar(ctx, x, y, s, scale, name) {
    const color = PHYS.starColor(s.Teff);
    let rPx;
    let kind = 'star';
    if (s.type === 'BH') { kind = 'BH'; rPx = 5.5; }
    else if (s.type === 'NS') { kind = 'NS'; rPx = 3.2; }
    else if (s.type === 'WD') { kind = 'WD'; rPx = 3.8; }
    else {
      // 普通恒星按真实半径线性绘制,与洛希瓣同比例——充满洛希瓣时画面上一目了然
      rPx = Math.max(3, Math.min(s.R * scale, Math.min(this.W, this.H) * 0.42));
    }
    if (kind === 'BH') {
      const g = ctx.createRadialGradient(x, y, rPx * 0.4, x, y, rPx * 2.6);
      g.addColorStop(0, 'rgba(255,170,80,0.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rPx * 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffb45e';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y, rPx, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(x, y, rPx - 1, 0, Math.PI * 2); ctx.fill();
    } else {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rPx * 2.6);
      g.addColorStop(0, color);
      g.addColorStop(0.35, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rPx * 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, rPx, 0, Math.PI * 2); ctx.fill();
      if (kind === 'NS') {
        ctx.strokeStyle = 'rgba(160,220,255,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, rPx + 2.5, 0, Math.PI * 2); ctx.stroke();
      }
    }
    const mass = s.M >= 10 ? s.M.toFixed(1) : s.M.toFixed(2);
    const typeName = kind === 'WD' ? '白矮星' : kind === 'NS' ? '中子星' : kind === 'BH' ? '黑洞' : '';
    const label = `${name}${typeName ? ' · ' + typeName : ''} ${mass} M☉`;
    ctx.fillStyle = 'rgba(210,220,255,0.85)';
    ctx.font = '10px sans-serif';
    const tw = ctx.measureText(label).width;
    ctx.fillText(label, x - tw / 2, y + rPx + 13);
  }
}

class LightCurve {
  constructor(canvas) {
    this.canvas = canvas;
    this.W = 380;
    this.H = 300;
    this.ctx = fitDpr(canvas, this.W, this.H);
  }

  // phase01: 当前轨道相位(0–1,随轨道视图同步移动)
  draw(sim, phase01) {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    ctx.fillStyle = '#0a0f1e';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(190,200,230,0.9)';
    ctx.fillText('光变曲线（示意）', 8, 14);

    const L1 = Math.max(sim.s1.L, 1e-8);
    const L2 = Math.max(sim.s2.L, 1e-8);
    const total = L1 + L2;
    const ecl = sim.isEclipsing();
    const r1 = sim.s1.R;
    const r2 = sim.s2.R;
    const wPhase = Math.min(0.45, (r1 + r2) / (Math.PI * Math.max(sim.orbit.a, 1e-3)));
    const flux = [];
    const N = 240;
    for (let i = 0; i <= N; i++) {
      const ph = i / N;
      let f = 1;
      if (ecl) {
        const dip = (center, depth, width) => {
          let dd = Math.abs(ph - center);
          dd = Math.min(dd, 1 - dd);
          if (dd > width) return 0;
          return depth * Math.pow(Math.cos((dd / width) * Math.PI / 2), 2);
        };
        const d1 = r2 <= r1 ? L1 * Math.pow(r2 / r1, 2) : L1;
        const d2 = r1 <= r2 ? L2 * Math.pow(r1 / r2, 2) : L2;
        f = 1 - (dip(0, d1 / total, wPhase) + dip(0.5, d2 / total, wPhase));
      }
      flux.push(f);
    }
    const minF = Math.min(...flux);
    const maxF = Math.max(...flux);
    const pad = (maxF - minF) * 0.15 + 0.02;
    const yOf = (f) => H - 26 - ((f - (minF - pad)) / ((maxF + pad) - (minF - pad))) * (H - 48);
    const xOf = (ph) => ph * (W - 20) + 10;

    // 相位轴刻度
    ctx.strokeStyle = 'rgba(140,160,210,0.3)';
    ctx.fillStyle = 'rgba(150,160,190,0.7)';
    ctx.lineWidth = 1;
    ctx.font = '10px sans-serif';
    [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
      const x = xOf(p);
      ctx.beginPath();
      ctx.moveTo(x, H - 24);
      ctx.lineTo(x, H - 20);
      ctx.stroke();
      ctx.fillText(String(p), x - 5, H - 8);
    });
    ctx.fillText('轨道相位', W - 56, H - 8);

    // 曲线
    ctx.strokeStyle = 'rgba(255,220,140,0.95)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    flux.forEach((f, i) => {
      const x = xOf(i / N);
      const y = yOf(f);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 当前相位标记:与轨道视图同步,直观对应"转到哪、亮多少"
    const ph = ((phase01 || 0) % 1 + 1) % 1;
    const fx = xOf(ph);
    const fy = yOf(flux[Math.round(ph * N)]);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(fx, 22);
    ctx.lineTo(fx, H - 24);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(fx, fy, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '11px sans-serif';
    if (ecl) {
      ctx.fillStyle = 'rgba(125,255,176,0.9)';
      ctx.fillText('食双星：相位 0 与 0.5 处发生两次掩食', 8, 30);
    } else {
      ctx.fillStyle = 'rgba(150,160,190,0.85)';
      ctx.fillText('当前倾角看不到食 — 拖动右侧「观测倾角」滑块试试', 8, 30);
    }
  }
}

if (typeof window !== 'undefined') {
  window.OrbitView = OrbitView;
  window.LightCurve = LightCurve;
}
