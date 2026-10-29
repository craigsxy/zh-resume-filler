// 侧边栏：资料库管理 + 触发填充 + 填充报告
// 设计原则（v2.0.11 起）：侧边栏里**不做任何选择交互**，所有字段都是文本输入框，
// 由用户自己填写。枚举词表只留在 schema/resolver 里，供填充时做同义词归一。
import { CATEGORIES, SCHEMA_VERSION, HINTS } from '../schema.js';
import { normalize } from '../util.js';
import { completion, exportPayload, parseImport, sanitizeProfile, sortEducation, sampleProfile } from './library.js';

const STORAGE_KEY = 'resumeProfile';
// 多份简历：当前这份始终在 STORAGE_KEY（content script / 老版本都只认它），
// 其余的存在 LIB_KEY.items[].data 里；切换时互换
const LIB_KEY = 'resumeLibrary';
const APPS_KEY = 'applications';
const APPS_VIEW = '__apps';
let library = { activeId: 'r1', items: [{ id: 'r1', name: '我的简历', updatedAt: Date.now() }] };
let applications = [];
const $ = s => document.querySelector(s);

let profile = {};
let activeId = 'personal';
let saveTimer;

function defaults() {
  return Object.fromEntries(CATEGORIES.map(c => [c.id, c.multiple ? [] : [{}]]));
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    profile.schemaVersion = SCHEMA_VERSION;
    const item = activeItem();
    if (item) item.updatedAt = Date.now();
    chrome.storage.local.set({ [STORAGE_KEY]: profile, [LIB_KEY]: library });
  }, 180);
  renderProgress();
}

function activeItem() {
  return (library.items || []).find(x => x.id === library.activeId) || null;
}

const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- 完成度 ----------

function renderProgress() {
  const box = $('#progress');
  if (!box) return;
  const st = completion(profile);
  box.querySelector('.progress-text').innerHTML =
    `已填写 <b>${st.filled}</b> / ${st.total} 个字段 · 完成度 <b>${st.percent}%</b>` +
    (st.total - st.filled > 0 ? ` · 未补齐 ${st.total - st.filled} 项` : '');
  box.querySelector('.progress-fill').style.width = st.percent + '%';
  // 导航上的分类计数就地刷新（不重建导航，敲字时不闪）
  document.querySelectorAll('#category-nav .nav-item').forEach(b => {
    const c = CATEGORIES.find(x => x.id === b.dataset.id);
    const cnt = b.querySelector('.nav-count');
    if (!c || !cnt) return;
    const cs = st.byCategory[c.id];
    if (c.custom) cnt.textContent = String((profile[c.id] || []).length || '');
    else cnt.textContent = cs && cs.total ? `${cs.filled}/${cs.total}` : '';
    cnt.classList.toggle('done', !!(cs && cs.total && cs.filled === cs.total));
  });
  // 记录卡片上的"未补齐 N 项"
  const cat = CATEGORIES.find(x => x.id === activeId);
  if (cat && !cat.custom) {
    const recs = (st.byCategory[cat.id] || {}).records || [];
    document.querySelectorAll('#records .record-card').forEach((card, i) => {
      const tag = card.querySelector('.record-missing');
      if (!tag || !recs[i]) return;
      const n = recs[i].missing.length;
      tag.textContent = n ? `未补齐 ${n} 项` : '已填全';
    });
  }
}

// ---------- 多份简历 ----------

function persistAll() {
  profile.schemaVersion = SCHEMA_VERSION;
  return chrome.storage.local.set({ [STORAGE_KEY]: profile, [LIB_KEY]: library });
}

function renderLibrary() {
  const sel = $('#resume-select');
  const name = $('#resume-name');
  if (!sel || !name) return;
  sel.replaceChildren();
  for (const it of library.items) {
    const o = document.createElement('option');
    o.value = it.id;
    o.textContent = it.name || '未命名简历';
    if (it.id === library.activeId) o.selected = true;
    sel.append(o);
  }
  const cur = activeItem();
  name.value = (cur && cur.name) || '';
  $('#resume-delete').disabled = library.items.length <= 1;
}

function rerenderAll() {
  renderLibrary();
  renderNav();
  renderSection();
  renderProgress();
}

/** 切到另一份：当前这份收进库里，目标那份放到 STORAGE_KEY */
async function switchResume(id) {
  if (id === library.activeId) return;
  const cur = activeItem();
  const next = library.items.find(x => x.id === id);
  if (!next) return;
  if (cur) cur.data = JSON.parse(JSON.stringify(profile));
  profile = sanitizeProfile(next.data || {});
  delete next.data;
  library.activeId = id;
  normalizeDates();
  await persistAll();
  rerenderAll();
}

async function createResume(name, data) {
  const cur = activeItem();
  if (cur) cur.data = JSON.parse(JSON.stringify(profile));
  const item = { id: uid(), name, updatedAt: Date.now() };
  library.items.push(item);
  library.activeId = item.id;
  profile = sanitizeProfile(data || {});
  normalizeDates();
  await persistAll();
  rerenderAll();
  return item;
}

