// 下拉适配器：原生 select + 自绘下拉（含可搜索型）
// 硬规则：选项匹配不上或存在歧义 → 自动跳过，不点、不填、不改网页已有值

import { clickEl, fire, isVisible, shortText, sleep, waitFor, setNativeValue, normalize, tagOf } from '../util.js';
import { matchOption, sameOption, primaryValue } from '../resolver.js';

/** 面板没打开时，把"看起来可能是面板"的可见节点报出来，便于按站点补选择器 */
function panelHints() {
  try {
    const SEL =
      '[class*="dropdown"],[class*="panel"],[class*="menu"],[class*="popup"],[class*="layer"],[class*="overlay"],[role="listbox"],[class*="portal"]';
    return [...new Set([...document.querySelectorAll(SEL)].filter(isVisible).map(el => tagOf(el)))].slice(0, 8);
  } catch (_) {
    return [];
  }
}

const PANEL_SEL = [
  '[role="listbox"]',
  '[class*="dropdown"]',
  '[class*="DropDown"]',
  '[class*="popover"]',
  '[class*="Popover"]',
  '[class*="popper"]',
  '[class*="select-menu"]',
  '[class*="option-list"]',
  '[class*="options"]',
  '[class*="panel"]',
  '[class*="Panel"]',
  '[class*="menu"]',
  '[class*="Menu"]',
  // 北森 Phoenix 的浮层 portal 容器（真机里籍贯/民族的下拉都挂在这上面）。
  // 只认根节点：`phoenix-unmodeled-layer__inner/__protect/__content` 都是它的内层。
  '[class*="unmodeled-layer"]:not([class*="__"])',
  '[class*="unmodeled"]:not([class*="__"])',
].join(',');

const OPTION_SEL = '[role="option"],li,[class*="option"],[class*="Option"]';

/** 当前页面上"像选项"的可见叶子节点，用于点击前后做差集 */
export function collectOptionLeaves(trigger) {
  let all = [];
  try {
    all = [...document.querySelectorAll(OPTION_SEL)];
  } catch (_) {
    return [];
  }
  return all.filter(el => {
    if (!isVisible(el)) return false;
    if (trigger && (trigger.contains(el) || el.contains(trigger))) return false;
    if (el.querySelector(OPTION_SEL)) return false;
    const t = shortText(el, 40);
    return !!t && [...t].length <= 40;
  });
}

/**
 * 兜底候选集：所有"短文本叶子节点"
 * 有的组件库选项节点既没有 role 也不带 option 类名（就一个 div），
 * 只靠 OPTION_SEL 会完全看不见面板。
 */
function collectTextLeaves(trigger) {
  let all = [];
  try {
    all = [...document.querySelectorAll('div,span,li,a,p,dd,dt')];
  } catch (_) {
    return [];
  }
  const out = [];
  for (const el of all) {
    if (el.children.length) continue;
    const t = String(el.textContent || '').trim();
    if (!t || [...t].length > 40) continue;
    if (trigger && (trigger.contains(el) || el.contains(trigger))) continue;
    if (!isVisible(el)) continue;
    out.push(el);
  }
  return out;
}

/** 点击前快照：先试便宜的（类名带 option），类名靠不住时改用全量短文本叶子 */
function snapshotCandidates(trigger) {
  const cheap = collectOptionLeaves(trigger);
  if (cheap.length >= 3) return { set: new Set(cheap), broad: false, trigger };
  return { set: new Set(collectTextLeaves(trigger)), broad: true, trigger };
}

/** 一批选项叶子的共同容器 = 下拉面板（不依赖类名，什么组件库都能兜住） */
function panelAround(leaves) {
  const tally = new Map();
  for (const leaf of leaves) {
    let n = leaf.parentElement;
    let d = 0;
    while (n && n !== document.body && d < 5) {
      const c = leaves.filter(x => n.contains(x)).length;
      if (c >= 2) {
        tally.set(n, Math.max(tally.get(n) || 0, c));
        break;
      }
      n = n.parentElement;
      d++;
    }
  }
  let best = null;
  let bestN = 0;
  for (const [n, c] of tally) {
    if (c > bestN) {
      best = n;
      bestN = c;
    }
  }
  return best;
}

export function collectNativeOptions(sel) {
  return [...sel.options].map(o => ({
    label: String(o.textContent || '').trim(),
    value: o.value,
    el: o,
  }));
}

export async function writeSelectNative(plan) {
  const sel = plan.field.el;
  if (!sel || sel.tagName !== 'SELECT') return { status: 'failed', reason: 'not-select' };
  const options = collectNativeOptions(sel);
  const m = matchOption(plan.resolved, options);
  if (!m.ok) {
    return { status: 'skipped', reason: m.reason, available: options.map(o => o.label).slice(0, 20) };
  }
  setNativeValue(sel, m.option.value);
  fire(sel, 'input', { bubbles: true });
  fire(sel, 'change', { bubbles: true });
  await sleep(60);
  const rb = String((sel.selectedOptions[0] && sel.selectedOptions[0].textContent) || '').trim();
  if (!rb) return { status: 'filled', via: 'native-select', readback: '', lowConfidence: true };
  return sameOption(rb, m.option.label)
    ? { status: 'filled', via: 'native-select', readback: rb }
    : { status: 'failed', reason: 'readback-mismatch', readback: rb, expected: m.option.label };
}

/** 日历面板不是下拉面板：真机上日期失败后面板不关，会把民族的下拉搜索污染成"又一个日历" */
function looksLikeCalendar(el) {
  if (!el) return false;
  const cls = String(el.className || '');
  if (/calendar|date-?picker|datepicker|time-?picker/i.test(cls)) return true;
  try {
    if (el.querySelector('.phoenix-calendar, [class*="calendar-panel"], [class*="calendar__"], [class*="calendar-date"]')) {
      return true;
    }
  } catch (_) {}
  return false;
}

/**
 * 点击前给所有"候选面板"拍一份文本指纹。
 *
 * 为什么必须有这一步：北森的 `phoenix-unmodeled-layer` 是**全页共用的浮层 portal 容器**，
 * 上一个字段（出生日期）填完后，它的内容还留在 DOM 里没清。
 * 只看"类名 + 有文本"会把这种**残留浮层**当成当前字段的面板 ——
 * 真机诊断就是这个：民族的 available 全是 `2026-01-07`，panelSel 是 unmodeled-layer，
 * 而里面根本没有民族选项，于是直接 option-no-match。
 *
 * 判据很简单：**点击前就在、点击后一个字都没变**的容器，不可能是这次打开的面板。
 */
function panelFingerprints() {
  const map = new Map();
  try {
    [...document.querySelectorAll(PANEL_SEL)].forEach(el => {
      try {
        map.set(el, String(el.textContent || '').replace(/\s+/g, ''));
      } catch (_) {}
    });
  } catch (_) {}
  return map;
}

function panelChanged(el, before) {
  if (!before) return true;
  let nowText = '';
  try {
    nowText = String(el.textContent || '').replace(/\s+/g, '');
  } catch (_) {
    return true;
  }
  const was = before.get(el);
  if (was === undefined) return true; // 点击后新冒出来的节点
  return was !== nowText; // 内容有变化才算"这次打开的"
}

function findPanelBySelector(trigger, before) {
  const cands = [...document.querySelectorAll(PANEL_SEL)].filter(el => {
    if (!isVisible(el)) return false;
    if (el.contains(trigger)) return false;
    if (looksLikeCalendar(el)) return false;
    if (!panelChanged(el, before)) return false;
    return true;
  });
  let best = null;
  let bestN = 0;
  for (const el of cands) {
    // innerText 在部分环境（jsdom / 未渲染的 portal）为空，必须退到 textContent，
    // 否则这一整条"按类名找面板"的便宜路径会静默失效，退化成猜容器
    const t = String(el.innerText || el.textContent || '').trim();
    if (!t || t.length > 6000) continue;
    // 按"有效选项数"排序：只按 OPTION_SEL 命中数会被
    // 带分页/空白模板的面板骗走（民族那次就选中了错误面板）
    const n = collectPanelOptions(el).length;
    if (n < 1) continue;
    if (n > bestN) {
      best = el;
      bestN = n;
    }
  }
  return best;
}

