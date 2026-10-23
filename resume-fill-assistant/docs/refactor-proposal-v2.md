# 网申填充助手 重构技术方案 v2

> 状态：待确认，未修改任何业务代码
> 依据：当前工作空间 `manifest.json` / `app.js` / `content.js` / `main-world.js` 的实际实现（v1.0.12）
> 目标：① 同名异义字段（教育 / 实习的开始结束时间等）能精确落到对应网页区块；② 资料库的自由文本值能适配网页上的选项控件

---

## 0. 结论先行

三个根因，按影响排序：

| # | 根因 | 直接后果 |
|---|---|---|
| R1 | 资料库所有分类、所有记录被**压平成一个全局值池**，字段名相同即冲突 | 「开始时间」「结束时间」「姓名」这类跨分类重名 key，多记录时**直接放弃**，一次都不会尝试填 |
| R2 | 页面侧**没有「区块 / 重复块」概念**，只有"字段 → 找标签 → 匹配" | 即使不冲突，也无法把「教育经历第 2 条」对到网页「第 2 个教育块」 |
| R3 | 值适配只有两条路：字符重叠打分 + 小尺寸硬编码别名表；日期则以「文本里出现 y-m-d」为唯一成功口径 | 枚举类（学位 / 政治面貌 / 到岗时间）大量填不上；月粒度日期控件**即使填对了也判失败**并回滚 |

性别的成功不是特例，而是恰好同时具备三个条件：**字段身份唯一**（全库只有一个"性别"）、**值是离散枚举且归一化了**、**提交动作是原生 `.click()` + 显式回读（`checked` / 行文本）**。
重构的核心就是把这三件事从"性别恰好有"变成"所有字段都有"。

---

## 1. 现状机制拆解与证据

### 1.1 R1：全局扁平值池导致同名 key 必然放弃

`content.js` 中：

```js
function collect(profile) {            // L36-46
  for (const records of Object.values(profile || {}))     // 遍历所有分类
    for (const record of ...)                             // 遍历该分类所有记录
      for (const [key, value] of Object.entries(record))  // 所有字段直接 push
        values.push({ key, value });
}
```

`values` 里因此同时存在：

- `{key:'开始时间', value:'2021-08-01'}`（教育第 1 条）
- `{key:'开始时间', value:'2023-06-01'}`（教育第 2 条）
- `{key:'开始时间', value:'2025-11-10'}`（实习第 1 条）
- …

再看 `bestMatch`（L56-62）：

```js
const ranked = values.map(...).filter(x => x.score >= 0.72).sort(...);
const tied = ranked.filter(x => Math.abs(x.score - ranked[0].score) < 0.05);
return new Set(tied.map(x => x.value)).size === 1 ? ranked[0] : null;
```

网页标签「开始时间」与三个同名 key 的得分都是 1.0，全部并列；值不唯一 → **返回 `null` → `skipped++`**。

**结论：目标 1 在当前数据模型下不是"填不准"，而是"根本不会触发填写"。**
同理，「姓名」在 `personal` 与 `family` 中重复，只要家庭情况填了人，个人信息里的姓名也会一起失效。

### 1.2 R2：没有 section / block，只有字段级向上爬 4 层

`groupLabelParts`（L862-874）从字段元素向上爬 4 层父级，取 `innerText` 去掉选项文字，**只接受长度 ≤ 24 字**的文本作为标签线索。

问题：

- 区块标题（如「教育经历」「实习经历」）通常与多个字段一起构成更长的文本，被 24 字上限切掉；
- 即使恰好取到「教育经历」，它在 `values` 里也没有对应的 key（资料库的 key 是字段名，不是分类名），匹配不到任何东西；
- 完全不存在"这是第几个教育块"的索引，因此无法做记录对齐。

### 1.3 标签匹配是字符重叠，不是语义

`score()`（L48-54）本质是字符交集比例 + 长度比，阈值 0.72。后果：

- 「学位」vs「学历」：交集 1 字 / 4 字 → 0.25，判不中；
- 「毕业时间」vs「结束时间」：交集 2 字 / 8 字 → 0.25，判不中；
- 「院校名称」vs「学校名称」可行，「公司名称」vs「单位名称」判不中；
- 反向误配：网页「实习开始时间」按 `includes` 命中 key「开始时间」，得 0.5+0.2=0.7，边缘；一旦阈值/长度变化就可能错配。

### 1.4 R3-a：枚举适配只有 10 条硬编码

`OPTION_ALIASES`（L79-90）覆盖：大专 / 本科 / 硕士 / 博士 / 高中 / 群众 / 团员 / 党员 / 预备党员 / 汉族。
`valueAliases`（L64-75）覆盖：女 / 男 / 是 / 否。

实际网申还需要、但当前无词表的：学位（学士 / 硕士 / 博士 / 无）、证件类型（身份证 / 护照 / 港澳通行证 / 台胞证）、婚姻状况、求职类型（全职 / 实习 / 兼职）、到岗时间、期望薪资（区间 / 面议）、获奖级别（国家 / 省 / 市 / 校 / 院）、语言证书（CET-4/6、TEM-4/8、IELTS、TOEFL、TOPIK、JLPT）、民族（55 个民族全称 vs 网页常写"汉"）、籍贯与户籍（省 / 市 / 区三级联动）。

另外 `uniqueOption` 用 `text.includes(target)` 给 0.9 高分，方向单一（选项包含值），无法处理"选项是缩写"的反向情况，也没有 canonical 概念，无法做严格的反向校验。

### 1.5 R3-b：日期填不上的四个叠加原因

