// Profile v2 数据契约：分类、字段语义槽、枚举字典、区块词典、强键
// 关键约定：字段 label 与 v1 完全一致，老数据无需改写即可用；语义信息在这里补足。

export const SCHEMA_VERSION = 2;

const T = (label, slot, alias, kind = 'text') => ({ label, slot, kind, alias });
const A = (label, slot, alias) => ({ label, slot, kind: 'textarea', alias });
const N = (label, slot, alias) => ({ label, slot, kind: 'number', alias });
const E = (label, slot, enumRef, alias) => ({ label, slot, kind: 'enum', enumRef, alias });
// 日期一律按"日"存（能填多细填多细）：写入时按网页控件能力自动降级到年月，
// 见 adapters/date.js 的 rawPrecision / coarserPrecision。
// 所以**不再有"月粒度字段"这个概念**——所有日期字段（出生日期、教育/实习起止、到岗时间…）
// 处理方式完全一致。
const D = (label, slot, precision, alias) => ({ label, slot, kind: 'date', precision, alias });
const U = (label, slot, alias) => ({ label, slot, kind: 'upload', alias });

export const CATEGORIES = [
  {
    id: 'personal',
    name: '个人信息',
    multiple: false,
    sectionKeys: ['个人信息', '基本信息', '个人资料', '基本资料', '个人基本信息', '个人信息填写'],
    fields: [
      T('姓名', 'personal.name', ['姓名', '名字', '真实姓名', '中文姓名', '申请人姓名']),
      E('性别', 'personal.gender', 'gender', ['性别']),
      D('出生日期', 'personal.birth', 'day', ['出生日期', '生日', '出生年月', '出生年月日']),
      E('证件类型', 'personal.idType', 'idType', ['证件类型', '证件种类', '证件']),
      T('证件号码', 'personal.idNo', ['证件号码', '证件号', '身份证号', '身份证号码', '证件编号']),
      E('政治面貌', 'personal.politics', 'politics', ['政治面貌', '政治背景']),
      E('民族', 'personal.ethnicity', 'ethnicity', ['民族']),
      // 最高学历是"人"的属性（网申基本信息区常单独问一次），教育经历里的"学历"是"这段经历"的属性
      E('最高学历', 'personal.highestDegree', 'degreeLevel', ['最高学历', '最高学历层次']),
      T('籍贯', 'personal.nativePlace', ['籍贯', '祖籍']),
      T('户籍所在地', 'personal.hukou', ['户籍所在地', '户口所在地', '户籍地', '户口所在地区']),
      T('手机', 'personal.mobile', ['手机', '手机号', '手机号码', '移动电话', '本人手机']),
      T('邮箱', 'personal.email', ['邮箱', '电子邮箱', '邮件', 'email', '常用邮箱']),
      T('当前所在城市', 'personal.currentCity', ['当前所在城市', '现居城市', '所在城市', '目前所在城市', '现居住城市', '当前城市', '现所在城市', '居住城市', '现居住地城市']),
      T('现居地址', 'personal.address', ['现居地址', '现居住地址', '居住地址', '现住址', '目前居住地']),
      T('通讯地址', 'personal.mailingAddress', ['通讯地址', '通信地址', '联系地址', '邮寄地址']),
      N('身高', 'personal.height', ['身高']),
      N('体重', 'personal.weight', ['体重']),
      T('紧急联系人', 'personal.emergencyContact', ['紧急联系人', '紧急联系人姓名']),
      T('紧急联系电话', 'personal.emergencyPhone', ['紧急联系电话', '紧急联系人电话', '紧急联系人手机']),
      T('参加高考城市', 'personal.gaokaoCity', ['参加高考城市', '高考所在地', '高考省份', '生源地']),
      T('英文名', 'personal.englishName', ['英文名', '英文姓名', '英文名字', 'englishname']),
      U('照片', 'personal.photo', ['照片', '头像', '证件照', '个人照片', '免冠照片']),
      // 简历附件：网页标签五花八门（「请上传您的简历」被 cleanLabel 去掉"请上传"后是「您的简历」）
      U('简历附件', 'personal.resume', ['简历附件', '简历', '上传简历', '您的简历', '附件简历', '个人简历', '简历文件', '中文简历', 'resume', 'cv']),
    ],
  },
  {
    id: 'intention',
    name: '求职意向',
    multiple: true,
    sectionKeys: ['求职意向', '应聘意向', '意向信息', '求职期望', '应聘信息', '岗位意向', '申请信息', '投递信息', '职位意向', '求职偏好', '实习意向'],
    fields: [
      T('意向岗位', 'intent.position', ['意向岗位', '应聘岗位', '期望职位', '求职岗位', '意向职位', '应聘职位']),
      T('意向城市', 'intent.city', ['意向城市', '期望工作城市', '意向工作地点', '期望城市']),
      T('意向行业', 'intent.industry', ['意向行业', '期望行业']),
      T('期望薪资', 'intent.salary', ['期望薪资', '期望月薪', '薪资要求', '期望薪酬', '期望年薪']),
      D('到岗时间', 'intent.onboard', 'day', ['到岗时间', '可到岗时间', '最快到岗时间', '入职时间', '最早到岗时间', '预计到岗时间']),
      // 实习岗网申的高频问题（辉瑞 / 图谱 tupu360 一类站点都会问）
      D('最早可实习时间', 'intent.internStart', 'day', ['最早可实习时间', '毕业前最早可实习时间', '可实习开始时间', '可开始实习时间', '最早实习时间', '可实习时间']),
      T('每周实习天数', 'intent.daysPerWeek', ['每周实习天数', '每周可出勤天数', '每周可实习天数', '每周出勤天数', '每周到岗天数', '每周可工作天数', '一周可实习天数']),
      T('实习时长', 'intent.internDuration', ['实习时长', '可实习时长', '实习周期', '可实习月数', '实习期限', '可连续实习时长']),
      T('是否服从调剂', 'intent.adjust', ['是否服从调剂', '是否服从岗位调剂', '是否接受调剂', '服从调剂', '是否接受调配', '是否服从分配', '是否接受岗位调剂', '是否服从专业调剂']),
      T('信息来源', 'intent.source', ['信息来源', '招聘信息来源', '你是从哪个渠道获取招聘信息的', '您是从哪个渠道获取招聘信息的', '获知渠道', '了解渠道', '信息获取渠道', '获取招聘信息渠道', '从何处得知招聘信息', '招聘渠道']),
      E('求职类型', 'intent.jobType', 'jobType', ['求职类型', '工作性质', '应聘类型']),
    ],
  },
  {
    id: 'education',
    name: '教育经历',
    multiple: true,
    sectionKeys: ['教育经历', '教育背景', '学习经历', '教育情况', '学历信息', '教育与培训'],
    fields: [
      // 资料库里按"日"存（能填多细填多细），填到网页时按控件能力自动降级到年月。
      // 有效精度 = min(资料精度, 控件精度)，见 adapters/date.js
      D('开始时间', 'edu.start', 'day', ['开始时间', '起始时间', '开始日期', '入学时间', '入学日期', '入学年月', '就读起始时间', '起始年月', '开始年月']),
      D('结束时间', 'edu.end', 'day', ['结束时间', '毕业时间', '结束日期', '毕业日期', '毕业年月', '预计毕业时间', '预计毕业日期', '预计毕业年月', '离校时间', '离校日期']),
      T('学校名称', 'edu.school', ['学校名称', '学校', '毕业院校', '院校', '院校名称', '就读学校']),
      T('学院名称', 'edu.college', ['学院名称', '学院', '所在学院', '院系']),
      // 专业类别必须单列：没有它时「专业类别」靠"包含专业"抢走 edu.major，
      // 真正的「专业名称」反而撞槽被跳过（tupu360 真机快照）
      T('专业类别', 'edu.majorCategory', ['专业类别', '专业类型', '学科门类', '专业大类', '学科类别', '专业所属类别', '最高学历专业类别']),
      T('专业名称', 'edu.major', ['专业名称', '专业', '所学专业', '就读专业']),
      // 别名里刻意不放"最高学历"：那是 personal.highestDegree 的别名。
      // 教育区块里出现"最高学历"时，靠"包含"打分（最高学历 ⊃ 学历）仍能落到这里。
      E('学历', 'edu.degreeLevel', 'degreeLevel', ['学历', '学历层次', '培养层次']),
      E('学位', 'edu.degreeName', 'degreeName', ['学位', '所获学位', '学位类型']),
      T('学习形式', 'edu.studyMode', ['学习形式', '培养方式', '学习方式', '就读形式', '教育形式']),
      A('专业课程', 'edu.courses', ['专业课程', '主修课程', '主要课程']),
      T('成绩（GPA）', 'edu.gpa', ['成绩gpa', 'gpa', '平均绩点', '绩点', '平均分', '成绩']),
      N('专业人数', 'edu.classSize', ['专业人数', '专业总人数', '年级人数', '专业总人数']),
      T('专业排名', 'edu.rank', ['专业排名', '成绩排名', '排名']),
    ],
  },
  {
    id: 'positions',
    name: '在校职务',
    multiple: true,
    sectionKeys: ['在校职务', '校园经历', '学生工作', '社团经历', '在校经历'],
    fields: [
      T('在校职务类别', 'pos.type', ['在校职务类别', '职务类别']),
      T('在校职务名称', 'pos.name', ['在校职务名称', '在校职务', '职务名称', '担任职务']),
      A('在校职务描述', 'pos.desc', ['在校职务描述', '职务描述', '工作描述']),
      D('开始时间', 'pos.start', 'day', ['开始时间', '起始时间', '开始日期']),
      D('结束时间', 'pos.end', 'day', ['结束时间', '结束日期', '离任时间']),
    ],
  },
  {
    id: 'practice',
    name: '在校实践',
    multiple: true,
    sectionKeys: ['在校实践', '实践经历', '项目经历', '科研经历', '项目经验', '科研及实践', '实践活动经验', '实践活动', '社会实践', '校内外实践', '实践经验', '活动经历', '科研项目经历'],
    fields: [
      T('在校科研及实践项目', 'prac.project', ['在校科研及实践项目', '项目名称', '实践项目', '科研项目', '项目经历', '活动名称', '实践名称', '实践活动名称']),
      T('担任角色', 'prac.role', ['担任角色', '项目角色', '角色']),
      A('实践描述', 'prac.desc', ['实践描述', '项目描述', '实践内容', '项目内容', '活动描述', '活动内容', '经历描述']),
      D('开始时间', 'prac.start', 'day', ['开始时间', '起始时间', '开始日期']),
      D('结束时间', 'prac.end', 'day', ['结束时间', '结束日期', '完成时间']),
    ],
  },
  {
    id: 'awards',
    name: '获奖情况',
    multiple: true,
    sectionKeys: ['获奖情况', '获奖经历', '荣誉奖励', '获奖信息', '奖励情况', '荣誉奖项', '获奖经验', '奖励荣誉', '所获荣誉', '荣誉证书', '获奖记录'],
    fields: [
      E('获奖级别', 'award.level', 'awardLevel', ['获奖级别', '奖项级别', '奖励级别']),
      T('奖项', 'award.name', ['奖项', '奖项名称', '获奖名称', '获奖情况', '荣誉名称', '奖励名称', '所获奖项']),
      D('获奖时间', 'award.time', 'day', ['获奖时间', '获奖日期', '获奖年月', '获得时间', '获奖年份']),
    ],
  },
  {
    id: 'publications',
    name: '论文/专著',
    multiple: true,
    sectionKeys: ['论文', '专著', '发表', '出版物'],
    fields: [
      T('名称', 'pub.name', ['名称', '论文名称', '专著名称', '论文专著名称', '题目']),
      D('发布时间', 'pub.time', 'day', ['发布时间', '发表日期', '发表时间']),
    ],
  },
  {
    id: 'internships',
    name: '实习经历',
    multiple: true,
    sectionKeys: ['实习经历', '工作经历', '实习经验', '实习情况', '职业经历', '实习及工作经历', '实习工作经历', '工作经验'],
    fields: [
      D('开始时间', 'exp.start', 'day', ['开始时间', '起始时间', '开始日期', '入职时间', '入职日期', '实习开始日期', '实习开始时间']),
      D('结束时间', 'exp.end', 'day', ['结束时间', '结束日期', '离职时间', '离职日期', '实习结束日期', '实习结束时间']),
      T('单位名称', 'exp.company', ['单位名称', '公司名称', '实习单位', '实习公司', '工作单位', '公司/组织名称', '组织名称', '企业名称', '实习单位名称', '公司/单位名称', '单位/公司名称']),
      T('实习岗位', 'exp.position', ['实习岗位', '实习岗位名称', '岗位名称', '职位名称', '实习职位', '担任职位', '岗位', '职位', '所任职位']),
      T('所在部门', 'exp.department', ['所在部门', '部门', '实习部门', '任职部门']),
      T('实习地点', 'exp.location', ['实习地点', '实习城市', '工作地点', '工作城市']),
      A('实习内容', 'exp.desc', ['实习内容', '工作内容', '实习描述', '工作描述', '实习职责', '工作职责', '实习工作职责/内容', '实习职责/内容', '工作职责/内容', '主要职责', '职责描述', '工作内容描述']),
    ],
  },
  {
    id: 'languages',
    name: '语言能力',
    multiple: true,
    sectionKeys: ['语言能力', '外语水平', '语言水平', '语言证书', '英语水平', '外语能力', '语言技能', '英语能力', '外语等级'],
    fields: [
      T('语言能力', 'lang.name', ['语言能力', '语种', '语言']),
      E('证书类型', 'lang.certType', 'certType', ['证书类型', '语言证书', '证书名称', '考试类型', '英语等级', '外语等级', '语言等级', '考试名称', '英语证书']),
      T('语言成绩', 'lang.score', ['语言成绩', '分数', '成绩', '等级', '考试成绩', '英语成绩', '分值']),
    ],
  },
  {
    id: 'family',
    name: '家庭情况',
    multiple: true,
    sectionKeys: ['家庭情况', '家庭成员', '家庭关系', '家庭信息'],
    fields: [
      T('姓名', 'family.name', ['成员姓名', '家庭成员姓名', '姓名', '名字']),
      T('与本人关系', 'family.relation', ['与本人关系', '关系', '称谓', '家庭成员关系']),
      T('工作单位', 'family.company', ['工作单位', '所在单位', '单位']),
      T('职务', 'family.title', ['职务', '职位', '担任职务']),
      T('工作所在地', 'family.location', ['工作所在地', '工作地点', '所在地']),
    ],
  },
  {
    id: 'additional',
    name: '附加信息',
    multiple: false,
    sectionKeys: ['附加信息', '其他信息', '自我评价', '补充信息', '其他说明'],
    fields: [
      A('兴趣爱好', 'extra.hobbies', ['兴趣爱好', '爱好', '兴趣']),
      A('特殊技能', 'extra.skills', ['特殊技能', '技能特长', '特长', '专业技能']),
      A('评价自身的优势和不足', 'extra.selfEval', ['评价自身的优势和不足', '自我评价', '优势与不足', '个人评价', '自我描述']),
    ],
  },
  {
    id: 'custom',
    name: '自定义字段',
    multiple: true,
    sectionKeys: [],
    custom: true,
    fields: [
      T('字段名称', 'custom.name', ['字段名称', '字段名']),
      A('字段内容', 'custom.content', ['字段内容', '内容']),
    ],
  },
];

