'use strict';

const CONST = {
  G: 6.6743e-11,
  MSUN: 1.989e30,
  RSUN: 6.957e8,
  DAY: 86400,
  C: 2.99792458e8,
  HUBBLE_MYR: 13800,
  CH: 1.44,
  Q_CRIT_RAD: 3.0,
  Q_CRIT_CONV: 1.0,
  LAMBDA_RGB: 2.0,
  LAMBDA_AGB: 0.7,
  ETA_MAX_ACCRET_MYR: 0.015,
};

function keplerA_Rsun(m1, m2, pDays) {
  return 4.2083 * Math.cbrt(m1 + m2) * Math.pow(Math.max(pDays, 1e-4), 2 / 3);
}

function keplerP_days(aRsun, m1, m2) {
  return Math.sqrt(Math.pow(Math.max(aRsun, 1e-6), 3) / (74.55 * (m1 + m2)));
}

function eggletonRL_over_a(q) {
  if (q <= 0) return 0.379;
  const q23 = Math.pow(q, 2 / 3);
  return (0.49 * q23) / (0.6 * q23 + Math.log(1 + Math.cbrt(q)));
}

function msLifetime_Myr(m) {
  return 10000 * Math.pow(Math.max(m, 0.05), -2.5);
}

function zamsRadius(m) {
  return m <= 1 ? Math.pow(m, 0.8) : Math.pow(m, 0.57);
}

function zamsTeff(m) {
  return 5772 * Math.pow(Math.max(m, 0.05), 0.55);
}

function zamsLum(m) {
  return Math.pow(Math.max(m, 0.05), 3.8);
}

function rgbMaxRadius(m) {
  return Math.min(700, 180 * Math.pow(Math.max(m, 0.05), -0.35));
}

function heIgnitionCore(m) {
  return Math.min(1.8, 0.11 * Math.pow(m, 1.4) + 0.3);
}

function ifmrWd(m0) {
  return Math.min(1.35, Math.max(0.4, 0.077 * m0 + 0.48));
}

function coWdFromHeStar(mHe) {
  return Math.min(1.3, Math.max(0.35, 0.25 + 0.15 * mHe));
}

function wdRadius(m) {
  const q1 = Math.pow(CONST.CH / Math.max(m, 0.02), 2 / 3);
  const q2 = Math.pow(Math.max(m, 0.02) / CONST.CH, 2 / 3);
  return Math.max(0.002, 0.0112 * Math.sqrt(Math.max(q1 - q2, 1e-6)));
}

function heStarRadius(m) {
  return 0.2 * Math.pow(Math.max(m, 0.1), 0.7);
}

function heStarLifetime_Myr(m) {
  return Math.max(0.05, 2 * Math.pow(Math.max(m, 0.1) / 2, -1.5));
}

function stageDurations(m, massive) {
  const tms = msLifetime_Myr(m);
  if (massive) {
    return {
      MS: tms,
      HG: 0.03 * tms,
      RGB: 0.05 * tms,
      CHeB: 0.04 * tms,
      AGB: 0,
      tSN: tms * 1.12,
    };
  }
  return {
    MS: tms,
    HG: 0.03 * tms,
    RGB: 0.13 * tms,
    CHeB: 0.08 * tms,
    AGB: 0.02 * tms,
    tSN: Infinity,
  };
}

function stageRadius(stage, m, x, f) {
  const rz = zamsRadius(m);
  const rTams = 1.6 * rz;
  const rRgb = rgbMaxRadius(m);
  switch (stage) {
    case 'MS':
      return rz * (1 + 0.6 * x);
    case 'HG': {
      const rHe = 0.3 * rRgb;
      return rTams + (rHe - rTams) * Math.min(1, f * 1.2);
    }
    case 'RGB':
      return 0.3 * rRgb + 0.7 * rRgb * Math.pow(Math.min(1, f), 1.5);
    case 'CHeB':
      return 12 * Math.pow(Math.max(m, 0.3), -0.2);
    case 'AGB':
      return 12 * Math.pow(Math.max(m, 0.3), -0.2) + (1.4 * rRgb - 12 * Math.pow(Math.max(m, 0.3), -0.2)) * Math.min(1, f);
    case 'HeMS':
      return heStarRadius(m);
    case 'WD':
      return wdRadius(m);
    case 'NS':
      return 1.72e-5;
    case 'BH':
      return 4.2e-6 * Math.max(m, 3);
    default:
      return rz;
  }
}

function stageTeff(stage, m, f) {
  switch (stage) {
    case 'MS':
      return zamsTeff(m);
    case 'HG':
      return zamsTeff(m) * (1 - 0.35 * Math.min(1, f * 1.2));
    case 'RGB':
      return 4100 - 400 * Math.min(1, f);
    case 'CHeB':
      return 4700;
    case 'AGB':
      return 3400;
    case 'HeMS':
      return 35000;
    case 'WD':
      return 15000;
    case 'NS':
      return 1e6;
    case 'BH':
      return 0;
    default:
      return zamsTeff(m);
  }
}

function stageLum(stage, m, x, f) {
  switch (stage) {
    case 'MS':
      return zamsLum(m) * (1 + 0.3 * x);
    case 'HG':
      return zamsLum(m) * (1 + 3 * Math.min(1, f * 1.2));
    case 'RGB':
      return 1500 * Math.pow(Math.max(m, 0.2), 1.3);
    case 'CHeB':
      return 120 * Math.pow(Math.max(m, 0.3), 0.8);
    case 'AGB':
      return 3000 * Math.pow(Math.max(m, 0.3), 1.2);
    case 'HeMS':
      return 50 * Math.pow(Math.max(m, 0.1), 2.5);
    case 'WD':
      return 0.008 * Math.pow(0.6 / Math.max(m, 0.15), 2);
    case 'NS':
    case 'BH':
      return 1e-6;
    default:
      return zamsLum(m);
  }
}

