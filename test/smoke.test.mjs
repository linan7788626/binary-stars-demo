import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import url from 'node:url';

const dir = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(dir, '..');

const files = ['js/physics.js', 'js/knowledge.js', 'js/levels.js', 'js/sim.js'];
const src = files.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
const fakeWindow = {};
new Function('window', src + '\n;')(fakeWindow);
const { PHYS, LEVELS, Simulation, KNOWLEDGE_CARDS } = fakeWindow;
globalThis.PHYS = PHYS;
globalThis.KNOWLEDGE_MAP = fakeWindow.KNOWLEDGE_MAP;

let pass = 0;
let fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
}

console.log('== 物理引擎单元检查 ==');
ok(Math.abs(PHYS.keplerA_Rsun(0.5, 0.5, 365.25) - 214.9) < 0.5, '开普勒第三定律: 总质量1 M☉ P=1年 → a≈214.9 R☉', PHYS.keplerA_Rsun(0.5, 0.5, 365.25).toFixed(2));
ok(Math.abs(PHYS.keplerA_Rsun(1, 1, 365.25) - 270.9) < 0.5, '开普勒第三定律: 1+1 M☉ P=1年 → a≈270.9 R☉', PHYS.keplerA_Rsun(1, 1, 365.25).toFixed(2));
ok(Math.abs(PHYS.eggletonRL_over_a(1) - 0.379) < 0.001, 'Eggleton 洛希瓣 q=1 → 0.379a', PHYS.eggletonRL_over_a(1).toFixed(4));
ok(Math.abs(PHYS.msLifetime_Myr(1) - 10000) < 1, '太阳主序寿命 10 Gyr');
ok(Math.abs(PHYS.wdRadius(0.6) - 0.0124) < 0.002, '0.6 M☉ 白矮星半径 ≈ 0.012 R☉', PHYS.wdRadius(0.6).toFixed(4));
const tauBT = PHYS.gwMergeTime_Myr(1.4, 1.4, 2.823, 0);
ok(tauBT > 1000 && tauBT < 3000, '赫尔斯-泰勒间距圆轨道并合时标 ~1.7 Gyr 量级', tauBT.toFixed(0));
ok(PHYS.gwMergeTime_Myr(1.4, 1.4, 2.823, 0.617) < tauBT * 0.25, '偏心率加速并合 (Peters 因子)');
ok(PHYS.keplerP_days(PHYS.keplerA_Rsun(5, 3, 5), 5, 3) - 5 < 1e-6, '开普勒互逆一致性');
ok(Math.abs(PHYS.trueAnomaly(0, 0.5)) < 1e-9, '真近点角 M=0 → ν=0');
ok(Math.abs(PHYS.trueAnomaly(Math.PI, 0.5) - Math.PI) < 1e-6, '真近点角 M=π → ν=π');
ok(PHYS.trueAnomaly(1.0, 0.617) > 1.0, '近星点附近 ν > M (开普勒第二定律)', PHYS.trueAnomaly(1.0, 0.617).toFixed(4));

function runLevel(level, config, expectFlags, maxSteps) {
  const logs = [];
  const defaults = { 'mt-mode': 'cons', 'ce-alpha': 'a1', 'sn-kick': 'nokick' };
  const sim = new Simulation({
    ...JSON.parse(JSON.stringify(config)),
    handlers: {
      log: (m, c) => logs.push(`[${c}] ${m}`),
      onEvent: () => {},
      onEnd: () => {},
    },
    defaultChoices: defaults,
  });
  if (level.cv) sim.startCv();
  let steps = 0;
  while (!sim.ended && steps < maxSteps) {
    if (sim.hasPending()) {
      const c = sim.pendingChoice;
      sim.resolve(defaults[c.id] || c.options[0].id);
    } else {
      sim.advance(0.5);
    }
    steps++;
  }
  return { sim, steps, logs };
}

console.log('\n== 关卡冒烟测试 ==');
const expectations = {
  l1: { flags: ['rgb', 'rlof-B', 'wd-born'], endTypes: ['quiet', 'compact-merge'], maxSteps: 200000 },
  l2: { flags: ['rlof-B', 'algol', 'vampire', 'ce'], endTypes: ['quiet', 'compact-merge', 'merge', 'ce-merge', 'unbind'], maxSteps: 200000 },
  l3: { flags: ['cv', 'gap', 'bounce', 'nova'], endTypes: ['quiet', 'compact-merge'], maxSteps: 400000 },
  l4: { flags: ['xrb', 'mspsr', 'rlof-B', 'wd-born', 'double-compact'], endTypes: ['quiet', 'compact-merge'], maxSteps: 400000 },
  l5: { flags: ['double-compact', 'kilonova'], endTypes: ['kilonova'], maxSteps: 200000 },
};

for (const lv of LEVELS) {
  if (lv.choice) {
    for (const opt of lv.choice) {
      console.log(`\n[关卡 ${lv.id} · 通道 ${opt.id}] ${opt.label}`);
      const { sim, steps } = runLevel(lv, opt.config, [], 300000);
      ok(sim.ended, '模拟正常结束', `steps=${steps}`);
      ok(sim.flags['ia'], '触发 Ia 型超新星事件');
      ok(sim.flags['ch'], '解锁钱德拉塞卡极限卡片');
      console.log(`    结局: ${sim.endResult ? sim.endResult.type : '未结束'} (t=${(sim.t / 1000).toFixed(2)} Gyr, steps=${steps})`);
    }
    continue;
  }
  const exp = expectations[lv.id];
  console.log(`\n[关卡 ${lv.id}] ${lv.name}`);
  const { sim, steps, logs } = runLevel(lv, lv.config, exp.flags, exp.maxSteps);
  for (const f of exp.flags) {
    ok(!!sim.flags[f], `事件触发: ${f}`);
  }
  ok(sim.ended, '模拟正常结束', `steps=${steps}, t=${(sim.t / 1000).toFixed(2)} Gyr`);
  ok(exp.endTypes.includes(sim.endResult ? sim.endResult.type : ''), `结局类型合理 (${sim.endResult ? sim.endResult.type : 'none'})`);
  const starsOk = sim.stars.every((s) => isFinite(s.M) && isFinite(s.R) && s.M > 0);
  ok(starsOk, '星体参数全程有限且为正');
  console.log(`    结局: ${sim.endResult ? sim.endResult.type : '未结束'} (t=${(sim.t / 1000).toFixed(2)} Gyr, steps=${steps})`);
  console.log('    关键日志:');
  logs.filter((l) => l.startsWith('[major]')).slice(0, 6).forEach((l) => console.log('      ' + l.slice(8, 110)));
}

console.log('\n== 知识卡 ==');
ok(KNOWLEDGE_CARDS.length >= 30, `知识卡数量 ${KNOWLEDGE_CARDS.length} ≥ 30`);
const ids = new Set(KNOWLEDGE_CARDS.map((c) => c.id));
ok(ids.size === KNOWLEDGE_CARDS.length, '知识卡 id 无重复');

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
