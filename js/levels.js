'use strict';

const LEVELS = [
  {
    id: 'l1',
    name: '序章 · 太阳的一生',
    brief: '一对类太阳恒星将度过漫长的一生。观察它们的阶段变化，见证物质转移与白矮星的诞生。',
    icon: '☀️',
    config: { star1: { m: 1.0 }, star2: { m: 1.0 }, pDays: 500, e: 0.1, inc: 80 },
    speed: 50,
    goals: [
      { id: 'g-rgb', text: '见证一颗恒星变成红巨星（壳层燃烧）', ev: 'rgb' },
      { id: 'g-rlof', text: '经历一次洛希瓣溢出（物质转移）', ev: 'rlof-B' },
      { id: 'g-wd', text: '见证白矮星诞生', ev: 'wd-born' },
      { id: 'g-pn', text: '看到行星状星云', ev: 'pn' },
    ],
    hint: '点击"开始演化"并调快时间速度。质量 1 M☉ 的恒星主序寿命约 100 亿年。',
  },
  {
    id: 'l2',
    name: '大陵五悖论',
    brief: '5+2.5 M☉ 的密近双星。让主星把包层送给伴星，制造一颗"质量小却更老"的大陵五型双星。',
    icon: '👑',
    config: { star1: { m: 5.0 }, star2: { m: 2.5 }, pDays: 5, e: 0.2, inc: 85 },
    speed: 5,
    goals: [
      { id: 'g-rlof', text: '触发 Case B 物质转移', ev: 'rlof-B' },
      { id: 'g-algol', text: '触发"大陵五佯谬"事件', ev: 'algol' },
      { id: 'g-vampire', text: '伴星成为"吸血鬼恒星"（蓝离散星）', ev: 'vampire' },
      { id: 'g-ce', text: '目睹共有包层（CE）演化', ev: 'ce' },
    ],
    hint: '关键节点的选择会影响轨道宽度。试试"守恒转移"与"非守恒"两种命运——看系统是变宽、变窄还是并合。',
  },
  {
    id: 'l3',
    name: '激变变星',
    brief: '这是一颗已经形成的激变变星（CV）：白矮星 + 充满洛希瓣的主序伴星。观察周期空缺与周期反弹。',
    icon: '💥',
    config: { star1: { m: 0.9, kind: 'wd', wdType: 'CO' }, star2: { m: 0.9, msFrac: 0.5 }, pDays: 0.25, e: 0, inc: 75 },
    speed: 100,
    cv: true,
    goals: [
      { id: 'g-cv', text: '进入激变变星吸积阶段', ev: 'cv' },
      { id: 'g-nova', text: '目睹一次新星爆发', ev: 'nova' },
      { id: 'g-gap', text: '进入 2–3 小时"周期空缺"', ev: 'gap' },
      { id: 'g-bounce', text: '见证 ~80 分钟的周期反弹', ev: 'bounce' },
    ],
    hint: 'CV 的周期演化以亿年计——放心把速度调到 1000×。',
  },
  {
    id: 'l4',
    name: '毫秒脉冲星工厂',
    brief: '一颗古老的中子星伴着 1.6 M☉ 的恒星。先看星风吸积"回收"脉冲星，再经历热时标物质转移，走向双致密星。',
    icon: '⏲️',
    config: { star1: { m: 1.4, kind: 'ns' }, star2: { m: 1.6, msFrac: 0.985 }, pDays: 500, e: 0, inc: 60 },
    speed: 100,
    goals: [
      { id: 'g-xrb', text: '进入 X 射线双星阶段（星风吸积）', ev: 'xrb' },
      { id: 'g-mspsr', text: '完成毫秒脉冲星"回收"', ev: 'mspsr' },
      { id: 'g-rlof', text: '触发红巨星的物质转移（Case B）', ev: 'rlof-B' },
      { id: 'g-wd', text: '供体演化为白矮星', ev: 'wd-born' },
      { id: 'g-pair', text: '形成双致密星系统', ev: 'double-compact' },
    ],
    hint: '真实通道：中子星先靠星风吸积"回收"自己（共生 X 射线双星），伴星演化成红巨星后再经洛希瓣溢出。',
  },
  {
    id: 'l5',
    name: '千新星之路',
    brief: '这是赫尔斯-泰勒双星的复刻：1.4+1.4 M☉ 双中子星，P=7.75 小时，e=0.617。引力波正让轨道收缩……',
    icon: '〰️',
    config: { star1: { m: 1.4, kind: 'ns' }, star2: { m: 1.4, kind: 'ns' }, pDays: 0.3229, e: 0.617, inc: 60 },
    speed: 1000,
    goals: [
      { id: 'g-pair', text: '识别双致密星与引力波旋进', ev: 'double-compact' },
      { id: 'g-kn', text: '时间快进到并合，触发千新星', ev: 'kilonova' },
    ],
    hint: '真实历史：赫尔斯与泰勒 1974 年发现此系统，通过轨道衰减首次间接证实引力波（1993 年诺贝尔奖）。',
  },
  {
    id: 'l6',
    name: '终极烟火 · Ia 型超新星',
    brief: '选择你的通道：单简并（白矮星吸积伴星）或双简并（两颗白矮星并合），把白矮星推过 1.44 M☉！',
    icon: '🌟',
    choice: [
      {
        id: 'sd',
        label: '单简并通道',
        desc: '1.30 M☉ 碳氧白矮星 + 1.0 M☉ 主序伴星，P = 8.4 小时。让白矮星吸积到钱德拉塞卡极限。',
        config: { star1: { m: 1.3, kind: 'wd', wdType: 'CO' }, star2: { m: 1.0, msFrac: 0.3 }, pDays: 0.35, e: 0, inc: 75 },
      },
      {
        id: 'dd',
        label: '双简并通道',
        desc: '1.05 + 0.65 M☉ 双碳氧白矮星，P = 2 小时。引力波将让它们在约 1.2 亿年内并合。',
        config: { star1: { m: 1.05, kind: 'wd', wdType: 'CO' }, star2: { m: 0.65, kind: 'wd', wdType: 'CO' }, pDays: 0.0833, e: 0, inc: 75 },
      },
    ],
    speed: 100,
    goals: [
      { id: 'g-ch', text: '理解钱德拉塞卡极限（解锁卡片）', ev: 'ch' },
      { id: 'g-ia', text: '触发 Ia 型超新星', ev: 'ia' },
    ],
    hint: 'Ia 型超新星是宇宙标准烛光——正是用它，人类发现了暗能量。',
  },
];

const FREE_DEFAULT = { star1: { m: 2.0 }, star2: { m: 1.0 }, pDays: 10, e: 0.1, inc: 80 };

if (typeof window !== 'undefined') {
  window.LEVELS = LEVELS;
  window.FREE_DEFAULT = FREE_DEFAULT;
}
