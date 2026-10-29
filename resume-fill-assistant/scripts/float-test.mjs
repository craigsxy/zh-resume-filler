// 悬浮按钮（float.js）+ 选区填写（fillPage 的 root 选项）
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${extra || ''}`);
  }
};
const FLOAT = readFileSync(new URL('../float.js', import.meta.url), 'utf8');

function page(html, ui = {}) {
  const dom = new JSDOM(html, { pretendToBeVisual: true, runScripts: 'outside-only' });
  const w = dom.window;
  // jsdom 没有布局：给每个元素一个非零尺寸，让"可见"判断成立
  w.HTMLElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 40, right: 100, bottom: 40 });
  const sent = [];
  w.chrome = {
    storage: { local: { get: (k, cb) => cb({ uiSettings: ui }) } },
    runtime: { sendMessage: (msg, cb) => { sent.push(msg); cb && cb({ found: true, filled: 3, skipped: 1, failed: 0 }); }, lastError: null },
  };
  w.eval(FLOAT);
  return { w, doc: w.document, sent };
}

const FORM = `<!doctype html><body><form>
  <div class="card"><div class="section-title">个人信息</div>
    <div class="form-item"><label>姓名</label><input id="a"></div>
    <div class="form-item"><label>手机</label><input id="b"></div>
  </div>
  <div class="card" id="edu"><div class="section-title">教育经历</div>
    <div class="form-item"><label>学校名称</label><input id="c"></div>
    <div class="form-item"><label>专业名称</label><input id="d"></div>
  </div>
</form></body>`;

console.log('\n[1] 悬浮按钮只在表单页出现，可在设置里关掉');
{
  const { doc } = page(FORM);
  const host = doc.getElementById('saa-float-host');
  ok('表单页出现悬浮按钮', !!host && !!host.shadowRoot.getElementById('fab'));
  const { doc: d2 } = page('<!doctype html><body><p>一篇文章</p><input id="q"></body>');
  ok('普通页面（只有一个搜索框）不出现', !d2.getElementById('saa-float-host'));
  const { doc: d3 } = page(FORM, { floatButton: false });
  ok('设置里关了就不出现', !d3.getElementById('saa-float-host'));
}

console.log('\n[2] 一键填写 / 选区填写 发给后台的消息');
{
  const { w, doc, sent } = page(FORM);
  const root = doc.getElementById('saa-float-host').shadowRoot;
  root.getElementById('fill').click();
  ok('一键填写 → FLOAT_FILL（整页）', sent[0] && sent[0].type === 'FLOAT_FILL' && !sent[0].region);
  ok('填完弹出结果提示', /已填 3 个/.test(root.getElementById('toast').textContent));
  root.getElementById('region').click();
  const target = doc.getElementById('c');
  target.dispatchEvent(new w.MouseEvent('mousemove', { bubbles: true }));
  target.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  ok('点选区域 → FLOAT_FILL（region）', sent[1] && sent[1].region === true);
  ok('选中的区域记在隔离世界里给填写用', w.__saaRegionRoot && w.__saaRegionRoot.contains(target));
}

console.log('\n[3] 选区填写只填选中的那块');
{
  const dom = new JSDOM(FORM, { pretendToBeVisual: true });
  Object.assign(global, {
    window: dom.window,
    document: dom.window.document,
    Node: dom.window.Node,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    HTMLSelectElement: dom.window.HTMLSelectElement,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  });
  const { fillPage } = await import('../src/fill.js');
  const { defaultProfile } = await import('../src/schema.js');
  const p = defaultProfile();
  p.personal = [{ 姓名: '张三', 手机: '13800000000' }];
  p.education = [{ 学校名称: '示例大学', 专业名称: '机械工程' }];
  const doc = dom.window.document;
  await fillPage(p, { bridge: { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) }, root: doc.getElementById('edu') });
  ok('选中的教育经历填上了', doc.getElementById('c').value === '示例大学' && doc.getElementById('d').value === '机械工程');
  ok('选区外的个人信息没动', doc.getElementById('a').value === '' && doc.getElementById('b').value === '');
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