1. **精度缺失**：资料库「开始时间」用 `input[type=date]`，实际存的是 `YYYY-MM-DD`；但网页上教育 / 实习的开始结束时间多为**年月粒度**控件。于是：
   - `parseDateParts`（L178-186）强制要求 `年-月-日` 三段，遇到 `2021-08` 直接 `null`；
   - `dateMatchesText`（L336-342）同样强制三段；
   - 结果：月粒度控件**永远无法通过校验**（校验函数本身不认 `2021-09` / `2021年9月`），填上了也判失败。
2. **动作策略不一致**：「日格」先原生 `.click()` 再 `reactClick`（L563-564），「年标签 / 月标签」却是 `reactClick` 优先（L373、L432）。同一站点内两套策略，失败点随机。
3. **面板定位靠猜类名**：`visibleCalendarPanels` 依赖 `class*="date|calendar|picker"` + 日格 ≥ 20；`pickYearInPanel` / `pickMonthInPanel` 是 Phoenix 专用逻辑（`phoenix-calendar-year-panel`、`*-select`、`prev-decade-btn`）。换一个组件库（antd / Element / 自研）就失效，且失败时只能靠 console 猜。
4. **固定 sleep 而非轮询**：全流程 `wait(120/180/250/300/350ms)` 硬等待，面板未渲染完就去找选项 → 偶发失败，且慢。

### 1.6 R3-c：没有 Vue 通道

`main-world.js` 只实现了 React fiber 侧（`__reactFiber$` / `__reactProps$` → `setFieldValue` / `onChange`）。国内大量网申用的是 Element UI / Element Plus（Vue），这类页面的自绘日期、级联、下拉无法走源码级改值，只能靠 UI 驱动，成功率明显低于 React 站。

### 1.7 没有回读与报告

`filledList` / `missed` 只 `console.log`；侧边栏只显示"已填写 N 个字段，跳过 M 个"。用户在页面上无法知道**哪个字段没填、为什么没填、填了什么值**。这也是迭代效率低的根因——每次适配都要开 F12 翻日志。

---

## 2. 重构总原则

1. **先建地图，再动手**：把页面一次性解析成结构化 `FormModel`（区块 / 块序号 / 字段 / 控件类型 / 选项），再规划填充，最后执行。禁止"边遍历边猜边填"。
2. **语义优先于字面**：网页标签 → 语义槽（slot），而不是直接匹配中文 key。槽是跨站稳定的，中文写法是不稳定的。
3. **离散化 + 可回读**：任何写入都必须有"值域（取值集合）"和"回读口径"；没有回读口径的写入不算成功。
4. **失败要显式**：宁可标记"待人工确认"，也不写脏值、不静默跳过。这是产品可用性的底线。
5. **通用策略打底，站点覆盖兜底**：不再为单一站点写死类名，Phoenix 这类特化降级为「站点适配档案」里的一条覆盖项。

---

## 3. 目标架构

### 3.1 分层

```
┌───────────────────────── 资料侧（侧边栏） ─────────────────────────┐
│ L0 数据契约  Profile v2：语义槽 slot + canonical 枚举 + 日期精度     │
│            profile-schema.js（CATEGORIES / ENUMS / SLOTS / 迁移）   │
└───────────────────────────────┬───────────────────────────────────┘
                                │ 结构化 profile（不再是扁平 key-value 池）
┌───────────────────────────────▼──────────── 页面侧（content）──────┐
│ L1 表单地图  form-model.js                                          │
│    Scan → Section(区块) → Block(重复块) → Field(label/kind/options)  │
│ L2 绑定器    binder.js                                              │
│    Section→分类  · Block↔Record（强键对齐） · Label→Slot            │
│ L3 适配器    adapters/*.js                                          │
│    write(field, value) → {ok, readback}；按 FieldKind 分派          │
│ L4 站点档案  site-profiles.js（host 级覆盖 + 用户手工修正写回）      │
│ L5 报告      report.js（每字段 stage/reason/readback → 侧边栏表格）  │
└───────────────────────────────┬───────────────────────────────────┘
                                │ DOM 属性 + CustomEvent 桥
┌───────────────────────────────▼───────────────────────────────────┐
│ 执行通道  main-world.js：React 模型读写 / Vue 实例读写 / 原生事件序列│
└───────────────────────────────────────────────────────────────────┘
```

### 3.2 L0：数据契约 Profile v2

**字段元数据**（替代现在只有 `['姓名','text']` 的二元组）：

```js
{ label:'开始时间', slot:'edu.start', kind:'date',
  precision:'month',            // year | month | day
  enumRef:null }
{ label:'学历',     slot:'edu.degreeLevel', kind:'enum', enumRef:'degreeLevel' }
{ label:'性别',     slot:'personal.gender',  kind:'enum', enumRef:'gender' }
```

**槽命名空间**（解决同名异义的根本）：

| 分类 | 槽前缀 | 示例 |
|---|---|---|
| 个人信息 | `personal.` | `personal.name` / `personal.gender` / `personal.birth` / `personal.politics` / `personal.ethnicity` / `personal.nativePlace` / `personal.hukou` |
| 求职意向 | `intent.` | `intent.position` / `intent.salary` / `intent.onboard` |
| 教育经历 | `edu.` | `edu.start` / `edu.end` / `edu.school` / `edu.degreeLevel` / `edu.degreeName` |
| 实习经历 | `exp.` | `exp.start` / `exp.end` / `exp.company` / `exp.location` |
| 在校职务 | `pos.` | `pos.start` / `pos.name` |
| 在校实践 | `prac.` | `prac.start` / `prac.project` |
| 获奖情况 | `award.` | `award.level` / `award.name` / `award.time` |
| 家庭情况 | `family.` | `family.name` / `family.relation` |