/** 面板本身可能就是滚动容器（差集法常把内层 list 当成面板），根节点也要算进来 */
function scrollerCandidates(root) {
  const out = [];
  const push = el => {
    if (!el || !isVisible(el)) return;
    if (Number(el.scrollHeight || 0) > Number(el.clientHeight || 0) + 16) out.push(el);
  };
  push(root);
  try {
    [...root.querySelectorAll('*')].forEach(push);
  } catch (_) {}
  return out.slice(0, 3);
}

/**
 * 找面板：先按类名（便宜），不行再用"点击后新增的短文本节点"反推容器。
 * 后者不依赖任何组件库类名，代价是一次全量扫描，只在必要时用。
 */
/**
 * WAI-ARIA 直连：组件库（antd / Element / iView / Arco / 自研 headless）的下拉触发器
 * 普遍带 aria-controls / aria-owns 指向弹层列表的 id。按 id 取是**精确**的——
 * 真机 antd 页面里打开过的下拉弹层全都留在 body 下（只是隐藏），
 * 按类名猜会挑到别的字段的旧弹层。
 */
function ariaPanelOf(trigger) {
  const hosts = [trigger];
  try {
    const box = trigger.closest && trigger.closest('[role="combobox"],[aria-haspopup]');
    if (box && box !== trigger) hosts.push(box);
    const inner = trigger.querySelector && trigger.querySelector('[role="combobox"],[aria-controls],[aria-owns]');
    if (inner) hosts.push(inner);
  } catch (_) {}
  for (const h of hosts) {
    for (const attr of ['aria-controls', 'aria-owns']) {
      const ids = String((h.getAttribute && h.getAttribute(attr)) || '').split(/\s+/).filter(Boolean);
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el || !isVisible(el) || el.contains(trigger)) continue;
        if (collectPanelOptions(el).length < 1) continue;
        return el;
      }
    }
  }
  return null;
}

function findOptionPanel(trigger, snap, before) {
  const byAria = ariaPanelOf(trigger);
  if (byAria) return popupRootOf(growToOptions(byAria), trigger);
  const bySel = findPanelBySelector(trigger, before);
  if (bySel) return popupRootOf(growToOptions(bySel), trigger);
  if (!snap) return null;
  const now = snap.broad ? collectTextLeaves(trigger) : collectOptionLeaves(trigger);
  const fresh = now.filter(el => !snap.set.has(el));
  if (fresh.length < 2) return null;
  const panel = panelAround(fresh);
  if (!panel || looksLikeCalendar(panel)) return null;
  return popupRootOf(growToOptions(panel), trigger);
}

/**
 * 双栏 / 带搜索的选择器，面板常常只定位到右栏（已选区）或左栏网格，
 * 真正能过滤列表的搜索框在弹层顶部 —— 在弹层外面就够不着它。
 * 这里往上爬到"含一个非触发器的可输入框"的那一层 = 弹层根。
 * 一旦爬到包含触发器的祖先（说明已经进了表单区）立刻放弃。
 */
function popupRootOf(panel, trigger) {
  let n = panel;
  for (let i = 0; i < 5; i++) {
    let hasInput = false;
    try {
      hasInput = [...n.querySelectorAll('input')].some(x => x !== trigger && !x.readOnly && !x.disabled);
    } catch (_) {}
    if (hasInput) return n;
    const p = n.parentElement;
    if (!p || p === document.body || p === document.documentElement) return panel;
    if (looksLikeCalendar(p)) return panel;
    if (trigger && p.contains(trigger)) return panel;
    n = p;
  }
  return panel;
}

/* ==================================================================== *
 * 弹层里的"勾选控件"根本不在文字上 —— 是左侧那个 14×14 的小圆图标
 *
 * 站点里同时存在两套弹层，结构不同但**语义完全一样**：
 *
 * 【A】通用多选/单选弹层  constant-main-selector-container
 *      （beisen-phoenix-part1；民族、籍贯走的就是这套）
 *        div.list-item-container
 *          span.icon-container
 *            svg.RadioUnchecked / RadioChecked
 *               / CheckboxUnchecked / CheckboxChecked      ← onClick=onChangeCheck ★唯一勾选入口
 *          span.item-text-label                             ← onClick=onClickLabel（只展开下级）
 * 【B】地区选择弹层  area-selector-container
 *      （beisen-phoenix-part2）
 *        div.area-item-container > div.area-item-name
 *          span.icon-container
 *            svg.area-icon-RadioUnchecked / RadioChecked   ← onClick=handleChangeCheck ★
 *          span.area-text-label                            ← onClick=handleLabelClick（只展开）
 *
 * 组件源码（A）：
 *     getIcon = function (checked, isMulti) {
 *       var kind = isMulti ? "Checkbox" : "Radio", st = checked ? "Checked" : "Unchecked";
 *       var Icon = ICONS[kind + st];
 *       return createElement(Icon, { color: "currentColor",
 *                                    onClick: this.handleChangeCheck,   // ★
 *                                    className: kind + st });           // → "RadioUnchecked"
 *     };
 *     render = function () {
 *       return div("list-item-container",
 *         span("icon-container", this.getIcon(checked, isMulti)),
 *         Tooltip(span("item-text-label", onClick: this.handleLabelClick,
 *                      Highlighter(textToHighlight: data.name,
 *                                  highlightClassName: "item-label-highLightCls"))),
 *         noExpand ? null : Arrow,
 *         isSearch && !leaf ? div("item-text-fullname", path) : null);
 *     };
 *
 * 所以**类名就是 `RadioUnchecked` / `RadioChecked` / `CheckboxUnchecked` / `CheckboxChecked`**，
 * 没有 `area-icon-` 前缀（那是 B 那一套）。v2.0.16 只认了 `area-icon-` 前缀，
 * 于是 `iconOf()` 恒为 null → 又退回点文字 → 真机上"还是不行"。
 * devtools 里悬浮图标显示的 `svg.RadioUnchecked 13.99 x 13.99` 就是铁证。
 *
 * 而点文字永远没用：
 *   - A：`handleLabelClick` 只调 `onClickLabel`（= onNodeExpand，展开下一级）；
 *   - B：`handleLabelClick` 第一行 `if (isForbidExpand || isSearch || status === NoChild) return;`
 * 民族、籍贯都是叶子节点 ⇒ 内部 `selectData` 一直是 `[]` ⇒ 点「确定」= `saveSelectData([])`
 * ⇒ `onSubmit([])` ⇒ 字段被清成「请选择必填」。真机那条 readback 就是这么来的。
 *
 * 结论：**点图标，不点文字**；两套弹层的类名一起认。
 * ==================================================================== */

/** 列表项容器（两套弹层） */
const ITEM_SEL = '.list-item-container, .area-item-container, .area-item-name';
/** 项里的文字标签（高亮组件会把整词拆成多个 span，所以要认这个"宿主"） */
const ITEM_LABEL_SEL = '[class*="item-text-label"], [class*="area-text-label"]';
/** 弹层根 */
const PANE_ROOT_SEL = ['.constant-main-selector-container', '.area-selector-container'];
/** 「已选」栏里的 chip 文字 */
const PANE_CHIP_SEL = '[class*="select-text-label"], [class*="select-area-text-label"]';
/**
 * Radio/Checkbox × Checked/Unchecked，可带 `area-icon-` 前缀和 `-disabled` 后缀。
 * 注意 SVG 元素的 className 不是字符串，必须用 getAttribute 读。
 */
const ITEM_ICON_RE = /(?:^|\s)(?:area-icon-)?(?:Radio|Checkbox)(?:Checked|Unchecked)(?:-disabled)?(?:\s|$)/;

