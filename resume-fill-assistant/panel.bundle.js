(() => {
  // src/schema.js
  var SCHEMA_VERSION = 2;
  var T = (label, slot, alias, kind = "text") => ({ label, slot, kind, alias });
  var A = (label, slot, alias) => ({ label, slot, kind: "textarea", alias });
  var N = (label, slot, alias) => ({ label, slot, kind: "number", alias });
  var E = (label, slot, enumRef, alias) => ({ label, slot, kind: "enum", enumRef, alias });
  var D = (label, slot, precision, alias) => ({ label, slot, kind: "date", precision, alias });
  var U = (label, slot, alias) => ({ label, slot, kind: "upload", alias });
  var CATEGORIES = [
    {
      id: "personal",
      name: "个人信息",
      multiple: false,
      sectionKeys: ["个人信息", "基本信息", "个人资料", "基本资料", "个人基本信息", "个人信息填写"],
      fields: [
        T("姓名", "personal.name", ["姓名", "名字", "真实姓名", "中文姓名", "申请人姓名"]),
        E("性别", "personal.gender", "gender", ["性别"]),
        D("出生日期", "personal.birth", "day", ["出生日期", "生日", "出生年月", "出生年月日"]),
        E("证件类型", "personal.idType", "idType", ["证件类型", "证件种类", "证件"]),
        T("证件号码", "personal.idNo", ["证件号码", "证件号", "身份证号", "身份证号码", "证件编号"]),
        E("政治面貌", "personal.politics", "politics", ["政治面貌", "政治背景"]),
        E("民族", "personal.ethnicity", "ethnicity", ["民族"]),
        // 最高学历是"人"的属性（网申基本信息区常单独问一次），教育经历里的"学历"是"这段经历"的属性
        E("最高学历", "personal.highestDegree", "degreeLevel", ["最高学历", "最高学历层次"]),
        T("籍贯", "personal.nativePlace", ["籍贯", "祖籍"]),
        T("户籍所在地", "personal.hukou", ["户籍所在地", "户口所在地", "户籍地", "户口所在地区"]),
        T("手机", "personal.mobile", ["手机", "手机号", "手机号码", "移动电话", "本人手机"]),
        T("邮箱", "personal.email", ["邮箱", "电子邮箱", "邮件", "email", "常用邮箱"]),
        T("现居地址", "personal.address", ["现居地址", "现居住地址", "居住地址", "现住址", "目前居住地"]),
        T("通讯地址", "personal.mailingAddress", ["通讯地址", "通信地址", "联系地址", "邮寄地址"]),
        N("身高", "personal.height", ["身高"]),
        N("体重", "personal.weight", ["体重"]),
        T("紧急联系人", "personal.emergencyContact", ["紧急联系人", "紧急联系人姓名"]),
        T("紧急联系电话", "personal.emergencyPhone", ["紧急联系电话", "紧急联系人电话", "紧急联系人手机"]),
        T("参加高考城市", "personal.gaokaoCity", ["参加高考城市", "高考所在地", "高考省份", "生源地"]),
        U("照片", "personal.photo", ["照片", "头像", "证件照", "个人照片", "免冠照片"])
      ]
    },
    {
      id: "intention",
      name: "求职意向",
      multiple: true,
      sectionKeys: ["求职意向", "应聘意向", "意向信息", "求职期望", "应聘信息", "岗位意向"],
      fields: [
        T("意向岗位", "intent.position", ["意向岗位", "应聘岗位", "期望职位", "求职岗位", "意向职位", "应聘职位"]),
        T("意向城市", "intent.city", ["意向城市", "期望工作城市", "意向工作地点", "期望城市"]),
        T("意向行业", "intent.industry", ["意向行业", "期望行业"]),
        T("期望薪资", "intent.salary", ["期望薪资", "期望月薪", "薪资要求", "期望薪酬", "期望年薪"]),
        D("到岗时间", "intent.onboard", "day", ["到岗时间", "可到岗时间", "最快到岗时间", "入职时间"]),
        E("求职类型", "intent.jobType", "jobType", ["求职类型", "工作性质", "应聘类型"])
      ]
    },
    {
      id: "education",
      name: "教育经历",
      multiple: true,
      sectionKeys: ["教育经历", "教育背景", "学习经历", "教育情况", "学历信息", "教育与培训"],
      fields: [
        // 资料库里按"日"存（能填多细填多细），填到网页时按控件能力自动降级到年月。
        // 有效精度 = min(资料精度, 控件精度)，见 adapters/date.js
        D("开始时间", "edu.start", "day", ["开始时间", "起始时间", "开始日期", "入学时间", "就读起始时间", "起始年月", "开始年月"]),
        D("结束时间", "edu.end", "day", ["结束时间", "毕业时间", "结束日期", "毕业年月", "预计毕业时间", "预计毕业年月", "离校时间"]),
        T("学校名称", "edu.school", ["学校名称", "学校", "毕业院校", "院校", "院校名称", "就读学校"]),
        T("学院名称", "edu.college", ["学院名称", "学院", "所在学院", "院系"]),
        T("专业名称", "edu.major", ["专业名称", "专业", "所学专业", "就读专业"]),
        // 别名里刻意不放"最高学历"：那是 personal.highestDegree 的别名。
        // 教育区块里出现"最高学历"时，靠"包含"打分（最高学历 ⊃ 学历）仍能落到这里。
        E("学历", "edu.degreeLevel", "degreeLevel", ["学历", "学历层次", "培养层次"]),
        E("学位", "edu.degreeName", "degreeName", ["学位", "所获学位", "学位类型"]),
        T("学习形式", "edu.studyMode", ["学习形式", "培养方式", "学习方式", "就读形式", "教育形式"]),
        A("专业课程", "edu.courses", ["专业课程", "主修课程", "主要课程"]),
        T("成绩（GPA）", "edu.gpa", ["成绩gpa", "gpa", "平均绩点", "绩点", "平均分", "成绩"]),
        N("专业人数", "edu.classSize", ["专业人数", "专业总人数", "年级人数", "专业总人数"]),
        T("专业排名", "edu.rank", ["专业排名", "成绩排名", "排名"])
      ]
    },
    {
      id: "positions",
      name: "在校职务",
      multiple: true,
      sectionKeys: ["在校职务", "校园经历", "学生工作", "社团经历", "在校经历"],
      fields: [
        T("在校职务类别", "pos.type", ["在校职务类别", "职务类别"]),
        T("在校职务名称", "pos.name", ["在校职务名称", "在校职务", "职务名称", "担任职务"]),
        A("在校职务描述", "pos.desc", ["在校职务描述", "职务描述", "工作描述"]),
        D("开始时间", "pos.start", "day", ["开始时间", "起始时间", "开始日期"]),
        D("结束时间", "pos.end", "day", ["结束时间", "结束日期", "离任时间"])
      ]
    },
    {
      id: "practice",
      name: "在校实践",
      multiple: true,
      sectionKeys: ["在校实践", "实践经历", "项目经历", "科研经历", "项目经验", "科研及实践"],
      fields: [
        T("在校科研及实践项目", "prac.project", ["在校科研及实践项目", "项目名称", "实践项目", "科研项目", "项目经历"]),
        T("担任角色", "prac.role", ["担任角色", "项目角色", "角色"]),
        A("实践描述", "prac.desc", ["实践描述", "项目描述", "实践内容", "项目内容"]),
        D("开始时间", "prac.start", "day", ["开始时间", "起始时间", "开始日期"]),
        D("结束时间", "prac.end", "day", ["结束时间", "结束日期", "完成时间"])
      ]
    },
    {
      id: "awards",
      name: "获奖情况",
      multiple: true,
      sectionKeys: ["获奖情况", "获奖经历", "荣誉奖励", "获奖信息", "奖励情况", "荣誉奖项"],
      fields: [
        E("获奖级别", "award.level", "awardLevel", ["获奖级别", "奖项级别", "奖励级别"]),
        T("奖项", "award.name", ["奖项", "奖项名称", "获奖名称", "获奖情况"]),
        D("获奖时间", "award.time", "day", ["获奖时间", "获奖日期", "获奖年月"])
      ]
    },
    {
      id: "publications",
      name: "论文/专著",
      multiple: true,
      sectionKeys: ["论文", "专著", "发表", "出版物"],
      fields: [
        T("名称", "pub.name", ["名称", "论文名称", "专著名称", "论文专著名称", "题目"]),
        D("发布时间", "pub.time", "day", ["发布时间", "发表日期", "发表时间"])
      ]
    },
    {
      id: "internships",
      name: "实习经历",
      multiple: true,
      sectionKeys: ["实习经历", "工作经历", "实习经验", "实习情况", "职业经历", "实习及工作经历"],
      fields: [
        D("开始时间", "exp.start", "day", ["开始时间", "起始时间", "开始日期", "入职时间"]),
        D("结束时间", "exp.end", "day", ["结束时间", "结束日期", "离职时间"]),
        T("单位名称", "exp.company", ["单位名称", "公司名称", "实习单位", "实习公司", "工作单位"]),
        T("实习地点", "exp.location", ["实习地点", "实习城市", "工作地点"]),
        A("实习内容", "exp.desc", ["实习内容", "工作内容", "实习描述", "工作描述", "实习职责"])
      ]
    },
    {
      id: "languages",
      name: "语言能力",
      multiple: true,
      sectionKeys: ["语言能力", "外语水平", "语言水平", "语言证书"],
      fields: [
        T("语言能力", "lang.name", ["语言能力", "语种", "语言"]),
        E("证书类型", "lang.certType", "certType", ["证书类型", "语言证书", "证书名称", "考试类型"]),
        T("语言成绩", "lang.score", ["语言成绩", "分数", "成绩", "等级"])
      ]
    },
    {
      id: "family",
      name: "家庭情况",
      multiple: true,
      sectionKeys: ["家庭情况", "家庭成员", "家庭关系", "家庭信息"],
      fields: [
        T("姓名", "family.name", ["成员姓名", "家庭成员姓名", "姓名", "名字"]),
        T("与本人关系", "family.relation", ["与本人关系", "关系", "称谓", "家庭成员关系"]),
        T("工作单位", "family.company", ["工作单位", "所在单位", "单位"]),
        T("职务", "family.title", ["职务", "职位", "担任职务"]),
        T("工作所在地", "family.location", ["工作所在地", "工作地点", "所在地"])
      ]
    },
    {
      id: "additional",
      name: "附加信息",
      multiple: false,
      sectionKeys: ["附加信息", "其他信息", "自我评价", "补充信息", "其他说明"],
      fields: [
        A("兴趣爱好", "extra.hobbies", ["兴趣爱好", "爱好", "兴趣"]),
        A("特殊技能", "extra.skills", ["特殊技能", "技能特长", "特长", "专业技能"]),
        A("评价自身的优势和不足", "extra.selfEval", ["评价自身的优势和不足", "自我评价", "优势与不足", "个人评价", "自我描述"])
      ]
    },
    {
      id: "custom",
      name: "自定义字段",
      multiple: true,
      sectionKeys: [],
      custom: true,
      fields: [
        T("字段名称", "custom.name", ["字段名称", "字段名"]),
        A("字段内容", "custom.content", ["字段内容", "内容"])
      ]
    }
  ];
  var ETHNIC_NAMES = [
    "汉",
    "蒙古",
    "回",
    "藏",
    "维吾尔",
    "苗",
    "彝",
    "壮",
    "布依",
    "朝鲜",
    "满",
    "侗",
    "瑶",
    "白",
    "土家",
    "哈尼",
    "哈萨克",
    "傣",
    "黎",
    "傈僳",
    "佤",
    "畲",
    "高山",
    "拉祜",
    "水",
    "东乡",
    "纳西",
    "土",
    "仫佬",
    "羌",
    "锡伯",
    "柯尔克孜",
    "达斡尔",
    "景颇",
    "毛南",
    "仡佬",
    "撒拉",
    "布朗",
    "塔吉克",
    "阿昌",
    "普米",
    "鄂温克",
    "怒",
    "京",
    "基诺",
    "德昂",
    "保安",
    "俄罗斯",
    "裕固",
    "乌孜别克",
    "门巴",
    "鄂伦春",
    "独龙",
    "塔塔尔",
    "赫哲",
    "珞巴"
  ];
  var ENUMS = {
    gender: {
      M: ["男", "男性", "male", "m"],
      F: ["女", "女性", "female", "f"],
      U: ["保密", "不愿透露", "不方便透露"]
    },
    degreeLevel: {
      HIGH_SCHOOL: ["高中", "普通高中", "高级中学"],
      VOCATIONAL: ["中专", "中职", "技校", "中等专业学校"],
      ASSOCIATE: ["大专", "专科", "高职", "大学专科"],
      BACHELOR: ["本科", "大学本科", "全日制本科", "学士"],
      MASTER: ["硕士", "硕士研究生", "硕士生", "研究生"],
      DOCTOR: ["博士", "博士研究生", "博士生"]
    },
    degreeName: {
      NONE: ["无", "没有", "无学位"],
      BACHELOR: ["学士", "学士学位", "学术学位学士", "专业学位学士"],
      MASTER: ["硕士", "硕士学位", "学术型硕士", "专业型硕士", "学术学位硕士", "专业学位硕士", "研究生学位"],
      DOCTOR: ["博士", "博士学位", "学术型博士", "专业型博士", "学术学位博士", "专业学位博士"]
    },
    politics: {
      MASS: ["群众", "普通群众"],
      LEAGUE: ["团员", "共青团员", "中国共产主义青年团团员"],
      PARTY: ["党员", "中共党员", "共产党员", "中国共产党党员"],
      PREP: ["预备党员", "中共预备党员"],
      DEMOCRATIC: ["民主党派", "民主党派成员"],
      OTHER: ["其他", "其它"]
    },
    ethnicity: Object.fromEntries(
      [...new Set(ETHNIC_NAMES)].map((n) => [n, n === "汉" ? ["汉族", "汉"] : [`${n}族`, n]])
    ),
    idType: {
      ID_CARD: ["身份证", "居民身份证", "二代身份证"],
      PASSPORT: ["护照"],
      HK_MO: ["港澳通行证", "港澳居民来往内地通行证"],
      TW: ["台胞证", "台湾居民来往大陆通行证"],
      FOREIGN: ["外国人永久居留身份证", "外国人居留证"],
      OTHER: ["其他", "其它"]
    },
    jobType: {
      FULL: ["全职", "全日制", "正式员工"],
      INTERN: ["实习", "实习生"],
      PART: ["兼职"],
      OTHER: ["其他", "其它"]
    },
    awardLevel: {
      NATIONAL: ["国家级", "国家", "全国"],
      PROVINCIAL: ["省级", "省部级", "省"],
      MUNICIPAL: ["市级", "市"],
      SCHOOL: ["校级", "学校", "校"],
      COLLEGE: ["院级", "学院", "院"],
      COMPANY: ["公司级", "企业"],
      OTHER: ["其他", "其它"]
    },
    certType: {
      CET4: ["大学英语四级", "英语四级", "cet4", "cet-4", "四级"],
      CET6: ["大学英语六级", "英语六级", "cet6", "cet-6", "六级"],
      TEM4: ["英语专业四级", "专四", "tem4", "tem-4"],
      TEM8: ["英语专业八级", "专八", "tem8", "tem-8"],
      IELTS: ["雅思", "ielts"],
      TOEFL: ["托福", "toefl"],
      GRE: ["gre"],
      TOEIC: ["托业", "toeic"],
      TOPIK: ["topik", "韩语能力考试", "韩语等级"],
      JLPT: ["jlpt", "日语能力考试", "日语等级"],
      OTHER: ["其他", "其它"]
    }
  };
  function withLabelAlias(field) {
    const alias = [field.label, ...field.alias || []];
    return { ...field, alias: [...new Set(alias)] };
  }
  for (const c of CATEGORIES) c.fields = c.fields.map(withLabelAlias);
  var DENY_ALIAS = {
    "personal.highestDegree": ["学历", "学位", "学历层次", "培养层次", "毕业学历"]
  };
  for (const c of CATEGORIES) {
    for (const f of c.fields) {
      if (DENY_ALIAS[f.slot]) f.deny = DENY_ALIAS[f.slot];
    }
  }
  var FIELD_BY_SLOT = /* @__PURE__ */ new Map();
  var FIELDS_BY_CATEGORY = /* @__PURE__ */ new Map();
  for (const c of CATEGORIES) {
    FIELDS_BY_CATEGORY.set(c.id, c.fields);
    for (const f of c.fields) FIELD_BY_SLOT.set(f.slot, { field: f, category: c });
  }
  var ALL_FIELDS = CATEGORIES.filter((c) => !c.custom).flatMap(
    (c) => c.fields.map((f) => ({ field: f, category: c }))
  );

  // src/util.js
  var normalize = (s) => String(s ?? "").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");

  // src/panel/index.js
  var STORAGE_KEY = "resumeProfile";
  var $ = (s) => document.querySelector(s);
  var profile = {};
  var activeId = "personal";
  var saveTimer;
  function defaults() {
    return Object.fromEntries(CATEGORIES.map((c) => [c.id, c.multiple ? [] : [{}]]));
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      profile.schemaVersion = SCHEMA_VERSION;
      chrome.storage.local.set({ [STORAGE_KEY]: profile });
    }, 180);
  }
  var pad2 = (n) => String(n).padStart(2, "0");
  function normalizeDates() {
    for (const c of CATEGORIES) {
      const records = profile[c.id] || [];
      for (const rec of records) {
        if (!rec) continue;
        for (const f of c.fields) {
          if (f.kind !== "date") continue;
          const v = rec[f.label];
          if (typeof v !== "string") continue;
          const m = v.match(/^(\d{4})\s*[-/.年]\s*(\d{1,2})(?:\s*[-/.月]\s*(\d{1,2}))?/);
          if (!m) continue;
          const ym = `${m[1]}-${pad2(m[2])}`;
          if (f.precision === "month") {
            rec[f.label] = ym;
          } else {
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
    if (stored && !stored.schemaVersion) {
      try {
        await chrome.storage.local.set({ [`${STORAGE_KEY}_v1_backup`]: stored });
      } catch (_) {
      }
    }
    profile = { ...defaults(), ...stored || {} };
    profile.schemaVersion = SCHEMA_VERSION;
    CATEGORIES.forEach((c) => {
      if (!Array.isArray(profile[c.id])) profile[c.id] = c.multiple ? [] : [{}];
    });
    normalizeDates();
    renderNav();
    renderSection();
    save();
  }
  function renderNav() {
    const nav = $("#category-nav");
    nav.replaceChildren();
    CATEGORIES.forEach((c) => {
      const b = document.createElement("button");
      b.className = "nav-item" + (activeId === c.id ? " active" : "");
      b.type = "button";
      const name = document.createElement("span");
      name.textContent = c.name;
      const count = document.createElement("span");
      count.className = "nav-count";
      count.textContent = c.multiple ? String((profile[c.id] || []).length) : "";
      b.append(name, count);
      b.onclick = () => {
        activeId = c.id;
        renderNav();
        renderSection();
      };
      nav.append(b);
    });
  }
  function addTag(label, text) {
    const tag = document.createElement("span");
    tag.className = "field-tag";
    tag.textContent = text;
    label.append(tag);
  }
  function createField(field, record) {
    const wrap = document.createElement("div");
    wrap.className = "field" + (field.kind === "textarea" ? " wide" : "");
    const label = document.createElement("label");
    label.textContent = field.label;
    const isPhoto = field.kind === "upload";
    const el = field.kind === "textarea" ? document.createElement("textarea") : document.createElement("input");
    if (el.tagName === "INPUT") {
      if (isPhoto) {
        el.type = "file";
        el.accept = "image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp";
      } else if (field.kind === "date") {
        el.type = "date";
      } else if (field.kind === "number") {
        el.type = "number";
      } else {
        el.type = "text";
      }
    }
    const raw = record[field.label];
    const monthOnly = field.kind === "date" && typeof raw === "string" && /^\d{4}-\d{2}$/.test(raw);
    if (monthOnly) addTag(label, "仅年月");
    if (!isPhoto) {
      el.value = raw || "";
      if (monthOnly) el.value = `${raw}-01`;
      if (!el.placeholder) el.placeholder = "选填";
    }
    el.setAttribute("aria-label", field.label);
    el.oninput = () => {
      record[field.label] = el.value;
      save();
    };
    if (isPhoto) {
      el.onchange = () => {
        const file = el.files && el.files[0];
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
          el.value = "";
          showNotice("请选择 5MB 以内的 JPG、JPEG、PNG 或 WEBP 图片。", true);
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
    const isLegacyCustomName = field.slot === "custom.name";
    if (isLegacyCustomName) {
      wrap.classList.add("custom-name-field");
      el.addEventListener("input", refreshCustomWarnings);
    }
    wrap.append(label, el);
    if (isLegacyCustomName) {
      const warn = document.createElement("p");
      warn.className = "custom-warn";
      warn.hidden = true;
      wrap.append(warn);
    }
    const current = record[field.label];
    if (isPhoto && current && current.dataUrl) {
      const preview = document.createElement("img");
      preview.src = current.dataUrl;
      preview.alt = "已选照片";
      preview.className = "photo-preview";
      wrap.append(preview);
    }
    return wrap;
  }
  function customRowsOf(record) {
    return record && Array.isArray(record.__custom) ? record.__custom : [];
  }
  function renderCustom(record, category) {
    if (!record || category.custom) return null;
    const box = document.createElement("div");
    box.className = "custom-fields";
    const head = document.createElement("div");
    head.className = "custom-head";
    const title = document.createElement("span");
    title.className = "custom-title";
    title.textContent = "自定义字段";
    const add = document.createElement("button");
    add.className = "link-button";
    add.type = "button";
    add.textContent = "＋ 添加";
    add.onclick = () => {
      for (const r of profile[category.id] || []) {
        if (!Array.isArray(r.__custom)) r.__custom = [];
        r.__custom.push({ name: "", value: "" });
      }
      save();
      renderSection();
    };
    head.append(title, add);
    box.append(head);
    const rows = customRowsOf(record);
    if (!rows.length) {
      const hint = document.createElement("p");
      hint.className = "custom-hint";
      hint.textContent = "网页上还有这里没有的字段？按网页的标签名加一条，填的时候会自动对上。";
      box.append(hint);
      return box;
    }
    const listEl = document.createElement("div");
    listEl.className = "custom-rows";
    rows.forEach((item, i) => {
      const box2 = document.createElement("div");
      box2.className = "custom-item";
      const row = document.createElement("div");
      row.className = "custom-row";
      const name = document.createElement("input");
      name.type = "text";
      name.className = "custom-name";
      name.placeholder = "字段名（照网页标签写）";
      name.value = item.name || "";
      name.setAttribute("aria-label", "自定义字段名");
      name.oninput = () => {
        item.name = name.value;
        for (const r of profile[category.id] || []) {
          if (r === record) continue;
          if (!Array.isArray(r.__custom)) r.__custom = [];
          while (r.__custom.length <= i) r.__custom.push({ name: "", value: "" });
          r.__custom[i].name = name.value;
        }
        document.querySelectorAll("#records .record-card").forEach((card) => {
          const rows2 = card.querySelectorAll(".custom-item");
          const twin = rows2[i] && rows2[i].querySelector(".custom-name");
          if (twin && twin !== name) twin.value = name.value;
        });
        save();
        refreshCustomWarnings();
      };
      const value = document.createElement("input");
      value.type = "text";
      value.className = "custom-value";
      value.placeholder = "内容";
      value.value = item.value || "";
      value.setAttribute("aria-label", "自定义字段内容");
      value.oninput = () => {
        item.value = value.value;
        save();
      };
      const del = document.createElement("button");
      del.type = "button";
      del.className = "delete-button";
      del.textContent = "✕";
      del.title = "删除这个自定义字段";
      del.onclick = () => {
        for (const r of profile[category.id] || []) {
          if (!Array.isArray(r.__custom)) continue;
          r.__custom.splice(i, 1);
          if (!r.__custom.length) delete r.__custom;
        }
        save();
        renderSection();
      };
      const warn = document.createElement("p");
      warn.className = "custom-warn";
      warn.hidden = true;
      row.append(name, value, del);
      box2.append(row, warn);
      listEl.append(box2);
    });
    box.append(listEl);
    return box;
  }
  var BUILTIN_NAMES = new Set(
    CATEGORIES.flatMap((c) => c.custom ? [] : c.fields.flatMap((f) => f.alias.map((a) => normalize(a))))
  );
  function customNameCells() {
    const out = [];
    for (const it of document.querySelectorAll("#records .custom-item")) {
      out.push({ box: it, input: it.querySelector(".custom-name"), warn: it.querySelector(".custom-warn") });
    }
    for (const it of document.querySelectorAll("#records .field.custom-name-field")) {
      out.push({ box: it, input: it.querySelector("input"), warn: it.querySelector(".custom-warn") });
    }
    return out;
  }
  function refreshCustomWarnings() {
    const cells = customNameCells();
    if (!cells.length) return;
    const names = cells.map((c) => String(c.input && c.input.value || "").trim());
    const keys = names.map(normalize);
    const GLOBAL = Symbol("global");
    const groupOf = (c) => {
      if (c.box.classList && c.box.classList.contains("custom-name-field")) return GLOBAL;
      return c.box.closest && c.box.closest(".record-card") || c.box;
    };
    const counts = /* @__PURE__ */ new Map();
    cells.forEach((c, i) => {
      if (!keys[i]) return;
      const g = groupOf(c);
      let inner = counts.get(g);
      if (!inner) {
        inner = /* @__PURE__ */ new Map();
        counts.set(g, inner);
      }
      inner.set(keys[i], (inner.get(keys[i]) || 0) + 1);
    });
    cells.forEach((cell, i) => {
      let text = "";
      if (!names[i]) text = "没填字段名，这条不会被填充";
      else if (BUILTIN_NAMES.has(keys[i])) text = "和内置字段重名：内置的优先，这条不会被填进去";
      else {
        const inner = counts.get(groupOf(cell));
        if (inner && (inner.get(keys[i]) || 0) > 1)
          text = "同一条记录里有同名字段，只有第一条生效";
      }
      const warn = cell.warn;
      if (warn) {
        warn.textContent = text;
        warn.hidden = !text;
      }
      if (cell.box) cell.box.classList.toggle("has-warning", !!text);
    });
  }
  function renderSection() {
    const c = CATEGORIES.find((x) => x.id === activeId);
    $("#section-title").textContent = c.name;
    const base = c.multiple ? '可添加多条记录。同名多记录会按"学校 / 单位"等强键与网页区块自动配对。' : "所有字段均为选填。";
    $("#section-description").textContent = c.custom ? '每条记录的"字段名称"就是网页上的标签名，填充时按它去对位。' : base + "每个分类都可以在下方加自定义字段。";
    $("#add-record").hidden = !c.multiple;
    const list = $("#records");
    list.replaceChildren();
    const records = profile[c.id] || [];
    $("#empty-state").hidden = records.length > 0;
    records.forEach((record, index) => {
      const card = document.createElement("section");
      card.className = "record-card";
      const head = document.createElement("div");
      head.className = "record-header";
      const title = document.createElement("span");
      title.className = "record-title";
      title.textContent = c.multiple ? `${c.name} ${index + 1}` : c.name;
      head.append(title);
      if (c.multiple) {
        const del = document.createElement("button");
        del.className = "delete-button";
        del.type = "button";
        del.textContent = "删除";
        del.onclick = () => {
          profile[c.id].splice(index, 1);
          save();
          renderNav();
          renderSection();
        };
        head.append(del);
      }
      const grid = document.createElement("div");
      grid.className = "field-grid";
      c.fields.forEach((field) => grid.append(createField(field, record)));
      card.append(head, grid);
      const custom = renderCustom(record, c);
      if (custom) card.append(custom);
      list.append(card);
    });
    refreshCustomWarnings();
  }
  $("#add-record").onclick = () => {
    const c = CATEGORIES.find((x) => x.id === activeId);
    profile[c.id].push({});
    save();
    renderNav();
    renderSection();
  };
  function showNotice(text, error = false) {
    const n = $("#notice");
    n.textContent = text;
    n.classList.toggle("error", error);
    n.classList.add("show");
    setTimeout(() => n.classList.remove("show"), 4600);
  }
  var STATUS_TEXT = {
    filled: "已填",
    "filled-low": "低置信",
    skipped: "已跳过",
    failed: "失败",
    empty: "无资料"
  };
  var REASON_TEXT = {
    "label-uncertain": "网页标签无法确定对应字段",
    "duplicate-slot": "同一段里出现了两次相同字段（多段经历没切分开），这一处跳过",
    "no-record": "网页区块在资料库中无对应记录",
    "option-no-match": "选项里没有匹配值",
    "option-ambiguous": "多个选项都可能，未敢选",
    "no-options": "控件没有可选项",
    "checkbox-unsupported": "多选组暂不支持",
    "panel-not-open": "下拉/日历面板未打开",
    "date-failed": "日期五级降级均失败，已回滚",
    "cleared-by-site": "写入成功后网页把它清掉了（重试一次仍被清），已如实标记",
    "date-verify-failed": "写入后回读不一致，已回滚",
    "value-not-a-date": "资料值不是合法日期",
    "readback-mismatch": "写入后回读不一致",
    "no-el": "找不到控件",
    "no-photo": "资料库未上传照片",
    "not-file-input": "网页不是文件上传控件",
    "control-kind-mismatch": "控件类型与字段不匹配，未写入",
    "cascader-unsupported": "省市区级联暂不支持，已跳过",
    "custom-no-match": "资料库有这个自定义字段，但网页上没有能对上的同名标签",
    "custom-name-duplicate": "自定义字段名与内置字段/其他自定义字段重名，未参与匹配",
    "custom-name-empty": "自定义字段没填名字，未参与匹配"
  };
  var lastReport = null;
  function renderReport(report) {
    const box = $("#report");
    const summary = $("#report-summary");
    const body = $("#report-body");
    box.hidden = false;
    summary.replaceChildren();
    body.replaceChildren();
    if (!report || report.error) {
      const p = document.createElement("p");
      p.className = "report-error";
      p.textContent = "填写失败：" + (report && report.error || "未知错误");
      summary.append(p);
      return;
    }
    const chips = [
      ["识别字段", report.total],
      ["已填", report.filled],
      ["低置信", report.lowConfidence],
      ["跳过", report.skipped],
      ["失败", report.failed]
    ];
    chips.forEach(([k, v]) => {
      const c = document.createElement("span");
      c.className = "chip";
      c.innerHTML = `<b>${v}</b> ${k}`;
      summary.append(c);
    });
    const rows = (report.results || []).filter((r) => r.status !== "empty");
    if (report.sections && report.sections.length) {
      const line = document.createElement("p");
      line.className = "report-sections";
      line.textContent = "识别区块：" + report.sections.map((s) => `${s.title || "(未命名)"}×${s.blocks}块/${s.fields ?? "?"}字段`).join("　");
      body.append(line);
    }
    if (report.repeat && ((report.repeat.added || 0) > 0 || (report.repeat.log || []).length)) {
      const line = document.createElement("p");
      line.className = "report-sections";
      const added = report.repeat.added || 0;
      const log = (report.repeat.log || []).join("；");
      line.textContent = (added > 0 ? `自动新增 ${added} 个经历区块：` : "未能自动新增经历区块：") + log;
      body.append(line);
    }
    if (report.reasonCounts && Object.keys(report.reasonCounts).length) {
      const line = document.createElement("p");
      line.className = "report-reasons";
      line.textContent = "原因分布：" + Object.entries(report.reasonCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${REASON_TEXT[k] || k}×${v}`).join("；");
      body.append(line);
    }
    if (!rows.length) {
      const p = document.createElement("p");
      p.className = "report-empty";
      p.textContent = "没有可报告的内容（页面字段在资料库里都没有值）。";
      body.append(p);
      return;
    }
    const table = document.createElement("table");
    table.className = "report-table";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>区块</th><th>字段</th><th>值</th><th>状态</th><th>说明</th></tr>";
    const tbody = document.createElement("tbody");
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      const statusKey = r.status === "filled" && r.lowConfidence ? "filled-low" : r.status;
      const reason = r.reason ? REASON_TEXT[r.reason] || r.reason : "";
      const extra = r.available && r.available.length ? `（网页选项：${r.available.slice(0, 6).join(" / ")})` : "";
      const attempts = r.attempts && r.attempts.length ? `（尝试：${r.attempts.join(" → ")}）` : "";
      const parts = r.parts && r.parts.length ? `（取到的标签：${r.parts.join(" / ")}）` : "";
      const hints = r.hints && r.hints.length ? `（可见面板：${r.hints.slice(0, 4).join(" / ")}）` : "";
      const panelText = r.panelText ? `（面板内容：${r.panelText}）` : "";
      const downgraded = r.downgraded === "month" ? "（网页只到年月，已按年月写入）" : "";
      const padded = r.note === "site-padded" ? "（网页把数值补成了固定小数位，已按你的原值回写）" : "";
      const cells = [
        r.section ? `${r.section}${r.block > 0 ? " #" + (r.block + 1) : ""}` : "未识别区块",
        r.label || "（未取到标签）",
        r.value,
        STATUS_TEXT[statusKey] || r.status,
        [reason + downgraded + padded + extra + attempts + parts + hints + panelText, r.readback && r.status !== "filled" ? `回读：${r.readback}` : ""].filter(Boolean).join("；")
      ];
      cells.forEach((text, i) => {
        const td = document.createElement("td");
        td.textContent = text || "";
        if (i === 3) td.className = `st st-${statusKey}`;
        tr.append(td);
      });
      tbody.append(tr);
    });
    table.append(thead, tbody);
    body.append(table);
  }
  $("#report-close").onclick = () => {
    $("#report").hidden = true;
  };
  $("#report-copy").onclick = async () => {
    try {
      const text = JSON.stringify(lastReport, null, 2);
      await navigator.clipboard.writeText(text);
      showNotice("诊断信息已复制，可直接发给开发者定位问题。");
    } catch (_) {
      showNotice("复制失败，请用控制台查看。", true);
    }
  };
  try {
    const v = chrome && chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : null;
    if (v) $("#panel-version").textContent = `仅保存在此设备 · v${v}`;
  } catch (_) {
  }
  $("#fill-page").onclick = async () => {
    const btn = $("#fill-page");
    btn.disabled = true;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) {
        showNotice("请先打开需要填写的网申网页。", true);
        return;
      }
      const inject = async () => {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["main-world.js"],
            world: "MAIN"
          });
        } catch (_) {
        }
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.bundle.js"] });
      };
      const send = () => chrome.tabs.sendMessage(tab.id, { type: "FILL_FORM", profile });
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
      if (result && result.error) {
        showNotice(`填写中断：${result.error}`, true);
      } else if (result && result.found) {
        showNotice(`已填 ${result.filled} 个（低置信 ${result.lowConfidence}），跳过 ${result.skipped} 个。请核对网页。`);
      } else {
        showNotice("未识别到可填写的表单字段。", true);
      }
      renderReport(result);
    } catch (e) {
      const msg = String(e.message || e);
      if (/Cannot access|permission|主机|权限/i.test(msg)) {
        showNotice("缺少该网站的访问权限。请到扩展详情 → 网站访问权限 → 选「在所有网站上」，再重试。", true);
      } else {
        showNotice(`填写失败：${msg}`, true);
      }
    } finally {
      btn.disabled = false;
    }
  };
  load();
})();
