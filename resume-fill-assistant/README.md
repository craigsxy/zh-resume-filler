# resume-fill-assistant · 简历一键填充助手

> 本仓库源自 [millie-ni/resume-fill-assistant](https://github.com/millie-ni/resume-fill-assistant)，原作者 millie-ni，保留完整提交历史。原仓库未声明开源许可证，版权归原作者所有。

Chrome Manifest V3 扩展：本地管理求职资料，按「语义槽」绑定网申字段、按控件类型适配写入。无法匹配的选项自动跳过，不写脏值、不自动提交。

不绑定某一家网申系统：区块、标签、控件类型都是通用识别，已按真机结构验证过北森（Phoenix）、
图谱 tupu360（Ant Design Vue，辉瑞校招等）的页面形态，antd / Element / iView 一类组件库的下拉、日期、单选都走同一套适配器。

## 功能

- 资料仅保存在本机浏览器（`chrome.storage.local`），不上传云端
- 资料库 18 个分类 / 241 个字段（个人信息、求职意向、教育、实习、项目、校园、工作、社会实践、技能、证书、外语、家庭、获奖、专利、论文、培训…），每个分类还能加自定义字段
- 多份简历随时切换（不限数量），导入 / 导出 JSON，完成度统计，投递记录
- 派生字段自动补：年龄、毕业院校/专业/时间、起止时间、证书认证；工作经历为空时自动用实习经历填
- 可选 AI 善后（自带 API Key，OpenRouter / DeepSeek 等 OpenAI 兼容接口）：规则认不出的标签、对不上的下拉交给模型；敏感字段永不外发
- 网页悬浮按钮：一键填写 / 选区填写；求职进度（状态 + 日程 + CSV 导出）；未补齐清单
- 多段经历（教育 / 实习 / 在校职务 / 在校实践…）自动「添加」出第 n 段
- 日期按网页能力自动降级（先试年月日，网页只收年月就写年月）
- 枚举字段做选项适配，覆盖虚拟滚动列表、级联选择、年月选择器、可编辑下拉等真机形态
- 卡片式录入：多段经历「添加 → 编辑卡 → 确认」自动走完，已保存的只读卡片不会被重复添加
- 整句问题当标签（「是否服从岗位调剂」「你是从哪个渠道获取招聘信息的」）：没有内置字段的，用自定义字段照抄网页标签即可
- 简历附件 / 照片上传（原生文件控件）
- 收尾复核：防止站点写入后又二次清空（如身份证号）

## 加载方式

1. Chrome 打开 `chrome://extensions`
2. 右上角开启「开发者模式」
3. 「加载已解压的扩展程序」→ 选择本目录
4. 点工具栏图标打开侧边栏，填入资料后点「填写当前网页」

## 开发 / 构建

```bash
npm install        # 安装依赖（esbuild + jsdom）
npm run build      # 打包 src/ → content.bundle.js / panel.bundle.js
npm test           # 全量回归：selftest / dom-test / beisen / panel / tupu / ai / float
npm run watch      # 监听 src/ 改动自动重打包
```

改完 `src/` 里的源码后必须重新 `npm run build`，再回到扩展页点「刷新」，否则跑的还是旧包（侧边栏会显示版本号，先看它）。

## 目录结构

- `manifest.json` / `background.js` / `index.html` / `styles.css` / `icons/` —— 扩展骨架
- `src/` —— 源码：`content-entry.js`（内容脚本入口）、`panel/`（侧边栏）、`adapters/`（按控件类型分派的适配器）、`binder.js`（标签→语义槽绑定）、`fill.js`、`repeat.js`（多段扩充）、`cards.js`（卡片确认 / 已保存去重）…
- `content.bundle.js` / `panel.bundle.js` —— 构建产物（clone 后直接加载即可用）
- `main-world.js` —— 注入页面主世界、与内容脚本通信的桥
- `scripts/` —— 测试脚本（`site-replica.mjs` / `ym-replica.mjs` 是真机 DOM 结构复刻；`tupu-test.mjs` 用 `fixtures/` 里的真机快照做端到端；`tupu-probe.mjs` 打印扫描/绑定结果，适配新站点时先跑它）
- `docs/` —— 技术方案与测试说明