function classOf(el) {
  if (!el || typeof el.getAttribute !== 'function') return '';
  return String(el.getAttribute('class') || '');
}

/** 从任意一个文字节点往上找到"这一项"的容器；不是弹层列表项则返回 null */
function listItemOf(el) {
  let n = el;
  for (let i = 0; i < 4 && n && n.nodeType === 1; i++) {
    try {
      if (n.matches && n.matches(ITEM_SEL)) return n;
      const hit = n.closest && n.closest(ITEM_SEL);
      if (hit) return hit;
    } catch (_) {}
    n = n.parentElement;
  }
  return null;
}

/** 这一项里的勾选图标（svg）；找不到说明它不是这种弹层的项 */
function listIconOf(item) {
  if (!item) return null;
  let list = [];
  try {
    list = [...item.querySelectorAll('svg,span,i')];
  } catch (_) {
    return null;
  }
  return list.find(x => ITEM_ICON_RE.test(classOf(x))) || null;
}

/** 项的标签文字（用于按标签重新定位、以及和"已选"栏比对） */
function itemKeyOf(item) {
  if (!item) return '';
  let node = null;
  try {
    node = item.querySelector(ITEM_LABEL_SEL);
  } catch (_) {}
  return normalize(shortText(node || item, 40));
}

function iconChecked(svg) {
  const c = classOf(svg);
  return ITEM_ICON_RE.test(c) && /Checked/.test(c) && !/-disabled/.test(c);
}

/** 可点吗：不是 disabled，且图标容器没被标成 hidden（hidden 的是"下一级才用得到"的图标） */
function iconUsable(svg) {
  const c = classOf(svg);
  if (!ITEM_ICON_RE.test(c)) return false;
  if (/-disabled/.test(c)) return false;
  try {
    const box = svg.closest && svg.closest('.icon-container');
    if (box && /(?:^|\s)hidden(?:\s|$)/.test(classOf(box))) return false;
  } catch (_) {}
  return true;
}

/** 当前打开的弹层（可见的，取最后一个 —— 最新打开的那个） */
function livePopupRoot() {
  for (const sel of PANE_ROOT_SEL) {
    let list = [];
    try {
      list = [...document.querySelectorAll(sel)].filter(el => isVisible(el));
    } catch (_) {
      continue;
    }
    if (list.length) return list[list.length - 1];
  }
  return null;
}

/**
 * 右栏「已选」里现在有哪些值。
 *
 * 判据必须走**文档级定位**：选中任何一项，组件都会重渲染列表和容器，
 * 手里那些引用当场变成"还连着父节点、却已不在页面上"的死节点，
 * 在死节点上回读永远拿到旧状态（这个坑本仓库已经踩过三轮）。
 */
function pickedLabels() {
  const root = livePopupRoot();
  if (!root) return null;
  let pane = null;
  try {
    pane = root.querySelector('[class*="select-data-container"]');
  } catch (_) {}
  if (!pane) return null;
  let labels = [];
  try {
    labels = [...pane.querySelectorAll(PANE_CHIP_SEL)]
      .map(el => normalize(shortText(el, 40)))
      .filter(Boolean);
  } catch (_) {}
  return labels;
}

/** 按标签重新找到"当前页面上"的那一项的图标（重渲染后旧引用全部作废） */
function relocateListIcon(key) {
  let items = [];
  try {
    items = [...document.querySelectorAll(ITEM_SEL)];
  } catch (_) {
    return null;
  }
  for (const it of items) {
    if (itemKeyOf(it) !== key) continue;
    const svg = listIconOf(it);
    if (svg && iconUsable(svg)) return svg;
  }
  return null;
}

/**
 * 走"真人路径"勾选一项，并**当场回读**这一项到底有没有被勾上。
 * 返回 null 表示这不是这种弹层的项（交给老逻辑）；
 * 返回 { ok, via } 时 ok 就是"这一项现在确实在已选里"。
 *
 * 判据顺序：
 *   ① 右栏「已选」的 chip 列表里有没有它 —— 最权威，是组件自己渲染出来的结果；
 *   ② 右栏不存在时退回看图标 class（RadioChecked / CheckboxChecked）。
 * 有了这个局部强反馈，才敢在"没勾上"时**放弃点确定** ——
 * 否则点确定就是 saveSelectData([]) → onSubmit([]) → 字段被清成「请选择必填」。
 */
async function selectListItem(el) {
  const item = listItemOf(el);
  if (!item) return null;
  const svg = listIconOf(item);
  if (!svg) return null;
  if (!iconUsable(svg)) return { ok: false, via: 'icon-disabled' };

  const key = itemKeyOf(item);
  const isOn = () => {
    const pane = pickedLabels();
    // 右栏存在就只信右栏：空了就是"一项都没选"，不必再去猜图标
    if (pane) return pane.includes(key);
    return iconChecked(relocateListIcon(key) || svg);
  };

  // 已经勾着就别再点：单选/限选点第二下是"取消选中"，比不点更糟
  if (isOn()) return { ok: true, via: 'icon-already' };

  clickEl(svg);
  await sleep(220);
  if (isOn()) return { ok: true, via: 'icon' };

  // 图标是 RadioChecked / RadioUnchecked 两个不同组件渲染的，React 会换节点；
  // 重渲染之后必须从 document 重新按标签取，不能还点手里那个。
  const again = relocateListIcon(key);
  if (again && again !== svg && !iconChecked(again)) {
    clickEl(again);
    await sleep(220);
    if (isOn()) return { ok: true, via: 'icon-retry' };
  }
  return { ok: false, via: 'icon-nochange' };
}

/**
 * 激活一个选项：弹层走图标，其余组件退回老的"点文字 + 补点原生控件"。
 * 返回 null = 老组件，成败只能靠 readback 判；返回 {ok,via} = 有局部强反馈。
 */
async function activateOption(el) {
  const hit = await selectListItem(el);
  if (hit) return hit;
  clickOption(el);
  return null;
}

/**
 * 点一个"选项"。比 clickEl 多一步：
 * 很多自绘列表项的真实控件是**视觉隐藏的 radio/checkbox**（截图里的 ○），
 * 只点外层的文字节点不会改选中态，事件冒泡到 li 也常常什么都不做。
 * 所以点完文字，再把同一项里的原生控件补点一下 —— 这两下合起来才等价于"用鼠标选了它"。
 */
function clickOption(el) {
  const ok = clickEl(el);
  try {
    // 从目标往上找"恰好含 1 个原生控件"的那一层 = 这一项自己的 radio。
    // 一旦某层出现 2 个以上控件，说明已经爬到整个列表了，必须停 ——
    // 否则会点到列表里的第一个 radio（可能是「汉族」），比不点更糟。
    let n = el;
    for (let i = 0; i < 3 && n; i++) {
      const ctls = [...n.querySelectorAll('input[type="radio"],input[type="checkbox"]')];
      if (ctls.length === 1) {
        const ctl = ctls[0];
        if (ctl !== el && !ctl.disabled && !ctl.checked) clickEl(ctl);
        break;
      }
      if (ctls.length > 1) break;
      n = n.parentElement;
    }
  } catch (_) {}
  return ok;
}

/**
 * 双栏选择器（左选右"已选0/1"+底部确定）会让面板定位停在内层某一栏，
 * 那一栏里只有"请在选择框中选择内容"之类的提示 → 一个选项都收不到（真机 no-options）。
 * 这里往上爬几层，直到找到一个真的含选项的容器。到 body/html 为止。
 *
 * 阈值是 **1** 而不是 2：搜索框过滤后常常只剩 1 个结果（搜"傣"只出"傣族"），
 * 用 2 会判定"这里没有选项"继续上爬，最后把整个表单当成面板 —— 那比选不中更糟。
 * 右栏「已选 1/1 + 已选值」那种假阳性已由 JUNK_RE 与 insideSelectedPane 挡掉。
 */