function isMassive(m) {
  return m >= 8;
}

function isConvectiveEnvelope(stage) {
  return stage === 'RGB' || stage === 'AGB';
}

function qCritFor(stage) {
  return isConvectiveEnvelope(stage) ? CONST.Q_CRIT_CONV : CONST.Q_CRIT_RAD;
}

function caseOf(stage) {
  switch (stage) {
    case 'MS':
      return 'A';
    case 'HG':
    case 'RGB':
      return 'B';
    default:
      return 'C';
  }
}

function conservativeDaOverA(dMd, md, ma) {
  return -2 * (dMd / md - dMd / ma);
}

function nonConservativeDaOverA(dMd, md, ma, beta) {
  const dMa = -beta * dMd;
  const dMlost = -dMd - dMa;
  const dJoverJ = dMlost / ma;
  return (
    2 * dJoverJ - 2 * (dMd / md) - 2 * (dMa / ma) + (dMd + dMa) / (md + ma)
  );
}

function ceOutcome(md, ma, core, env, rd, aRsun, alpha, lambda) {
  const eBind = (CONST.G * md * CONST.MSUN * env * CONST.MSUN) / (lambda * rd * CONST.RSUN);
  const eOrbI = (CONST.G * md * CONST.MSUN * ma * CONST.MSUN) / (2 * aRsun * CONST.RSUN);
  const ratio = eBind / (alpha * eOrbI);
  if (ratio <= 1) {
    const eOrbF = eOrbI - eBind / alpha;
    const aF = (CONST.G * core * CONST.MSUN * ma * CONST.MSUN) / (2 * eOrbF * CONST.RSUN);
    return { outcome: 'eject', aF, eBind, eOrbI, ratio };
  }
  if (alpha >= 1 && ratio <= 2) {
    const eOrbF = eOrbI - eBind / 2;
    const aF = (CONST.G * core * CONST.MSUN * ma * CONST.MSUN) / (2 * eOrbF * CONST.RSUN);
    return { outcome: 'partial', aF, eBind, eOrbI, ratio };
  }
  return { outcome: 'merge', aF: 0, eBind, eOrbI, ratio };
}

function snRemnant(m) {
  if (m >= 20) return { type: 'BH', m: Math.max(4, m / 5) };
  return { type: 'NS', m: 1.4 };
}

function gwMergeTime_Myr(m1, m2, aRsun, e) {
  const a = aRsun * CONST.RSUN;
  const m1s = m1 * CONST.MSUN;
  const m2s = m2 * CONST.MSUN;
  const num = (5 / 256) * Math.pow(CONST.C, 5) * Math.pow(a, 4);
  const den = Math.pow(CONST.G, 3) * m1s * m2s * (m1s + m2s);
  const tCirc = num / den;
  const eccFactor = Math.pow(Math.max(1e-4, 1 - e * e), 3.5);
  return (tCirc * eccFactor) / (3.156e13);
}

function orbitalEnergy_J(md, ma, aRsun) {
  return (CONST.G * md * CONST.MSUN * ma * CONST.MSUN) / (2 * aRsun * CONST.RSUN);
}

function snPostOrbit(mTotBefore, dmLost, aBefore, eBefore) {
  const mTotAfter = mTotBefore - dmLost;
  if (dmLost >= 0.5 * mTotBefore) {
    return { bound: false, a: 0, e: 0 };
  }
  const aAfter = aBefore * (mTotBefore / mTotAfter);
  const eAfter = Math.min(0.95, eBefore + dmLost / mTotAfter);
  return { bound: true, a: aAfter, e: eAfter };
}

function starColor(teff) {
  if (teff <= 0) return '#8888ff';
  const t = Math.min(Math.max(teff, 2500), 45000);
  const stops = [
    [2500, [255, 160, 90]],
    [3500, [255, 190, 130]],
    [5000, [255, 230, 190]],
    [6500, [255, 248, 235]],
    [8500, [235, 240, 255]],
    [15000, [200, 220, 255]],
    [45000, [170, 200, 255]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      const f = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
      const a = stops[i][1];
      const b = stops[i + 1][1];
      return `rgb(${Math.round(a[0] + f * (b[0] - a[0]))},${Math.round(a[1] + f * (b[1] - a[1]))},${Math.round(a[2] + f * (b[2] - a[2]))})`;
    }
  }
  return '#ffffff';
}

const PHYS_API = {
  CONST,
  keplerA_Rsun,
  keplerP_days,
  eggletonRL_over_a,
  msLifetime_Myr,
  zamsRadius,
  zamsTeff,
  zamsLum,
  rgbMaxRadius,
  heIgnitionCore,
  ifmrWd,
  coWdFromHeStar,
  wdRadius,
  heStarRadius,
  heStarLifetime_Myr,
  stageDurations,
  stageRadius,
  stageTeff,
  stageLum,
  isMassive,
  isConvectiveEnvelope,
  qCritFor,
  caseOf,
  conservativeDaOverA,
  nonConservativeDaOverA,
  ceOutcome,
  snRemnant,
  gwMergeTime_Myr,
  orbitalEnergy_J,
  snPostOrbit,
  starColor,
};

if (typeof window !== 'undefined') {
  window.PHYS = PHYS_API;
}
