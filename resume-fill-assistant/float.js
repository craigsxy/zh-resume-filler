// 网页悬浮按钮（v2.2.0）：只在"看起来是表单"的页面出现（≥4 个可见输入控件），
// 不打开侧边栏也能一键填写；「选区填写」只填你点选的那一块（某一段经历、某一个弹窗）。
// 设置里可关；本页点「本页隐藏」只影响当前页面。UI 放在 Shadow DOM 里，不受网页样式影响。
(() => {
  if (window.__saaFloatReady || window.top !== window) return;
  window.__saaFloatReady = true;

  const FIELD_SEL = 'input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select, [role="combobox"]';
  const visible = el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const looksLikeForm = () => {
    let n = 0;
    for (const el of document.querySelectorAll(FIELD_SEL)) {
      if (visible(el) && ++n >= 4) return true;
    }
    return false;
  };

  let host = null;
  let toastTimer = null;

  function build() {
    host = document.createElement('div');
    host.id = 'saa-float-host';
    host.style.cssText = 'all:initial;position:fixed;right:18px;bottom:22px;z-index:2147483646;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host{all:initial}
        .wrap{font:13px/1.4 "Segoe UI","Microsoft YaHei",sans-serif;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
        .fab{width:46px;height:46px;border-radius:50%;border:0;background:#75634d;color:#fff;font-weight:700;font-size:17px;
             box-shadow:0 6px 18px #2a1f1240;cursor:pointer}
        .fab:hover{background:#5d4c38}
        .menu{display:none;background:#fffdf9;border:1px solid #e8dfd2;border-radius:12px;padding:6px;box-shadow:0 8px 26px #2a1f1230;min-width:150px}
        .menu.open{display:block}
        .menu button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:8px 10px;border-radius:8px;
             color:#342f29;cursor:pointer;font:inherit}
        .menu button:hover{background:#f1e9dc}
        .menu .muted{color:#9a8d7a;font-size:11px}
        .toast{display:none;max-width:260px;background:#3f392f;color:#fff;padding:9px 12px;border-radius:9px;font-size:12px;box-shadow:0 6px 20px #2a1f1230}
        .toast.show{display:block}
      </style>
      <div class="wrap">
        <div class="toast" id="toast"></div>
        <div class="menu" id="menu">
          <button id="fill">⚡ 一键填写本页</button>
          <button id="region">▢ 选区填写（点选一块区域）</button>
          <button id="hide" class="muted">本页隐藏</button>
        </div>
        <button class="fab" id="fab" title="简历一键填充助手">简</button>
      </div>`;
    const $ = id => root.getElementById(id);
    $('fab').onclick = () => $('menu').classList.toggle('open');
    $('fill').onclick = () => {
      $('menu').classList.remove('open');
      run(false);
    };
    $('region').onclick = () => {
      $('menu').classList.remove('open');
      pickRegion();
    };
    $('hide').onclick = () => host.remove();
    host.__toast = (text, ms = 5200) => {
      const t = $('toast');
      t.textContent = text;
      t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), ms);
    };
    document.documentElement.append(host);
  }

  // 后台转来的填写进度：在提示框里显示"正在填写 12/40：实习经历 · 单位名称"
  try {
    chrome.runtime.onMessage.addListener(msg => {
      if (!msg || msg.type !== 'FLOAT_PROGRESS' || !host || !running) return;
      if (msg.stage === 'done') return;
      const pct = msg.total ? ` (${Math.round((msg.done / msg.total) * 100)}%)` : '';
      host.__toast(String(msg.text || '') + pct, 60000);
    });
  } catch (_) {}
  let running = false;

  function run(region) {
    running = true;
    host.__toast(region ? '正在填写选中的区域…' : '正在填写本页…', 60000);
    chrome.runtime.sendMessage({ type: 'FLOAT_FILL', region }, res => {
      running = false;
      const err = chrome.runtime.lastError;
      if (err || !res) return host.__toast('填写失败：' + ((err && err.message) || '没有响应'));
      if (res.error) return host.__toast('填写中断：' + res.error);
      if (!res.found) return host.__toast('这里没有识别到可填写的字段。');
      host.__toast(`已填 ${res.filled} 个，跳过 ${res.skipped} 个，失败 ${res.failed} 个。打开侧边栏可看完整报告。`);
    });
  }

  /** 选区：鼠标移到哪块就描边，点一下选定（Esc 取消）；只认含输入控件的区域 */
  function pickRegion() {
    host.__toast('移动鼠标选择要填写的区域，点击确认；Esc 取消。', 60000);
    const box = document.createElement('div');
    box.style.cssText =
      'position:fixed;pointer-events:none;z-index:2147483645;border:2px solid #b0884a;background:#e2c58f22;border-radius:6px;display:none';
    document.documentElement.append(box);
    let cur = null;
    const target = el => {
      let n = el;
      while (n && n !== document.body) {
        if (n.querySelector && n.querySelector(FIELD_SEL) && n.getBoundingClientRect().height > 30) return n;
        n = n.parentElement;
      }
      return null;
    };
    const move = e => {
      if (host.contains(e.target)) return;
      cur = target(e.target);
      if (!cur) return (box.style.display = 'none');
      const r = cur.getBoundingClientRect();
      Object.assign(box.style, { display: 'block', left: r.left - 3 + 'px', top: r.top - 3 + 'px', width: r.width + 6 + 'px', height: r.height + 6 + 'px' });
    };
    const done = () => {
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key, true);
      box.remove();
    };
    const click = e => {
      if (host.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const picked = cur;
      done();
      if (!picked) return host.__toast('这里没有输入框，已取消。');
      window.__saaRegionRoot = picked; // 与 content.bundle 同处扩展隔离世界，fill 时读它
      run(true);
    };
    const key = e => {
      if (e.key === 'Escape') {
        done();
        host.__toast('已取消选区填写。', 1500);
      }
    };
    document.addEventListener('mousemove', move, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
  }

  function maybeShow() {
    if (host || !looksLikeForm()) return false;
    build();
    return true;
  }

  chrome.storage.local.get('uiSettings', data => {
    const s = (data && data.uiSettings) || {};
    if (s.floatButton === false) return;
    if (maybeShow()) return;
    // 单页应用的表单常常晚一点才渲染：观察 15 秒
    const obs = new MutationObserver(() => {
      if (maybeShow()) obs.disconnect();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 15000);
  });
})();