function growToOptions(panel) {
  if (!panel) return panel;
  let n = panel;
  let last = panel;
  for (let i = 0; i < 4; i++) {
    if (collectPanelOptions(n).length >= 1) return n;
    n = n.parentElement;
    if (!n || n === document.body || n === document.documentElement) return last;
    if (looksLikeCalendar(n)) return last;
    last = n;
  }
  return last;
}

/**
 * 面板里的"非选项"文本：清空、占位提示、计数、页脚按钮等，必须剔掉。
 * 双栏选择器右侧的「已选0/1」曾经被当成唯一选项，把面板判定带偏过。
 */
const JUNK_RE =
  /^(已选.*|搜索结果.*|共\s*\d+\s*[个条项]?|清空已选|清除|清空|请选择.*|请[在输].*|在选择框中选择.*|确定|取消|搜索|全选|重置|暂无.*|无数据|没有.*|这里什么都没有.*|全部|[\d/]+|\d+|\d+\/\d+)$/;

/** 「已选 1/1」那一栏是"待确认的选择"，不是可选项，别把它里面的 chip 当成选项 */
function insideSelectedPane(el) {
  let n = el.parentElement;
  for (let i = 0; i < 3 && n; i++) {
    const t = String(n.textContent || '').replace(/\s+/g, '');
    if (t.length < 60 && /^已选\s*\d+\s*\/\s*\d+/.test(t)) return true;
    n = n.parentElement;
  }
  return false;
}

/**
 * 选项候选：role/类名带 option 的节点 + 所有"短文本叶子" + **文本节点的父元素**。
 * 这三类必须**合并**而不是二选一 —— 真机上弹层里有一个 `<li>搜索结果1个</li>`，
 * 让"只要有 li 就不走叶子兜底"的旧逻辑彻底漏掉了 div 网格里的民族项。
 * 第三类（文本节点直采）是最稳的一层：元素类型、层级、可见性判定都可能骗人，
 * 但"这段文字在不在 DOM 里"不会骗人 —— 肉眼看得见就一定抓得到。
 */
function candidateNodes(panel) {
  const set = new Set();
  try {
    [...panel.querySelectorAll(OPTION_SEL)].forEach(el => set.add(el));
  } catch (_) {}
  // 弹层的文字标签宿主（item-text-label / area-text-label）必须无条件进候选。
  // 高亮组件把搜索词整段包成一个子 span 时（搜「汉族」→ <span>汉族</span>），
  // 宿主内部**没有任何裸文本节点**，于是它既不是"叶子"也不是"文本节点的父元素"，
  // 两条通道都收不到它 —— 而它的碎片又被 collectPanelOptions 的 labelHost 规则跳过了，
  // 结果就是"搜完之后一个选项都收不到"（v2.0.16 真机 option-detached 的真因）。
  try {
    [...panel.querySelectorAll(ITEM_LABEL_SEL)].forEach(el => set.add(el));
  } catch (_) {}
  try {
    [...panel.querySelectorAll('div,span,li,a,p,dd,dt')]
      .filter(el => el.children.length === 0)
      .forEach(el => set.add(el));
  } catch (_) {}
  try {
    const walker = document.createTreeWalker(panel, 4 /* SHOW_TEXT */);
    let n = null;
    let guard = 0;
    while ((n = walker.nextNode()) && guard++ < 4000) {
      const t = String(n.nodeValue || '').replace(/\s+/g, '');
      if (!t || [...t].length > 40) continue;
      const p = n.parentElement;
      if (p && p !== panel) set.add(p);
    }
  } catch (_) {}
  return [...set];
}

function newProbe() {
  return {
    nodes: 0,
    invisible: 0,
    hasTextChild: 0,
    inSelected: 0,
    tooLong: 0,
    junk: 0,
    kept: 0,
    samples: { invisible: [], hasTextChild: [], junk: [] },
  };
}

function collectPanelOptions(panel, probe) {
  const out = [];
  const seen = new Set();
  const nodes = candidateNodes(panel);
  if (probe) probe.nodes = nodes.length;
  for (const el of nodes) {
    if (!isVisible(el)) {
      if (probe) {
        probe.invisible++;
        if (probe.samples.invisible.length < 6) probe.samples.invisible.push(shortText(el, 20));
      }
      continue;
    }
    // 弹层的文字标签（`span.item-text-label` / `span.area-text-label`）内部会被
    // 高亮组件拆成多个 span：
    //   <span class="item-text-label"><span class="item-label-highLightCls">白</span>族</span>
    // 按"最内层"规则会把「白族」拆成「白」+「族」，整词永远匹配不上；
    // 只剩碎片时连 `itemKeyOf()` 都对不上，定位与回读会一起失真。
    // 所以对这类标签做特例：标签本身一律算选项，标签内部的碎片一律跳过。
    let labelHost = null;
    try {
      labelHost = el.closest && el.closest(ITEM_LABEL_SEL);
    } catch (_) {}
    if (labelHost && labelHost !== el) continue;
    // 只保留最内层：内部还有带文字的子孙，说明它是容器不是选项
    if (!labelHost && [...el.children].some(c => String(c.textContent || '').trim())) {
      if (probe) {
        probe.hasTextChild++;
        if (probe.samples.hasTextChild.length < 6) probe.samples.hasTextChild.push(shortText(el, 20));
      }
      continue;
    }
    if (insideSelectedPane(el)) {
      if (probe) probe.inSelected++;
      continue;
    }
    const label = shortText(el, 60);
    if (!label || [...label].length > 40) {
      if (probe && label) probe.tooLong++;
      continue;
    }
    if (JUNK_RE.test(label)) {
      if (probe) {
        probe.junk++;
        if (probe.samples.junk.length < 6) probe.samples.junk.push(label);
      }
      continue;
    }
    const key = normalize(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ label, value: null, el });
  }
  if (probe) probe.kept = out.length;
  return out;
}

/** 面板内容可能是异步渲染/虚拟滚动的：等选项数稳定再取值 */
async function waitOptions(panel) {
  let last = [];
  let stable = 0;
  const end = Date.now() + 900;
  while (Date.now() < end) {
    const now = collectPanelOptions(panel);
    if (now.length && now.length === last.length) {
      stable++;
      if (stable >= 2) return now;
    } else {
      stable = 0;
    }
    last = now;
    await sleep(90);
  }
  return last;
}

/**
 * 虚拟滚动收割：民族这种 56 项的列表只渲染可视区那 8~10 个，
 * 汉族可能压根没被渲染出来，直接收集永远匹配不到。
 * 这里把面板内可滚动容器逐屏滚一遍，边滚边收（只读，不点，不会误选）。
 */
async function harvestOptions(panel) {
  const seen = new Map();
  const collect = () => {
    for (const o of collectPanelOptions(panel)) if (!seen.has(o.label)) seen.set(o.label, o);
  };
  collect();
  const scrollers = scrollerCandidates(panel);
  for (const sc of scrollers) {
    let last = -1;
    for (let i = 0; i < 10; i++) {
      if (sc.scrollTop === last) break;
      last = sc.scrollTop;
      sc.scrollTop = Math.min(sc.scrollTop + Math.max(sc.clientHeight || 180, 80), sc.scrollHeight || 0);
      fire(sc, 'scroll', { bubbles: false });
      await sleep(110);
      collect();
    }
    sc.scrollTop = 0;
    fire(sc, 'scroll', { bubbles: false });
    await sleep(160);
  }
  return [...seen.values()];
}

/** 滚动过之后被虚拟列表回收的节点要重新定位：一切从顶部重新找，避免漏掉目标项 */
async function relocateOption(panel, label) {
  const now = collectPanelOptions(panel);
  const hit = now.find(o => normalize(o.label) === normalize(label));
  if (hit) return hit;
  const scrollers = scrollerCandidates(panel);
  for (const sc of scrollers) {
    sc.scrollTop = 0;
    fire(sc, 'scroll', { bubbles: false });
    await sleep(150);
    for (let i = 0; i < 10; i++) {
      const cur = collectPanelOptions(panel).find(o => normalize(o.label) === normalize(label));
      if (cur) return cur;
      sc.scrollTop = sc.scrollTop + Math.max(sc.clientHeight || 180, 80);
      fire(sc, 'scroll', { bubbles: false });
      await sleep(110);
    }
    sc.scrollTop = 0;
  }
  return null;
}

