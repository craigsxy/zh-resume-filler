// 派生字段：资料库里没填、但能从别的字段算出来的值，填充前一次性补齐。
// 原则：**只补空，不覆盖**——用户自己填了的永远优先。
//   · 年龄 ← 出生日期
//   · 最高学位 / 毕业院校 / 毕业专业 / 毕业时间 / 学习形式 ← 教育经历里学历最高的那段
//   · 各经历的「起止时间」← 开始时间 + 结束时间
//   · 技能专长 · 证书认证 ← 「证书」列表的证书名称
//   · 工作经历一条都没有 → 用实习经历代替（应届生网申的「工作经历」基本就是实习）

import { resolveValue } from './resolver.js';

const DEGREE_RANK = { HIGH_SCHOOL: 1, VOCATIONAL: 1, ASSOCIATE: 2, BACHELOR: 3, MASTER: 4, DOCTOR: 5 };

const has = v => v != null && typeof v !== 'object' && String(v).trim() !== '';
const filledRecord = r =>
  r && typeof r === 'object' && Object.entries(r).some(([k, v]) => k !== '__custom' && has(v));

/** 学历最高的那段教育经历（同级取排在前面的） */
export function highestEducation(profile) {
  const list = ((profile && profile.education) || []).filter(filledRecord);
  let best = null;
  let bestRank = -1;
  for (const r of list) {
    const res = resolveValue(r['学历'], 'degreeLevel');
    const rank = (res && DEGREE_RANK[res.code]) || 0;
    if (rank > bestRank) {
      best = r;
      bestRank = rank;
    }
  }
  return best;
}

/** 周岁：按"今天"算，生日没到减一 */
export function ageFrom(birth, today = new Date()) {
  const m = String(birth || '').match(/^(\d{4})\D+(\d{1,2})(?:\D+(\d{1,2}))?/);
  if (!m) return '';
  const y = +m[1];
  const mo = +m[2];
  const d = m[3] ? +m[3] : 1;
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age--;
  return age > 0 && age < 120 ? String(age) : '';
}

/** 起止时间：2021-09-01 + 2025-06-30 → 2021.09-2025.06（结束为空 → 至今） */
export function periodOf(start, end) {
  const ym = v => {
    const m = String(v || '').match(/^(\d{4})\D+(\d{1,2})/);
    return m ? `${m[1]}.${String(m[2]).padStart(2, '0')}` : '';
  };
  const a = ym(start);
  if (!a) return '';
  const b = ym(end);
  return `${a}-${b || '至今'}`;
}

const PERIOD_CATEGORIES = ['education', 'internships', 'projects', 'positions', 'work', 'practice', 'trainings'];

/** 返回补齐后的新资料（不改原对象） */
export function deriveProfile(profile, today = new Date()) {
  if (!profile || typeof profile !== 'object') return profile;
  const out = { ...profile };
  const clone = id => (out[id] = (profile[id] || []).map(r => (r && typeof r === 'object' ? { ...r } : r)));

  // ① 个人信息
  const personal = clone('personal');
  const me = personal[0] || (personal[0] = {});
  if (!has(me['年龄']) && has(me['出生日期'])) {
    const a = ageFrom(me['出生日期'], today);
    if (a) me['年龄'] = a;
  }
  const hi = highestEducation(profile);
  if (hi) {
    const fill = (to, from) => {
      if (!has(me[to]) && has(hi[from])) me[to] = hi[from];
    };
    fill('最高学历', '学历');
    fill('最高学位', '学位');
    fill('毕业院校', '学校名称');
    fill('毕业专业', '专业名称');
    fill('毕业时间', '结束时间');
    fill('学习形式', '学习形式');
  }

  // ② 起止时间
  for (const id of PERIOD_CATEGORIES) {
    const list = clone(id);
    for (const r of list) {
      if (!r || typeof r !== 'object' || has(r['起止时间'])) continue;
      const p = periodOf(r['开始时间'], r['结束时间']);
      if (p) r['起止时间'] = p;
    }
  }

  // ③ 证书认证
  const skills = clone('skills');
  const sk = skills[0] || (skills[0] = {});
  if (!has(sk['证书认证'])) {
    const names = (profile.certificates || []).map(c => c && c['证书名称']).filter(has);
    if (names.length) sk['证书认证'] = names.join('、');
  }

  // ④ 工作经历缺省 → 实习经历（字段按同名 / 同义搬过去）
  const work = (out.work || []).filter(filledRecord);
  if (!work.length) {
    const map = {
      开始时间: '开始时间',
      结束时间: '结束时间',
      起止时间: '起止时间',
      单位名称: '单位名称',
      公司规模: '公司规模',
      所属行业: '所属行业',
      实习岗位: '职位',
      所在部门: '所在部门',
      实习地点: '工作地点',
      用工性质: '用工性质',
      职位年薪: '薪资',
      证明人姓名: '证明人姓名',
      证明人联系方式: '证明人联系方式',
      证明人职位: '证明人职位',
      实习内容: '工作内容',
      离职原因: '离职原因',
    };
    const fromInterns = (out.internships || []).filter(filledRecord).map(r => {
      const w = { __derivedFrom: 'internships' };
      for (const [a, b] of Object.entries(map)) if (has(r[a])) w[b] = r[a];
      if (Array.isArray(r.__custom)) w.__custom = r.__custom;
      return w;
    });
    if (fromInterns.length) out.work = fromInterns;
  }
  // ⑤ 社会实践缺省 → 校园经历（学生会 / 社团 / 学生工作）。两样都空就不填，绝不借实习的内容
  const prac = (out.practice || []).filter(filledRecord);
  if (!prac.length) {
    const fromPos = (out.positions || []).filter(filledRecord).map(r => {
      const p = { __derivedFrom: 'positions' };
      const map = { 组织名称: '组织名称', 在校职务名称: '担任角色', 开始时间: '开始时间', 结束时间: '结束时间', 起止时间: '起止时间', 在校职务描述: '实践描述' };
      for (const [a, b] of Object.entries(map)) if (has(r[a])) p[b] = r[a];
      if (!has(p['组织名称']) && has(r['在校职务类别'])) p['组织名称'] = r['在校职务类别'];
      return p;
    });
    if (fromPos.length) out.practice = fromPos;
  }
  return out;
}