function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 导入：读文件 → 解析 → 作为一份新简历加入并切过去（不覆盖现有的） */
export async function importResumeText(text, fallbackName = '导入的简历') {
  const r = parseImport(text);
  if (!r.ok) {
    showNotice('导入失败：' + r.error, true);
    return null;
  }
  const item = await createResume(r.name || fallbackName, r.profile);
  showNotice(`已导入「${item.name}」并切换过去。`);
  return item;
}

function wireLibrary() {
  const sel = $('#resume-select');
  if (!sel) return;
  sel.onchange = () => switchResume(sel.value);
  $('#resume-name').oninput = () => {
    const cur = activeItem();
    if (!cur) return;
    cur.name = $('#resume-name').value;
    const opt = sel.querySelector(`option[value="${cur.id}"]`);
    if (opt) opt.textContent = cur.name || '未命名简历';
    save();
  };
  $('#resume-new').onclick = () => createResume(`简历 ${library.items.length + 1}`, {});
  $('#resume-copy').onclick = () => {
    const cur = activeItem();
    return createResume(`${(cur && cur.name) || '简历'} 副本`, JSON.parse(JSON.stringify(profile)));
  };
  // 删除要点两次（侧边栏里 confirm() 不一定可用），3 秒内再点一次才真删
  let armed = 0;
  $('#resume-delete').onclick = async () => {
    const btn = $('#resume-delete');
    if (library.items.length <= 1) return;
    if (Date.now() - armed > 3000) {
      armed = Date.now();
      btn.textContent = '再点一次确认删除';
      setTimeout(() => (btn.textContent = '删除'), 3000);
      return;
    }
    armed = 0;
    btn.textContent = '删除';
    const goneId = library.activeId;
    const next = library.items.find(x => x.id !== goneId);
    library.items = library.items.filter(x => x.id !== goneId);
    library.activeId = next.id;
    profile = sanitizeProfile(next.data || {});
    delete next.data;
    normalizeDates();
    await persistAll();
    rerenderAll();
    showNotice('已删除这份简历。');
  };
  $('#resume-export').onclick = () => {
    const cur = activeItem();
    const name = (cur && cur.name) || '我的简历';
    downloadJSON(`${name}.json`, exportPayload(name, profile));
  };
  $('#resume-import').onclick = () => $('#resume-import-file').click();
  $('#resume-import-file').onchange = async () => {
    const input = $('#resume-import-file');
    const file = input.files && input.files[0];
    if (!file) return;
    const text = await file.text();
    input.value = '';
    await importResumeText(text, file.name.replace(/\.json$/i, ''));
  };
  $('#resume-sample').onclick = async () => {
    await createResume('示例简历（虚构）', sampleProfile());
    showNotice('已新建一份示例简历，可以直接拿去测试网申页面。');
  };
}

// ---------- 投递记录 ----------

const APP_STATUS = ['已填写', '已投递', '笔试', '面试', 'Offer', '未通过', '放弃'];

async function logApplication(tab, report) {
  try {
    const url = String((tab && tab.url) || '');
    const host = (() => {
      try {
        return new URL(url).host;
      } catch (_) {
        return '';
      }
    })();
    // 同一个页面重复填只更新，不刷屏
    const key = url.split('#')[0];
    let row = applications.find(a => a.key === key);
    if (!row) {
      row = { id: uid(), key, url, host, title: String((tab && tab.title) || host), status: '已填写', note: '', createdAt: Date.now() };
      applications.unshift(row);
    }
    row.updatedAt = Date.now();
    row.resume = (activeItem() && activeItem().name) || '';
    row.filled = (report && report.filled) || 0;
    row.failed = (report && report.failed) || 0;
    applications = applications.slice(0, 500);
    await chrome.storage.local.set({ [APPS_KEY]: applications });
    renderAppsCount();
    if (activeId === APPS_VIEW) renderApps();
  } catch (_) {}
}

function renderAppsCount() {
  const c = $('#apps-count');
  if (c) c.textContent = applications.length ? String(applications.length) : '';
}

function saveApps() {
  chrome.storage.local.set({ [APPS_KEY]: applications });
}

