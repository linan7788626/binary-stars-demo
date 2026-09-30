'use strict';

class OrbitView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.t = 0;
    this.lobeCache = { key: '', paths: [[], []] };
  }

  rocheLobePath(starIdx, d, m1, m2) {
    const key = `${starIdx}|${d.toFixed(3)}|${m1.toFixed(3)}|${m2.toFixed(3)}`;
    if (this.lobeCache.key === key) return this.lobeCache.paths[starIdx];
    const mm = [m1, m2];
    const r1 = -(d * m2) / (m1 + m2);
    const r2 = (d * m1) / (m1 + m2);
    const centers = [r1, r2];
    const rl = [PHYS.eggletonRL_over_a(m1 / m2) * d, PHYS.eggletonRL_over_a(m2 / m1) * d];
    const l1x = d * (0.5 - 0.227 * Math.log10(m1 / m2));
    const phiL1 = -mm[0] / Math.abs(l1x - r1) - mm[1] / Math.abs(l1x - r2) - 0.5 * (mm[0] + mm[1]) * l1x * l1x;
    const paths = [];
    for (let si = 0; si < 2; si++) {
      const cx = centers[si];
      const other = centers[1 - si];
      const pts = [];
      const N = 72;
      for (let i = 0; i <= N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        let lo = 0.02 * d;
        let hi = Math.abs(cx - other) * 0.98;
        const cap = si === 0 ? l1x - cx : cx - l1x;
        hi = Math.min(hi, Math.abs(cap) * 1.02);
        for (let it = 0; it < 34; it++) {
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

  draw(sim, phase, dtFrame) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    this.t += dtFrame;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#070b16';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = ((i * 977) % 1000) / 1000 * W;
      const y = ((i * 613) % 1000) / 1000 * H;
      const s = (i % 3) * 0.4 + 0.4;
      ctx.fillStyle = `rgba(255,255,255,${0.12 + (i % 5) * 0.05})`;
      ctx.fillRect(x, y, s, s);
    }
    const s1 = sim.s1;
    const s2 = sim.s2;
    const a = sim.orbit.a;
    const e = sim.orbit.e;
    const nu = phase * Math.PI * 2;
    const d = e > 0.001 ? (a * (1 - e * e)) / (1 + e * Math.cos(nu)) : a;
    const m1 = s1.M;
    const m2 = s2.M;
    const scale = Math.min(W, H) * 0.42 / Math.max(d, Math.max(s1.R, s2.R) * 1.2, 0.5);
    const cx = W / 2;
    const cy = H / 2;
    const r1x = -(d * m2) / (m1 + m2);
    const r2x = (d * m1) / (m1 + m2);
    const px1 = cx + r1x * scale;
    const px2 = cx + r2x * scale;
    ctx.strokeStyle = 'rgba(120,140,200,0.25)';
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1;
    const a2 = d * (m1 / (m1 + m2));
    const b2 = a2 * Math.sqrt(Math.max(1 - e * e, 0.02));
    ctx.beginPath();
    ctx.ellipse(cx - a2 * e * scale, cy, a2 * scale, b2 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let si = 0; si < 2; si++) {
      const s = si === 0 ? s1 : s2;
      if (s.type === 'star' || s.type === 'HeMS') {
        const path = this.rocheLobePath(si, d, m1, m2);
        const fill = sim.fillFactor(si);
        if (fill > 0.55) {
          ctx.beginPath();
          path.forEach((p, i) => {
            const x = cx + p[0] * scale;
            const y = cy + p[1] * scale;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fillStyle = 'rgba(90,120,255,0.10)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(120,150,255,0.45)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    const l1x = d * (0.5 - 0.227 * Math.log10(m1 / Math.max(m2, 1e-3)));
    const l1px = cx + l1x * scale;
    ctx.fillStyle = 'rgba(255,210,120,0.9)';
    ctx.beginPath();
    ctx.arc(l1px, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,210,120,0.6)';
    ctx.font = '10px sans-serif';
    ctx.fillText('L1', l1px - 6, cy - 8);
    if (sim.rlof || sim.mode === 'cv') {
      const donorIdx = sim.rlof ? sim.rlof.donorIdx : 1;
      const from = donorIdx === 0 ? px1 : px2;
      const to = donorIdx === 0 ? px2 : px1;
      const rr = Math.abs(to - from);
      for (let i = 0; i < 9; i++) {
        const f = ((this.t * 0.6 + i / 9) % 1);
        const bx = from + (to - from) * f;
        const by = cy + Math.sin(f * Math.PI) * 14 * Math.sign(1) * (donorIdx === 0 ? 1 : -1);
        ctx.fillStyle = `rgba(255,170,90,${0.85 - f * 0.6})`;
        ctx.beginPath();
        ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this.drawStar(ctx, px1, cy, s1, scale);
    this.drawStar(ctx, px2, cy, s2, scale);
    ctx.fillStyle = 'rgba(200,210,240,0.75)';
    ctx.font = '11px sans-serif';
    ctx.fillText('旋转参考系俯视图（两星固定于连线，间距随偏心率脉动）', 10, H - 10);
  }

  drawStar(ctx, x, y, s, scale) {
    const color = PHYS.starColor(s.Teff);
    const rPx = Math.max(2.2, Math.min(80, Math.sqrt(s.R) * scale * 0.55));
    const g = ctx.createRadialGradient(x, y, 0, x, y, rPx * 2.4);
    g.addColorStop(0, color);
    g.addColorStop(0.35, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rPx * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, rPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(210,220,255,0.9)';
    ctx.font = '10px sans-serif';
    const label = s.type === 'WD' ? '白矮星' : s.type === 'NS' ? '中子星' : s.type === 'BH' ? '黑洞' : `${s.M.toFixed(2)} M☉`;
    ctx.fillText(label, x - 14, y + rPx + 13);
  }
}

class LightCurve {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(sim) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0f1e';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(140,160,210,0.7)';
    ctx.fillStyle = 'rgba(190,200,230,0.9)';
    ctx.font = '11px sans-serif';
    ctx.fillText('示意光变曲线', 8, 14);
    const L1 = Math.max(sim.s1.L, 1e-8);
    const L2 = Math.max(sim.s2.L, 1e-8);
    const total = L1 + L2;
    const ecl = sim.isEclipsing();
    const r1 = sim.s1.R;
    const r2 = sim.s2.R;
    const wPhase = Math.min(0.45, (r1 + r2) / (Math.PI * sim.orbit.a));
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
        f = 1 - (dip(0, d1 / total, wPhase) + dip(0.5, d2 / total, wPhase)) / 1;
      }
      flux.push(f);
    }
    const minF = Math.min(...flux);
    const maxF = Math.max(...flux);
    const pad = (maxF - minF) * 0.15 + 0.02;
    const yOf = (f) => H - 22 - ((f - (minF - pad)) / ((maxF + pad) - (minF - pad))) * (H - 40);
    ctx.strokeStyle = 'rgba(255,220,140,0.95)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    flux.forEach((f, i) => {
      const x = (i / N) * (W - 16) + 8;
      const y = yOf(f);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    if (!ecl) {
      ctx.fillStyle = 'rgba(150,160,190,0.8)';
      ctx.fillText('倾角过低：观测不到食。试试把 i 调大（新系统生效）', 8, H - 8);
    }
  }
}

if (typeof window !== 'undefined') {
  window.OrbitView = OrbitView;
  window.LightCurve = LightCurve;
}