// ---------- 枚举字典：canonical code → 同义词 ----------

const ETHNIC_NAMES = [
  '汉', '蒙古', '回', '藏', '维吾尔', '苗', '彝', '壮', '布依', '朝鲜', '满', '侗', '瑶', '白', '土家',
  '哈尼', '哈萨克', '傣', '黎', '傈僳', '佤', '畲', '高山', '拉祜', '水', '东乡', '纳西', '土', '仫佬',
  '羌', '锡伯', '柯尔克孜', '达斡尔', '景颇', '毛南', '仡佬', '撒拉', '布朗', '塔吉克', '阿昌', '普米', '鄂温克',
  '怒', '京', '基诺', '德昂', '保安', '俄罗斯', '裕固', '乌孜别克', '门巴', '鄂伦春', '独龙', '塔塔尔',
  '赫哲', '珞巴',
];

export const ENUMS = {
  gender: {
    M: ['男', '男性', 'male', 'm'],
    F: ['女', '女性', 'female', 'f'],
    U: ['保密', '不愿透露', '不方便透露'],
  },
  degreeLevel: {
    HIGH_SCHOOL: ['高中', '普通高中', '高级中学'],
    VOCATIONAL: ['中专', '中职', '技校', '中等专业学校'],
    ASSOCIATE: ['大专', '专科', '高职', '大学专科'],
    BACHELOR: ['本科', '大学本科', '全日制本科', '学士'],
    MASTER: ['硕士', '硕士研究生', '硕士生', '研究生'],
    DOCTOR: ['博士', '博士研究生', '博士生'],
  },
  degreeName: {
    NONE: ['无', '没有', '无学位'],
    BACHELOR: ['学士', '学士学位', '学术学位学士', '专业学位学士'],
    MASTER: ['硕士', '硕士学位', '学术型硕士', '专业型硕士', '学术学位硕士', '专业学位硕士', '研究生学位'],
    DOCTOR: ['博士', '博士学位', '学术型博士', '专业型博士', '学术学位博士', '专业学位博士'],
  },
  politics: {
    MASS: ['群众', '普通群众'],
    LEAGUE: ['团员', '共青团员', '中国共产主义青年团团员'],
    PARTY: ['党员', '中共党员', '共产党员', '中国共产党党员'],
    PREP: ['预备党员', '中共预备党员'],
    DEMOCRATIC: ['民主党派', '民主党派成员'],
    OTHER: ['其他', '其它'],
  },
  ethnicity: Object.fromEntries(
    [...new Set(ETHNIC_NAMES)].map(n => [n, n === '汉' ? ['汉族', '汉'] : [`${n}族`, n]])
  ),
  idType: {
    ID_CARD: ['身份证', '居民身份证', '二代身份证'],
    PASSPORT: ['护照'],
    HK_MO: ['港澳通行证', '港澳居民来往内地通行证'],
    TW: ['台胞证', '台湾居民来往大陆通行证'],
    FOREIGN: ['外国人永久居留身份证', '外国人居留证'],
    OTHER: ['其他', '其它'],
  },
  jobType: {
    FULL: ['全职', '全日制', '正式员工'],
    INTERN: ['实习', '实习生'],
    PART: ['兼职'],
    OTHER: ['其他', '其它'],
  },
  awardLevel: {
    NATIONAL: ['国家级', '国家', '全国'],
    PROVINCIAL: ['省级', '省部级', '省'],
    MUNICIPAL: ['市级', '市'],
    SCHOOL: ['校级', '学校', '校'],
    COLLEGE: ['院级', '学院', '院'],
    COMPANY: ['公司级', '企业'],
    OTHER: ['其他', '其它'],
  },
  certType: {
    CET4: ['大学英语四级', '英语四级', 'cet4', 'cet-4', '四级'],
    CET6: ['大学英语六级', '英语六级', 'cet6', 'cet-6', '六级'],
    TEM4: ['英语专业四级', '专四', 'tem4', 'tem-4'],
    TEM8: ['英语专业八级', '专八', 'tem8', 'tem-8'],
    IELTS: ['雅思', 'ielts'],
    TOEFL: ['托福', 'toefl'],
    GRE: ['gre'],
    TOEIC: ['托业', 'toeic'],
    TOPIK: ['topik', '韩语能力考试', '韩语等级'],
    JLPT: ['jlpt', '日语能力考试', '日语等级'],
    OTHER: ['其他', '其它'],
  },
};