「开始时间」在页面上永远只有一种写法，但落到哪个槽由**所在区块**决定。这是 R1 + R2 的统一解法。

**日期值统一形状**：

```js
{ y:2021, m:8, d:1, precision:'month' }   // 序列化仍可存 'YYYY-MM-DD'，但精度显式携带
```

存储不变（仍写 `YYYY-MM-DD`，兼容老数据），**精度作为字段元数据**，由分类决定默认值，用户可改：

- `personal.birth` → `day`
- `edu/exp/pos/prac` 的 start/end → `month`
- `award.time` / `publications.发布时间` → `month`
- `intent.onboard` → `month`

> 这直接解决 1.5-①。月份粒度字段在网页上就是月选择器，校验也只校验到月，不再出现"填对了判失败"。

**枚举字典**（canonical code ↔ 同义词集合）：

```js
ENUMS.gender = { M:['男','男性','male','m'], F:['女','女性','female','f'], U:['保密','不愿透露'] };
ENUMS.degreeLevel = {
  HIGH_SCHOOL:['高中','高级中学'], VOCATIONAL:['中专','中职'],
  ASSOCIATE:['大专','专科','高职','大学专科'],
  BACHELOR:['本科','大学本科','学士'],
  MASTER:['硕士','研究生','硕士研究生'],
  DOCTOR:['博士','博士研究生']
};
ENUMS.degreeName = { NONE:['无'], BACHELOR:['学士'], MASTER:['硕士'], DOCTOR:['博士'] };
ENUMS.politics = { MASS:['群众','普通群众'], LEAGUE:['团员','共青团员'],
  PARTY:['党员','中共党员','共产党员'], PREP:['预备党员'],
  DEMOCRATIC:['民主党派'], OTHER:['其他'] };
ENUMS.docType  = { ID_CARD:['身份证','居民身份证'], PASSPORT:['护照'],
  HK_MO:['港澳通行证'], TW:['台胞证','台湾居民来往大陆通行证'], FOREIGN:['外国人永久居留证'] };
ENUMS.jobType  = { FULL:['全职','全日制'], INTERN:['实习'], PART:['兼职'] };
// ethnicity / certType / awardLevel 同理
```

> ⚠️ **本节已被 §9.2 修订**：经确认，输入形态保持文本框，不上受控下拉。ENUMS 字典仍保留，但角色从「UI 控件」降级为「匹配资产」，由运行时的 ValueResolver 消费。

### 3.3 L1：表单地图 form-model.js

输出结构：

```js
FormModel = [{
  title:'教育经历',            // 区块标题原文
  category:'education',        // 由标题词典判定
  container:Element,
  blocks:[{
    index:0,
    fields:[{
      el, label:'开始时间', kind:'DATE_MONTH',
      slotCandidates:['edu.start'],
      options:null,            // 或 [{label,value,el}]
      control:{ native:false, framework:'react', readonly:false }
    }]
  }]
}]
```

三步：

1. **找区块**：从每个候选字段向上聚合到字段容器（`form-item` / `tr` / `[class*=item]`），再聚合到"含标题的容器"。标题判定：区块内出现一个文本短（≤12 字）且在标题词典里的节点，或 `fieldset > legend` / `h2-h4` / `[class*=title]`。词典：

   `个人信息|基本信息|个人资料 → personal`；`求职意向|应聘意向|意向岗位 → intention`；`教育经历|教育背景|学习经历 → education`；`实习经历|工作经历|实习经验 → internships`；`项目经历|科研经历|实践经历 → practice`；`校园经历|在校职务|学生工作 → positions`；`获奖|荣誉|奖项 → awards`；`语言能力|外语水平 → languages`；`家庭情况|家庭成员 → family`；`论文|专著|发表 → publications`

2. **找重复块**：同一区块内的字段容器，按「标签序列签名」聚类（`labels.join('|')` 归一后哈希）。同签名且 ≥2 个 → 视为重复块，按 DOM 顺序编号。这比"找 repeater class"更稳，不依赖框架。

3. **识别控件类型 FieldKind**：先归一到 11 种抽象类型，再决定适配器：

| FieldKind | 判定线索 |
|---|---|
| `TEXT` / `TEXTAREA` / `NUMBER` | 原生 input / textarea |
| `DATE_NATIVE` | `input[type=date\|month]` |
| `SELECT_NATIVE` | `<select>` |
| `RADIO_GROUP` / `CHECKBOX_GROUP` | 原生 radio/checkbox 成组，或 `[role=radio]`/`[class*=radio]` 成组（性别走这条） |
| `SELECT_CUSTOM` | `role=combobox` / `aria-haspopup=listbox` / 点击后出现选项面板 |
| `DATE_CUSTOM` | 输入框 readonly 或点击后出现日历面板（含日格 / 年月网格 / 年月下拉） |
| `CASCADER` | 点击后出现多列面板（省 / 市 / 区） |
| `UPLOAD` | `input[type=file]` |
| `RICH_TEXT` | `contenteditable` |

### 3.4 L2：绑定器 binder.js —— 三层消歧

```
Layer A  区块 → 分类：标题词典 + 归一化字符串相似（阈值 0.8，唯一最优）
Layer B  块 ↔ 记录：强键对齐
Layer C  标签 → 槽：槽词典（同义词族）+ 区块分类约束（edu.* 只在该区块内生效）
```

**Layer B 强键对齐算法**（解决"第 2 条教育经历填到第 1 个块"）：