function renderApps() {
  const view = $('#apps-view');
  view.replaceChildren();
  if (!applications.length) {
    const p = document.createElement('div');
    p.className = 'empty-state';
    p.textContent = '还没有投递记录。每次点「填写当前网页」都会在这里记一笔，状态可以自己改。';
    view.append(p);
    return;
  }
  for (const a of applications) {
    const row = document.createElement('div');
    row.className = 'app-row';
    const top = document.createElement('div');
    top.className = 'app-top';
    const title = document.createElement('a');
    title.className = 'app-title';
    title.textContent = a.title || a.host;
    title.href = a.url;
    title.target = '_blank';
    title.rel = 'noreferrer';
    const meta = document.createElement('span');
    meta.className = 'app-meta';
    const d = new Date(a.updatedAt || a.createdAt || Date.now());
    meta.textContent = `${d.getMonth() + 1}/${d.getDate()} · 填 ${a.filled || 0}${a.failed ? ' · 失败 ' + a.failed : ''}${a.resume ? ' · ' + a.resume : ''}`;
    top.append(title, meta);

    const ctl = document.createElement('div');
    ctl.className = 'app-ctl';
    const st = document.createElement('select');
    st.setAttribute('aria-label', '投递状态');
    for (const s0 of APP_STATUS) {
      const o = document.createElement('option');
      o.value = o.textContent = s0;
      if (s0 === a.status) o.selected = true;
      st.append(o);
    }
    st.onchange = () => {
      a.status = st.value;
      saveApps();
    };
    const note = document.createElement('input');
    note.type = 'text';
    note.placeholder = '备注（岗位 / 笔试时间 / 内推人…）';
    note.value = a.note || '';
    note.oninput = () => {
      a.note = note.value;
      saveApps();
    };
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'delete-button';
    del.textContent = '✕';
    del.title = '删除这条记录';
    del.onclick = () => {
      applications = applications.filter(x => x !== a);
      saveApps();
      renderAppsCount();
      renderApps();
    };
    ctl.append(st, note, del);
    row.append(top, ctl);
    view.append(row);
  }
}

/** v1 → v2 迁移：只补元数据与日期精度，字段名不动，老数据零改写；迁移前整份备份 */
const pad2 = n => String(n).padStart(2, '0');

function normalizeDates() {
  for (const c of CATEGORIES) {
    const records = profile[c.id] || [];
    for (const rec of records) {
      if (!rec) continue;
      for (const f of c.fields) {
        if (f.kind !== 'date') continue;
        const v = rec[f.label];
        if (typeof v !== 'string') continue;
        const m = v.match(/^(\d{4})\s*[-/.年]\s*(\d{1,2})(?:\s*[-/.月]\s*(\d{1,2}))?/);
        if (!m) continue;
        const ym = `${m[1]}-${pad2(m[2])}`;
        if (f.precision === 'month') {
          // 月粒度字段：日没有意义，直接裁掉
          rec[f.label] = ym;
        } else {
          // 日粒度字段：v1 存的是 YYYY-MM，**保留"仅年月"原样**，不擅自补成 01 号
          // （补了就等于替用户编了一个"日"，填到只看日期的网页上会变成 2020-09-01）
          const next = m[3] ? `${ym}-${pad2(m[3])}` : ym;
          if (next !== v) rec[f.label] = next;
        }
      }
    }
  }
}

async function load() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const stored = data[STORAGE_KEY];
  try {
    const lib = (await chrome.storage.local.get(LIB_KEY))[LIB_KEY];
    if (lib && Array.isArray(lib.items) && lib.items.length) library = lib;
    const apps = (await chrome.storage.local.get(APPS_KEY))[APPS_KEY];
    if (Array.isArray(apps)) applications = apps;
  } catch (_) {}
  if (!library.items.some(x => x.id === library.activeId)) library.activeId = library.items[0].id;
  if (stored && !stored.schemaVersion) {
    try {
      await chrome.storage.local.set({ [`${STORAGE_KEY}_v1_backup`]: stored });
    } catch (_) {}
  }
  profile = { ...defaults(), ...(stored || {}) };
  profile.schemaVersion = SCHEMA_VERSION;
  CATEGORIES.forEach(c => {
    if (!Array.isArray(profile[c.id])) profile[c.id] = c.multiple ? [] : [{}];
  });
  normalizeDates();
  renderLibrary();
  renderNav();
  renderSection();
  renderAppsCount();
  save();
}

function renderNav() {
  const nav = $('#category-nav');
  nav.replaceChildren();
  CATEGORIES.forEach(c => {
    const b = document.createElement('button');
    b.className = 'nav-item' + (activeId === c.id ? ' active' : '');
    b.type = 'button';
    b.dataset.id = c.id;
    const name = document.createElement('span');
    name.textContent = c.name;
    const count = document.createElement('span');
    count.className = 'nav-count';
    count.textContent = c.multiple ? String((profile[c.id] || []).length) : '';
    b.append(name, count);
    b.onclick = () => {
      activeId = c.id;
      renderNav();
      renderSection();
    };
    nav.append(b);
  });
  const apps = $('#apps-nav');
  if (apps) {
    apps.classList.toggle('active', activeId === APPS_VIEW);
    apps.onclick = () => {
      activeId = APPS_VIEW;
      renderNav();
      renderSection();
    };
  }
  renderProgress();
}

function addTag(label, text) {
  const tag = document.createElement('span');
  tag.className = 'field-tag';
  tag.textContent = text;
  label.append(tag);
}

/**
 * 枚举字段不再提供"选择"：一律是普通输入框，由用户自己填写。
 * 原因：插件里选得再好，页面上仍然是另一套交互（自绘弹层），
 * 两边语义对不齐反而增加"我以为选对了"的误判。词表仍然保留在
 * schema/resolver 里，只用于填充时做同义词归一（填"傣"也能对上"傣族"）。
 */
const DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function createField(field, record) {
  const wrap = document.createElement('div');
  wrap.className = 'field' + (field.kind === 'textarea' ? ' wide' : '');

  const label = document.createElement('label');
  label.textContent = field.label;

  const isPhoto = field.kind === 'upload';
  // 上传字段分两种：照片（图片）和简历附件（PDF / Word）
  const isDoc = isPhoto && field.slot === 'personal.resume';
  const el =
    field.kind === 'textarea'
      ? document.createElement('textarea')
      : document.createElement('input');

  // textarea 的 type 是只读的（赋了也没用，jsdom 里还会直接抛），只有 input 才设 type
  if (el.tagName === 'INPUT') {
    if (isPhoto) {
      el.type = 'file';
      el.accept = isDoc
        ? 'application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx'
        : 'image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp';
    } else if (field.kind === 'date') {
      // 所有日期字段都是日粒度（v2.0.19）：和"出生日期"完全同一种处理，不再有"年月"输入框
      el.type = 'date';
    } else if (field.kind === 'number') {
      el.type = 'number';
    } else {
      el.type = 'text';
    }
  }

  // "仅年月"的老数据（v1 就是按 YYYY-MM 存的）：
  // <input type="date"> 不接受 YYYY-MM，直接赋值会被浏览器清成空，看起来像资料丢了。
  // 这里只在**显示**上补 01 号，资料库里仍是 YYYY-MM，填充时按年月精度走
  // （不会把 01 号当成用户填的日期写进网页）。
  const raw = record[field.label];
  const monthOnly =
    field.kind === 'date' && typeof raw === 'string' && /^\d{4}-\d{2}$/.test(raw);
  if (monthOnly) addTag(label, '仅年月');

  if (!isPhoto) {
    el.value = raw || '';
    if (monthOnly) el.value = `${raw}-01`;
    if (!el.placeholder) el.placeholder = HINTS[field.slot] || '选填';
  }
  el.setAttribute('aria-label', field.label);

  el.oninput = () => {
    record[field.label] = el.value;
    save();
  };

  if (isPhoto) {
    el.onchange = () => {
      const file = el.files && el.files[0];
      if (!file) return;
      if (isDoc) {
        const okType = DOC_TYPES.includes(file.type) || /\.(pdf|docx?)$/i.test(file.name || '');
        if (!okType || file.size > 8 * 1024 * 1024) {
          el.value = '';
          showNotice('请选择 8MB 以内的 PDF、DOC 或 DOCX 简历。', true);
          return;
        }
      } else if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        el.value = '';
        showNotice('请选择 5MB 以内的 JPG、JPEG、PNG 或 WEBP 图片。', true);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        record[field.label] = { name: file.name, type: file.type, dataUrl: reader.result };
        save();
        renderSection();
      };
      reader.readAsDataURL(file);
    };
  }

  // 老的「自定义字段」分类：这里的"字段名称"也是一条自定义字段名，同样要监测唯一性
  const isLegacyCustomName = field.slot === 'custom.name';
  if (isLegacyCustomName) {
    wrap.classList.add('custom-name-field');
    el.addEventListener('input', refreshCustomWarnings);
  }

  wrap.append(label, el);
  if (isLegacyCustomName) {
    const warn = document.createElement('p');
    warn.className = 'custom-warn';
    warn.hidden = true;
    wrap.append(warn);
  }
  const current = record[field.label];
  if (isDoc && current && current.dataUrl) {
    const note = document.createElement('p');
    note.className = 'section-description';
    note.textContent = `已选：${current.name || '简历'}`;
    wrap.append(note);
  } else if (isPhoto && current && current.dataUrl) {
    const preview = document.createElement('img');
    preview.src = current.dataUrl;
    preview.alt = '已选照片';
    preview.className = 'photo-preview';
    wrap.append(preview);
  }
  return wrap;
}

// ---------- 分类下的自定义字段 ----------
// 存在记录里的 __custom: [{ name, value }]。
// 填充时 binder 会把这些条目当成"额外的候选字段"，用用户填的字段名去匹配网页标签，
// 所以字段名越接近网页上的写法，命中率越高。

function customRowsOf(record) {
  return record && Array.isArray(record.__custom) ? record.__custom : [];
}

