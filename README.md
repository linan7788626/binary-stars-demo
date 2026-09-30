# 双星纪元 Binary Era

> 面向本科天文学专业的**双星演化互动模拟**——亲手设定一对恒星的质量、轨道与倾角,看着它们在参数化物理规则下度过一生。

[![No Build](https://img.shields.io/badge/build-none-blueviolet)](#运行)
[![Tests](https://img.shields.io/badge/tests-52%2F52%20passing-brightgreen)](./test/smoke.test.mjs)
[![License](https://img.shields.io/badge/license-MIT-blue)](#许可)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-orange)](#贡献)

**English**: An interactive web simulation of binary-star evolution, designed for undergraduate astronomy students. Set up a pair of stars (masses, period, inclination, eccentricity) and watch them evolve through the full parameterised life cycle — main sequence, Roche-lobe overflow, common envelope, supernovae, white dwarfs, neutron stars, black holes, kilonovae, and gravitational-wave mergers.

**知识内核 / Knowledge base**: 韩占文《恒星物理的发展》(《物理》2025) §4、Kippenhahn *Stellar Structure and Evolution* 双星章、黄润乾《恒星物理》、Han et al. RAA 2020、Eggleton 1983、Peters 1964. 完整映射见 [DESIGN.md](./DESIGN.md)。

---

## 亮点 / Highlights

- **6 关卡 + 双通道(Ia 超新星)** + 自由模式:从太阳的一生到大陵五佯谬、激变变星、毫秒脉冲星、赫尔斯-泰勒复刻、千新星
- **参数化物理引擎**:开普勒第三定律、Eggleton 洛希瓣、Eggleton 演化拟合、Case A/B/C 质量转移、αλ 共有包层判据、Peters 引力波并合时标
- **36 张知识卡**:解锁即弹窗,提供本科教材级表述 + 韩占文等文献出处
- **互动决策**:RLOF 守恒/非守恒、CE α=1.0/0.3、SN 踢速度——每项决策可视化展示其能量/质量判据
- **实时观测倾角滑块**:演化过程中拖动 i 倾角,光变曲线即时反馈——直观展示"倾角如何决定是否观测到食"

## 运行 / Run

```bash
# 直接玩 — 浏览器打开 index.html
open index.html        # macOS
xdg-open index.html    # Linux
# 或启动本地服务器(推荐,Retina DPI 适配更可靠)
python3 -m http.server 8000
# 然后访问 http://127.0.0.1:8000/

# 跑测试 — 无依赖,纯 Node.js
node test/smoke.test.mjs
```

测试覆盖五关卡全部链路 + 双通道,52 项断言。冒烟测试用 `node:vm` 加载脚本,无需安装任何依赖。

## 截图 / Screenshots

> *准备中 — 运行 demo 后自行截图,或访问 GitHub Pages 版(规划中)*

## 文件结构 / File Layout

```
├── DESIGN.md            设计文档(v0.2,含模块映射与数值参数)
├── README.md            本文件
├── index.html           入口(无构建工具)
├── css/style.css        深空主题 + 药丸/进度条/元数据样式
├── js/
│   ├── physics.js       开普勒/Eggleton/参数化恒星/RLOF/CE/SN/GW
│   ├── sim.js           演化状态机 + 事件/决策
│   ├── knowledge.js     36 张知识卡
│   ├── levels.js        6 关 + Ia 超新星双通道
│   ├── render.js        轨道视图(惯性系、开普勒真近点角)+ 光变曲线
│   ├── hrd.js           赫罗图(刻度/图例/当前位置环)
│   ├── ui.js            DOM 面板 + 决策弹窗元数据可视化
│   └── main.js          游戏主循环 + 节流渲染
└── test/smoke.test.mjs  链路冒烟测试(52 项断言,Node 无依赖)
```

## 关卡 / Levels

| # | 名称 | 起点 | 核心现象 |
|---|---|---|---|
| 1 | 序章 · 太阳的一生 | 1.0+1.0 M☉, P=500 d | 红巨星 + RLOF + 白矮星 + 行星状星云 |
| 2 | 大陵五悖论 | 5.0+2.5 M☉, P=5 d | Case B 稳定转移 + 质量比反转 + 共有包层 |
| 3 | 激变变星 | 0.9 WD+0.9 MS, P=6 hr | 周期空缺 + 周期反弹 + 新星 |
| 4 | 毫秒脉冲星工厂 | 1.4 NS+1.6 MS, P=500 d | 星风回收 + Case B → 双致密星 |
| 5 | 千新星之路 | 1.4+1.4 NS, P=7.75 hr, e=0.617 | 赫尔斯-泰勒复刻 + 引力波 + 并合 |
| 6 | 终极烟火 · Ia 超新星 | 双通道任选 | 钱德拉塞卡极限 → 标准烛光 → 暗能量 |
| ☆ | 自由模式 | 任意参数 | 自由探索(无目标) |

## 教学指向 / Teaching Goals

| 层级 | 知识点 |
|---|---|
| 直观 | 恒星也有一生 / 双星互相绕转 / 恒星会爆炸 |
| 进阶 | 赫罗图 / 质量决定寿命 / 开普勒第三定律 / 食双星光变 |
| 本科 | 洛希瓣与内拉格朗日点 / Case A/B/C / 共有包层 / 钱德拉塞卡极限 / 角动量与轨道响应 / 引力波并合 |

## v0.2 相对 v0.1 的关键优化

| 维度 | 优化 |
|---|---|
| 关键教学瞬间 | 恒星改为线性半径绘制(原 `sqrt(R)` 压缩导致红巨星充满洛希瓣时画面只有几像素) |
| 轨道动画 | 真近点角由开普勒方程求解,近星点加速(开普勒第二定律);角速度随 P^(-1/3) 变化 |
| 食双星判据 | 修正为 `cos i · a < rSum`,主序时 i=80 默认无食、巨星膨胀后即时出现掩食 |
| 关卡速度 | 每关按特性配置(sun-like 100×、Algol 10×、CV/双中子星 1000×) |
| 画面 | DPI 适配 / 惯性系俯视 / 质心十字 / 双轨道椭圆(主星金伴星蓝)/ 洛希瓣常显 + 充填警示 / 物质流贝塞尔弧 + 吸积盘 / 黑洞/中子星/白矮星差异化 |
| 直观展示参数关系 | 实时倾角滑块 / RLOF 转移速率 Ṁ / 决策弹窗能量预算 / 宇宙年龄进度条 / 光变曲线相位同步标记 |
| 性能 | UI/DOM 重建由 60Hz 限流至 8Hz |

## 局限性 / Limitations

本作采用**参数化简化模型**,量级正确、公式可溯源、细节简化处全部在游戏内"知识卡 → 关于本作物理模型"明示:
- 单星演化用多项式拟合(不求解结构方程组),细节如蓝回绕、热脉冲省略
- RLOF 速率放慢到可视化量级(实际为热时标 10³–10⁴ 年,本作可视化需要)
- 共有包层 λ 取值偏乐观(含复合能近似),部分抛射是研究前沿的玩具化实现
- 超新星默认无踢(可选小踢)
- CV 周期演化是指数简化模型

适合作为**入门与教学辅助**,精确科学研究请使用 MESA / BSE 等专业代码。

## 许可 / License

[MIT](./LICENSE) — 欢迎教学与研究使用。

## 致谢 / Acknowledgements

- 韩占文《恒星物理的发展》(《物理》2025 第 2 期)
- Kippenhahn, Weigert & Weiss, *Stellar Structure and Evolution*
- 黄润乾《恒星物理》
- Han, Ge, Chen et al. RAA 2020, 20, 161(双星演化综述)
- Eggleton 1983(洛希瓣);Peters 1964(引力波并合时标)

## 贡献 / Contributing

Issues 与 PR 欢迎。开发约定:
- 不引入构建工具/框架依赖(保持零依赖纯前端)
- 修改物理逻辑后请运行 `node test/smoke.test.mjs` 确认 52 项断言全通过
- 决策点 / 关卡参数改动请同步更新 `DESIGN.md`