```
强键 = { education:['school','major'], internships:['company'],
         awards:['name'], positions:['name'], practice:['project'],
         languages:['name'] }

1. 若 M(块数) == 1 或 N(记录数) == 1 → 按序对齐
2. 否则对每个 (block j, record i) 求强键相似度均值 → 得分矩阵
3. 贪心取最大权配对；已配对的记录不可复用
4. 强键全空的块 → 按"剩余记录 + DOM 顺序"顺位补齐
5. N > M：只填前 M 条，剩余在报告里列为"页面无对应区块"
   M > N：多余块不动，报告里标注
```

**Layer C 槽匹配**不再用字符重叠，改为：

1. 精确命中槽词典（「开始时间 / 起始时间 / 开始日期 / 入职时间」→ `*.start`，由区块决定前缀；
   「毕业时间 / 结束时间 / 离职时间」→ `*.end`）
2. 词典未命中 → 归一化后做 token 级相似（Dice 系数），阈值 0.75，且必须"唯一最优 + 领先第二名 ≥ 0.1"
3. 仍不确定 → **不填**，报告 `reason:'label-uncertain'`，并把候选槽列出来

### 3.5 L3：适配器契约

统一接口，每种 FieldKind 一个文件：

```js
adapter = {
  canHandle(field) -> boolean,
  write(field, value) -> { ok:boolean, readback:any, stage:'commit'|'verify', reason?:string }
}
```

| FieldKind | 写入动作 | 回读口径 |
|---|---|---|
| `TEXT` / `TEXTAREA` / `NUMBER` | 原生 setter + `input`/`change`/`blur` | `el.value` |
| `SELECT_NATIVE` | `setValue(sel, option.value)` | `el.value` + 选中项文本 |
| `RADIO_GROUP` | **原生 `.click()`**（性别的成功路径，保持不变） | `checked` / 组内选中项文本 |
| `SELECT_CUSTOM` | 打开 → **键入搜索过滤** → 点中 → 必要时点「确定」；优先 `optionValueOf` 取真实 value 走源码级改值 | 触发器显示文本 + 组件模型值 |
| `DATE_CUSTOM` | 见 §4 降级链 | 按 precision 双读 |
| `CASCADER` | 按级取值逐列点选，支持"只到市" | 各级显示文本 |
| `UPLOAD` | `DataTransfer`（现有逻辑可直接复用） | `files.length` |

**动作策略统一**（修正 1.5-②）：所有点击按固定顺序尝试，任一步成功即停并回读：
`原生 el.click()` → 完整指针/鼠标序列（pointerdown→mousedown→pointerup→mouseup→click）→ 框架 handler 直调（React props / Vue `$emit`）。

**枚举值匹配统一**（目标 2）：

```
canonical = 资料库值 → ENUMS 反查
候选比较：
  ① 选项文本归一后 === 任一 canonical 同义词      → 1.0
  ② 选项文本归一后包含 canonical 同义词（带修饰括注） → 0.95（如「本科」⊂「本科（全日制）」）
  ③ 同义词包含选项文本（选项是缩写，如「汉」⊂「汉族」） → 0.9
  ④ token Dice                                           → 取分值
取最高分；若最高分 < 0.8，或第二名与第一名差 < 0.05 且文本不同 → 不填，报告 'option-ambiguous'
写入后回读选中项文本 → 反查回 canonical → 与目标 canonical 严格比对
```

第 ④ 步的**反向校验**是关键改进：现在的实现只比"文本包含"，无法发现「本科（专升本）」被误认为「本科」；反查后能确定到底命中了哪个 canonical。

### 3.6 L4：站点适配档案

```js
SITE_PROFILES['example.com'] = {
  fingerprint: { framework:'react', ui:'phoenix' },
  datePanel: { type:'rc-calendar', yearPanelClass:'phoenix-calendar-year-panel' },
  slotOverrides: { '单位':'exp.company', '毕业院校':'edu.school' },
  enumOverrides: { degreeLevel: { BACHELOR:'本科（统招）' } },
  kindOverrides: { '[data-field=gender]':'RADIO_GROUP' }
};
```

优先级：**用户手工修正 > 站点档案 > 通用策略**。
用户在侧边栏对某字段点"改填为…"后写回该 host 的档案，下次自动生效。这是"越用越准"的最小闭环，也是你后续迭代不用再开 F12 的抓手。

### 3.7 L5：填充报告

每次填充产出结构化结果，侧边栏以表格展示：

```js
{ section:'教育经历', block:1, label:'开始时间', slot:'edu.start',
  value:'2021-08', kind:'DATE_MONTH',
  ok:false, stage:'verify', reason:'panel-not-found', readback:'请选择' }
```

分组展示：**已填 / 未填（带原因） / 需人工确认（歧义）**。用户一眼能定位问题，你也能拿到可复现的失败现场。

---

## 4. 关键专题：日期控件（最痛的点）

### 4.1 精度模型是前提

| 资料库字段 | precision | 网页常见控件 |
|---|---|---|
| 出生日期 | day | 年月日选择器 |
| 教育 / 实习 / 职务 / 实践 起止 | month | 年月选择器（`YYYY-MM`） |
| 获奖时间 / 发布时间 | month | 年月选择器 |
| 到岗时间 | month | 年月选择器 |

校验函数改为精度感知：

```js
match(value, target) =
  precision==='year'  ? value.y === target.y
: precision==='month' ? value.y===target.y && value.m===target.m
:                       value.y===target.y && value.m===target.m && value.d===target.d
```

解析器同时接受：`YYYY-MM-DD` / `YYYY-MM` / `YYYY/M/D` / `YYYY年M月D日` / `YYYY.MM` / `MM/YYYY`。