function renderCustom(record, category) {
  // 「自定义字段」分类本身就是"字段名 + 内容"，再加一层就重复了
  if (!record || category.custom) return null;

  const box = document.createElement('div');
  box.className = 'custom-fields';

  const head = document.createElement('div');
  head.className = 'custom-head';
  const title = document.createElement('span');
  title.className = 'custom-title';
  title.textContent = '自定义字段';
  const add = document.createElement('button');
  add.className = 'link-button';
  add.type = 'button';
  add.textContent = '＋ 添加';
  add.onclick = () => {
    // v2.0.26：加一条 = 同分类**每条记录**都加上这个字段（字段名同步、内容各填各的）。
    // 只加当前这条的话，其他记录的网页块就永远等不到这个字段。
    for (const r of profile[category.id] || []) {
      if (!Array.isArray(r.__custom)) r.__custom = [];
      r.__custom.push({ name: '', value: '' });
    }
    save();
    renderSection();
  };
  head.append(title, add);
  box.append(head);

  const rows = customRowsOf(record);
  if (!rows.length) {
    const hint = document.createElement('p');
    hint.className = 'custom-hint';
    hint.textContent = '网页上还有这里没有的字段？按网页的标签名加一条，填的时候会自动对上。';
    box.append(hint);
    return box;
  }

  const listEl = document.createElement('div');
  listEl.className = 'custom-rows';
  rows.forEach((item, i) => {
    const box2 = document.createElement('div');
    box2.className = 'custom-item';

    const row = document.createElement('div');
    row.className = 'custom-row';

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'custom-name';
    name.placeholder = '字段名（照网页标签写）';
    name.value = item.name || '';
    name.setAttribute('aria-label', '自定义字段名');
    name.oninput = () => {
      item.name = name.value;
      // v2.0.26：字段名在同分类的所有记录上**按序号同步**（第 i 行都是同一个字段），
      // 内容保持各自独立。不同步的话，其他记录的网页块对不上这个字段名。
      for (const r of profile[category.id] || []) {
        if (r === record) continue;
        if (!Array.isArray(r.__custom)) r.__custom = [];
        while (r.__custom.length <= i) r.__custom.push({ name: '', value: '' });
        r.__custom[i].name = name.value;
      }
      // v2.0.29：同步**界面上**其他记录的同位输入框。只同步数据的话，其他记录的
      // 输入框还空着、挂着"没填字段名"提示，看起来就像没同步（用户截图证据：
      // 信息1 填了"解决"，信息2 还是空）。不重渲染，只就地改值，不会丢焦点。
      document.querySelectorAll('#records .record-card').forEach(card => {
        const rows = card.querySelectorAll('.custom-item');
        const twin = rows[i] && rows[i].querySelector('.custom-name');
        if (twin && twin !== name) twin.value = name.value;
      });
      save();
      // 就地刷新重名提示：不重渲染，否则每敲一个字都会丢焦点
      refreshCustomWarnings();
    };

    const value = document.createElement('input');
    value.type = 'text';
    value.className = 'custom-value';
    value.placeholder = '内容';
    value.value = item.value || '';
    value.setAttribute('aria-label', '自定义字段内容');
    value.oninput = () => {
      item.value = value.value;
      save();
    };

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'delete-button';
    del.textContent = '✕';
    del.title = '删除这个自定义字段';
    del.onclick = () => {
      // v2.0.26：删也按序号同步到所有记录，保持"每条记录都有同一组字段"
      for (const r of profile[category.id] || []) {
        if (!Array.isArray(r.__custom)) continue;
        r.__custom.splice(i, 1);
        if (!r.__custom.length) delete r.__custom;
      }
      save();
      renderSection();
    };

    const warn = document.createElement('p');
    warn.className = 'custom-warn';
    warn.hidden = true;

    row.append(name, value, del);
    box2.append(row, warn);
    listEl.append(box2);
  });
  box.append(listEl);
  return box;
}

/** 全部内置字段的标签 + 别名（归一后）：自定义字段名不能和它们撞 */
const BUILTIN_NAMES = new Set(
  CATEGORIES.flatMap(c => (c.custom ? [] : c.fields.flatMap(f => f.alias.map(a => normalize(a)))))
);

/**
 * 同一分类下的字段唯一性监测。
 * 三类问题都会让"看起来加了字段、其实填不进去"，必须在输入时就点出来：
 *   ① 字段名空着 → 无从匹配
 *   ② 与内置字段重名 → 内置优先，自定义那条会被丢掉（binder 里刻意这么做：
 *      否则同一个标签会精确命中两个槽 → 判成歧义 → 连内置字段都填不上）
 *   ③ **同一条记录里**与另一条自定义字段重名 → 只有第一条生效
 *     （v2.0.26 起同名字段出现在**不同记录**上是预期行为——每条记录各填各的值，
 *      不再算重名）
 * 直接读 DOM（而不是读 profile），这样敲字时能即时刷新，不用重渲染（重渲染会丢焦点）。
 */
function customNameCells() {
  const out = [];
  for (const it of document.querySelectorAll('#records .custom-item')) {
    out.push({ box: it, input: it.querySelector('.custom-name'), warn: it.querySelector('.custom-warn') });
  }
  // 老的「自定义字段」分类：一条记录的"字段名称"就是一条自定义字段名
  for (const it of document.querySelectorAll('#records .field.custom-name-field')) {
    out.push({ box: it, input: it.querySelector('input'), warn: it.querySelector('.custom-warn') });
  }
  return out;
}

