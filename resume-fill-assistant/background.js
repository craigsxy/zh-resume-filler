// 后台：点击工具栏图标即打开侧边栏；代理 AI 请求（API Key 只在这里读取，内容脚本和网页拿不到）。
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

const AI_KEY = 'aiSettings';
const AI_DEFAULTS = {
  enabled: false,
  apiKey: '',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'deepseek/deepseek-v4.1-flash',
};

async function aiSettings() {
  const data = await chrome.storage.local.get(AI_KEY);
  return { ...AI_DEFAULTS, ...(data[AI_KEY] || {}) };
}

/** OpenAI 兼容的 chat/completions（OpenRouter / DeepSeek 官方 / 其他兼容服务都能用） */
async function chat(messages, override) {
  const s = { ...(await aiSettings()), ...(override || {}) };
  if (!s.apiKey) return { ok: false, error: '没有设置 API Key' };
  const url = String(s.baseUrl || AI_DEFAULTS.baseUrl).replace(/\/+$/, '') + '/chat/completions';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  const post = jsonMode =>
    fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${s.apiKey}`,
        // OpenRouter 用这两个头做来源展示，其他服务会忽略
        'HTTP-Referer': 'https://github.com/craigsxy/zh-resume-filler',
        'X-Title': 'resume-fill-assistant',
      },
      body: JSON.stringify({
        model: s.model || AI_DEFAULTS.model,
        messages,
        temperature: 0,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
  try {
    let res = await post(true);
    let text = await res.text();
    // 个别模型 / 服务商不支持 JSON 模式：去掉再试一次（提示词本身已要求只输出 JSON）
    if (!res.ok && res.status === 400 && /response_format|json/i.test(text)) {
      res = await post(false);
      text = await res.text();
    }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}：${text.slice(0, 200)}` };
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {
      return { ok: false, error: '接口返回的不是 JSON' };
    }
    const content = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    return content ? { ok: true, content, usage: json.usage || null } : { ok: false, error: '模型没有返回内容' };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? '请求超时（30 秒）' : String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 网页悬浮按钮：在后台完成注入 + 填写 ----------

async function fillTab(tab, region) {
  const data = await chrome.storage.local.get(['resumeProfile', AI_KEY]);
  const profile = data.resumeProfile || {};
  const ai = !!(data[AI_KEY] && data[AI_KEY].enabled && data[AI_KEY].apiKey);
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['main-world.js'], world: 'MAIN' });
  } catch (_) {}
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.bundle.js'] });
  const aiForce = !!(ai && data[AI_KEY].always);
  const report = await chrome.tabs.sendMessage(tab.id, { type: 'FILL_FORM', profile, ai, aiForce, region: !!region });
  // 侧边栏开着时会监听到这一条并显示完整报告；关着也留到下次打开
  await chrome.storage.local.set({ lastFillReport: { report, url: tab.url, title: tab.title, at: Date.now() } });
  if (report && report.found && !report.error) await logApplication(tab, report);
  return report;
}

/** 与侧边栏同一套求职进度记录：同一页面只更新不新增 */
async function logApplication(tab, report) {
  const data = await chrome.storage.local.get(['applications', 'resumeLibrary']);
  const apps = Array.isArray(data.applications) ? data.applications : [];
  const url = String(tab.url || '');
  const key = url.split('#')[0];
  let host = '';
  try {
    host = new URL(url).host;
  } catch (_) {}
  let row = apps.find(a => a.key === key);
  if (!row) {
    row = { id: 'r' + Date.now().toString(36), key, url, host, title: String(tab.title || host), company: '', position: '', status: '已填写', note: '', events: [], createdAt: Date.now() };
    apps.unshift(row);
  }
  const lib = data.resumeLibrary;
  const cur = lib && Array.isArray(lib.items) ? lib.items.find(x => x.id === lib.activeId) : null;
  row.updatedAt = Date.now();
  row.resume = (cur && cur.name) || row.resume || '';
  row.filled = report.filled || 0;
  row.failed = report.failed || 0;
  await chrome.storage.local.set({ applications: apps.slice(0, 500) });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;
  if (message.type === 'FILL_PROGRESS') {
    // 转给同一页的悬浮按钮（内容脚本之间收不到彼此的 runtime 消息）
    const tab = sender && sender.tab;
    if (tab && tab.id) chrome.tabs.sendMessage(tab.id, { ...message, type: 'FLOAT_PROGRESS' }).catch(() => {});
    return false;
  }
  if (message.type === 'FLOAT_FILL') {
    const tab = sender && sender.tab;
    if (!tab || !tab.id) return false;
    fillTab(tab, message.region)
      .then(r => sendResponse(r || { found: false }))
      .catch(e => sendResponse({ error: String((e && e.message) || e), found: false }));
    return true;
  }
  if (message.type === 'AI_CHAT') {
    aiSettings().then(s => {
      if (!s.enabled) return sendResponse({ ok: false, error: 'AI 辅助未开启' });
      chat(message.messages).then(sendResponse);
    });
    return true;
  }
  if (message.type === 'AI_TEST') {
    // 侧边栏「测试连接」：用侧边栏当前填的设置试一次（还没保存也能测）
    chat(
      [
        { role: 'system', content: '只输出 JSON。' },
        { role: 'user', content: '回复 {"ok":true}' },
      ],
      message.settings || null
    ).then(sendResponse);
    return true;
  }
  return false;
});
