'use strict';

class HRD {
  constructor(canvas) {
    this.canvas = canvas;
    this.W = 460;
    this.H = 300;
    this.ctx = fitDpr(canvas, this.W, this.H);
    this.trails = [[], []];
  }

  reset() {
    this.trails = [[], []];
  }

  push(sim) {
    for (let i = 0; i < 2; i++) {
      const s = sim.stars[i];
      if (s.L <= 0 || s.Teff <= 0) continue;
      const tr = this.trails[i];
      const last = tr[tr.length - 1];
      if (last && Math.abs(last[0] - s.Teff) < 1 && Math.abs(last[1] - s.L) / Math.max(s.L, 1e-6) < 0.02) continue;
      tr.push([s.Teff, s.L, s.stage, sim.t]);
      if (tr.length > 420) tr.shift();
    }
  }

  xOf(teff, W) {
    const lt = Math.log10(Math.min(Math.max(teff, 2800), 45000));
    return 8 + ((Math.log10(45000) - lt) / (Math.log10(45000) - Math.log10(2800))) * (W - 16);
  }

  yOf(lum, H) {
    const ll = Math.log10(Math.min(Math.max(lum, 1e-4), 1e6));
    return H - 20 - ((ll - Math.log10(1e-4)) / (Math.log10(1e6) - Math.log10(1e-4))) * (H - 34);
  }

  draw(sim) {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    ctx.fillStyle = '#0a0f1e';
    ctx.fillRect(0, 0, W, H);

    // 网格与刻度
    const teffTicks = [3000, 6000, 12000, 25000];
    const lumTicks = [
      [0.01, '10⁻²'],
      [1, '1'],
      [100, '10²'],
      [10000, '10⁴'],
      [1000000, '10⁶'],
    ];
    ctx.lineWidth = 1;
    ctx.font = '10px sans-serif';
    teffTicks.forEach((t) => {
      const x = this.xOf(t, W);
      ctx.strokeStyle = 'rgba(120,140,200,0.13)';
      ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x, H - 19); ctx.stroke();
      ctx.fillStyle = 'rgba(150,160,190,0.7)';
      ctx.fillText(t >= 1000 ? t / 1000 + 'k' : String(t), x - 8, H - 8);
    });
    lumTicks.forEach(([l, lbl]) => {
      const y = this.yOf(l, H);
      ctx.strokeStyle = 'rgba(120,140,200,0.13)';
      ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(W - 8, y); ctx.stroke();
      ctx.fillStyle = 'rgba(150,160,190,0.7)';
      ctx.fillText(lbl, 10, y - 3);
    });

    // 标题与轴说明
    ctx.fillStyle = 'rgba(190,200,230,0.9)';
    ctx.font = '11px sans-serif';
    ctx.fillText('赫罗图  纵轴 log L/L☉ · 横轴 log Teff/K（越右越冷）', 8, 14);

    // 主序带背景
    ctx.fillStyle = 'rgba(255,240,200,0.14)';
    ctx.beginPath();
    for (let m = 0.3; m <= 40; m *= 1.06) {
      const x = this.xOf(PHYS.zamsTeff(m), W);
      const y = this.yOf(PHYS.zamsLum(m), H);
      if (m <= 0.31) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let m = 40; m >= 0.3; m /= 1.06) {
      const x = this.xOf(PHYS.zamsTeff(m) * 0.86, W);
      const y = this.yOf(PHYS.zamsLum(m) * 1.9, H);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(200,210,240,0.5)';
    ctx.fillText('主序带', this.xOf(9000, W), this.yOf(3, H) - 6);

    // 图例(与星体卡、轨道视图颜色一致)
    ctx.font = '10px sans-serif';
    for (let i = 0; i < 2; i++) {
      const lx = W - 108 + i * 54;
      ctx.fillStyle = STAR_ID_COLORS[i];
      ctx.beginPath(); ctx.arc(lx, 11, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(210,220,240,0.85)';
      ctx.fillText(i === 0 ? '★主星' : '☆伴星', lx + 6, 14);
    }

    // 两星演化轨迹与当前位置
    ctx.strokeStyle = 'rgba(120,140,200,0.35)';
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    for (let i = 0; i < 2; i++) {
      const tr = this.trails[i];
      if (!tr.length) continue;
      ctx.strokeStyle = STAR_ID_COLORS[i];
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      tr.forEach((p, k) => {
        const x = this.xOf(p[0], W);
        const y = this.yOf(p[1], H);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
      const cur = sim.stars[i];
      if (cur.Teff > 0 && cur.L > 0) {
        const px = this.xOf(cur.Teff, W);
        const py = this.yOf(cur.L, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(px, py, 6.5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = STAR_ID_COLORS[i];
        ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

if (typeof window !== 'undefined') {
  window.HRD = HRD;
}