function refreshCustomWarnings() {
  const cells = customNameCells();
  if (!cells.length) return;
  const names = cells.map(c => String((c.input && c.input.value) || '').trim());
  const keys = names.map(normalize);

  // 分组键：
  //   · 普通分类：字段内容按记录独立（信息1、信息2 上同名的"年龄"各填各的值）→
  //     按**记录卡片**分组，跨记录的同名不算重名；
  //   · 老的「自定义字段」分类：字段名是全局的（跨记录同名会撞、只生效第一条）→ 全算一组。
  // 关键：分组键不能用 `元素 + '|' + 名字` 这种字符串拼接 —— 元素会被 toString 成
  // "[object HTMLElement]"，所有 .record-card 拼出来是同一个串，跨记录分组就形同虚设，
  // 表现就是"信息2 自动同步出来的同名字段"也被误判成重名（用户 2026-10-22 反馈）。
  const GLOBAL = Symbol('global');
  const groupOf = c => {
    if (c.box.classList && c.box.classList.contains('custom-name-field')) return GLOBAL;
    return (c.box.closest && c.box.closest('.record-card')) || c.box;
  };
  const counts = new Map(); // 组(元素/Symbol) → Map(归一化名 → 次数)
  cells.forEach((c, i) => {
    if (!keys[i]) return;
    const g = groupOf(c);
    let inner = counts.get(g);
    if (!inner) {
      inner = new Map();
      counts.set(g, inner);
    }
    inner.set(keys[i], (inner.get(keys[i]) || 0) + 1);
  });

  cells.forEach((cell, i) => {
    let text = '';
    if (!names[i]) text = '没填字段名，这条不会被填充';
    else if (BUILTIN_NAMES.has(keys[i])) text = '和内置字段重名：内置的优先，这条不会被填进去';
    else {
      const inner = counts.get(groupOf(cell));
      if (inner && (inner.get(keys[i]) || 0) > 1)
        text = '同一条记录里有同名字段，只有第一条生效';
    }
    const warn = cell.warn;
    if (warn) {
      warn.textContent = text;
      warn.hidden = !text;
    }
    if (cell.box) cell.box.classList.toggle('has-warning', !!text);
  });
}

function renderSection() {
  const appsView = $('#apps-view');
  if (activeId === APPS_VIEW) {
    $('#section-title').textContent = '投递记录';
    $('#section-description').textContent = '每次填写网页自动记一笔；状态和备注自己维护，只存在本机。';
    $('#add-record').hidden = true;
    const sortBtn = $('#sort-edu');
    if (sortBtn) sortBtn.hidden = true;
    $('#records').replaceChildren();
    $('#empty-state').hidden = true;
    if (appsView) {
      appsView.hidden = false;
      renderApps();
    }
    return;
  }
  if (appsView) appsView.hidden = true;
  const c = CATEGORIES.find(x => x.id === activeId);
  $('#section-title').textContent = c.name;
  ensureSortButton(c);
  const base = c.multiple
    ? '可添加多条记录。同名多记录会按"学校 / 单位"等强键与网页区块自动配对。'
    : '所有字段均为选填。';
  $('#section-description').textContent = c.custom
    ? '每条记录的"字段名称"就是网页上的标签名，填充时按它去对位。'
    : base + '每个分类都可以在下方加自定义字段。';
  $('#add-record').hidden = !c.multiple;

  const list = $('#records');
  list.replaceChildren();
  const records = profile[c.id] || [];
  $('#empty-state').hidden = records.length > 0;

  records.forEach((record, index) => {
    const card = document.createElement('section');
    card.className = 'record-card';

    const head = document.createElement('div');
    head.className = 'record-header';
    const title = document.createElement('span');
    title.className = 'record-title';
    title.textContent = c.multiple ? `${c.name} ${index + 1}` : c.name;
    if (!c.custom) {
      const missing = document.createElement('span');
      missing.className = 'record-missing';
      title.append(missing);
    }
    head.append(title);
    if (c.multiple) {
      const tools = document.createElement('div');
      tools.className = 'record-tools';
      const move = (dir, text) => {
        const b = document.createElement('button');
        b.className = 'link-button';
        b.type = 'button';
        b.textContent = text;
        const to = index + dir;
        b.disabled = to < 0 || to >= records.length;
        b.onclick = () => {
          const arr = profile[c.id];
          [arr[index], arr[to]] = [arr[to], arr[index]];
          save();
          renderSection();
        };
        return b;
      };
      const del = document.createElement('button');
      del.className = 'delete-button';
      del.type = 'button';
      del.textContent = '删除';
      del.onclick = () => {
        profile[c.id].splice(index, 1);
        save();
        renderNav();
        renderSection();
      };
      tools.append(move(-1, '上移'), move(1, '下移'), del);
      head.append(tools);
    }

    const grid = document.createElement('div');
    grid.className = 'field-grid';
    c.fields.forEach(field => grid.append(createField(field, record)));
    card.append(head, grid);
    const custom = renderCustom(record, c);
    if (custom) card.append(custom);
    list.append(card);
  });

  refreshCustomWarnings();
  renderProgress();
}