### 4.2 五级降级链

```
L1 原生控件直写
   input[type=date|month] → setValue；三个原生 <select>(年/月/日) → 逐级 setValue
   ↓ 失败
L2 框架模型写值
   React：沿 fiber 找 setFieldValue / setValue / onChange / onSelect
   Vue  ：沿 __vueParentComponent / __vue__ 找 emit('update:modelValue'|'input') 或直接改 data
   类型构造：克隆现有值对象改年/月/日（moment/dayjs）→ 新 Date → ISO 字符串
   ↓ 失败
L3 面板驱动（能力探测，不猜类名）
   打开面板 → probePanel() 得到能力集 → 按能力选动作序列
   ↓ 失败
L4 键入兜底
   写文本 + keydown Enter + blur；键盘序列（PageUp/PageDown 切月、方向键切日）
   ↓ 失败
L5 放弃 + 报告（回滚原值，绝不写脏值）
```

### 4.3 L3 的能力探测

```js
probePanel(root) -> {
  hasNativeSelect: boolean,     // 内部有年/月/日 <select>
  hasYearGrid, hasMonthGrid, hasDayGrid,
  hasSearchInput,               // 面板内可键入搜索
  hasNavPrevNext,
  view: { y, m }                // 当前视图年月（多格式解析）
}
```

动作决策：
- `hasNativeSelect` → 按选项数值范围分类年/月/日（现有 `classifySelect` 思路保留，扩到月粒度）后 `setValue`
- `hasYearGrid` → 点年标签进入年网格 → 翻页到目标十年 → 点目标年（现有 `pickYearInPanel` 保留，但类名从"硬编码"降级为"档案覆盖项"，通用路径用能力探测 + 叶子数字范围）
- `hasMonthGrid` → 点月标签 → 点目标月
- `hasDayGrid` → **必须先校验 `view.y/m === target`** 再点日格（现有这个保护是对的，保留）
- `hasNavPrevNext` → 翻页兜底（现有逻辑保留，含"连续无反应即停"的熔断）
- `hasSearchInput` → 键入目标值过滤后点选

月粒度控件只走到 month 层就结束，**不点日格**——这是现在既做不到、又会因校验失败而回滚的地方。

### 4.4 为什么这样能解决"日期填不上"

| 现象 | 当前原因 | 新方案对应 |
|---|---|---|
| 多记录时开始时间完全不动 | 值池冲突，`bestMatch` 返回 null | 槽 + 区块绑定，值唯一化（§3.4） |
| 单条记录也填不上 | 面板探测靠类名，非 Phoenix 组件失败 | 能力探测（§4.3） |
| 明明选了却报未填 | 校验只认 y-m-d，月粒度必失败 | 精度感知校验（§4.1） |
| 年份错乱（2005 → 2065） | 掩码输入框裸写 | 保持"日历驱动优先、裸写最末、失败回滚" |
| 偶发失败 | 固定 sleep | 改为轮询 / MutationObserver 等条件成立（≤800ms） |

---

## 5. 文件级改造清单

| 文件 | 改动 | 说明 |
|---|---|---|
| `profile-schema.js` | **新增** | CATEGORIES（含 slot/precision/enumRef）、ENUMS、SLOTS 词典、v1→v2 迁移函数 |
| `app.js` | 改动 | 读 schema；枚举字段渲染为下拉；日期字段加精度选择；新增"填充报告"面板；`load()` 前执行迁移（迁移前备份 v1 到 `resumeProfile_v1_backup`） |
| `form-model.js` | **新增** | 扫描 → Section / Block / Field / FieldKind |
| `binder.js` | **新增** | 三层消歧 + 强键对齐 + 槽匹配 |
| `adapters/*.js` | **新增** | text / select-native / select-custom / radio / date / cascader / upload |
| `site-profiles.js` | **新增** | host 级覆盖读写（`chrome.storage.local`，key: `siteProfile:<host>`） |
| `report.js` | **新增** | 结果汇总 + 侧边栏渲染 |
| `content.js` | **瘦身** | 只做编排：`scan → bind → plan → execute → report`，删除内联的匹配 / 日期 / 下拉逻辑（约可减 60%） |
| `main-world.js` | 改动 | 加 Vue 通道（`__vueParentComponent` / `__vue__` 的 model 读写）；`readModel(el)` 统一回读入口（React/Vue/native 三选一） |
| `manifest.json` | 改动 | 版本 2.0.0；content script 前置注入 schema / adapters |

**工程化决策**：文件从 4 个变成 10+ 个，MV3 content script 没有模块系统。两条路——
- A（推荐）：引入 esbuild，`npm run build` 打成单个 `content.bundle.js`，源码保留多文件、可维护；
- B（零构建）：用 `<script>` 顺序注入 + `window.__SAA` 命名空间。可行，但依赖顺序脆弱。

---

## 6. 分阶段落地与验收

### P0 · 打通目标 1（同名异义 + 日期精度）
Profile v2 元数据与迁移、form-model 的 Section/Block、binder 强键对齐、日期 precision 全链路、报告最小版。

**验收**：目标网站上，2 条教育经历 + 2 条实习经历的开始/结束时间，逐个落到正确区块，值正确，报告零"歧义"。

### P1 · 打通目标 2（枚举适配）
ENUMS 字典、ValueResolver（文本 → canonical）、适配器契约重构（select-native / select-custom / radio 统一）、双向匹配 + 反向校验、选项回传闭环。
（原「枚举字段改受控下拉」已废弃，见 §9.2）