// ---------- 索引 ----------

/** 每个字段补上 label 自身作为别名 */
function withLabelAlias(field) {
  const alias = [field.label, ...(field.alias || [])];
  return { ...field, alias: [...new Set(alias)] };
}

for (const c of CATEGORIES) c.fields = c.fields.map(withLabelAlias);

/**
 * 反别名（deny）：这些标签明确不属于该字段，打分时直接判 0。
 * 用在"包含"关系天然的字段对上，否则短的会把长的抢走：
 * 「学历」是教育经历里那一段的学历，不是这个人的最高学历；页面把它放在
 * 基本信息区时，仍然应该按教育经历的学历去填（历史行为，不能因为新增字段而改变）。
 */
const DENY_ALIAS = {
  'personal.highestDegree': ['学历', '学位', '学历层次', '培养层次', '毕业学历'],
};
// 反模式（denyRe）：标签里出现这些字就一定不是本字段。
// 「最高学历专业类别」同时"包含"学历与专业类别，两边打分几乎相同 → 判歧义整条跳过；
// 带"专业"二字的永远不是学历层次。
const DENY_RE = {
  'personal.highestDegree': /专业/,
  'edu.degreeLevel': /专业/,
  // 专业类别的标签一定带"类/门"（专业类别 / 学科门类 / 专业大类）；
  // 否则「最高学历」会因为"被最高学历专业类别包含"而和学历打成平手
  'edu.majorCategory': /^[^类门]*$/,
};
for (const c of CATEGORIES) {
  for (const f of c.fields) {
    if (DENY_ALIAS[f.slot]) f.deny = DENY_ALIAS[f.slot];
    if (DENY_RE[f.slot]) f.denyRe = DENY_RE[f.slot];
  }
}