/** 教育经历：一键按学历从高到低排（很多网申要求"从最高学历填起"） */
function ensureSortButton(c) {
  let b = $('#sort-edu');
  if (!b) {
    b = document.createElement('button');
    b.id = 'sort-edu';
    b.type = 'button';
    b.className = 'secondary';
    b.textContent = '按学历排序';
    b.onclick = () => {
      profile.education = sortEducation(profile.education || []);
      save();
      renderSection();
      showNotice('已按学历从高到低排好。');
    };
    $('#add-record').before(b);
  }
  b.hidden = c.id !== 'education' || (profile.education || []).length < 2;
}

$('#add-record').onclick = () => {
  const c = CATEGORIES.find(x => x.id === activeId);
  profile[c.id].push({});
  save();
  renderNav();
  renderSection();
};

function showNotice(text, error = false) {
  const n = $('#notice');
  n.textContent = text;
  n.classList.toggle('error', error);
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 4600);
}

// ---------- 填充报告 ----------

const STATUS_TEXT = {
  filled: '已填',
  'filled-low': '低置信',
  skipped: '已跳过',
  failed: '失败',
  empty: '无资料',
};

const REASON_TEXT = {
  'label-uncertain': '网页标签无法确定对应字段',
  'duplicate-slot': '同一段里出现了两次相同字段（多段经历没切分开），这一处跳过',
  'no-record': '网页区块在资料库中无对应记录',
  'option-no-match': '选项里没有匹配值',
  'option-ambiguous': '多个选项都可能，未敢选',
  'no-options': '控件没有可选项',
  'checkbox-unsupported': '多选组暂不支持',
  'panel-not-open': '下拉/日历面板未打开',
  'date-failed': '日期五级降级均失败，已回滚',
  'cleared-by-site': '写入成功后网页把它清掉了（重试一次仍被清），已如实标记',
  'date-verify-failed': '写入后回读不一致，已回滚',
  'value-not-a-date': '资料值不是合法日期',
  'readback-mismatch': '写入后回读不一致',
  'no-el': '找不到控件',
  'no-photo': '资料库未上传照片/简历附件',
  'card-commit-blocked': '点了卡片里的「确认」，但网页没保存（多半是有必填项没填，见说明）',
  'not-file-input': '网页不是文件上传控件',
  'upload-type-mismatch': '网页上传控件不收这种文件类型（照片 / 简历附件放错了位置），未上传',
  'control-kind-mismatch': '控件类型与字段不匹配，未写入',
  'cascader-unsupported': '省市区级联暂不支持，已跳过',
  'custom-no-match': '资料库有这个自定义字段，但网页上没有能对上的同名标签',
  'custom-name-duplicate': '自定义字段名与内置字段/其他自定义字段重名，未参与匹配',
  'custom-name-empty': '自定义字段没填名字，未参与匹配',
};

let lastReport = null;