**验收**：学历 / 学位 / 政治面貌 / 民族 / 证件类型 / 求职类型 / 获奖级别 / 语言证书 8 类枚举，在目标站点填中率 ≥ 90%，且**零错填**（错填比不填更糟）。

### P2 · 稳定性与复用
日期面板能力探测、Vue 通道、轮询替代固定 sleep、站点档案 + 用户修正写回。

**验收**：新增 2 个不同技术栈（React+antd / Vue+Element）的站点，不改代码只加 site profile 即可跑通。

### P3 · 诊断闭环
失败字段快照（outerHTML 摘要 + fiber/vue 组件名 + 阶段日志）一键导出，替代现在的 `fiber-probe.js` 手工粘贴。

---

## 7. 风险与边界

| 风险 | 处理 |
|---|---|
| Profile v2 迁移不可逆 | 迁移前整份备份到 `resumeProfile_v1_backup`；迁移幂等（带 `schemaVersion`） |
| 枚举字段改下拉会让老用户"找不到自己填的值" | 迁移时把无法映射的自由文本保留为"自定义值"选项，不丢数据 |
| 站点校验 `isTrusted` | 无解，只能报"需手动确认"，不硬闯 |
| 通用化永远覆盖不全 | 接受"显式失败 + 可修正"，不做"猜着填" |
| 过度抽象 | 先只用 2–3 个真实目标站验证，抽象只保留被 2 个以上站点需要的 |

---

## 8. 需要你决策的 4 件事

1. **Profile v2 迁移**：是否接受"字段元数据升级 + 老数据自动迁移（含备份）"？这是解决目标 1 的前提。
2. **枚举字段改下拉**：侧边栏里性别 / 学历 / 学位 / 政治面貌等改成受控下拉，是否接受？不改的话目标 2 只能做到"尽量猜"。
3. **构建方式**：引入 esbuild（源码多文件、产物单文件）还是坚持零构建多文件注入？
4. **目标站点**：具体是哪几个网申系统（北森 / 用友 / 自研 / Moka…）？这决定适配器优先级和能不能拿到真实 DOM 采样。**在没有真实 DOM 的情况下，本方案的 L3/L4 只能给通用策略，适配精度要等采样后校准。**

---

## 附：不做的事

- 不自动提交表单（保持现状）。
- 不做云端同步 / 不上传任何资料（保持现状）。
- 不为"填不上的字段"做 AI 猜测式填充——错填的代价高于不填。

---

# 第二部分 · 决策记录与方案修订（2026-10-22）

## 9. 四项决策的确认结果

| # | 议题 | 结论 | 对方案的影响 |
|---|---|---|---|
| 1 | Profile v2 迁移 | ✅ 接受 | 按 §3.2 执行，迁移前备份 `resumeProfile_v1_backup`，带 `schemaVersion` 幂等 |
| 2 | 枚举字段是否改受控下拉 | ❌ 不改，保留文本框 | **§3.2 的 UI 部分作废**，改为 §9.2 的「文本输入 + 运行时值解析」；ENUMS 字典保留为匹配资产 |
| 3 | 构建方式（esbuild） | ⏳ 待定，见 §11 | 不阻塞 P0 设计，但决定 P0 的目录结构 |
| 4 | 目标站点 | ✅ 北森（`*.zhiye.com`）+ Moka（`*.mokahr.com`） | 见 §10，适配器优先级与验收用例据此重排 |

---

## 9.1 「受控下拉」是什么，以及为什么你的方案可行但需要补偿

**受控下拉**：插件侧字段的 UI 本身就是一个 `<select>`，用户只能从我们预定义的选项里挑一个，存进 `chrome.storage` 的不是"本科"这三个字，而是一个稳定代号 `BACHELOR`。

| | 受控下拉（原方案） | 文本框 + 运行时解析（你的方案） |
|---|---|---|
| 存进 storage 的 | `BACHELOR`（唯一代号） | `本科`（自由文本） |
| 用户能输入 | 只能选，不能自由写 | 想写什么写什么 |
| 网页选项是「大学本科」 | 代号不变，映射层换成"大学本科"就行 | 靠文本相似度去猜 |
| 网页选项是「本科（专升本）」 | 能区分（代号不同） | **可能误判成"本科"** |
| 用户写错成"本科学历" | 不可能发生 | 需要模糊兜底 |
| 新增一个网页新写法 | 改一行映射表 | 可能要调词典 |
| 「期望薪资」网页要两个框 | 下拉表达不了 | 自由文本天然能表达 |

**结论：你的方案在通用性上确实更强**（尤其非枚举字段），但它放弃了两样东西——**唯一代号**和**输入时校验**。这两样是"零错填"的保障。所以采纳你的形态，但必须补两个机制：

1. **ValueResolver**：把自由文本解析成代号（解析不到就标记 `unparsed`，不硬猜）；
2. **反向回读 + 选项回传**：写入后读回网页选中的是哪个选项，反解回代号与目标比对；不一致就回滚，并把**网页真实选项列表**回传到侧边栏，让你改一次文本、写进站点档案，下次自动生效。

没有第 2 条，自由文本方案会长期停在"要么填不上、要么填错且不知道"——这是它唯一的致命短板。

## 9.2 修订后的目标 2 实现路径

你的原始描述「先判断对应字段是填写/选择，再去做选项适配」——这个思路和架构完全一致，就是 L1 的 FieldKind 判定 + L3 的适配器分派。完整链路：

