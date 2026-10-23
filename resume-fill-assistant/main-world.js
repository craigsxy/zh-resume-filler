// 主世界桥：React fiber / Vue 实例只存在于页面主世界，隔离世界读不到（DOM 共享，JS 属性按世界隔离）。
// 通过 DOM 自定义事件与 content.bundle.js 通信，代为执行：
//   ping          —— 探测桥是否就绪
//   reactClick    —— 沿 DOM/fiber 找 React 事件 handler 并直接调用
//   setFieldValue —— 源码级改值：React owner（setFieldValue/setValue/onChange/onSelect）或 Vue（emit / onUpdate）
//   readModel     —— 回读组件模型值（统一的"写后校验"口径）
//   optionValue   —— 读取选项元素背后的真实 value
// 通信约定：请求 CustomEvent 'saa-rw-request'，响应 'saa-rw-response'，detail 均为 JSON 字符串。
(() => {
  if (window.__saaBridgeReady) return;
  window.__saaBridgeReady = true;

  const pad = n => String(n).padStart(2, '0');
  const findEl = id => document.querySelector(`[data-saa-id="${id}"]`);

  const fiberOf = node => {
    for (const k of Object.keys(node)) {
      if (k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')) return node[k];
    }
    return null;
  };
  const propsOf = node => {
    for (const k of Object.keys(node)) {
      if (k.startsWith('__reactEventHandlers$') || k.startsWith('__reactProps$')) {
        const p = node[k];
        if (p && typeof p === 'object') return p;
      }
    }
    return null;
  };
  const vueOf = node => {
    let n = node;
    let depth = 0;
    while (n && depth < 12) {
      if (n.__vueParentComponent) return { kind: 'vue3', inst: n.__vueParentComponent };
      if (n.__vue__) return { kind: 'vue2', vm: n.__vue__ };
      n = n.parentElement;
      depth++;
    }
    return null;
  };

  const fakeEv = node => {
    const nativeEvent = {
      target: node, currentTarget: node, type: 'click', eventName: 'click',
      bubbles: true, cancelable: true, composed: true, isTrusted: false, defaultPrevented: false,
      pageX: 0, pageY: 0, clientX: 0, clientY: 0, screenX: 0, screenY: 0, offsetX: 0, offsetY: 0,
      button: 0, buttons: 1, detail: 1, which: 1, keyCode: 0, charCode: 0, key: '', code: '',
      shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false,
      timeStamp: Date.now(), view: window, relatedTarget: null, data: null,
      stopPropagation() {}, preventDefault() {}, stopImmediatePropagation() {}, persist() {},
    };
    return {
      target: node, currentTarget: node, type: 'click',
      bubbles: true, cancelable: true, composed: true, isTrusted: false, defaultPrevented: false,
      pageX: 0, pageY: 0, clientX: 0, clientY: 0, screenX: 0, screenY: 0, offsetX: 0, offsetY: 0,
      button: 0, buttons: 1, detail: 1, which: 1, keyCode: 0, charCode: 0, key: '', code: '',
      shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false,
      timeStamp: Date.now(), view: window, relatedTarget: null, data: null,
      preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, persist() {},
      nativeEvent,
    };
  };

  const fmtDate = d =>
    d && typeof d.getFullYear === 'function'
      ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      : '';

  /** 把任意模型值转成可比较的字符串 */
  const modelToString = v => {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (v instanceof Date) return fmtDate(v);
    if (typeof v.format === 'function') {
      try {
        return v.format('YYYY-MM-DD');
      } catch (_) {
        return '';
      }
    }
    if (typeof v.year === 'function') {
      try {
        const y = v.year();
        const m = typeof v.month === 'function' ? v.month() + 1 : null;
        const d = typeof v.date === 'function' ? v.date() : 1;
        return m ? `${y}-${pad(m)}-${pad(d)}` : String(y);
      } catch (_) {
        return '';
      }
    }
    if (typeof v.value === 'string' || typeof v.value === 'number') return String(v.value);
    if (Array.isArray(v)) return v.map(modelToString).filter(Boolean).join(',');
    return '';
  };

  /** 构造候选值：优先克隆字段现有值对象（类型零偏差），再退到标准类型 */
  const buildCandidates = (raw, current) => {
    const out = [];
    const m = typeof raw === 'string' && raw.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?/);
    if (m && current && typeof current === 'object') {
      try {
        if (window.moment && window.moment.isMoment && window.moment.isMoment(current)) {
          out.push(current.clone().year(+m[1]).month(+m[2] - 1).date(+m[3] || 1));
        } else if (window.dayjs && window.dayjs.isDayjs && window.dayjs.isDayjs(current)) {
          out.push(current.year(+m[1]).month(+m[2] - 1).date(+m[3] || 1));
        } else if (current instanceof Date) {
          out.push(new Date(+m[1], +m[2] - 1, +m[3] || 1));
        }
      } catch (_) {}
    }
    if (m) {
      const d = new Date(+m[1], +m[2] - 1, +m[3] || 1);
      if (!Number.isNaN(d.getTime())) out.push(d);
      if (window.moment) {
        try {
          const mm = window.moment(raw, 'YYYY-MM-DD');
          if (mm && mm.isValid && mm.isValid()) out.push(mm);
        } catch (_) {}
      }
      if (window.dayjs) {
        try {
          const dj = window.dayjs(raw);
          if (dj && dj.isValid && dj.isValid()) out.push(dj);
        } catch (_) {}
      }
    }
    out.push(raw);
    return out.filter(v =>
      v == null
        ? false
        : typeof v !== 'object' || v instanceof Date || typeof v.format === 'function' || 'value' in v
    );
  };

  const setViaReact = (el, raw) => {
    let f = fiberOf(el);
    let owner = null;
    while (f) {
      const p = f.memoizedProps || (f.stateNode && f.stateNode.props);
      if (
        p &&
        (typeof p.setFieldValue === 'function' ||
          typeof p.setValue === 'function' ||
          typeof p.onChange === 'function' ||
          typeof p.onSelect === 'function')
      ) {
        owner = p;
        break;
      }
      f = f.return;
    }
    if (!owner) return { ok: false, reason: 'no-owner' };
    const name = owner.name || owner.fieldName || owner.id;
    const vals = buildCandidates(raw, owner.value);
    for (const v of vals) {
      const second =
        v && typeof v.format === 'function'
          ? v.format('YYYY-MM-DD')
          : typeof v === 'string'
            ? v
            : undefined;
      try {
        if (name && typeof owner.setFieldValue === 'function') {
          owner.setFieldValue(name, v);
          return { ok: true, used: 'setFieldValue' };
        }
      } catch (_) {}
      try {
        if (typeof owner.setValue === 'function') {
          owner.setValue(v);
          return { ok: true, used: 'setValue' };
        }
      } catch (_) {}
      try {
        if (typeof owner.onChange === 'function') {
          owner.onChange(v, second);
          return { ok: true, used: 'onChange' };
        }
      } catch (_) {}
      try {
        if (typeof owner.onSelect === 'function') {
          owner.onSelect(v, second);
          return { ok: true, used: 'onSelect' };
        }
      } catch (_) {}
    }
    return { ok: false, reason: 'no-handler-called' };
  };

  const setViaVue = (el, raw) => {
    const v = vueOf(el);
    if (!v) return { ok: false, reason: 'no-vue' };
    const candidates = [raw, new Date(raw)];
    if (v.kind === 'vue3') {
      const inst = v.inst;
      const props = inst.props || {};
      const key = Object.keys(props).find(k => ['modelValue', 'value', 'model'].includes(k));
      const handler = props[`onUpdate:${key || 'modelValue'}`];
      for (const val of candidates) {
        if (typeof handler === 'function') {
          try {
            handler(val);
            return { ok: true, used: 'vue3-onUpdate' };
          } catch (_) {}
        }
        if (typeof inst.emit === 'function') {
          try {
            inst.emit('update:modelValue', val);
            inst.emit('change', val);
            return { ok: true, used: 'vue3-emit' };
          } catch (_) {}
        }
      }
    } else {
      const vm = v.vm;
      for (const val of candidates) {
        if (typeof vm.$emit === 'function') {
          try {
            vm.$emit('input', val);
            vm.$emit('update:modelValue', val);
            vm.$emit('change', val);
            return { ok: true, used: 'vue2-emit' };
          } catch (_) {}
        }
      }
    }
    return { ok: false, reason: 'vue-no-handler' };
  };

  let lastOpInfo = null;
  const reportCrash = msg => {
    if (lastOpInfo && Date.now() - lastOpInfo.ts < 1500) {
      try {
        console.warn('[简历一键填充] ⚠️ 桥操作(' + lastOpInfo.op + ')后站点抛错:', String(msg || '').slice(0, 160));
      } catch (_) {}
    }
  };
  window.addEventListener('error', e => reportCrash(e && (e.message || e.type)), true);
  window.addEventListener('unhandledrejection', e => reportCrash(e && e.reason && (e.reason.message || e.reason)), true);

  document.addEventListener('saa-rw-request', async e => {
    let msg;
    try {
      msg = JSON.parse(e.detail);
    } catch (_) {
      return;
    }
    lastOpInfo = { op: msg.op, ts: Date.now() };
    const res = { id: msg.id, ok: false };

    try {
      const el = findEl(msg.elId);
      if (!el) {
        res.reason = 'no-el';
      } else if (msg.op === 'ping') {
        res.ok = true;
        res.react = !!fiberOf(el);
        res.vue = !!vueOf(el);
      } else if (msg.op === 'reactClick') {
        let node = el;
        let called = false;
        for (let i = 0; i < 6 && node && !called; i++) {
          const p = propsOf(node);
          if (p) {
            for (const type of ['onMouseDown', 'onPointerDown', 'onTouchStart', 'onClick']) {
              if (typeof p[type] === 'function') {
                try {
                  p[type](fakeEv(node));
                  called = true;
                } catch (_) {}
              }
            }
          }
          if (!called) node = node.parentElement;
        }
        if (!called) {
          let f = fiberOf(el);
          while (f && !called) {
            const p = f.memoizedProps;
            if (p) {
              for (const type of ['onMouseDown', 'onClick']) {
                if (typeof p[type] === 'function') {
                  try {
                    p[type](fakeEv(el));
                    called = true;
                  } catch (_) {}
                }
              }
            }
            f = f.return;
          }
        }
        res.ok = called;
        if (!called) res.reason = 'no-react-handler';
      } else if (msg.op === 'setFieldValue') {
        const r1 = setViaReact(el, msg.value);
        if (r1.ok) {
          res.ok = true;
          res.used = r1.used;
        } else {
          const r2 = setViaVue(el, msg.value);
          res.ok = r2.ok;
          res.used = r2.used;
          res.reason = r2.ok ? undefined : r1.reason + '/' + r2.reason;
        }
        if (res.ok) {
          await new Promise(r => setTimeout(r, 220));
          res.readback = readModelValue(el);
        }
      } else if (msg.op === 'readModel') {
        const v = readModelValue(el);
        res.ok = v !== '';
        res.value = v;
      } else if (msg.op === 'optionValue') {
        let f = fiberOf(el);
        let val = null;
        while (f) {
          const p = f.memoizedProps || (f.stateNode && f.stateNode.props);
          if (p && p.value !== undefined && p.value !== null && (typeof p.value === 'string' || typeof p.value === 'number')) {
            val = p.value;
            break;
          }
          f = f.return;
        }
        if (val === null) {
          for (const a of ['value', 'data-value', 'data-val', 'title']) {
            const v = el.getAttribute(a);
            if (v) {
              val = v;
              break;
            }
          }
        }
        res.ok = val !== null && val !== undefined;
        res.value = val;
      }
    } catch (e2) {
      res.reason = String(e2).slice(0, 120);
    }
    document.dispatchEvent(new CustomEvent('saa-rw-response', { detail: JSON.stringify(res) }));
  });

  /** 统一回读：组件模型值优先，其次元素自身值 */
  function readModelValue(el) {
    let f = fiberOf(el);
    let depth = 0;
    while (f && depth < 24) {
      const p = f.memoizedProps || (f.stateNode && f.stateNode.props);
      if (p && p.value !== undefined && p.value !== null) {
        const s = modelToString(p.value);
        if (s) return s;
      }
      f = f.return;
      depth++;
    }
    const v = vueOf(el);
    if (v) {
      try {
        const val = v.kind === 'vue3' ? (v.inst.props || {}).modelValue : v.vm.value;
        const s = modelToString(val);
        if (s) return s;
      } catch (_) {}
    }
    if (el && 'value' in el && String(el.value || '').trim()) return String(el.value).trim();
    return '';
  }
})();