/**
 * 取一个"现在的文本就是目标项"的节点准备点击。
 *
 * 真机上出现过点歪：要「汉族」却选成「黎族」。虚拟列表会复用节点（只改 textContent）
 * 或异步重渲染，手里那个节点 isConnected 仍是 true，但内容已经换成别的项了；
 * 而 scrollIntoView 本身还会触发滚动 → 窗口整体位移 → 手里的节点又变了一个值。
 * 所以：滚进视口后必须重新按标签取节点，并且在点之前再核一次节点文本。
 */
async function pickFreshOption(panel, label) {
  const key = normalize(label);
  const findNow = () => collectPanelOptions(panel).find(o => normalize(o.label) === key) || null;

  let hit = findNow() || (await relocateOption(panel, label));
  if (!hit) return null;
  try {
    if (hit.el.scrollIntoView) hit.el.scrollIntoView({ block: 'nearest' });
  } catch (_) {}
  await sleep(160);

  // 滚动/重渲染之后，手里的节点可能已经变成别的项 —— 必须按标签重取
  hit = findNow() || (await relocateOption(panel, label));
  if (!hit) return null;
  if (normalize(shortText(hit.el, 60)) !== key) return null;
  return hit.el;
}

/** "共青团员共青团员共青团员" → "共青团员"：显示区常常把同一个值渲染多份 */
function collapseRepeat(text) {
  const t = String(text || '');
  const chars = [...t];
  for (let n = 1; n <= Math.floor(chars.length / 2); n++) {
    if (chars.length % n !== 0) continue;
    const unit = chars.slice(0, n).join('');
    if (unit.repeat(chars.length / n) === t) return unit;
  }
  return t;
}

/**
 * 读触发器当前显示的选择结果。
 *
 * 真机（北森 phoenix-select--editable）一个值会同时出现在**四处**，截图实拍：
 *   ① span.phoenix-select__calcEle                                        ← 组件计算后的真值位
 *   ② span.phoenix-select__tipEle                                         ← tip 区
 *   ③ div.phoenix-select__placeholder--large                              ← 占位，选中后旧值不清
 *   ④ input.phoenix-select__input--unText[value]                          ← 同时是搜索框
 *
 * 按 **①→②→③→④ 的优先级取第一个非空**，不做拼接也不取最短：
 * - 拼接会得到「傣族 畲族」这种永远判不对的东西（v2.0.11 的坑）；
 * - 取最短则会在四处都是旧值时误判（v2.0.12 截图里四处全是"畲族"）。
 * - ① 是组件的"计算结果"字段，语义上最接近"当前选中值"，所以权重最高。
 * ④ 放最后：它常常存着我们刚键入的过滤词（"傣"），必须放在最后兜底。
 */
const VALUE_NODE_SELS = [
  '[class*="calcEle"]',
  '[class*="tipEle"]',
  '[class*="placeholder"]',
  '[class*="Placeholder"]',
  '[class*="selection"]',
  '[class*="Selection"]',
  '[class*="selected"]',
  '[class*="value"]',
  '[class*="Value"]',
];

/**
 * 「空态提示」不是值。
 *
 * v2.0.15 只认「请选择」「请输入」「请填写」三个整词，于是真机清空后组件进入
 * 必填报错态、占位文案变成「请选择必填」时，它被当成了回读结果 ——
 * 报告里出现 `readback: "请选择必填"` 这种既不像成功也不像失败的东西，
 * 后续所有「回读是否等于目标值」的判断也都跟着失真。
 *
 * 所以改成前缀匹配：凡是「请选择…」「请输入…」「请填写…」一律视为空。
 */
const EMPTY_HINT_RE = /^(?:请选择.*|请输入.*|请填写.*|选填|必填|--|—|-)$/;