```
① 判定控件类型 FieldKind
   静态判定（零副作用）：tagName / type / role / aria-haspopup / readOnly / 关联图标 class / placeholder
   ↓ 静态不确定时才做
   动态探测（一次）：点一下 → 300ms 内扫面板结构 → Esc + 点空白关闭
   ↓ 探测结果写回站点档案缓存（同 host 同标签不再二次探测）
② 若为「选择类」：读取该控件的真实选项集 options[] = [{label, value}]
③ ValueResolver：用户文本 → { code, confidence }
   L0 归一后 === 某代号同义词           → 1.00
   L1 同义词 ⊂ 文本 / 文本 ⊂ 同义词      → 0.90
   L2 数值与单位抽取（3.6/4.0→3.6；15k-20k→[15000,20000]；2021年9月→{y,m}）
   L3 模糊 Dice ≥ 0.75 且唯一最优领先 ≥ 0.1 → 0.75~0.90
   L4 解析失败 → unparsed（不猜）
④ 双向匹配（code × options）
   正向：同义词 → 选项文本；反向：选项文本 → 同义词（处理「汉」⊂「汉族」）
   取较高分；要求唯一最优，否则 option-ambiguous
⑤ 写入 → 回读选中项文本 → 反解回 code → 与目标 code 严格比对
⑥ 不一致：回滚 + 报告中带 availableOptions
```

**置信度分层在报告里的呈现**：`已填（高置信）` / `已填（低置信，请核对）` / `未填（选项无匹配）` / `未填（选项歧义）` / `未填（标签不确定）`。
低置信必须显式暴露，不能计入"已填 N 个"里混过去。

**关于性能**：动态探测只在静态判定不确定时触发，且结果按 `host + 归一化标签` 缓存到站点档案，因此每个站点的探测成本是一次性的，不是每次填充都付。

---

## 10. 目标站点适配计划（北森 / Moka）

### 10.1 北森 · `*.zhiye.com`（iTalent 校招网申）

- 已核实：北森校招网申入口为 `https://<企业>.zhiye.com/campus/jobs` 这一类路径（来源：北森 2027 校招公告页）。
- 现有 `content.js` 里已有 `phoenix-calendar-year-panel`、`prev-decade-btn`、`*-select` 等类名，说明当前适配对象就是北森自研的 **Phoenix 组件库**（依据：你代码中的实际类名，非外部资料）。
- 据此推断（**需采样验证**）：日期为「年网格 → 月网格 → 日格」的多层面板；下拉为 `div` + 浮层而非原生 `select`。
- 适配重点：
  1. `DATE_CUSTOM` 走能力探测，Phoenix 的年/月面板结构从"硬编码"降级为站点档案里的覆盖项；
  2. 下拉优先用现有 `optionValueOf` 取真实 value，走 React 源码级改值（这条能力已经跑通，直接复用）；
  3. 你现有代码里的 React fiber 桥说明北森侧是 React，`main-world.js` 无需大改。

### 10.2 Moka · `*.mokahr.com`

- 已核实：Moka 前端为 **React + TypeScript** 技术栈（来源：Moka 官方招聘贴，含 React16/Redux/TS 表述）。
- **关键差异：分步长表单**。Moka 校招投递是分步表单，非当前步骤的字段可能不在 DOM、或存在但不可见。这直接推翻原方案 L1「整页一次扫描」的假设，必须改为：
  - **只扫描可见区块**（`getBoundingClientRect().height > 0` + 祖先 `display/visibility` 检查）；
  - **分步执行**：每次「填写当前网页」只填当前可见步骤，报告里标注「本页共 N 步，已填第 k 步」；
  - 步骤切换后自动重扫（MutationObserver 监听容器替换），可选「连续填写到末步」，但**绝不自动提交**。
- 字段线索差异（需采样验证）：Moka 的表单 label 不一定在 `label[for]`，可能在兄弟节点或 placeholder，`labelParts` 的采集范围要扩。

### 10.3 适配器优先级（据此重排）

| 优先级 | 适配器 | 理由 |
|---|---|---|
| P0 | `TEXT` / `TEXTAREA` / `NUMBER` | 两个站点都占大头，且现有能力已基本可用 |
| P0 | `DATE_CUSTOM`（年月精度） | 教育/实习起止是刚需，也是当前最大失败点 |
| P1 | `SELECT_CUSTOM`（含搜索型） | 学历/学位/民族等全走这条 |
| P1 | `RADIO_GROUP` | 性别已验证可用，抽成标准适配器即可 |
| P2 | `CASCADER` | 籍贯/户籍，北森更常见 |
| P2 | `UPLOAD` | 现有 `DataTransfer` 逻辑可直接搬 |
| P3 | `RICH_TEXT` | 出现频率低 |

> **前置依赖**：`DATE_CUSTOM` 和 `SELECT_CUSTOM` 的具体选择器策略必须基于真实 DOM 采样。请提供北森、Moka 各一条网申表单 URL（脱敏即可，或在两个站点上跑一次 `fiber-probe.js` 把输出贴给我）。没有采样，我只能给通用能力探测，无法保证一次跑通——这一点我不做乐观承诺。

---

## 11. 构建方式（esbuild）通俗解释

**问题背景**：Chrome 扩展的 content script **没有模块系统**，你写不了 `import x from './binder.js'`。扩展注入脚本的方式是给一个文件列表，按顺序当成普通脚本执行，它们共享同一个全局作用域。

重构后文件会从 4 个变成 12 个左右（`profile-schema` / `form-model` / `binder` / `adapters×7` / `report` / `site-profiles` / `content`）。于是有两条路：

