'use strict';

class HRD {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
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
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0f1e';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(140,160,210,0.7)';
    ctx.fillStyle = 'rgba(190,200,230,0.9)';
    ctx.font = '11px sans-serif';
    ctx.fillText('赫罗图（log L – log Teff）', 8, 14);
    ctx.fillStyle = 'rgba(255,240,200,0.16)';
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
    ctx.fillStyle = 'rgba(200,210,240,0.55)';
    ctx.fillText('主序带', this.xOf(9000, W), this.yOf(3, H) - 6);
    ctx.strokeStyle = 'rgba(120,140,200,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    const colors = ['#ffca6a', '#7ab8ff'];
    for (let i = 0; i < 2; i++) {
      const tr = this.trails[i];
      if (!tr.length) continue;
      ctx.strokeStyle = colors[i];
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
      const cur = sim.stars[i];
      if (cur.Teff > 0 && cur.L > 0) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.arc(this.xOf(cur.Teff, W), this.yOf(cur.L, H), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(190,200,230,0.75)';
    ctx.fillText('冷 ←', 8, H - 8);
    ctx.fillText('→ 热', W - 40, H - 8);
    ctx.fillText('亮 ↑', 8, 26);
  }
}

if (typeof window !== 'undefined') {
  window.HRD = HRD;
}
