// 侧边栏的纯逻辑：完成度统计、导入导出格式、按学历排序、示例简历。
// 不碰 DOM、不碰 chrome.*，方便单测。
import { CATEGORIES, SCHEMA_VERSION } from '../schema.js';
import { resolveValue } from '../resolver.js';

export const EXPORT_TYPE = 'resume-fill-assistant/profile';

const has = v => {
  if (v == null) return false;
  if (typeof v === 'object') return !!v.dataUrl;
  return String(v).trim() !== '';
};

/**
 * 完成度：每条记录 × 该分类全部字段。多记录分类一条都没有时是 0/0（不拉低完成度，
 * 与"尚未新增内容"语义一致）。返回 { filled, total, byCategory: {id: {filled,total,records:[{filled,total,missing}]}} }
 */
export function completion(profile) {
  let filled = 0;
  let total = 0;
  const byCategory = {};
  for (const c of CATEGORIES) {
    if (c.custom) continue;
    const records = Array.isArray(profile && profile[c.id]) ? profile[c.id] : [];
    const stat = { filled: 0, total: 0, records: [] };
    for (const r of records) {
      const rec = r || {};
      const missing = c.fields.filter(f => !has(rec[f.label])).map(f => f.label);
      const rs = { total: c.fields.length, filled: c.fields.length - missing.length, missing };
      stat.records.push(rs);
      stat.filled += rs.filled;
      stat.total += rs.total;
    }
    byCategory[c.id] = stat;
    filled += stat.filled;
    total += stat.total;
  }
  return { filled, total, percent: total ? Math.round((filled / total) * 100) : 0, byCategory };
}

/** 只保留认识的分类，补齐缺的分类；多记录分类必须是数组，单记录分类至少一条 */
export function sanitizeProfile(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = { schemaVersion: SCHEMA_VERSION };
  for (const c of CATEGORIES) {
    let v = src[c.id];
    if (!Array.isArray(v)) v = v && typeof v === 'object' ? [v] : [];
    v = v.filter(r => r && typeof r === 'object').map(r => ({ ...r }));
    if (!c.multiple) v = [v[0] || {}];
    out[c.id] = v;
  }
  return out;
}

/** 导出文件格式：带类型标记 + 名称，导入时也兼容"裸资料对象" */
export function exportPayload(name, profile) {
  return { type: EXPORT_TYPE, version: SCHEMA_VERSION, name: name || '我的简历', exportedAt: new Date().toISOString(), data: profile };
}

export function parseImport(text) {
  let obj;
  try {
    obj = JSON.parse(String(text || ''));
  } catch (_) {
    return { ok: false, error: '不是合法的 JSON 文件' };
  }
  if (!obj || typeof obj !== 'object') return { ok: false, error: '文件内容为空' };
  const data = obj.type === EXPORT_TYPE && obj.data ? obj.data : obj;
  const known = CATEGORIES.some(c => data && data[c.id] != null);
  if (!known) return { ok: false, error: '文件里没有可识别的简历分类（个人信息 / 教育经历…）' };
  return { ok: true, name: String(obj.name || '').trim() || '导入的简历', profile: sanitizeProfile(data) };
}

const DEGREE_RANK = { DOCTOR: 6, MASTER: 5, BACHELOR: 4, ASSOCIATE: 3, VOCATIONAL: 2, HIGH_SCHOOL: 1 };

/** 教育经历按学历从高到低；同级按入学时间新→旧（稳定排序，不认识的学历排最后） */
export function sortEducation(list) {
  const rank = r => {
    const res = resolveValue(r && r['学历'], 'degreeLevel');
    return (res && DEGREE_RANK[res.code]) || 0;
  };
  return (list || [])
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(b.r) - rank(a.r) || String(b.r['开始时间'] || '').localeCompare(String(a.r['开始时间'] || '')) || a.i - b.i)
    .map(x => x.r);
}

/** 示例简历：用来试插件，全部是虚构内容 */
export function sampleProfile() {
  return sanitizeProfile({
    personal: [
      {
        姓名: '林小满',
        姓名拼音: 'Lin Xiaoman',
        性别: '女',
        出生日期: '2002-03-18',
        民族: '汉族',
        政治面貌: '共青团员',
        婚姻状况: '未婚',
        证件类型: '身份证',
        手机: '13800000000',
        邮箱: 'xiaoman@example.com',
        当前所在城市: '上海市',
        现居地址: '上海市 / 杨浦区',
        籍贯: '浙江省 / 杭州市',
        户口性质: '城镇',
        是否应届生: '是',
        工作年限: '0',
        英语等级: 'CET-6',
        健康状况: '健康',
      },
    ],
    intention: [{ 意向岗位: '产品经理', 意向城市: '上海、杭州', 期望薪资: '面议', 是否服从调剂: '是', 信息来源: '官网' }],
    education: [
      { 学校名称: '示例大学', 学历: '硕士', 学位: '硕士', 专业名称: '计算机技术', 专业类别: '工学', 开始时间: '2024-09-01', 结束时间: '2027-06-30', 学习形式: '全日制', 学历状态: '在读' },
      { 学校名称: '样例理工大学', 学历: '本科', 学位: '学士', 专业名称: '软件工程', 专业类别: '工学', 开始时间: '2020-09-01', 结束时间: '2024-06-30', 学习形式: '全日制', 学历状态: '毕业' },
    ],
    internships: [
      { 单位名称: '示例科技有限公司', 实习岗位: '产品实习生', 所在部门: '用户增长部', 开始时间: '2025-06-01', 结束时间: '2025-09-30', 实习地点: '上海市', 实习内容: '负责新手引导改版，次日留存提升 6%' },
    ],
    projects: [{ 项目名称: '校园二手交易小程序', 项目职务: '负责人', 开始时间: '2023-03-01', 结束时间: '2023-07-01', 项目描述: '从 0 到 1 搭建并运营', 项目成果: '注册用户 3000+' }],
    awards: [{ 奖项: '校级一等奖学金', 获奖时间: '2023-10-01', 获奖级别: '校级', 奖励等级: '一等奖', 奖励类型: '个人' }],
    languages: [{ 语言能力: '英语', 证书类型: 'CET-6', 语言成绩: '560' }],
    certificates: [{ 证书名称: '计算机二级（Python）', 获得时间: '2021-12-01' }],
    skills: [{ 技术技能: 'SQL、Python 数据分析', 软件技能: 'Figma、Axure、Office' }],
  });
}