| | A · 零构建 | B · esbuild 打包 |
|---|---|---|
| 怎么写 | 12 个文件按依赖顺序列在 manifest / `executeScript` 的 `files` 数组里 | 源码写成 ES Module，`npx esbuild src/content/index.js --bundle --outfile=content.bundle.js` |
| 扩展加载几个文件 | 12 个 | **1 个** |
| 传值方式 | 靠 `window.__SAA` 全局命名空间手动挂 | 正常 `import` / `export` |
| 顺序写错会怎样 | **静默 undefined**，表单填一半没反应，极难排查 | 不存在这个问题（打包器解析依赖） |
| 开发体验 | 改一个文件直接刷新扩展 | 改完跑一条命令（或 `--watch` 自动重建） |
| 额外成本 | 0 | 一个 build 脚本 + 一条 npm 命令，约 10 分钟 |

**我的建议：选 B。** 理由很具体——不是"更现代"，而是 A 方案在 12 个文件规模下，"注入顺序错一个 → 静默失败"会成为你日常最烦的坑，而你现在的调试手段（F12 看 console）恰恰对这类错误最不敏感。B 的代价只是多一条命令。

**B 的一个注意点**：`chrome.scripting.executeScript` 注入的是**打包产物**，所以改源码后必须先 build，仓库里要提交 `content.bundle.js`（Edge/Chrome 加载"已解压扩展"读的是产物文件，不是源码）。

**如果你选 A**：我会用 IIFE 包裹每个文件 + 显式挂 `window.__SAA.<module>`，并把注入顺序写在 manifest 注释和一份 `INJECT_ORDER.md` 里，风险可控但不优雅。

---

## 12. 待你确认的最后一项

只剩 **§11 的 A / B 选择**。你回复 A 或 B 之后，我按以下顺序动手（不再改方案）：

1. 建 `profile-schema.js`（含 v1→v2 迁移 + 备份）
2. 建 `form-model.js`（Section / Block / Field / FieldKind）
3. 建 `binder.js`（槽映射 + 强键对齐）
4. 改造 `content.js` 为编排层
5. 建 `adapters/date.js` + `adapters/select.js`（P0 两个核心）
6. 报告最小版接入侧边栏

第 5 步之后需要你在北森/Moka 上实测一轮，用真实失败样本校准选择器。

---

# 第三部分 · 实施结果（2026-10-22 已落地）

## 13. 交付内容

构建方式按你的选择采用 **B（esbuild 打包）**；并新增一条硬规则：**选项无法匹配就自动跳过**，不点、不写、不改网页原值。

| 层 | 文件 | 状态 |
|---|---|---|
| L0 契约 | `src/schema.js` | ✅ 12 分类 / 76 字段 / 全部带语义槽 / 19 类 canonical 枚举 / 8 类强键 |
| L0 迁移 | `src/panel/index.js` | ✅ 自动迁移 + `resumeProfile_v1_backup` 备份，字段名零改动 |
| L1 地图 | `src/form-model.js` | ✅ 区块 / 重复块（标签签名聚类）/ 11 种 FieldKind / 静态判定 |
| L2 绑定 | `src/binder.js` | ✅ 区块→分类、强键对齐（贪心最大权）、标签→槽（精确命中优先 + 起止冲突守卫）、跨区块全局唯一回退 |
| L3 适配 | `src/adapters/*` | ✅ text / radio / select-native / select-custom / date / upload |
| L3 日期 | `src/adapters/date.js` | ✅ 精度模型 + 五级降级（原生 → 框架模型 → 面板能力探测 → 键入 → 回滚跳过） |
| L4 通道 | `main-world.js` | ✅ 新增 Vue3/Vue2 写值与统一 `readModel` 回读 |
| L5 报告 | `src/panel/index.js` + `styles.css` | ✅ 五态分类表格 + 网页真实选项回传 + 复制诊断 |
| 工具链 | `build.mjs` / `package.json` | ✅ `npm run build` / `watch` / `test` |

## 14. 验证情况（诚实口径）

| 测试 | 覆盖 | 结果 |
|---|---|---|
| `scripts/selftest.mjs` | 槽名唯一性、同名异义（开始/结束 × 教育/实习/职务）、形近字段（学历/学位、专业/专业人数）、19 个枚举解析、选项匹配与跳过规则、日期解析与精度 | **37/37 通过** |
| `scripts/dom-test.mjs` | jsdom 仿真页：区块识别、重复块识别、控件类型识别、块↔记录强键对齐（含网页顺序与资料反序）、真实写入（姓名/性别/学历/日期键入）、只读日期无面板时跳过且不留脏值 | **27/27 通过** |

**未验证的部分（必须说明）**：北森 / Moka 的真实 DOM。日期面板与自绘下拉的选择器策略是通用能力探测 + Phoenix 类名特征，**没有真实样本校准**。失败时会落到「已跳过（面板没打开）」，不会错填，但填中率目前无法承诺。

## 15. 实施中发现并修正的三个设计缺口

1. **`matchSlot` 的 0.06 边缘差被浮点误差击穿**：`1 - 0.9400000000000001 = 0.0599…` 小于阈值，导致「专业」被「专业人数」的包含匹配拖成歧义。改为**归一后完全相等 = 决定性证据，不再看领先幅度**。
2. **「学历/学位」常被放在基本信息区块**：纯粹的分类内约束会漏掉。加了**受控跨区块回退**——仅当该标签在全局唯一时才回退，且值从属分类的记录里取。因此「学历」能回退到 `edu.degreeLevel`，而「姓名」（personal 与 family 重复）仍然会被跳过。
3. **容器内多个 select 会被误当成「年月日」三元组**：加日期标签守卫（`时间|日期|年月|出生|生日|入职|毕业`），并让非日期字段落到日期控件时**一律不当日期写**，避免把年份写进「籍贯」这类两级下拉。
