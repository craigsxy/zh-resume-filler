// AI 善后（ai.js）：用桩模型验证"规则失败 → AI 补救"的整条链路，以及发出去的内容不含敏感值
import { JSDOM } from 'jsdom';

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

const HTML = `<!doctype html><html><body><form>
  <div class="card"><div class="section-title">个人信息</div>
    <div class="form-item"><label class="form-label">姓名</label><input id="name"></div>
    <div class="form-item"><label class="form-label">手机</label><input id="mobile"></div>
    <div class="form-item"><label class="form-label">您目前常驻的城市</label><input id="city"></div>
    <div class="form-item"><label class="form-label">本科及以上学历所学门类</label>
      <select id="cat"><option value="">请选择</option><option>医学与药学类</option><option>信息科学与技术类</option><option>商科与管理类</option></select></div>
    <div class="form-item"><label class="form-label">您是通过什么途径了解到我们的</label>
      <select id="src"><option value="">请选择</option><option>辉瑞微信公众号</option><option>高校就业网</option><option>其他</option></select></div>
    <div class="form-item"><label class="form-label">我已阅读并同意隐私条款</label><input id="agree" type="checkbox"></div>
  </div>
</form></body></html>`;

function boot() {
  const d = new JSDOM(HTML, { pretendToBeVisual: true });
  Object.assign(global, {
    window: d.window,
    document: d.window.document,
    Node: d.window.Node,
    HTMLInputElement: d.window.HTMLInputElement,
    HTMLTextAreaElement: d.window.HTMLTextAreaElement,
    HTMLSelectElement: d.window.HTMLSelectElement,
    getComputedStyle: d.window.getComputedStyle.bind(d.window),
    CSS: { escape: s => String(s).replace(/["\\]/g, '\\$&') },
  });
  return d.window.document;
}

const { fillPage } = await import('../src/fill.js');
const { defaultProfile } = await import('../src/schema.js');
const { parseJsonReply, slotCatalog } = await import('../src/ai.js');
const bridge = { setModelValue: async () => ({ ok: false }), readModel: async () => ({ ok: false }) };

const profile = () => {
  const p = defaultProfile();
  p.personal = [{ 姓名: '王小明', 手机: '13912345678', 当前所在城市: '上海市黄浦区', 邮箱: 'x@example.com' }];
  p.education = [{ 学校名称: '北岸大学', 学历: '硕士', 专业类别: '学术型硕士 / 工学 / 机械工程' }];
  p.intention = [{ 信息来源: '官网' }];
  return p;
};

/** 桩模型：按请求类型给固定回答，同时记录收到的全部内容 */
function stubModel(opts = {}) {
  const seen = [];
  const client = async messages => {
    const user = JSON.parse(messages[1].content);
    seen.push({ system: messages[0].content, user });
    if (opts.fail) throw new Error('HTTP 401：invalid key');
    if (user.fields) {
      const matches = user.fields.map(f => {
        const l = f.label.join(' ');
        if (/常驻的城市/.test(l)) return { field: f.field, slot: 'personal.currentCity', confidence: 0.93 };
        if (/所学门类/.test(l)) return { field: f.field, slot: 'edu.majorCategory', confidence: 0.9 };
        if (/途径/.test(l)) return { field: f.field, slot: 'intent.source', confidence: 0.88 };
        if (/同意/.test(l)) return { field: f.field, slot: 'personal.name', confidence: 0.99 }; // 胡乱匹配，应被拦
        return { field: f.field, slot: null, confidence: 0 };
      });
      return '```json\n' + JSON.stringify({ matches }) + '\n```';
    }
    if (user.items) {
      const choices = user.items.map(it => {
        if (/门类|专业类别/.test(it.field)) return { id: it.id, option: '信息科学与技术类' };
        if (/来源|途径/.test(it.field)) return { id: it.id, option: opts.invent ? '官方网站' : '其他' };
        return { id: it.id, option: null };
      });
      return JSON.stringify({ choices });
    }
    return '{}';
  };
  return { client, seen };
}

console.log('\n[1] 工具函数');
{
  ok('能从 ```json 代码块里抠出 JSON', parseJsonReply('好的：```json\n{"a":1}\n```')?.a === 1);
  ok('带前后废话也能解析', parseJsonReply('结果如下 {"a":2} 以上')?.a === 2);
  ok('非 JSON 返回 null', parseJsonReply('没有') === null);
  const cat = slotCatalog(profile());
  ok('候选清单只含"有值"的字段名称', cat.some(s => s.id === 'personal.currentCity') && !cat.some(s => s.id === 'personal.idNo'));
  ok('候选清单里没有任何值', !JSON.stringify(cat).includes('13912345678') && !JSON.stringify(cat).includes('黄浦区'));
}

console.log('\n[2] 规则认不出 → AI 补认标签 + 补选下拉');
{
  const doc = boot();
  const { client, seen } = stubModel();
  const report = await fillPage(profile(), { bridge, aiClient: client });
  ok('规则照常填上姓名 / 手机', doc.getElementById('name').value === '王小明' && doc.getElementById('mobile').value === '13912345678');
  ok('AI 把「您目前常驻的城市」认成当前所在城市并填上', doc.getElementById('city').value === '上海市黄浦区', doc.getElementById('city').value);
  ok('AI 补认的门类字段：路径值对不上选项 → AI 从选项里挑了信息科学与技术类', doc.getElementById('cat').value === '信息科学与技术类', doc.getElementById('cat').value);
  ok('信息来源：官网不在选项 → AI 选了「其他」', doc.getElementById('src').value === '其他', doc.getElementById('src').value);
  ok('授权勾选框没被 AI 碰', !doc.getElementById('agree').checked);
  ok('授权类字段根本没发给 AI', !seen.some(x => x.user.fields && x.user.fields.some(f => f.label.join('').includes('同意'))));
  ok('报告里统计了 AI 的贡献', report.ai && report.ai.mapped >= 1 && report.ai.options >= 2, JSON.stringify(report.ai));
  ok('AI 填的行带标记', report.results.some(r => r.ai === 'ai-mapped' && r.status === 'filled') && report.results.some(r => r.ai === 'ai-option'));
  const sent = JSON.stringify(seen.map(x => x.user));
  ok('发出去的内容里没有姓名 / 手机 / 邮箱', !/王小明|13912345678|x@example\.com/.test(sent), sent.slice(0, 200));
  ok('标签请求里没有任何资料值（城市也不发）', !JSON.stringify(seen[0].user).includes('黄浦区'));
}

console.log('\n[3] AI 编造了网页上没有的选项 → 不采用');
{
  const doc = boot();
  const { client } = stubModel({ invent: true });
  await fillPage(profile(), { bridge, aiClient: client });
  ok('信息来源保持未选', doc.getElementById('src').value === '', doc.getElementById('src').value);
}

console.log('\n[4] AI 接口出错 → 规则部分照常完成，报告说明原因');
{
  const doc = boot();
  const { client } = stubModel({ fail: true });
  const report = await fillPage(profile(), { bridge, aiClient: client });
  ok('姓名照常填上', doc.getElementById('name').value === '王小明');
  ok('报告带上错误原因', report.ai && /401/.test(report.ai.error || ''), JSON.stringify(report.ai));
}

console.log('\n[5] 没开 AI → 行为与原来完全一致，不发任何请求');
{
  const doc = boot();
  const report = await fillPage(profile(), { bridge });
  ok('没有 AI 统计', report.ai == null);
  ok('认不出的城市字段保持为空', doc.getElementById('city').value === '');
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