function renderReport(report) {
  const box = $('#report');
  const summary = $('#report-summary');
  const body = $('#report-body');
  box.hidden = false;
  summary.replaceChildren();
  body.replaceChildren();

  if (!report || report.error) {
    const p = document.createElement('p');
    p.className = 'report-error';
    p.textContent = '填写失败：' + ((report && report.error) || '未知错误');
    summary.append(p);
    return;
  }

  const chips = [
    ['识别字段', report.total],
    ['已填', report.filled],
    ['低置信', report.lowConfidence],
    ['跳过', report.skipped],
    ['失败', report.failed],
  ];
  chips.forEach(([k, v]) => {
    const c = document.createElement('span');
    c.className = 'chip';
    c.innerHTML = `<b>${v}</b> ${k}`;
    summary.append(c);
  });

  const rows = (report.results || []).filter(r => r.status !== 'empty');

  if (report.sections && report.sections.length) {
    const line = document.createElement('p');
    line.className = 'report-sections';
    line.textContent =
      '识别区块：' +
      report.sections
        .map(s => `${s.title || '(未命名)'}×${s.blocks}块/${s.fields ?? '?'}字段`)
        .join('　');
    body.append(line);
  }

  // 多段经历扩充：资料库里有 N 段、网页只渲染 1 段时，是先点网页的「添加」把容器点出来的。
  // 这一步会改动页面结构，必须让用户看得见"我点了几次、点了哪个按钮"。
  if (report.repeat && ((report.repeat.added || 0) > 0 || (report.repeat.log || []).length)) {
    const line = document.createElement('p');
    line.className = 'report-sections';
    const added = report.repeat.added || 0;
    const log = (report.repeat.log || []).join('；');
    const onlySaved = (report.repeat.log || []).every(l => /已保存在页面上/.test(l));
    line.textContent =
      (added > 0 ? `自动新增 ${added} 个经历区块：` : onlySaved ? '多段经历：' : '未能自动新增经历区块：') + log;
    body.append(line);
  }

  // 原因分布：一眼看出这次是"标签取不到"还是"选项匹配不上"
  if (report.reasonCounts && Object.keys(report.reasonCounts).length) {
    const line = document.createElement('p');
    line.className = 'report-reasons';
    line.textContent =
      '原因分布：' +
      Object.entries(report.reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${REASON_TEXT[k] || k}×${v}`)
        .join('；');
    body.append(line);
  }

  if (!rows.length) {
    const p = document.createElement('p');
    p.className = 'report-empty';
    p.textContent = '没有可报告的内容（页面字段在资料库里都没有值）。';
    body.append(p);
    return;
  }

  const table = document.createElement('table');
  table.className = 'report-table';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>区块</th><th>字段</th><th>值</th><th>状态</th><th>说明</th></tr>';
  const tbody = document.createElement('tbody');

  rows.forEach(r => {
    const tr = document.createElement('tr');
    const statusKey = r.status === 'filled' && r.lowConfidence ? 'filled-low' : r.status;
    const reason = r.reason ? REASON_TEXT[r.reason] || r.reason : '';
    const extra = r.available && r.available.length ? `（网页选项：${r.available.slice(0, 6).join(' / ')})` : '';
    const attempts = r.attempts && r.attempts.length ? `（尝试：${r.attempts.join(' → ')}）` : '';
    const parts = r.parts && r.parts.length ? `（取到的标签：${r.parts.join(' / ')}）` : '';
    const hints = r.hints && r.hints.length ? `（可见面板：${r.hints.slice(0, 4).join(' / ')}）` : '';
    const panelText = r.panelText ? `（面板内容：${r.panelText}）` : '';
    // 资料是日粒度、网页控件只到年月：写成功了，但要让用户知道"日没写进去（网页不收）"
    const downgraded = r.downgraded === 'month' ? '（网页只到年月，已按年月写入）' : '';
    // 站点把 6.5 强行格式化成 6.50000
    const padded = r.note === 'site-padded' ? '（网页把数值补成了固定小数位，已按你的原值回写）' : '';
    const cells = [
      r.section ? `${r.section}${r.block > 0 ? ' #' + (r.block + 1) : ''}` : '未识别区块',
      r.label || '（未取到标签）',
      r.value,
      STATUS_TEXT[statusKey] || r.status,
      [reason + downgraded + padded + extra + attempts + parts + hints + panelText, r.readback && r.status !== 'filled' ? `回读：${r.readback}` : '']
        .filter(Boolean)
        .join('；'),
    ];
    cells.forEach((text, i) => {
      const td = document.createElement('td');
      td.textContent = text || '';
      if (i === 3) td.className = `st st-${statusKey}`;
      tr.append(td);
    });
    tbody.append(tr);
  });

  table.append(thead, tbody);
  body.append(table);
}

$('#report-close').onclick = () => {
  $('#report').hidden = true;
};

$('#report-copy').onclick = async () => {
  try {
    const text = JSON.stringify(lastReport, null, 2);
    await navigator.clipboard.writeText(text);
    showNotice('诊断信息已复制，可直接发给开发者定位问题。');
  } catch (_) {
    showNotice('复制失败，请用控制台查看。', true);
  }
};

// ---------- 触发填充 ----------

// 头部显示扩展版本：排查"改了还是没填"时，先确认侧边栏跑的是不是新包。
// （扩展改完必须去 chrome://extensions 点一次刷新，否则跑的还是旧 bundle。）
try {
  const v = chrome && chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : null;
  if (v) $('#panel-version').textContent = `仅保存在此设备 · v${v}`;
} catch (_) {}

$('#fill-page').onclick = async () => {
  const btn = $('#fill-page');
  btn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) {
      showNotice('请先打开需要填写的网申网页。', true);
      return;
    }
    const inject = async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['main-world.js'],
          world: 'MAIN',
        });
      } catch (_) {}
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.bundle.js'] });
    };
    const send = () => chrome.tabs.sendMessage(tab.id, { type: 'FILL_FORM', profile });

    await inject();
    let result;
    try {
      result = await send();
    } catch (e) {
      if (/receiving end|context|does not exist/i.test(String(e.message || e))) {
        await inject();
        result = await send();
      } else {
        throw e;
      }
    }
    lastReport = result;
    if (result && !result.error && result.found) logApplication(tab, result);
    if (result && result.error) {
      showNotice(`填写中断：${result.error}`, true);
    } else if (result && result.found) {
      showNotice(`已填 ${result.filled} 个（低置信 ${result.lowConfidence}），跳过 ${result.skipped} 个。请核对网页。`);
    } else {
      showNotice('未识别到可填写的表单字段。', true);
    }
    renderReport(result);
  } catch (e) {
    const msg = String(e.message || e);
    if (/Cannot access|permission|主机|权限/i.test(msg)) {
      showNotice('缺少该网站的访问权限。请到扩展详情 → 网站访问权限 → 选「在所有网站上」，再重试。', true);
    } else {
      showNotice(`填写失败：${msg}`, true);
    }
  } finally {
    btn.disabled = false;
  }
};

wireLibrary();
load();
