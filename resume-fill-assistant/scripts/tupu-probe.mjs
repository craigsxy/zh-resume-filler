// 诊断脚本（不是断言）：用 tupu360（图谱/辉瑞校招）真机快照跑扫描 + 绑定，打印插件看到的东西
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
const HTML = readFileSync(new URL('./fixtures/tupu360-form.html', import.meta.url), 'utf8');
const dom = new JSDOM(`<!doctype html><html><body>${HTML}</body></html>`, { pretendToBeVisual: true });
Object.assign(global, { window: dom.window, document: dom.window.document, Node: dom.window.Node,
  HTMLInputElement: dom.window.HTMLInputElement, HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
  HTMLSelectElement: dom.window.HTMLSelectElement, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  CSS: { escape: s => String(s).replace(/["\\]/g, '\\$&') } });
const { buildFormModel } = await import('../src/form-model.js');
const { bind } = await import('../src/binder.js');
const { defaultProfile } = await import('../src/schema.js');
const model = buildFormModel(document.body);
for (const s of model.sections) {
  console.log(`\n## ${s.title} → ${s.categoryId} (${s.blocks.length} 块)`);
  s.blocks.forEach((b, i) => console.log(`  #${i}: ` + b.fields.map(f => `${f.label}[${f.controlKind}]`).join(' | ')));
}
const p = defaultProfile();
p.personal = [{ 姓名: '张三', 性别: '男', 邮箱: 'a@b.com', 现居地址: '上海市黄浦区' }];
p.intention = [{ 意向城市: '上海' }];
p.education = [
  { 学校名称: 'A大学', 学历: '硕士', 开始时间: '2025-09-01', 结束时间: '2027-06-30', 专业名称: '机械' },
  { 学校名称: 'B大学', 学历: '本科', 开始时间: '2021-09-01', 结束时间: '2025-06-30', 专业名称: '自动化' },
];
p.internships = [{ 单位名称: 'X公司', 开始时间: '2024-07-01', 结束时间: '2024-09-30', 实习内容: '做事' }];
p.awards = [{ 奖项: '一等奖学金', 获奖时间: '2024-10-01' }];
p.languages = [{ 证书类型: 'TOEFL', 语言成绩: '111' }];
for (const pl of bind(model, p)) {
  console.log(`${pl.sectionTitle}#${pl.blockIndex} 「${pl.label || pl.field.label}」 → ${pl.slot || '-'} ${pl.dup ? 'DUP' : ''}${pl.weak ? 'WEAK' : ''} = ${pl.value ?? ''}`);
}