/** slot → { field, category } */
export const FIELD_BY_SLOT = new Map();
/** categoryId → field[] */
export const FIELDS_BY_CATEGORY = new Map();
for (const c of CATEGORIES) {
  FIELDS_BY_CATEGORY.set(c.id, c.fields);
  for (const f of c.fields) FIELD_BY_SLOT.set(f.slot, { field: f, category: c });
}

/** 全部字段（无区块时的兜底匹配池） */
export const ALL_FIELDS = CATEGORIES.filter(c => !c.custom).flatMap(c =>
  c.fields.map(f => ({ field: f, category: c }))
);

/** 多记录分类的强键：用于块 ↔ 记录对齐 */
export const STRONG_KEYS = {
  education: ['edu.school', 'edu.major'],
  internships: ['exp.company'],
  practice: ['prac.project'],
  positions: ['pos.name'],
  awards: ['award.name'],
  publications: ['pub.name'],
  languages: ['lang.name', 'lang.certType'],
  family: ['family.name'],
  intention: ['intent.position'],
};

export function categoryById(id) {
  return CATEGORIES.find(c => c.id === id) || null;
}

export function defaultProfile() {
  return Object.fromEntries(CATEGORIES.map(c => [c.id, c.multiple ? [] : [{}]]));
}

/** 日期精度：字段决定，用于写入与校验 */
export function precisionOf(categoryId, label) {
  const c = categoryById(categoryId);
  const f = c && c.fields.find(x => x.label === label);
  if (f && f.kind === 'date') return f.precision || 'day';
  return 'day';
}