function cleanValueText(n) {
  const t = String(n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (EMPTY_HINT_RE.test(t.replace(/\s+/g, ''))) return '';
  return collapseRepeat(t.slice(0, 60));
}

function readTriggerText(field) {
  const el = field.el;
  const box = field.container || (el && el.parentElement);
  let hasValueNode = false;
  if (box) {
    for (const sel of VALUE_NODE_SELS) {
      let list = [];
      try {
        list = [...box.querySelectorAll(sel)];
      } catch (_) {
        continue;
      }
      if (list.length) hasValueNode = true;
      for (const n of list) {
        // 别把包着输入框的容器当值节点（selection 这类容器会把搜索词一起带出来）
        if (n.querySelector && n.querySelector('input,textarea,select')) continue;
        if (!isVisible(n)) continue;
        const t = cleanValueText(n);
        if (t) return t;
      }
    }
    // ④ 输入框的 value 只能在"整块里根本没有值节点"时兜底。
    //    否则就是假阳性：值节点存在但为空 = 组件没值，此时 input.value 里
    //    装的正是我们自己刚键入的搜索词（第 [12] 组就因此误判成填写成功）。
    if (!hasValueNode) {
      try {
        const inp = [el, ...box.querySelectorAll('input')].find(
          x => x && x.tagName === 'INPUT' && !x.readOnly && !x.disabled
        );
        const v = inp ? String(inp.value || '').trim() : '';
        if (v && !EMPTY_HINT_RE.test(v)) return collapseRepeat(v.slice(0, 60));
      } catch (_) {}
    }
    // 显示节点全空时退到整块文本（老式组件）
    try {
      const clone = box.cloneNode(true);
      clone
        .querySelectorAll(
          '.el-form-item__label,.ant-form-item-label,label,[class*="label"],[class*="Label"],[class*="title"],[class*="Title"]'
        )
        .forEach(n => n.remove());
      clone.querySelectorAll('input,textarea,select').forEach(n => n.remove());
      const shown = String(clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      if (shown && !EMPTY_HINT_RE.test(shown.replace(/\s+/g, ''))) return collapseRepeat(shown);
    } catch (_) {}
  }
  if (el && !hasValueNode) {
    const v = String(el.value ?? '').trim();
    if (v && !EMPTY_HINT_RE.test(v)) return v;
  }
  return '';
}

/**
 * 整块里到底有没有"值节点"。
 * 用来区分两种"回读为空"：
 *   ① 有值节点但读到空 → 组件明确处于未选态（占位「请选择必填」），是**没填上**；
 *   ② 压根没有值节点 → 这种组件不给回读，只能低置信度放行（老逻辑）。
 * 混为一谈就会把 ① 误报成"填写成功"。
 */
function hasValueNodes(field) {
  const box = field.container || (field.el && field.el.parentElement);
  if (!box) return false;
  for (const sel of VALUE_NODE_SELS) {
    let list = [];
    try {
      list = [...box.querySelectorAll(sel)];
    } catch (_) {
      continue;
    }
    for (const n of list) {
      // 和 readTriggerText 用同一套过滤：包着输入框的只是容器，不是值位。
      // 不过滤就会把 `phoenix-select__selection` 这种外壳算成"值位"，
      // 把一个只是没有可读值的组件误判成"明确未选"。
      if (n.querySelector && n.querySelector('input,textarea,select')) continue;
      return true;
    }
  }
  return false;
}

/**
 * 地区弹层满额点新项时，组件会弹一条警告并盖一层 `div.message-mask.show`，
 * 遮罩期间**所有点击都被挡掉**（1.5s 后自动关）。清空/点选之间必须等它消失，
 * 否则后面的点击全是无效点击，报告却看不出任何异常。
 */
async function waitMaskGone(timeout = 1800) {
  const end = Date.now() + timeout;
  const up = () => {
    try {
      return [...document.querySelectorAll('[class*="message-mask"]')].some(
        el => isVisible(el) && /(?:^|\s)show(?:\s|$)/.test(classOf(el))
      );
    } catch (_) {
      return false;
    }
  };
  while (Date.now() < end) {
    if (!up()) return true;
    await sleep(120);
  }
  return false;
}

async function closePanel(field) {
  try {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  } catch (_) {}
  for (const target of [field.el, document]) {
    try {
      fire(target, 'keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true });
    } catch (_) {}
  }
  const body = document.body;
  if (body) clickEl(body);
  await sleep(140);
}

async function tryTypeFilter(panel, trigger, text) {
  let input = [...panel.querySelectorAll('input')].find(
    el => isVisible(el) && !el.readOnly && (el.type === 'text' || el.type === 'search' || !el.type)
  );
  if (!input && trigger && trigger.tagName === 'INPUT' && !trigger.readOnly) input = trigger;
  if (!input) return false;
  try {
    input.focus();
  } catch (_) {}
  setNativeValue(input, text);
  fire(input, 'input', { bubbles: true });
  fire(input, 'keyup', { bubbles: true });
  await sleep(280);
  return true;
}

/**
 * 同类组件"打不开面板"的记忆：
 * 一页上几十个同款自绘下拉，逐个试 2 秒会把整轮填充拖到一分钟以上。
 * 同一签名连续失败 2 次后，后续同类直接按已知失败跳过（报告里仍写明原因）。
 */
const NO_PANEL = new Map();

/** 每次填充开始时清空记忆，避免上一轮的失败影响这一轮 */
export function resetPanelMemo() {
  NO_PANEL.clear();
}

/** 点歪后的补救：重新打开面板，按标签重新定位再点一次 */
async function repickOption(field, label) {
  const trigger = field.el;
  // 关键：上一轮的弹层可能还开着。这时再点触发器等于"收起"，
  // openPanel 会一直等一个永远不会出现的面板（真机 repick:fail 就是这么来的）。
  await closePanel(field);
  const snap = snapshotCandidates(trigger);
  const panel = await openPanel(field, trigger, snap);
  if (!panel) return '';
  await waitOptions(panel);
  // 重开的面板可能又变成"满额"状态（组件把旧值回填了），先腾位置**再**取节点 ——
  // 顺序反了的话，清空引发的重渲染会把刚取到的节点变成死节点。
  await makeRoom(panel);
  const el = await pickFreshOption(panel, label);
  if (!el) {
    await closePanel(field);
    return '';
  }
  const act = await activateOption(el);
  await sleep(200);
  if (!act || act.ok) await clickConfirm(panel);
  try {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  } catch (_) {}
  return readTriggerText(field);
}

function componentSigOf(el) {
  let n = el;
  let d = 0;
  while (n && n.nodeType === 1 && d < 5) {
    const toks = String(n.className || '')
      .split(/\s+/)
      .filter(Boolean);
    const hit = toks.find(t => /select|picker|cascader|dropdown/i.test(t));
    if (hit) return hit;
    n = n.parentElement;
    d++;
  }
  return 'unknown';
}

/** 依次尝试"能打开面板"的节点：输入框 → 整块容器 → 组件内部触发器 */
async function openPanel(field, trigger, snap) {
  const box = field.container || trigger.parentElement;
  const targets = [trigger];
  if (box) {
    targets.push(box);
    try {
      const inner = box.querySelector('[class*="selection"],[class*="trigger"],[class*="selector"],[class*="value"]');
      if (inner && inner !== trigger) targets.push(inner);
    } catch (_) {}
  }
  // 点击前拍指纹：全页共用的浮层容器里可能还留着上一个字段（出生日期）的内容，
  // 不拍指纹就分辨不出"这次打开的"和"上次没清的"
  const before = panelFingerprints();
  for (const t of targets) {
    try {
      t.focus && t.focus();
    } catch (_) {}
    clickEl(t);
    const panel = await waitFor(() => findOptionPanel(trigger, snap, before), 520, 60);
    if (panel) return panel;
  }
  return null;
}

/**
 * 读「已选 N/M」计数：多选组件满了以后，点新项会被直接拒绝。
 *
 * **不能直接对整块 textContent 用 `/已选(\d+)\/(\d+)/`**：
 * 组件的计数是拆成两个 span 渲染的，拼起来的文本是「已选」+「1/1」+「1」= `已选1/11`，
 * 正则会把 max 读成 11（v2.0.16 真机就是这么导致"没觉得满、不去清空"的）。
 * 所以先读组件自己的 `select-data-num-text` / `select-data-num-limit`，
 * 两套弹层各自的拆分方式都覆盖到。
 */
function selectedCount(panel) {
  try {
    const numEl = panel.querySelector('[class*="select-data-num-text"]');
    const limEl = panel.querySelector('[class*="select-data-num-limit"]');
    if (numEl) {
      const numText = String(numEl.textContent || '').replace(/\s+/g, '');
      const limitText = limEl ? String(limEl.textContent || '').replace(/\s+/g, '') : '';
      const m = numText.match(/^(\d+)(?:\/(\d+))?$/);
      let n = m ? Number(m[1]) : null;
      let max = m && m[2] ? Number(m[2]) : null;
      if (!max && limitText) {
        const l = limitText.match(/(\d+)/);
        if (l) max = Number(l[1]);
      }
      if (n !== null && max) return { n, max };
    }
  } catch (_) {}

  // 第二手：数右栏的 chip（有的组件计数栏文案不带数字）
  try {
    const pane = panel.querySelector('[class*="select-data-container"]');
    if (pane) {
      const empty = !!pane.querySelector('[class*="select-data-empty"]');
      const chips = pane.querySelectorAll(
        '[class*="select-item-container"],[class*="select-text-label"],[class*="select-area-text-label"]'
      ).length;
      const limEl = panel.querySelector('[class*="select-data-num-limit"]');
      const l = limEl ? String(limEl.textContent || '').replace(/\s+/g, '').match(/(\d+)/) : null;
      if (l) return { n: empty ? 0 : chips, max: Number(l[1]) };
    }
  } catch (_) {}

  // 最后一手：老组件只给一整句「已选 N/M」
  try {
    const t = String(panel.textContent || '').replace(/\s+/g, '');
    const m = t.match(/已选(\d+)\s*\/\s*(\d+)/);
    if (!m) return null;
    return { n: Number(m[1]), max: Number(m[2]) };
  } catch (_) {
    return null;
  }
}

/**
 * 「清空已选」——按真人的操作路径走：已选区满着（1/1）时要先清空，才能换值。
 *
 * 这条是 v2.0.15 的关键补充。截图左侧显示「已选 1/1 · 畲族 ⓧ」，
 * 也就是 maxCount 名额已经用掉了；此时点「白族」组件什么都不做 ——
 * 不是点不到，是**它不接受**。之前所有版本都缺这一步。
 */
async function clearSelected(panel) {
  if (!panel) return false;
  const roots = [];
  let n = panel;
  for (let i = 0; i < 3; i++) {
    if (!n || n === document.body || n === document.documentElement) break;
    roots.push(n);
    n = n.parentElement;
  }
  for (const r of roots) {
    let cands = [];
    try {
      cands = [...r.querySelectorAll('[class*="clear-select-data"],span,div,a,button,[role="button"]')];
    } catch (_) {
      continue;
    }
    const hit = cands
      .filter(el => {
        if (!isVisible(el)) return false;
        if (el.children.length > 2) return false;
        // 站点 bundle：0 个已选时 clear-select-data 会带 disabled 类，点了没反应
        if (/(?:^|\s)disabled(?:\s|$)/.test(classOf(el))) return false;
        const t = String(el.textContent || '').replace(/\s+/g, '');
        return /^(?:清空已选|清空|清除|重置)$/.test(t);
      })
      .sort((a, b) => a.children.length - b.children.length)[0];
    if (hit) {
      clickEl(hit);
      await sleep(240);
      // 满额点新项时组件会弹「已选总数不能超过 N 个」并盖一层 message-mask，
      // 遮罩期间点击全部无效 —— 清空前后都必须等它消失
      await waitMaskGone();
      const cnt = selectedCount(panel);
      // 回读「已选 0/N」才算真清空。清空是勾选的前提，糊弄过去后面每一步都白做。
      return !cnt || cnt.n === 0;
    }
  }
  return false;
}

/** 已选区满着就先腾位置（只在真的满了、且有「清空已选」时才动手） */
async function makeRoom(panel) {
  if (!panel) return false;
  const cnt = selectedCount(panel);
  if (!cnt || !cnt.max || cnt.n < cnt.max) return false;
  return clearSelected(panel);
}

/** 页面里的"确定"按钮：双栏选择器把它放在面板外面（页脚），所以要往上找几层 */
async function clickConfirm(panel) {
  const roots = [];
  let n = panel;
  for (let i = 0; i < 3; i++) {
    if (!n || n === document.body || n === document.documentElement) break;
    roots.push(n);
    n = n.parentElement;
  }
  for (const r of roots) {
    let cands = [];
    try {
      cands = [
        ...r.querySelectorAll(
          'button,[role="button"],[class*="confirm"],[class*="Confirm"],[class*="ok"],[class*="submit"],[class*="Submit"],span,div,a'
        ),
      ];
    } catch (_) {
      continue;
    }
    const hits = cands.filter(el => {
      if (!isVisible(el)) return false;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
      // 按钮里可能还套着图标（<i> + <span>），2 个子元素是上限
      if (el.children.length > 2) return false;
      const t = String(el.textContent || '').replace(/\s+/g, '');
      return /^(?:确定|确认|完成|提交|保存|ok|confirm|submit)$/i.test(t);
    });
    if (!hits.length) continue;
    // 最内层优先：文本一致时取子元素最少的，避免点到包了一层的容器
    hits.sort((a, b) => a.children.length - b.children.length);
    clickEl(hits[0]);
    await sleep(220);
    return true;
  }
  return false;
}

/** 可编辑下拉（phoenix-select--editable）：真值就是往它的 input 里写，和日期输入框同理 */
function editableInputOf(field) {
  const trigger = field.el;
  const writable = el =>
    el && el.tagName === 'INPUT' && !el.readOnly && !el.disabled &&
    ['text', 'search', ''].includes(String(el.type || 'text').toLowerCase());
  if (writable(trigger)) return trigger;
  const box = field.container;
  if (!box) return null;
  try {
    return [...box.querySelectorAll('input')].find(writable) || null;
  } catch (_) {
    return null;
  }
}

/** 向输入框按一次键（keydown + keyup，按键码齐全，有的组件只看 keyCode） */
function pressKey(el, key, code, keyCode, times = 1) {
  for (let i = 0; i < times; i++) {
    try {
      fire(el, 'keydown', { key, code, keyCode, which: keyCode, bubbles: true });
      fire(el, 'keyup', { key, code, keyCode, which: keyCode, bubbles: true });
    } catch (_) {}
  }
}

/**
 * 按"日期的方式"直填：把值写进下拉的输入框 → 提交 → 回读校验。
 * 传 `panel = null` 时只走键盘路线（不依赖面板），用于"面板定位不可信"的字段。
 *
 * 提交方式因组件而异，逐级递进（每一级都回读，成了就返回）：
 * ① 点过滤出来的目标项 + 点确定
 * ② 点目标项 + 回车 + 点确定（点击只把项放进"待确认区"的组件）
 * ③ 裸回车
 * ④ ↓ 高亮首项 + 回车（combo 的标准键盘提交：没有高亮项时回车是空操作）
 * ⑤ ↓↓ + 回车（首项是分组标题/不可选时）
 * ⑥ 失焦提交（输入 → blur/change，有的 combo 在 blur 时才校验落值）
 *
 * 真机（北森 `phoenix-select--editable` 的 emptyMultiValue 变体）走 ④。
 */
async function commitByInput(field, panel, plan) {
  const input = editableInputOf(field);
  if (!input) return { ok: false, reason: 'no-input' };
  const text = primaryValue((plan.resolved && plan.resolved.raw) || '').trim();
  if (!text) return { ok: false, reason: 'no-text' };
  const original = String(input.value || '');
  const collect = () => {
    if (!panel) return [];
    try {
      return collectPanelOptions(panel);
    } catch (_) {
      return [];
    }
  };

  const restore = () => {
    try {
      if (String(input.value || '') === original) return;
      setNativeValue(input, original);
      fire(input, 'input', { bubbles: true });
    } catch (_) {}
  };

  const retype = async () => {
    setNativeValue(input, text);
    fire(input, 'input', { bubbles: true });
    await sleep(220);
  };

  try {
    input.focus();
  } catch (_) {}
  if (panel) await makeRoom(panel);
  await retype();

  const typed = collect();
  const m = matchOption(plan.resolved, typed);
  const want = (m.ok && m.option.label) || text;
  const hit = rb => !!rb && (sameOption(rb, want) || sameOption(rb, text));
  /** 选项点击的局部反馈（地区弹层才有），失败时带进报告方便定位 */
  let lastItem = null;

  // ① 点过滤出来的目标项 + 确定（没有面板就跳过这条，只走键盘）
  if (panel && m.ok) {
    const el = await pickFreshOption(panel, m.option.label);
    if (el) {
      // 地区弹层在这里就能拿到"这一项是否真的被勾上"的强反馈，
      // 没勾上就没必要再点确定（点下去等于 submit([])，会把字段清空）
      const act = await activateOption(el);
      await sleep(180);
      if (!act || act.ok) {
        await clickConfirm(panel);
        const rb = readTriggerText(field);
        if (hit(rb)) return { ok: true, via: 'input+click', readback: rb };

        // ② 点完还得回车确认
        pressKey(input, 'Enter', 'Enter', 13);
        await sleep(220);
        await clickConfirm(panel);
        const rb2 = readTriggerText(field);
        if (hit(rb2)) return { ok: true, via: 'input+click+enter', readback: rb2 };
      }
      lastItem = act || null;
    }
  }

  // ③ 裸回车（最常见，先试最快的路径）
  await retype();
  pressKey(input, 'Enter', 'Enter', 13);
  await sleep(280);
  await clickConfirm(panel);
  const rbEnter = readTriggerText(field);
  if (hit(rbEnter)) return { ok: true, via: 'input-enter', readback: rbEnter };

  // ④⑤ 键盘：先高亮再回车（没有高亮项时回车是空操作，这是真机那种组件的脾气）
  let lastRead = rbEnter;
  for (const downs of [1, 2]) {
    await retype();
    pressKey(input, 'ArrowDown', 'ArrowDown', 40, downs);
    await sleep(140);
    pressKey(input, 'Enter', 'Enter', 13);
    await sleep(260);
    await clickConfirm(panel);
    lastRead = readTriggerText(field);
    if (hit(lastRead)) return { ok: true, via: `input-keys(${downs})`, readback: lastRead };
  }

  // ⑥ 失焦提交：有的 combo 在 blur 时才校验并把输入值落成选中值
  await retype();
  try {
    fire(input, 'change', { bubbles: true });
    input.blur();
  } catch (_) {}
  await sleep(260);
  await clickConfirm(panel);
  const rbBlur = readTriggerText(field);
  if (hit(rbBlur)) return { ok: true, via: 'input-blur', readback: rbBlur };
  lastRead = rbBlur || lastRead;

  // 没成：把输入框恢复原样，别把触发器里"已选中的值"擦掉
  restore();
  return {
    ok: false,
    reason: lastRead ? 'readback-mismatch' : 'no-readback',
    readback: lastRead,
    itemClick: lastItem ? lastItem.via : '',
  };
}

export async function writeSelectCustom(plan) {
  const field = plan.field;
  const trigger = field.el;
  const sig = componentSigOf(trigger);

  // ⓪ 先按"出生日期那条路"直接改：这类可编辑下拉（phoenix-select--editable）本身
  //    就带一个可写 input，把值写进去 + 让组件自己确认，比"找选项、点选项、点确定"
  //    可靠得多 —— 用户的原话就是"为什么不能像填写出生日期那样，直接改呢"。
  //    不依赖面板定位，所以也不会被"上一个字段留下的浮层"带偏。
  const direct = await commitByInput(field, null, plan);
  if (direct.ok) {
    return {
      status: 'filled',
      via: direct.via,
      readback: direct.readback,
      attempts: [`direct:${direct.via}:ok`],
    };
  }
  // 直填过程可能把下拉展开了一半：不关干净，下面点触发器就变成"收起"，
  // openPanel 会等一个永远不出现的面板
  await closePanel(field);

  if ((NO_PANEL.get(sig) || 0) >= 2) {
    return { status: 'skipped', reason: 'panel-not-open', hints: [`同类组件已知无法打开：${sig}`] };
  }

  // 点击前先记下已有候选节点，点击后只认"新增的"
  const snap = snapshotCandidates(trigger);
  let panel = await openPanel(field, trigger, snap);
  if (!panel) {
    NO_PANEL.set(sig, (NO_PANEL.get(sig) || 0) + 1);
    return {
      status: 'skipped',
      reason: 'panel-not-open',
      hints: panelHints(),
    };
  }

  // 先把名额腾出来：这类多选下拉的文案里写得很清楚
  // —— `selectAllLengthText: "已选总数不能超过{0}个"`。
  // 名额占满时点新项不是"点不中"，是**组件直接拒绝**（真机：已选 1/1 · 畲族）。
  // 必须在过滤/点选之前清掉，否则后面每一步都白做。
  const cleared = await makeRoom(panel);
  if (cleared) {
    // 清空会让组件重渲染整个浮层，手里这个引用可能已经不是页面上那个了；
    // 继续在死节点上点选项/点确定，两边都"成功"，页面上却什么都没发生。
    await sleep(220);
    await waitMaskGone();
    let alive = true;
    try {
      alive = !!(panel && panel.isConnected);
    } catch (_) {}
    if (!alive) {
      const again = await openPanel(field, trigger, snapshotCandidates(trigger));
      if (again) panel = again;
    }
  }

  let options = await waitOptions(panel);
  let m = matchOption(plan.resolved, options);
  const raw = plan.resolved && plan.resolved.raw ? primaryValue(plan.resolved.raw) : '';

  // ① 键入过滤：选项多/匹配不上时，先让组件把列表缩小
  if (raw && (!m.ok || options.length > 30)) {
    const typed = await tryTypeFilter(panel, trigger, raw);
    if (typed) {
      options = await waitOptions(panel);
      const m2 = matchOption(plan.resolved, options);
      if (m2.ok) m = m2;
    }
  }

  // ② 虚拟滚动收割：只渲染可视区那 8~10 项的列表（民族 56 项就是这种）
  if (!m.ok) {
    const harvested = await harvestOptions(panel);
    if (harvested.length > options.length) {
      options = harvested;
      const m3 = matchOption(plan.resolved, options);
      if (m3.ok) m = m3;
    }
  }

  // ③ 换用更短的过滤词再试一次（"汉族" → "汉"）
  if (!m.ok && raw) {
    const short = [...String(raw)].slice(0, 2).join('');
    if (short && short !== raw) {
      const typed = await tryTypeFilter(panel, trigger, short);
      if (typed) {
        const o2 = await waitOptions(panel);
        const m4 = matchOption(plan.resolved, o2);
        if (m4.ok) {
          m = m4;
          options = o2;
        }
      }
    }
  }

  if (!m.ok) {
    // 列表里匹配不上：先按"日期的方式"直填输入框（可编辑下拉就是这么取值的）
    const byInput = await commitByInput(field, panel, plan);
    if (byInput.ok) {
      return { status: 'filled', via: byInput.via, readback: byInput.readback, attempts: [`${byInput.via}:ok`] };
    }

    // 还是不行：关面板，跳过（输入框的值已由 commitByInput 自行还原）
    // 带上 probe：一个字段为什么收不到选项，只有把"淘汰在哪一步"摊开才能定位，
    // 否则只能靠一轮轮猜（我们已经猜了四轮）。
    const probe = newProbe();
    let sel = '';
    try {
      collectPanelOptions(panel, probe);
      sel = panel.tagName.toLowerCase() + (typeof panel.className === 'string' && panel.className
        ? '.' + panel.className.trim().split(/\s+/).join('.')
        : '');
    } catch (_) {}
    const panelText = String(panel.innerText || panel.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    await closePanel(field);
    return {
      status: 'skipped',
      reason: m.reason,
      available: options.map(o => o.label).slice(0, 20),
      panelText,
      panelSel: sel,
      probe,
      attempts: [`input-enter:${byInput.reason}`],
    };
  }

  // 虚拟列表里被回收/被复用的节点要重新定位，否则点的是已卸载或已换内容的元素
  const target = await pickFreshOption(panel, m.option.label);
  if (!target) {
    await closePanel(field);
    return { status: 'skipped', reason: 'option-detached', available: options.map(o => o.label).slice(0, 12) };
  }
  const act = await activateOption(target);
  // 多选组件（phoenix-select__inputWrapper--emptyMultiValue）点完才渲染
  // 「已选 1/1 + 确定」这一段，等久一点，否则确定按钮还没进 DOM
  await sleep(260);

  // 地区弹层能当场告诉我们"这项到底勾上没有"。
  // 没勾上就**绝不能**点确定：`saveSelectData` 提交的是内部 selectData，
  // 空数组一路 onSubmit([])，字段会被清成「请选择必填」——
  // v2.0.15 真机上那个 readback 就是这么来的（比不点更糟）。
  if (!act || act.ok) {
    // 部分组件需要再点「确定」（双栏选择器的按钮在面板外面）
    await clickConfirm(panel);
  }
  try {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  } catch (_) {}
  await waitMaskGone();

  const readback = readTriggerText(field);
  if (readback && sameOption(readback, m.option.label)) return { status: 'filled', via: 'panel', readback };
  // 有值节点却读到空 = 组件明确处在"未选"态（占位「请选择必填」），是没填上。
  // 只有整块里压根没有值节点时，才低置信度放行 —— 混为一谈就是假成功。
  if (!readback && !hasValueNodes(field)) {
    return { status: 'filled', via: 'panel', readback: '', lowConfidence: true };
  }

  // 读回不对，分三种情况：
  // ① 点歪了（要「汉族」点成「黎族」）→ 重开面板按标签重新定位再点一次；
  // ② 压根没提交（真机 v2.0.11：能过滤、能点中、也点了确定，值就是不变）
  //    → 这时候再点一百次也没用，必须换键盘：输入过滤 + ↓ 高亮 + 回车。
  // ③ v2.0.16 才搞清楚的真因：地区弹层的勾选控件是左侧 svg 图标，点文字无效，
  //    于是"点了确定但 selectData 是空的" → onSubmit([]) → 字段被清成「请选择必填」。
  const byKeys = await commitByInput(field, panel, plan);
  if (byKeys.ok) {
    return {
      status: 'filled',
      via: byKeys.via,
      readback: byKeys.readback,
      attempts: ['panel-readback-mismatch', `${byKeys.via}:ok`],
    };
  }

  const retried = await repickOption(field, m.option.label);
  if (retried && sameOption(retried, m.option.label)) {
    return { status: 'filled', via: 'panel', readback: retried, attempts: ['repick:ok'] };
  }
  return {
    status: 'failed',
    reason: readback ? 'readback-mismatch' : 'readback-empty',
    readback: retried || readback,
    expected: m.option.label,
    // 选项点击的局部反馈：地区弹层能给出 icon / icon-nochange / icon-disabled，
    // 有它就不必再靠"回读为空"去反推到底是点不动还是没提交
    itemClick: act ? act.via : 'text',
    attempts: [
      'panel-readback-mismatch',
      `keys:${byKeys.reason}`,
      'repick:' + (retried ? 'still-mismatch' : 'fail'),
    ],
  };
}
