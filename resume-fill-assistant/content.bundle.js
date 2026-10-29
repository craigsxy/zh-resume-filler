(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/util.js
  var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  var normalize = (s) => String(s ?? "").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
  var cleanLabel = (s) => String(s ?? "").replace(/请输入|请选择|请填写|请上传|选填|必填|（必填）|\(必填\)/g, "").replace(/^[*＊\s]+/, "").replace(/[:：]\s*$/, "").trim();
  function charDice(a, b) {
    const A2 = [...a];
    const B = [...b];
    if (!A2.length || !B.length) return 0;
    const bag = /* @__PURE__ */ new Map();
    for (const c of A2) bag.set(c, (bag.get(c) || 0) + 1);
    let inter = 0;
    for (const c of B) {
      const n = bag.get(c) || 0;
      if (n > 0) {
        inter++;
        bag.set(c, n - 1);
      }
    }
    return 2 * inter / (A2.length + B.length);
  }
  var START_RE = /开始|起始|入学|入职|进入|就读|起|start|begin/;
  var END_RE = /结束|毕业|离职|离开|终止|止|end|finish/;
  function conflicts(a, b) {
    const A2 = String(a || "");
    const B = String(b || "");
    if (START_RE.test(A2) && END_RE.test(B)) return true;
    if (END_RE.test(A2) && START_RE.test(B)) return true;
    return false;
  }
  function lengthPenalty(text) {
    const n = [...String(text || "")].length;
    if (n > 24) return 0.45;
    if (n > 14) return 0.78;
    if (n > 10) return 0.92;
    return 1;
  }
  var layoutChecked = false;
  var layoutAvailable = true;
  function hasLayoutEngine() {
    if (!layoutChecked) {
      layoutChecked = true;
      try {
        layoutAvailable = !!(document.body && document.body.getClientRects && document.body.getClientRects().length);
      } catch (_) {
        layoutAvailable = false;
      }
    }
    return layoutAvailable;
  }
  function isVisible(el) {
    if (!el || !el.getClientRects) return false;
    if (el.hasAttribute && el.hasAttribute("hidden")) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return false;
    if (Number(cs.opacity) === 0) return false;
    if (!hasLayoutEngine()) return true;
    return el.getClientRects().length > 0;
  }
  function realmOf(el) {
    const doc = el && el.ownerDocument;
    const view = doc && doc.defaultView;
    if (view && typeof view.Event === "function") return view;
    if (typeof window !== "undefined" && window && typeof window.Event === "function") return window;
    return globalThis;
  }
  function fire(el, type, init = {}) {
    if (!el || typeof el.dispatchEvent !== "function") return false;
    const R = realmOf(el);
    const opts = { bubbles: true, cancelable: true, ...init };
    const ctors = type.startsWith("key") ? [R.KeyboardEvent, R.Event] : /^(mouse|click|pointer|focus|blur)/.test(type) ? [R.MouseEvent, R.Event] : [R.Event];
    for (const C of ctors) {
      if (typeof C !== "function") continue;
      try {
        el.dispatchEvent(new C(type, opts));
        return true;
      } catch (_) {
      }
    }
    try {
      const ev = el.ownerDocument.createEvent("Event");
      ev.initEvent(type, opts.bubbles !== false, true);
      el.dispatchEvent(ev);
      return true;
    } catch (_) {
    }
    return false;
  }
  function setNativeValue(el, value) {
    const view = realmOf(el);
    const tag = el.tagName;
    const proto = tag === "TEXTAREA" ? view.HTMLTextAreaElement && view.HTMLTextAreaElement.prototype : tag === "SELECT" ? view.HTMLSelectElement && view.HTMLSelectElement.prototype : view.HTMLInputElement && view.HTMLInputElement.prototype;
    let desc = proto && Object.getOwnPropertyDescriptor(proto, "value");
    if (!desc || !desc.set) {
      let n = Object.getPrototypeOf(el);
      while (n && !desc) {
        desc = Object.getOwnPropertyDescriptor(n, "value");
        n = Object.getPrototypeOf(n);
      }
    }
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
  }
  function clickEl(el) {
    if (!el) return false;
    const R = realmOf(el);
    let cx = 0;
    let cy = 0;
    try {
      const r = el.getBoundingClientRect();
      if (r && (r.width || r.height)) {
        cx = Math.round(r.left + r.width / 2);
        cy = Math.round(r.top + r.height / 2);
      }
    } catch (_) {
    }
    const opts = {
      bubbles: true,
      cancelable: true,
      view: R,
      button: 0,
      buttons: 1,
      clientX: cx,
      clientY: cy,
      screenX: cx,
      screenY: cy,
      detail: 1
    };
    try {
      fire(el, "pointerover", { ...opts, pointerType: "mouse", isPrimary: true, pointerId: 1 });
      fire(el, "mouseover", opts);
      fire(el, "pointermove", { ...opts, buttons: 0, pointerType: "mouse", isPrimary: true, pointerId: 1 });
      fire(el, "mousemove", opts);
    } catch (_) {
    }
    const P = R.PointerEvent;
    if (P) {
      fire(el, "pointerdown", { ...opts, pointerType: "mouse", isPrimary: true, pointerId: 1 });
      fire(el, "mousedown", opts);
      fire(el, "pointerup", { ...opts, buttons: 0, pointerType: "mouse", isPrimary: true, pointerId: 1 });
      fire(el, "mouseup", { ...opts, buttons: 0 });
    } else {
      fire(el, "mousedown", opts);
      fire(el, "mouseup", { ...opts, buttons: 0 });
    }
    fire(el, "click", { ...opts, buttons: 0 });
    return true;
  }
  async function waitFor(fn, timeout = 1500, interval = 60) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      let r = null;
      try {
        r = fn();
      } catch (_) {
        r = null;
      }
      if (r) return r;
      await sleep(interval);
    }
    return null;
  }
  function numericOf(text) {
    const s = String(text ?? "").replace(/\s/g, "");
    const k = s.match(/(-?\d+(?:\.\d+)?)\s*[kK]/);
    if (k) return String(Math.round(parseFloat(k[1]) * 1e3));
    const m = s.match(/-?\d+(?:\.\d+)?/);
    return m ? m[0] : "";
  }
  function shortText(el, max = 24) {
    return String(el && (el.innerText || el.textContent) || "").replace(/\s+/g, " ").trim().slice(0, max);
  }
  function leavesOf(root) {
    if (!root) return [];
    return [...root.querySelectorAll("*")].filter(
      (e) => e.children.length === 0 && String(e.textContent || "").trim()
    );
  }
  function cssEsc(s) {
    try {
      return CSS.escape(s);
    } catch (_) {
      return String(s).replace(/["\\]/g, "\\$&");
    }
  }
  function tagOf(el) {
    if (!el || !el.tagName) return "";
    const cls = String(el.className || "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
    return `<${el.tagName.toLowerCase()}${cls ? "." + cls : ""}>`;
  }
  function pathOf(el, max = 6) {
    const out = [];
    let n = el && el.parentElement;
    let d = 0;
    while (n && n.nodeType === 1 && n !== document.body && d < max) {
      out.push(tagOf(n));
      n = n.parentElement;
      d++;
    }
    return out.join(" < ");
  }

  // src/schema.js
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
        T("当前所在城市", "personal.currentCity", ["当前所在城市", "现居城市", "所在城市", "目前所在城市", "现居住城市", "当前城市", "现所在城市", "居住城市", "现居住地城市"]),
        T("现居地址", "personal.address", ["现居地址", "现居住地址", "居住地址", "现住址", "目前居住地"]),
        T("通讯地址", "personal.mailingAddress", ["通讯地址", "通信地址", "联系地址", "邮寄地址"]),
        N("身高", "personal.height", ["身高"]),
        N("体重", "personal.weight", ["体重"]),
        T("紧急联系人", "personal.emergencyContact", ["紧急联系人", "紧急联系人姓名"]),
        T("紧急联系电话", "personal.emergencyPhone", ["紧急联系电话", "紧急联系人电话", "紧急联系人手机"]),
        T("参加高考城市", "personal.gaokaoCity", ["参加高考城市", "高考所在地", "高考省份", "生源地"]),
        T("英文名", "personal.englishName", ["英文名", "英文姓名", "英文名字", "englishname"]),
        U("照片", "personal.photo", ["照片", "头像", "证件照", "个人照片", "免冠照片"]),
        // 简历附件：网页标签五花八门（「请上传您的简历」被 cleanLabel 去掉"请上传"后是「您的简历」）
        U("简历附件", "personal.resume", ["简历附件", "简历", "上传简历", "您的简历", "附件简历", "个人简历", "简历文件", "中文简历", "resume", "cv"])
      ]
    },
    {
      id: "intention",
      name: "求职意向",
      multiple: true,
      sectionKeys: ["求职意向", "应聘意向", "意向信息", "求职期望", "应聘信息", "岗位意向", "申请信息", "投递信息", "职位意向", "求职偏好", "实习意向"],
      fields: [
        T("意向岗位", "intent.position", ["意向岗位", "应聘岗位", "期望职位", "求职岗位", "意向职位", "应聘职位"]),
        T("意向城市", "intent.city", ["意向城市", "期望工作城市", "意向工作地点", "期望城市"]),
        T("意向行业", "intent.industry", ["意向行业", "期望行业"]),
        T("期望薪资", "intent.salary", ["期望薪资", "期望月薪", "薪资要求", "期望薪酬", "期望年薪"]),
        D("到岗时间", "intent.onboard", "day", ["到岗时间", "可到岗时间", "最快到岗时间", "入职时间", "最早到岗时间", "预计到岗时间"]),
        // 实习岗网申的高频问题（辉瑞 / 图谱 tupu360 一类站点都会问）
        D("最早可实习时间", "intent.internStart", "day", ["最早可实习时间", "毕业前最早可实习时间", "可实习开始时间", "可开始实习时间", "最早实习时间", "可实习时间"]),
        T("每周实习天数", "intent.daysPerWeek", ["每周实习天数", "每周可出勤天数", "每周可实习天数", "每周出勤天数", "每周到岗天数", "每周可工作天数", "一周可实习天数"]),
        T("实习时长", "intent.internDuration", ["实习时长", "可实习时长", "实习周期", "可实习月数", "实习期限", "可连续实习时长"]),
        T("是否服从调剂", "intent.adjust", ["是否服从调剂", "是否服从岗位调剂", "是否接受调剂", "服从调剂", "是否接受调配", "是否服从分配", "是否接受岗位调剂", "是否服从专业调剂"]),
        T("信息来源", "intent.source", ["信息来源", "招聘信息来源", "你是从哪个渠道获取招聘信息的", "您是从哪个渠道获取招聘信息的", "获知渠道", "了解渠道", "信息获取渠道", "获取招聘信息渠道", "从何处得知招聘信息", "招聘渠道"]),
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
        D("开始时间", "edu.start", "day", ["开始时间", "起始时间", "开始日期", "入学时间", "入学日期", "入学年月", "就读起始时间", "起始年月", "开始年月"]),
        D("结束时间", "edu.end", "day", ["结束时间", "毕业时间", "结束日期", "毕业日期", "毕业年月", "预计毕业时间", "预计毕业日期", "预计毕业年月", "离校时间", "离校日期"]),
        T("学校名称", "edu.school", ["学校名称", "学校", "毕业院校", "院校", "院校名称", "就读学校"]),
        T("学院名称", "edu.college", ["学院名称", "学院", "所在学院", "院系"]),
        // 专业类别必须单列：没有它时「专业类别」靠"包含专业"抢走 edu.major，
        // 真正的「专业名称」反而撞槽被跳过（tupu360 真机快照）
        T("专业类别", "edu.majorCategory", ["专业类别", "专业类型", "学科门类", "专业大类", "学科类别", "专业所属类别", "最高学历专业类别"]),
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
      sectionKeys: ["在校实践", "实践经历", "项目经历", "科研经历", "项目经验", "科研及实践", "实践活动经验", "实践活动", "社会实践", "校内外实践", "实践经验", "活动经历", "科研项目经历"],
      fields: [
        T("在校科研及实践项目", "prac.project", ["在校科研及实践项目", "项目名称", "实践项目", "科研项目", "项目经历", "活动名称", "实践名称", "实践活动名称"]),
        T("担任角色", "prac.role", ["担任角色", "项目角色", "角色"]),
        A("实践描述", "prac.desc", ["实践描述", "项目描述", "实践内容", "项目内容", "活动描述", "活动内容", "经历描述"]),
        D("开始时间", "prac.start", "day", ["开始时间", "起始时间", "开始日期"]),
        D("结束时间", "prac.end", "day", ["结束时间", "结束日期", "完成时间"])
      ]
    },
    {
      id: "awards",
      name: "获奖情况",
      multiple: true,
      sectionKeys: ["获奖情况", "获奖经历", "荣誉奖励", "获奖信息", "奖励情况", "荣誉奖项", "获奖经验", "奖励荣誉", "所获荣誉", "荣誉证书", "获奖记录"],
      fields: [
        E("获奖级别", "award.level", "awardLevel", ["获奖级别", "奖项级别", "奖励级别"]),
        T("奖项", "award.name", ["奖项", "奖项名称", "获奖名称", "获奖情况", "荣誉名称", "奖励名称", "所获奖项"]),
        D("获奖时间", "award.time", "day", ["获奖时间", "获奖日期", "获奖年月", "获得时间", "获奖年份"])
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
      sectionKeys: ["实习经历", "工作经历", "实习经验", "实习情况", "职业经历", "实习及工作经历", "实习工作经历", "工作经验"],
      fields: [
        D("开始时间", "exp.start", "day", ["开始时间", "起始时间", "开始日期", "入职时间", "入职日期", "实习开始日期", "实习开始时间"]),
        D("结束时间", "exp.end", "day", ["结束时间", "结束日期", "离职时间", "离职日期", "实习结束日期", "实习结束时间"]),
        T("单位名称", "exp.company", ["单位名称", "公司名称", "实习单位", "实习公司", "工作单位", "公司/组织名称", "组织名称", "企业名称", "实习单位名称", "公司/单位名称", "单位/公司名称"]),
        T("实习岗位", "exp.position", ["实习岗位", "实习岗位名称", "岗位名称", "职位名称", "实习职位", "担任职位", "岗位", "职位", "所任职位"]),
        T("所在部门", "exp.department", ["所在部门", "部门", "实习部门", "任职部门"]),
        T("实习地点", "exp.location", ["实习地点", "实习城市", "工作地点", "工作城市"]),
        A("实习内容", "exp.desc", ["实习内容", "工作内容", "实习描述", "工作描述", "实习职责", "工作职责", "实习工作职责/内容", "实习职责/内容", "工作职责/内容", "主要职责", "职责描述", "工作内容描述"])
      ]
    },
    {
      id: "languages",
      name: "语言能力",
      multiple: true,
      sectionKeys: ["语言能力", "外语水平", "语言水平", "语言证书", "英语水平", "外语能力", "语言技能", "英语能力", "外语等级"],
      fields: [
        T("语言能力", "lang.name", ["语言能力", "语种", "语言"]),
        E("证书类型", "lang.certType", "certType", ["证书类型", "语言证书", "证书名称", "考试类型", "英语等级", "外语等级", "语言等级", "考试名称", "英语证书"]),
        T("语言成绩", "lang.score", ["语言成绩", "分数", "成绩", "等级", "考试成绩", "英语成绩", "分值"])
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
  var DENY_RE = {
    "personal.highestDegree": /专业/,
    "edu.degreeLevel": /专业/,
    // 专业类别的标签一定带"类/门"（专业类别 / 学科门类 / 专业大类）；
    // 否则「最高学历」会因为"被最高学历专业类别包含"而和学历打成平手
    "edu.majorCategory": /^[^类门]*$/
  };
  for (const c of CATEGORIES) {
    for (const f of c.fields) {
      if (DENY_ALIAS[f.slot]) f.deny = DENY_ALIAS[f.slot];
      if (DENY_RE[f.slot]) f.denyRe = DENY_RE[f.slot];
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
  var STRONG_KEYS = {
    education: ["edu.school", "edu.major"],
    internships: ["exp.company"],
    practice: ["prac.project"],
    positions: ["pos.name"],
    awards: ["award.name"],
    publications: ["pub.name"],
    languages: ["lang.name", "lang.certType"],
    family: ["family.name"],
    intention: ["intent.position"]
  };
  function categoryById(id) {
    return CATEGORIES.find((c) => c.id === id) || null;
  }

  // src/form-model.js
  var categoryById2 = (id) => CATEGORIES.find((c) => c.id === id) || { multiple: false, fields: [] };
  var FIELD_SEL = 'input, textarea, select, [contenteditable="true"], [role="combobox"]';
  var IGNORE_INPUT_TYPES = /* @__PURE__ */ new Set(["hidden", "submit", "button", "reset", "image"]);
  var LABEL_SEL = 'label,[class*="label"],[class*="Label"],[class*="title"],[class*="Title"],[class*="caption"]';
  var OPTION_SEL = '[role="radio"],[role="checkbox"],[class*="radio"],[class*="Radio"],[class*="checkbox"],[class*="Checkbox"]';
  function isOptionish(n) {
    try {
      return !!(n && n.matches && n.matches(OPTION_SEL));
    } catch (_) {
      return false;
    }
  }
  var SECTION_KEYS = CATEGORIES.filter((c) => (c.sectionKeys || []).length).flatMap((c) => c.sectionKeys.map((k) => ({ id: c.id, key: k }))).sort((a, b) => b.key.length - a.key.length);
  var FIELD_LABEL_SET = /* @__PURE__ */ new Set();
  for (const c of CATEGORIES) {
    for (const f of c.fields) {
      FIELD_LABEL_SET.add(normalize(f.label));
      for (const a of f.alias || []) FIELD_LABEL_SET.add(normalize(a));
    }
  }
  var countCache = /* @__PURE__ */ new Map();
  function countFields(node) {
    if (!node || node.nodeType !== 1) return 0;
    if (countCache.has(node)) return countCache.get(node);
    let n = 0;
    try {
      n = node.querySelectorAll(FIELD_SEL).length;
    } catch (_) {
      n = 0;
    }
    countCache.set(node, n);
    return n;
  }
  function matchSection(text) {
    const n = normalize(text);
    if (!n) return null;
    const len = [...n].length;
    if (len > 12) return null;
    for (const { id, key } of SECTION_KEYS) {
      const kn = normalize(key);
      if (kn && n === kn) return { categoryId: id, key };
    }
    if (FIELD_LABEL_SET.has(n)) return null;
    for (const { id, key } of SECTION_KEYS) {
      const kn = normalize(key);
      if (kn && n.includes(kn)) return { categoryId: id, key };
    }
    return null;
  }
  function looksLikeSectionTitle(t) {
    const n = normalize(t);
    if (!n) return false;
    const len = [...n].length;
    if (len < 2 || len > 12) return false;
    if (FIELD_LABEL_SET.has(n)) return false;
    if (/^[\d.\-/]+$/.test(n)) return false;
    return /[\u4e00-\u9fa5a-z]/.test(n);
  }
  function ownText(node) {
    if (!node) return "";
    let t = "";
    for (const c of node.childNodes) if (c.nodeType === 3) t += c.textContent;
    return t.replace(/\s+/g, " ").trim();
  }
  function looksLikeLabel(t, maxLen = 12) {
    const s = String(t || "").replace(/\s+/g, "");
    if (!s) return false;
    const len = [...s].length;
    if (len < 1 || len > maxLen) return false;
    if (/^[\d.\-/年月日]+$/.test(s)) return false;
    if (/^(请选择|请输入|请填写|请上传|选填|必填|请输入内容|暂无)$/.test(s)) return false;
    return /[\u4e00-\u9fa5]/.test(s);
  }
  var LATIN_LABEL_STOP = /^(submit|reset|search|ok|yes|no|cancel|confirm|close|next|prev|back|save|login|logout|more)$/i;
  function looksLikeLatinLabel(t) {
    const s = String(t || "").replace(/\s+/g, "");
    if (!s) return false;
    const len = [...s].length;
    if (len < 2 || len > 20) return false;
    if (!/^[A-Za-z][A-Za-z0-9_+#.\-]*$/.test(s)) return false;
    return !LATIN_LABEL_STOP.test(s);
  }
  function isExplicitLabel(n) {
    if (!n || !n.tagName) return false;
    if (n.tagName === "LABEL") return true;
    return /label/i.test(String(n.className || ""));
  }
  function labelTextsOf(node, el) {
    const out = [];
    if (!node) return out;
    if (node === document.body || node === document.documentElement) return out;
    const add = (t, allowLatin = false, allowLong = false) => {
      const s = cleanLabel(t);
      if (looksLikeLabel(s) || allowLatin && looksLikeLatinLabel(s)) {
        out.push(s);
        return;
      }
      if (allowLong && looksLikeLabel(s, 30)) out.push(s);
      const cut = String(s).split(/[\s，,。；;：:（(【[|/]+/).map((x) => cleanLabel(x)).find((x) => x && (looksLikeLabel(x) || allowLatin && looksLikeLatinLabel(x)));
      if (cut) out.push(cut);
    };
    try {
      for (const n of node.querySelectorAll(LABEL_SEL)) {
        if (n.contains(el)) continue;
        if (isOptionish(n)) continue;
        if (countFields(n) > 0) continue;
        add(shortText(n, 40), true, isExplicitLabel(n));
      }
    } catch (_) {
    }
    for (const k of node.children || []) {
      if (k.contains && k.contains(el)) continue;
      if (isOptionish(k)) continue;
      if (countFields(k) > 0) continue;
      add(shortText(k, 24));
    }
    const prev = node.previousElementSibling;
    if (prev && !isOptionish(prev) && !(prev.contains && prev.contains(el)) && countFields(prev) === 0) {
      const t = shortText(prev, 24);
      const looksHeader = /(title|header|head|caption|legend)/i.test(String(prev.className || ""));
      if (!(looksHeader && matchSection(cleanLabel(t)))) add(t);
    }
    return [...new Set(out)];
  }
  var FORM_ITEM_TOKENS = /* @__PURE__ */ new Set([
    "form-item",
    "formitem",
    "form_item",
    "form-field",
    "formfield",
    "form_field",
    "ant-form-item",
    "el-form-item",
    "ivu-form-item",
    "van-field",
    "moka-form-item",
    "field-item",
    "form-row",
    "input-item"
  ]);
  function formItemAncestor(el) {
    let n = el.parentElement;
    let depth = 0;
    while (n && n !== document.body && depth < 14) {
      const tokens = String(n.className || "").split(/\s+/).filter(Boolean);
      if (tokens.some((t) => FORM_ITEM_TOKENS.has(t.toLowerCase()))) {
        const c = countFields(n);
        if (c >= 1 && c <= 8) return n;
      }
      n = n.parentElement;
      depth++;
    }
    return null;
  }
  function findContainer(el) {
    const item = formItemAncestor(el);
    if (item && labelTextsOf(item, el).length) return item;
    let node = el.parentElement;
    let depth = 0;
    let fallback = el.parentElement;
    while (node && node !== document.body && depth < 10) {
      const n = countFields(node);
      if (n <= 8) {
        fallback = node;
        if (labelTextsOf(node, el).length) return node;
      }
      node = node.parentElement;
      depth++;
    }
    const safe = (n) => n && n !== document.body && n !== document.documentElement ? n : null;
    return safe(item) || safe(fallback) || el.parentElement;
  }
  function pickSectionFromText(raw) {
    const t = cleanLabel(raw);
    if (!t) return null;
    const r = matchSection(t);
    if (r) return { title: t, ...r };
    if (looksLikeSectionTitle(t)) return { title: t, categoryId: null };
    const seg = String(t).split(/[\s|｜·•—–\-\/]+/).map((x) => cleanLabel(x)).find((x) => x && [...x].length <= 12 && (matchSection(x) || looksLikeSectionTitle(x)));
    if (seg) {
      const r2 = matchSection(seg);
      return r2 ? { title: seg, ...r2 } : { title: seg, categoryId: null };
    }
    return null;
  }
  function sectionTitleOf(node) {
    if (!node || node.nodeType !== 1) return null;
    let heads = [];
    try {
      heads = node.querySelectorAll(":scope > legend, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5");
    } catch (_) {
      heads = [];
    }
    for (const h of heads) {
      const r = pickSectionFromText(shortText(h, 40));
      if (r) return { ...r, strong: true };
    }
    for (const k of node.children) {
      if (countFields(k) > 0) continue;
      const cls = String(k.className || "");
      if (!/(title|header|head|caption|legend)/i.test(cls)) continue;
      const r = pickSectionFromText(shortText(k, 40));
      if (r) return SECTION_HEAD_RE.test(cls) ? { ...r, strong: true } : r;
    }
    const own = ownText(node);
    if (own) {
      const r = pickSectionFromText(own);
      if (r) return r;
    }
    try {
      let firstField = null;
      try {
        firstField = node.querySelector(FIELD_SEL);
      } catch (_) {
      }
      if (firstField) {
        let checked = 0;
        for (const el of node.querySelectorAll("*")) {
          if (++checked > 800) break;
          if (el.children.length) continue;
          if (el.matches(FIELD_SEL)) continue;
          if (isOptionish(el)) continue;
          if (el.closest && el.closest('[class*="form-item"]')) continue;
          if (!(el.compareDocumentPosition(firstField) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
          const t = cleanLabel(el.textContent);
          const len = [...t].length;
          if (len < 2 || len > 12) continue;
          const r = matchSection(t);
          if (r) return { title: t, ...r };
        }
      }
    } catch (_) {
    }
    return null;
  }
  var SECTION_HEAD_RE = /(section|card|module|part|group|block|panel|area|step)[-_]?(title|header|head|caption)|(title|header|head)[-_]?(section|card|module|wrapper|wrap|bar)/i;
  function sectionOf(container) {
    let node = container.parentElement;
    let depth = 0;
    while (node && node !== document.body && depth < 16) {
      const n = countFields(node);
      if (n >= 1) {
        const t = sectionTitleOf(node);
        if (t && (n >= 2 || t.strong)) return { title: t.title, categoryId: t.categoryId, container: node };
      }
      node = node.parentElement;
      depth++;
    }
    return { title: "", categoryId: null, container: null };
  }
  function detectControlKind(el) {
    const tag = el.tagName;
    if (tag === "SELECT") return "SELECT_NATIVE";
    if (tag === "TEXTAREA") return "TEXTAREA";
    if (el.isContentEditable) return "RICH_TEXT";
    if (tag === "INPUT") {
      const t = (el.type || "text").toLowerCase();
      if (t === "file") return "UPLOAD";
      if (t === "date") return "DATE_NATIVE_DAY";
      if (t === "month") return "DATE_NATIVE_MONTH";
      if (t === "radio") return "RADIO_GROUP";
      if (t === "checkbox") return "CHECKBOX_GROUP";
      if (t === "number") return "NUMBER";
      if (el.readOnly || el.getAttribute("aria-haspopup") || el.getAttribute("role") === "combobox") return "PICKER";
      return "TEXT";
    }
    if (el.getAttribute("role") === "combobox") return "SELECT_CUSTOM";
    return "TEXT";
  }
  function refinePickerKind(field) {
    if (field.controlKind !== "PICKER") return field.controlKind;
    const box = field.container || field.el.parentElement;
    const hints = [
      field.labelParts.join(" "),
      field.el.getAttribute("placeholder") || "",
      String(box && box.className || ""),
      String(box && box.innerHTML || "").slice(0, 1500)
    ].join(" ");
    if (/(日历|calendar|date-picker|datepicker|日期选择|时间选择)/i.test(hints)) return "DATE_CUSTOM";
    if (/(日期|时间|年月|出生|生日|date|time)/i.test(hints)) return "DATE_CUSTOM";
    return "SELECT_CUSTOM";
  }
  var KIND_HINTS = [
    { re: /cascader|area-select|region-select|city-select/i, kind: "CASCADER" },
    { re: /date-?picker|datepicker|datetime|time-?picker|calendar|date-?select/i, kind: "DATE_CUSTOM" },
    { re: /(^|[\s_-])select([\s_-]|$)|select__|select--/i, kind: "SELECT_CUSTOM" }
  ];
  function classChainOf(el, max = 5) {
    const out = [];
    let n = el;
    let d = 0;
    while (n && n.nodeType === 1 && d < max) {
      out.push(String(n.className || ""));
      n = n.parentElement;
      d++;
    }
    return out.join(" ").replace(/\s+/g, " ");
  }
  function refineKindByComponent(field) {
    const k = field.controlKind;
    if (!["TEXT", "PICKER", "SELECT_CUSTOM", "DATE_CUSTOM"].includes(k)) return k;
    const chain = classChainOf(field.el, 5);
    for (const h of KIND_HINTS) if (h.re.test(chain)) return h.kind;
    return k;
  }
  function pickLabel(parts) {
    const cjk = parts.find((p) => /[\u4e00-\u9fa5]/.test(p) && [...p].length <= 12);
    return cjk || parts[0] || "";
  }
  var elIds = /* @__PURE__ */ new WeakMap();
  var elSeq = 0;
  function idOf(el) {
    if (!el) return "0";
    if (!elIds.has(el)) elIds.set(el, ++elSeq);
    return String(elIds.get(el));
  }
  function groupContainer(items) {
    if (!items || !items.length) return null;
    const first = items[0];
    let c = first.parentElement;
    let depth = 0;
    while (c && c !== document.body && depth < 8) {
      const containsAll = items.every((e) => e === first || c.contains(e));
      if (containsAll && labelTextsOf(c, first).length) return c;
      c = c.parentElement;
      depth++;
    }
    return null;
  }
  function choiceKeyOf(el, container, type) {
    const name = el.getAttribute("name") || "";
    if (name) return "n:" + name;
    let n = el.parentElement;
    let depth = 0;
    while (n && n !== document.body && depth < 6) {
      let same = 0;
      let others = 0;
      try {
        for (const x of n.querySelectorAll('input,textarea,select,[role="combobox"],[contenteditable="true"]')) {
          if (x.tagName === "INPUT" && String(x.type || "").toLowerCase() === type) same++;
          else others++;
        }
      } catch (_) {
      }
      if (same >= 2 && others === 0) return "a:" + idOf(n);
      n = n.parentElement;
      depth++;
    }
    return "c:" + idOf(container || el.parentElement);
  }
  function mergeChoiceGroups(items) {
    const out = [];
    const groups = /* @__PURE__ */ new Map();
    for (const it of items) {
      const el = it.el;
      const t = el.tagName === "INPUT" ? String(el.type || "").toLowerCase() : "";
      if (t !== "radio" && t !== "checkbox") {
        out.push(it);
        continue;
      }
      const key = `${t}:${choiceKeyOf(el, it.container, t)}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          el,
          container: it.container,
          forceKind: t === "radio" ? "RADIO_GROUP" : "CHECKBOX_GROUP",
          choiceInputs: [el]
        };
        groups.set(key, g);
        out.push(g);
      } else {
        g.choiceInputs.push(el);
      }
    }
    for (const g of groups.values()) {
      if (g.choiceInputs.length < 2) continue;
      const c = groupContainer(g.choiceInputs);
      if (c) g.container = c;
    }
    return out;
  }
  function collectFields(root) {
    const out = [];
    let all = [];
    try {
      all = [...root.querySelectorAll(FIELD_SEL)];
    } catch (_) {
      all = [];
    }
    for (const el of all) {
      if (el.tagName === "INPUT") {
        const t = (el.type || "text").toLowerCase();
        if (IGNORE_INPUT_TYPES.has(t)) continue;
      }
      if (el.disabled) continue;
      const container = findContainer(el);
      if (!container) continue;
      if (container === document.body || container === document.documentElement) continue;
      if (!isVisible(container) && !isVisible(el)) continue;
      out.push({ el, container });
    }
    const merged = mergeChoiceGroups(out);
    try {
      const SEL = '[role="radio"],[class*="radio"],[class*="Radio"]';
      const leaves = [...root.querySelectorAll(SEL)].filter((el) => isVisible(el)).filter((el) => !el.querySelector(SEL));
      const used = /* @__PURE__ */ new Set();
      for (const leaf of leaves) {
        if (used.has(leaf)) continue;
        let n = leaf.parentElement;
        let depth = 0;
        while (n && n !== document.body && depth < 6) {
          const inside = leaves.filter((x) => n.contains(x));
          if (inside.length >= 2 && inside.length <= 8 && !n.querySelector("input,textarea,select") && labelTextsOf(n, leaf).length) {
            inside.forEach((x) => used.add(x));
            merged.push({ el: inside[0], container: n, forceKind: "RADIO_GROUP" });
            break;
          }
          n = n.parentElement;
          depth++;
        }
      }
    } catch (_) {
    }
    return merged;
  }
  function splitByRepeatedLabels(fields) {
    const labels = fields.map((f) => normalize(f.label || ""));
    const n = labels.length;
    if (n < 6) return null;
    if (labels.some((l) => !l)) return null;
    for (let p = n - 3; p >= 3; p--) {
      const k = Math.floor(n / p);
      const r = n - k * p;
      let num = 0;
      for (let i = 0; i < n; i++) if (labels[i] === labels[i % p]) num++;
      let den = n;
      if (r > 0 && k >= 2) {
        num = 0;
        for (let i = 0; i < k * p; i++) if (labels[i] === labels[i % p]) num++;
        den = k * p;
      }
      if (num / den < 0.8) continue;
      const chunks = [];
      for (let s = 0; s < k * p; s += p) chunks.push(fields.slice(s, s + p));
      if (r > 0) {
        if (k === 1) {
          chunks.push(fields.slice(k * p));
        } else if (r <= chunks.length * 2) {
          for (let j = 0; j < r; j++) chunks[j % chunks.length].push(fields[k * p + j]);
        } else {
          continue;
        }
      }
      if (chunks.length < 2) continue;
      const sizes = chunks.map((c) => c.length);
      const min = Math.min(...sizes);
      const max = Math.max(...sizes);
      if (min < 3 || min / max < 0.6) continue;
      return chunks;
    }
    return null;
  }
  function buildBlocks(sectionFields, sectionContainer, categoryId) {
    const byParent = /* @__PURE__ */ new Map();
    for (const f of sectionFields) {
      const p = f.container.parentElement;
      if (!p) continue;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p).push(f);
    }
    const sig = (arr) => [...new Set(arr.map((x) => normalize(x.label)).filter(Boolean))].sort().join("|");
    const buckets = /* @__PURE__ */ new Map();
    for (const [parent, arr] of byParent) {
      if (arr.length < 2) continue;
      const s = sig(arr);
      if (!s) continue;
      if (!buckets.has(s)) buckets.set(s, []);
      buckets.get(s).push({ parent, fields: arr });
    }
    let best = null;
    for (const [, members] of buckets) {
      if (members.length >= 2 && (!best || members.length > best.length)) best = members;
    }
    const sortByDom = (list) => list.slice().sort((a, b) => {
      try {
        return a.parent.compareDocumentPosition(b.parent) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      } catch (_) {
        return 0;
      }
    });
    if (!best) {
      const multi = categoryId ? categoryById2(categoryId).multiple : false;
      if (multi) {
        const flat = splitByRepeatedLabels(sectionFields);
        if (flat && flat.length >= 2) {
          return flat.map((fields, i) => ({
            index: i,
            container: fields[0].container && fields[0].container.parentElement || sectionContainer,
            fields: fields.slice()
          }));
        }
      }
      if (multi) {
        for (const [, arr] of byParent) {
          const parts = splitByRepeatedLabels(arr);
          if (parts && parts.length >= 2) {
            return parts.map((fields, i) => ({
              index: i,
              container: fields[0].container && fields[0].container.parentElement || sectionContainer,
              fields: fields.slice()
            }));
          }
        }
      }
      const cands = [...byParent.values()].filter((arr) => arr.length >= 3);
      if (multi && cands.length >= 2 && cands.length <= 8) {
        const ordered2 = sortByDom(cands.map((fields) => ({ parent: fields[0].container.parentElement, fields })));
        return ordered2.map((m, i) => ({ index: i, container: m.parent, fields: m.fields.slice() }));
      }
      return [{ index: 0, container: sectionContainer || document.body, fields: sectionFields }];
    }
    const ordered = sortByDom(best);
    const blocks = ordered.map((m, i) => ({ index: i, container: m.parent, fields: m.fields.slice() }));
    const included = new Set(blocks.flatMap((b) => b.fields));
    const orphans = sectionFields.filter((f) => !included.has(f));
    if (orphans.length && blocks.length) blocks[0].fields.push(...orphans);
    return blocks;
  }
  function pairLabelsByPosition(groups) {
    const map = /* @__PURE__ */ new Map();
    const byContainer = /* @__PURE__ */ new Map();
    for (const g of groups) {
      if (g.inputs && g.inputs.length > 1) continue;
      if (!byContainer.has(g.container)) byContainer.set(g.container, []);
      byContainer.get(g.container).push(g);
    }
    for (const [container, list] of byContainer) {
      if (list.length < 2 || list.length > 6) continue;
      const labels = labelNodesOf(container);
      const pickText = () => list.filter((g) => {
        const el = g.el;
        if (!el || el.tagName !== "INPUT") return false;
        const t = (el.type || "text").toLowerCase();
        return t !== "radio" && t !== "checkbox" && t !== "file";
      });
      if (labels.length === 1 && list.length >= 2) {
        const texts = pickText();
        const plain = texts.filter((g) => !isSelectInnerInput(g.el));
        const pool = plain.length ? plain : texts;
        if (pool.length === 1) {
          const winner = pool[0].el;
          list.forEach((g) => map.set(g.el, g.el === winner ? labels[0].text : ""));
          continue;
        }
      }
      if (labels.length !== list.length) continue;
      if (new Set(labels.map((x) => x.text)).size !== labels.length) continue;
      const okPos = labels.every((lb, i) => {
        try {
          const target = list[i].el;
          return !!(lb.node.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING);
        } catch (_) {
          return false;
        }
      });
      if (!okPos) continue;
      list.forEach((g, i) => map.set(g.el, labels[i].text));
    }
    return map;
  }
  var SELECT_INNER_RE = /(^|[\s_-])[a-z0-9-]*select([\s_-]|$)|select__|select--|select_input|cascader|dropdown/i;
  function isSelectInnerInput(el) {
    let n = el;
    for (let depth = 0; n && depth < 4; depth++) {
      const c = String(n.className && n.className.baseVal || n.className || "");
      if (c && SELECT_INNER_RE.test(c)) return true;
      n = n.parentElement;
    }
    return false;
  }
  function labelNodesOf(container) {
    const out = [];
    try {
      for (const n of container.querySelectorAll(LABEL_SEL)) {
        if (isOptionish(n)) continue;
        if (countFields(n) > 0) continue;
        if (!isVisible(n)) continue;
        const text = cleanLabel(shortText(n, 24));
        if (!looksLikeLabel(text)) continue;
        if (out.some((x) => x.node.contains(n) || n.contains(x.node))) continue;
        out.push({ node: n, text });
      }
    } catch (_) {
    }
    return out;
  }
  function buildFormModel(root = document.body) {
    countCache = /* @__PURE__ */ new Map();
    const raw = collectFields(root);
    const DATE_LABEL_RE = /时间|日期|年月|出生|生日|入职|毕业/;
    const groups = [];
    const consumed = /* @__PURE__ */ new Set();
    for (const r of raw) {
      if (consumed.has(r)) continue;
      const selects = raw.filter(
        (x) => x.container === r.container && x.el.tagName === "SELECT" && !consumed.has(x)
      );
      const looksDate = DATE_LABEL_RE.test(labelTextsOf(r.container, r.el).join(" "));
      if (selects.length >= 2 && selects.length <= 3 && looksDate) {
        selects.forEach((x) => consumed.add(x));
        groups.push({ el: r.el, inputs: selects.map((x) => x.el), container: r.container, forceKind: r.forceKind });
        continue;
      }
      consumed.add(r);
      groups.push({ el: r.el, inputs: [r.el], container: r.container, forceKind: r.forceKind });
    }
    const ownLabel = pairLabelsByPosition(groups);
    const fields = groups.map((g) => {
      const hasOwn = ownLabel.has(g.el);
      const own = ownLabel.get(g.el);
      const ownParts = hasOwn ? [own].filter(Boolean) : labelTextsOf(g.container, g.el);
      const parts = [
        .../* @__PURE__ */ new Set([
          ...ownParts,
          ...[g.el.getAttribute("placeholder"), g.el.getAttribute("aria-label"), g.el.getAttribute("name")].map((s) => cleanLabel(s)).filter(Boolean)
        ])
      ];
      const field = {
        el: g.el,
        inputs: g.inputs,
        container: g.container,
        labelParts: parts,
        label: pickLabel(parts),
        controlKind: g.forceKind || detectControlKind(g.el),
        section: null,
        blockIndex: 0
      };
      if (g.inputs.length > 1 && field.controlKind === "SELECT_NATIVE") field.controlKind = "DATE_TRIPLE_SELECT";
      if (!g.forceKind) {
        field.controlKind = refinePickerKind(field);
        field.controlKind = refineKindByComponent(field);
      }
      return field;
    });
    const sectionMap = /* @__PURE__ */ new Map();
    for (const f of fields) {
      const meta = sectionOf(f.container);
      f.section = meta;
      const key = meta.container || "__none__";
      if (!sectionMap.has(key)) {
        sectionMap.set(key, {
          title: meta.title,
          categoryId: meta.categoryId,
          container: meta.container,
          fields: []
        });
      }
      sectionMap.get(key).fields.push(f);
    }
    const sections = [];
    for (const s of sectionMap.values()) {
      const blocks = buildBlocks(s.fields, s.container, s.categoryId);
      blocks.forEach((b) => b.fields.forEach((f) => f.blockIndex = b.index));
      sections.push({ title: s.title, categoryId: s.categoryId, container: s.container, blocks });
    }
    return { sections, fieldCount: fields.length };
  }

  // src/resolver.js
  var OPTION_MIN_SCORE = 0.82;
  var OPTION_MIN_MARGIN = 0.05;
  var PLACEHOLDER_RE = /^(请选择|请选择一项|全部|不限|--+|—+|-+|无数据|暂无)$/;
  function resolveValue(raw, enumRef) {
    const text = String(raw ?? "").trim();
    if (!text) return null;
    const n = normalize(text);
    const dict = enumRef ? ENUMS[enumRef] : null;
    const labels = [text];
    let code = null;
    let confidence = 0.6;
    if (dict) {
      for (const [c, syns] of Object.entries(dict)) {
        if (syns.some((s) => normalize(s) === n)) {
          code = c;
          labels.push(...syns);
          confidence = 1;
          break;
        }
      }
      if (!code) {
        let best = null;
        for (const [c, syns] of Object.entries(dict)) {
          for (const s of syns) {
            const sn = normalize(s);
            if (!sn || [...sn].length < 2) continue;
            let sc = 0;
            if (n.includes(sn) || sn.includes(n)) {
              const ratio = Math.min(sn.length, n.length) / Math.max(sn.length, n.length);
              sc = 0.88 + 0.1 * ratio;
            } else {
              const d = charDice(n, sn);
              if (d >= 0.6) sc = d * 0.85;
            }
            if (sc > 0 && (!best || sc > best.sc)) best = { c, syns, sc };
          }
        }
        if (best && best.sc >= 0.8) {
          code = best.c;
          labels.push(...best.syns);
          confidence = best.sc;
        }
      }
    }
    return { code, labels: [...new Set(labels)], raw: text, confidence };
  }
  function matchOption(plan, options) {
    if (!plan) return { ok: false, reason: "no-value", ranked: [] };
    const labels = (plan.labels || []).map(normalize).filter(Boolean);
    const rawN = normalize(plan.raw || "");
    const pool = (options || []).filter((o) => {
      const t = normalize(o.label);
      return t && !PLACEHOLDER_RE.test(t);
    });
    if (!pool.length) return { ok: false, reason: "no-options", ranked: [] };
    const scored = pool.map((o) => {
      const ot = normalize(o.label);
      const ov = normalize(o.value == null ? "" : String(o.value));
      let score = 0;
      for (const lb of labels) {
        if (!lb) continue;
        let s = 0;
        if (ot === lb) s = 1;
        else if (ot.includes(lb) && lb.length >= 2) {
          s = 0.9 + 0.08 * (lb.length / Math.max(ot.length, lb.length));
        } else if (lb.includes(ot) && ot.length >= 2) {
          s = 0.88 + 0.08 * (ot.length / Math.max(ot.length, lb.length));
        } else {
          const d = charDice(ot, lb);
          if (d >= 0.62) s = d * 0.85;
        }
        if (s > score) score = s;
      }
      if (ov && ov === rawN) score = Math.max(score, 0.95);
      return { ...o, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const exacts = scored.filter((o) => {
      const ot = normalize(o.label);
      return labels.includes(ot) || rawN && ot === rawN;
    });
    if (exacts.length === 1) {
      return { ok: true, option: exacts[0], score: 1, ranked: scored.slice(0, 5) };
    }
    const top = scored[0];
    const second = scored[1];
    if (!top || top.score < OPTION_MIN_SCORE) {
      return { ok: false, reason: "option-no-match", ranked: scored.slice(0, 5) };
    }
    if (second && top.score - second.score < OPTION_MIN_MARGIN - 1e-6 && normalize(second.label) !== normalize(top.label)) {
      return { ok: false, reason: "option-ambiguous", ranked: scored.slice(0, 5) };
    }
    return { ok: true, option: top, score: top.score, ranked: scored.slice(0, 5) };
  }
  function sameOption(readback, optionLabel) {
    const a = normalize(readback);
    const b = normalize(optionLabel);
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
  }

  // src/binder.js
  var SLOT_MIN_SCORE = 0.78;
  var SLOT_MIN_MARGIN = 0.06;
  function scorePartAgainstField(part, field) {
    const p = normalize(part);
    if (!p) return 0;
    if (field.deny && field.deny.some((d) => normalize(d) === p)) return 0;
    if (field.denyRe && field.denyRe.test(p)) return 0;
    let best = 0;
    for (const alias of field.alias) {
      const an = normalize(alias);
      if (!an) continue;
      if (conflicts(p, an)) continue;
      const pLen = [...p].length;
      const aLen = [...an].length;
      let s = 0;
      if (p === an) {
        s = 1;
      } else if (p.includes(an) || an.includes(p)) {
        const min = Math.min(pLen, aLen);
        if (min >= 2) s = 0.9 + 0.08 * (min / Math.max(pLen, aLen));
      } else {
        const d = charDice(p, an);
        if (d >= 0.72) s = d * 0.85;
      }
      if (s) s *= lengthPenalty(part);
      if (s > best) best = s;
    }
    return best;
  }
  function matchSlot(parts, candidates) {
    const clean = [...new Set((parts || []).map((p) => String(p || "").trim()).filter(Boolean))];
    if (!clean.length || !candidates || !candidates.length) return null;
    const exactHits = [];
    for (let i = 0; i < clean.length; i++) {
      const p = normalize(clean[i]);
      if (!p) continue;
      for (const c of candidates) {
        const denied = c.field.deny && c.field.deny.some((d) => normalize(d) === p) || c.field.denyRe && c.field.denyRe.test(p);
        if (!denied && c.field.alias.some((a) => normalize(a) === p)) exactHits.push({ c, i });
      }
    }
    if (exactHits.length) {
      const firstIdx = exactHits[0].i;
      const same = exactHits.filter((h) => h.i === firstIdx);
      const slots = [...new Set(same.map((h) => h.c.field.slot))];
      if (slots.length === 1) return { ...same[0].c, score: 1 };
      return null;
    }
    const scored = [];
    for (const c of candidates) {
      let score = 0;
      for (const part of clean) {
        const s = scorePartAgainstField(part, c.field);
        if (s > score) score = s;
      }
      if (score > 0) scored.push({ ...c, score });
    }
    if (!scored.length) return null;
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];
    const second = scored[1];
    if (top.score < SLOT_MIN_SCORE) return null;
    if (second && top.score - second.score < SLOT_MIN_MARGIN - 1e-6 && second.field.slot !== top.field.slot) {
      return null;
    }
    return top;
  }
  function fieldsOf(section) {
    if (!section) return [];
    if (Array.isArray(section.fields)) return section.fields;
    if (!Array.isArray(section.blocks)) return [];
    return section.blocks.flatMap((b) => b && Array.isArray(b.fields) ? b.fields : []);
  }
  function inferCategory(section) {
    const tally = /* @__PURE__ */ new Map();
    for (const f of fieldsOf(section)) {
      if (!f || !Array.isArray(f.labelParts)) continue;
      for (const c of ALL_FIELDS) {
        const s = Math.max(...f.labelParts.map((p) => scorePartAgainstField(p, c.field)), 0);
        if (s >= 0.85) tally.set(c.category.id, (tally.get(c.category.id) || 0) + 1);
      }
    }
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return null;
    if (ranked[1] && ranked[1][1] >= ranked[0][1]) return null;
    return ranked[0][0];
  }
  function customEntries(record) {
    return record && Array.isArray(record.__custom) ? record.__custom : [];
  }
  function customFieldsOf(profile) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const push = (categoryId, name, value, slot) => {
      const key = normalize(name);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ categoryId, name, key, value: value == null ? "" : String(value), slot });
    };
    for (const c of CATEGORIES) {
      for (const rec of profile[c.id] || []) {
        for (const item of customEntries(rec)) {
          push(c.id, String(item && item.name || "").trim(), item && item.value, "");
        }
      }
    }
    for (const rec of profile.custom || []) {
      push("custom", String(rec && rec["字段名称"] || "").trim(), rec && rec["字段内容"], "");
    }
    return out.map((f) => ({
      ...f,
      slot: f.categoryId === "custom" ? `custom:global:${f.key}` : `custom:${f.categoryId}:${f.key}`
    }));
  }
  function customCandidates(profile, builtinNames) {
    const out = [];
    for (const f of customFieldsOf(profile)) {
      if (builtinNames.has(f.key)) continue;
      out.push({
        field: { label: f.name, slot: f.slot, kind: "text", alias: [f.name] },
        category: categoryById(f.categoryId) || { id: f.categoryId },
        custom: true,
        customName: f.name,
        customValue: f.value
      });
    }
    return out;
  }
  function readCurrent(field) {
    try {
      if (field.controlKind === "RADIO_GROUP") {
        const on = field.container.querySelector("input[type=radio]:checked");
        if (on) {
          const lab = on.closest("label") || on.parentElement;
          return String(lab && lab.innerText || on.value || "").trim();
        }
        return "";
      }
      const el = field.el;
      if (el.value != null && String(el.value).trim()) return String(el.value).trim();
      return String(el.innerText || el.textContent || "").trim();
    } catch (_) {
      return "";
    }
  }
  function alignBlocks(blocks, records, category, candidates) {
    const assign = /* @__PURE__ */ new Map();
    if (!records.length) return assign;
    if (blocks.length <= 1 || records.length <= 1) {
      blocks.forEach((b) => {
        if (b.index < records.length) assign.set(b.index, b.index);
      });
      return assign;
    }
    const strongSlots = STRONG_KEYS[category.id] || [];
    const blockValues = blocks.map((b) => {
      const map = /* @__PURE__ */ new Map();
      for (const f of b.fields) {
        const m = matchSlot(f.labelParts, candidates);
        if (!m) continue;
        if (map.has(m.field.slot)) continue;
        map.set(m.field.slot, readCurrent(f));
      }
      return map;
    });
    const pairs = [];
    for (let bi = 0; bi < blocks.length; bi++) {
      for (let ri = 0; ri < records.length; ri++) {
        const record = records[ri] || {};
        let total = 0;
        let count = 0;
        for (const slot of strongSlots) {
          const meta = candidates.find((c) => c.field.slot === slot);
          if (!meta) continue;
          const pv = normalize(blockValues[bi].get(slot) || "");
          const rv = normalize(record[meta.field.label] || "");
          if (!pv || !rv) continue;
          let s;
          if (pv === rv) s = 1;
          else if (pv.includes(rv) || rv.includes(pv)) s = 0.85;
          else s = charDice(pv, rv);
          total += s;
          count++;
        }
        pairs.push({ bi, ri, score: count ? total / count : 0 });
      }
    }
    pairs.sort((a, b) => b.score - a.score);
    const usedB = /* @__PURE__ */ new Set();
    const usedR = /* @__PURE__ */ new Set();
    for (const p of pairs) {
      if (p.score < 0.5) continue;
      if (usedB.has(p.bi) || usedR.has(p.ri)) continue;
      assign.set(p.bi, p.ri);
      usedB.add(p.bi);
      usedR.add(p.ri);
    }
    for (const b of blocks) {
      if (assign.has(b.index)) continue;
      const ri = records.findIndex((_, i) => !usedR.has(i));
      if (ri < 0) break;
      assign.set(b.index, ri);
      usedR.add(ri);
    }
    return assign;
  }
  var DATE_WORD_RE = /(时间|日期|年月|生日|出生|入学|毕业|入职|离职|到岗|起止)/;
  function looksLikeDateValue(v) {
    const s = String(v ?? "").trim();
    return /^\d{4}\s*[-/.年]/.test(s) || /^\d{4}$/.test(s);
  }
  function promoteToDate(plan) {
    if (!plan || plan.kind === "date") return plan;
    const name = String(plan.label || "") + " " + String(plan.field && plan.field.label || "");
    if (!DATE_WORD_RE.test(name)) return plan;
    if (!looksLikeDateValue(plan.value)) return plan;
    return { ...plan, kind: "date", precision: "day", enumRef: null };
  }
  function recordValue(record, meta) {
    if (!record || !meta) return "";
    const direct = record[meta.label];
    if (String(direct ?? "").trim()) return direct;
    for (const a of meta.alias || []) {
      const v = record[a];
      if (String(v ?? "").trim()) return v;
    }
    const names = new Set([meta.label, ...meta.alias || []].map(normalize).filter(Boolean));
    for (const it of Array.isArray(record.__custom) ? record.__custom : []) {
      if (!it) continue;
      if (!names.has(normalize(String(it.name || "").trim()))) continue;
      if (String(it.value ?? "").trim()) return it.value;
    }
    return direct == null ? "" : direct;
  }
  function ownCustomValue(record, name) {
    const key = normalize(String(name || "").trim());
    if (!key) return void 0;
    for (const it of Array.isArray(record.__custom) ? record.__custom : []) {
      if (it && normalize(String(it.name || "").trim()) === key) {
        return String(it.value == null ? "" : it.value);
      }
    }
    return void 0;
  }
  var DEGREE_RANK = { HIGH_SCHOOL: 1, VOCATIONAL: 1, ASSOCIATE: 2, BACHELOR: 3, MASTER: 4, DOCTOR: 5 };
  function highestDegreeIndex(records) {
    let best = -1;
    let bestRank = 0;
    records.forEach((r, i) => {
      const res = r ? resolveValue(r["学历"], "degreeLevel") : null;
      const rank = res && DEGREE_RANK[res.code] || 0;
      if (rank > bestRank) {
        bestRank = rank;
        best = i;
      }
    });
    return best;
  }
  function bind(model, profile) {
    const plans = [];
    const sections = (model && Array.isArray(model.sections) ? model.sections : []).filter(
      (s) => s && Array.isArray(s.blocks)
    );
    const builtinNames = new Set(ALL_FIELDS.flatMap((c) => c.field.alias.map((a) => normalize(a))));
    const customs = customCandidates(profile, builtinNames);
    for (const section of sections) {
      const categoryId = section.categoryId || inferCategory(section);
      const category = categoryId ? categoryById(categoryId) : null;
      const records = category ? profile[category.id] || [] : [];
      const builtinCandidates = category ? category.fields.map((f) => ({ field: f, category })) : ALL_FIELDS;
      const candidates = [...builtinCandidates, ...customs];
      const assign = alignBlocks(section.blocks, records, category || { id: "" }, candidates);
      for (const block of section.blocks) {
        let ri = assign.has(block.index) ? assign.get(block.index) : null;
        if (category && category.id === "education" && records.length > 1 && section.blocks.length === 1) {
          const asksHighest = (block.fields || []).some((f) => /最高学历/.test((f.labelParts || []).join(" ")));
          if (asksHighest) {
            const hi = highestDegreeIndex(records);
            if (hi >= 0) ri = hi;
          }
        }
        const record = ri != null ? records[ri] || {} : null;
        const seen = /* @__PURE__ */ new Set();
        for (const field of block.fields || []) {
          let m = matchSlot(field.labelParts, candidates);
          if (!m && category) m = matchSlot(field.labelParts, ALL_FIELDS);
          const meta = m ? m.field : null;
          const owner = meta ? m.category : category;
          const dedupeKey = meta && owner ? `${owner.id}:${meta.slot}` : null;
          if (dedupeKey) {
            if (seen.has(dedupeKey)) {
              plans.push({
                field,
                sectionTitle: section.title || "",
                categoryId: owner.id,
                blockIndex: block.index,
                recordIndex: ri,
                slot: meta.slot,
                label: meta.label,
                kind: meta.kind,
                precision: meta.precision || null,
                enumRef: meta.enumRef || null,
                value: "",
                matchScore: m ? m.score : 0,
                hasRecord: !!record,
                dup: true,
                dupOfSlot: meta.slot
              });
              continue;
            }
            seen.add(dedupeKey);
          }
          let rawValue = "";
          let hasRecord = false;
          if (meta && owner) {
            if (m.custom) {
              if (owner === category && record) {
                const own = ownCustomValue(record, m.customName);
                rawValue = own === void 0 ? m.customValue : own;
              } else {
                rawValue = m.customValue;
              }
              hasRecord = true;
            } else if (owner === category && record) {
              rawValue = recordValue(record, meta);
              hasRecord = true;
            } else {
              const recs = profile[owner.id] || [];
              const hit = recs.find((r) => r && String(recordValue(r, meta) ?? "").trim()) || recs[0] || null;
              rawValue = hit ? recordValue(hit, meta) : "";
              hasRecord = !!hit;
            }
          }
          const weak = !(category && owner && category.id === owner.id);
          plans.push(
            promoteToDate({
              field,
              sectionTitle: section.title || "",
              categoryId: owner ? owner.id : categoryId || "",
              blockIndex: block.index,
              recordIndex: ri,
              slot: meta ? meta.slot : null,
              label: meta ? meta.label : field.label,
              kind: meta ? meta.kind : null,
              precision: meta ? meta.precision : null,
              enumRef: meta ? meta.enumRef : null,
              value: rawValue == null ? "" : rawValue,
              matchScore: m ? m.score : 0,
              hasRecord,
              ...weak ? { weak: true } : {},
              // 卡片式录入要回到"这张卡"点确认（见 cards.js），留引用，不进报告
              section,
              block
            })
          );
        }
      }
    }
    return plans;
  }

  // src/repeat.js
  var MAX_ADD = 20;
  var ADD_RE = /(添加|新增|增加|再加|继续添加|\badd\b)/i;
  var NOISE_RE = /(附件|照片|上传|文件|证件|简历|图片|证书)/;
  var GENERIC_ADD_RE = /^[＋+⊕]?\s*(添加|新增|增加)(一条|一项|一个|记录|经历|条目)?$/;
  var ICON_ADD_RE = /^[＋+⊕]$|^\+$/;
  var ICON_NAME_RE = /add|plus|new/i;
  var textOf = (el) => String(el && el.textContent || "").replace(/\s+/g, " ").trim();
  var attrOf = (el) => [
    el.getAttribute("title"),
    el.getAttribute("aria-label"),
    el.getAttribute("data-title"),
    el.getAttribute("placeholder")
  ].filter(Boolean).join(" ");
  function usableRecords(profile, category) {
    const records = profile[category.id] || [];
    return records.filter((r) => {
      if (!r || typeof r !== "object") return false;
      return Object.entries(r).some(([k, v]) => k !== "__custom" && v != null && String(v).trim());
    });
  }
  function candidatesIn(area) {
    const out = [];
    if (!area || !area.querySelectorAll) return out;
    for (const el of area.querySelectorAll('button,[role="button"],a,span,div,i,svg')) {
      if (!isVisible(el)) continue;
      if (el.disabled) continue;
      if (el.children.length > 2) continue;
      if (el.querySelector && el.querySelector('button,[role="button"]')) continue;
      const t = textOf(el);
      const attr = attrOf(el);
      const cls = String((el.className && el.className.baseVal != null ? el.className.baseVal : el.className) || "");
      if (t && t.length <= 20 && ADD_RE.test(t) && !NOISE_RE.test(t)) {
        out.push({ el, text: t, kind: "text" });
        continue;
      }
      if (ICON_ADD_RE.test(t) || ICON_NAME_RE.test(cls) && (ADD_RE.test(attr) || !t)) {
        if (t.length <= 20 && !NOISE_RE.test(t + attr)) {
          out.push({ el, text: (t || attr || "＋").slice(0, 20), kind: "icon" });
        }
      }
    }
    return out;
  }
  function findAddButton(section, category) {
    const names = [category.name, ...category.sectionKeys || []].filter(Boolean);
    const named = (list) => {
      const hits = list.filter((x) => names.some((n) => x.text.includes(n)));
      if (!hits.length) return void 0;
      const minLen = Math.min(...hits.map((x) => x.text.length));
      const shortest = hits.filter((x) => x.text.length === minLen);
      return shortest[shortest.length - 1];
    };
    const areas = [section.container, section.container && section.container.parentElement].filter(Boolean);
    for (const area of areas) {
      const hit = named(candidatesIn(area));
      if (hit) return hit;
    }
    const blocks = section.blocks || [];
    const lastBlock = blocks.length ? blocks[blocks.length - 1] : null;
    let last = lastBlock && lastBlock.container && lastBlock.container !== section.container ? lastBlock.container : null;
    if (!last && lastBlock && lastBlock.fields && lastBlock.fields.length) {
      last = lastBlock.fields[lastBlock.fields.length - 1].container || null;
    }
    for (const area of areas) {
      const generic = candidatesIn(area).find((x) => {
        if (!GENERIC_ADD_RE.test(x.text) && x.kind !== "icon") return false;
        if (last && last.contains && last.contains(x.el)) return false;
        if (last && !(last.compareDocumentPosition(x.el) & 4)) return false;
        return true;
      });
      if (generic) return generic;
    }
    try {
      const hit = named(candidatesIn(document.body));
      if (hit) return hit;
    } catch (_) {
    }
    return null;
  }
  function hasLocalAdd(section) {
    const category = section && section.categoryId ? categoryById(section.categoryId) : null;
    if (!category || !section.container) return false;
    const names = [category.name, ...category.sectionKeys || []].filter(Boolean);
    const areas = [section.container, section.container.parentElement].filter(Boolean);
    return areas.some((a) => candidatesIn(a).some((x) => x.kind === "text" && names.some((n) => x.text.includes(n))));
  }
  async function dismissDialogIfAny() {
    const dialogs = [...document.querySelectorAll('[role="dialog"],[class*="modal"],[class*="Modal"],[class*="dialog"]')].filter(
      isVisible
    );
    if (!dialogs.length) return false;
    for (const d of dialogs) {
      const close = [...d.querySelectorAll('button,[role="button"],[class*="close"]')].find(
        (b) => isVisible(b) && /^(取消|关闭|cancel|close|×|✕)$/i.test(textOf(b).slice(0, 4))
      );
      if (close) {
        clickEl(close);
        await sleep(150);
        return true;
      }
    }
    try {
      fire(document.body, "keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true });
    } catch (_) {
    }
    await sleep(150);
    return true;
  }
  function pickTarget(model, profile, skip) {
    const rep = /* @__PURE__ */ new Map();
    for (const s of model.sections || []) {
      if (!s.categoryId) continue;
      const cur = rep.get(s.categoryId);
      const n = (s.blocks || []).length;
      const m = cur ? (cur.blocks || []).length : -1;
      if (!cur || n > m || n === m && !hasLocalAdd(cur) && hasLocalAdd(s)) rep.set(s.categoryId, s);
    }
    for (const section of model.sections || []) {
      const category = section.categoryId ? categoryById(section.categoryId) : null;
      if (!category || !category.multiple || category.custom) continue;
      if (rep.get(category.id) !== section) continue;
      if (skip && skip.has(category.id)) continue;
      const records = usableRecords(profile, category);
      const have = (section.blocks || []).length;
      if (records.length <= have) continue;
      const btn = findAddButton(section, category);
      if (!btn) continue;
      return { section, category, btn, need: records.length - have, have };
    }
    const present = new Set((model.sections || []).map((s) => s.categoryId).filter(Boolean));
    for (const category of CATEGORIES) {
      if (!category.multiple || category.custom || present.has(category.id)) continue;
      if (skip && skip.has(category.id)) continue;
      const records = usableRecords(profile, category);
      if (!records.length) continue;
      const btn = findAddButton({ container: null, blocks: [] }, category);
      if (!btn || btn.kind !== "text") continue;
      return { section: { title: category.name, categoryId: category.id, blocks: [] }, category, btn, need: records.length, have: 0 };
    }
    return null;
  }
  function relookup(next, section, category) {
    const list = (next.sections || []).filter(
      (s) => s.categoryId === category.id || section.title && s.title === section.title
    );
    let best = null;
    for (const s of list) if (!best || (s.blocks || []).length > (best.blocks || []).length) best = s;
    return best;
  }
  function fieldCountOf(section) {
    return (section && section.blocks || []).reduce((n, b) => n + (b.fields && b.fields.length || 0), 0);
  }
  async function expandSections(profile, model, options = {}) {
    const limit = Math.max(0, Math.min(options.maxAdd == null ? MAX_ADD : options.maxAdd, MAX_ADD));
    const log = [];
    let cur = model;
    let added = 0;
    const clicked = /* @__PURE__ */ new Map();
    const stuck = /* @__PURE__ */ new Set();
    for (let round = 0; round < limit; round++) {
      const target = pickTarget(cur, profile, stuck);
      if (!target) break;
      const { section, category, btn, need, have } = target;
      const done = clicked.get(category.id) || 0;
      if (done >= need) {
        stuck.add(category.id);
        continue;
      }
      const fieldsBefore = fieldCountOf(section);
      clickEl(btn.el);
      await sleep(480);
      clicked.set(category.id, done + 1);
      let next = null;
      try {
        next = buildFormModel();
      } catch (_) {
        next = null;
      }
      const after = next ? relookup(next, section, category) : null;
      const blocksAfter = after ? (after.blocks || []).length : 0;
      const fieldsAfter = fieldCountOf(after);
      const grew = blocksAfter > have || fieldsAfter > fieldsBefore;
      if (!after || !grew) {
        const cleaned = await dismissDialogIfAny();
        log.push(`${category.name}：「${btn.text}」点了没多出区块${cleaned ? "（已关掉弹出的对话框）" : ""}`);
        stuck.add(category.id);
        continue;
      }
      log.push(
        blocksAfter > have ? `${category.name}：${have} → ${blocksAfter} 块（还差 ${need} 段）` : `${category.name}：块数没变，但字段 ${fieldsBefore} → ${fieldsAfter} 个（站点把新记录塞进了同一块）`
      );
      cur = next;
      added++;
    }
    return { model: cur, added, log };
  }

  // src/adapters/text.js
  var isNumeric = (s) => /^-?\d+(\.\d+)?$/.test(String(s ?? "").trim());
  var trimZeros = (s) => String(s ?? "").trim().replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  function paddedZeros(got, want) {
    const a = String(got ?? "").trim();
    const b = String(want ?? "").trim();
    if (!a || !b || a === b) return false;
    if (!isNumeric(a) || !isNumeric(b)) return false;
    return trimZeros(a) === trimZeros(b) && Number(a) === Number(b);
  }
  async function writeText(plan) {
    const { field } = plan;
    const el = field.el;
    if (!el) return { status: "failed", reason: "no-el" };
    let value = String(plan.value ?? "");
    if (plan.kind === "number") value = numericOf(value) || value;
    if (!value.trim()) return { status: "skipped", reason: "empty-value" };
    if (field.controlKind === "RICH_TEXT") {
      el.focus();
      el.textContent = value;
      fire(el, "input", { bubbles: true });
      fire(el, "change", { bubbles: true });
      await sleep(60);
      const rb2 = String(el.textContent || "").trim();
      return rb2 === value ? { status: "filled", via: "richtext", readback: rb2 } : { status: "failed", reason: "readback-mismatch", readback: rb2 };
    }
    try {
      el.focus();
    } catch (_) {
    }
    setNativeValue(el, value);
    fire(el, "input", { bubbles: true });
    await sleep(40);
    let rb = String(el.value ?? "").trim();
    if (normalize(rb) !== normalize(value)) {
      fire(el, "change", { bubbles: true });
      await sleep(30);
      rb = String(el.value ?? "").trim();
    }
    let note;
    if (paddedZeros(rb, value)) {
      setNativeValue(el, value);
      fire(el, "input", { bubbles: true });
      await sleep(40);
      rb = String(el.value ?? "").trim();
      if (paddedZeros(rb, value)) note = "site-padded";
    }
    let ok = normalize(rb) === normalize(value) || rb && normalize(rb).includes(normalize(value));
    if (!ok) {
      fire(el, "blur", { bubbles: false });
      await sleep(120);
      rb = String(el.value ?? "").trim();
      if (paddedZeros(rb, value)) note = "site-padded";
      ok = normalize(rb) === normalize(value) || rb && normalize(rb).includes(normalize(value));
    }
    return ok ? { status: "filled", via: "native", readback: rb, ...note ? { note } : {} } : { status: "failed", reason: "readback-mismatch", readback: rb, expected: value };
  }

  // src/adapters/radio.js
  function optionLabelOf(input, root) {
    const lab = input.closest("label") || input.id && root.querySelector(`label[for="${cssEsc(input.id)}"]`) || input.parentElement;
    return shortText(lab, 40);
  }
  function collectRadioOptions(field) {
    const root = field.container || field.el.parentElement;
    if (!root) return [];
    const natives = [...root.querySelectorAll('input[type="radio"]')];
    if (natives.length) {
      return natives.map((input) => ({ label: optionLabelOf(input, root), value: input.value, el: input, native: true })).filter((o) => o.label);
    }
    const SEL = '[role="radio"],[class*="radio"],[class*="Radio"]';
    let fakes = [...root.querySelectorAll(SEL)].filter(isVisible).filter((el) => !el.querySelector(SEL));
    if (!fakes.length) fakes = [...root.querySelectorAll('[role="radio"]')].filter(isVisible);
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const el of fakes) {
      const label = shortText(el, 20).replace(/\s+/g, "");
      if (!label || label.length > 10) continue;
      if (seen.has(label)) continue;
      seen.add(label);
      out.push({ label, value: null, el, native: false });
    }
    return out;
  }
  async function writeRadio(plan) {
    const field = plan.field;
    const options = collectRadioOptions(field);
    if (!options.length) return { status: "skipped", reason: "no-radio-options" };
    const m = matchOption(plan.resolved, options);
    if (!m.ok) {
      return {
        status: "skipped",
        reason: m.reason,
        available: options.map((o) => o.label).slice(0, 20)
      };
    }
    clickEl(m.option.el);
    await sleep(90);
    const root = field.container || field.el.parentElement;
    let checked = root.querySelector('input[type="radio"]:checked');
    if (!checked && m.option.native && typeof m.option.el.click === "function") {
      m.option.el.click();
      await sleep(70);
      checked = root.querySelector('input[type="radio"]:checked');
    }
    let readback = "";
    if (checked) readback = optionLabelOf(checked, root);
    if (!readback) {
      const fake = [...root.querySelectorAll('[role="radio"][aria-checked="true"], [class*="is-checked"], [class*="checked"]')].find(
        (el) => shortText(el, 40)
      );
      if (fake) readback = shortText(fake, 40);
    }
    if (!readback) return { status: "filled", via: "click", readback: "", lowConfidence: true };
    return sameOption(readback, m.option.label) ? { status: "filled", via: "click", readback } : { status: "failed", reason: "readback-mismatch", readback, expected: m.option.label };
  }

  // src/adapters/select.js
  function panelHints() {
    try {
      const SEL = '[class*="dropdown"],[class*="panel"],[class*="menu"],[class*="popup"],[class*="layer"],[class*="overlay"],[role="listbox"],[class*="portal"]';
      return [...new Set([...document.querySelectorAll(SEL)].filter(isVisible).map((el) => tagOf(el)))].slice(0, 8);
    } catch (_) {
      return [];
    }
  }
  var PANEL_SEL = [
    '[role="listbox"]',
    '[class*="dropdown"]',
    '[class*="DropDown"]',
    '[class*="popover"]',
    '[class*="Popover"]',
    '[class*="popper"]',
    '[class*="select-menu"]',
    '[class*="option-list"]',
    '[class*="options"]',
    '[class*="panel"]',
    '[class*="Panel"]',
    '[class*="menu"]',
    '[class*="Menu"]',
    // 北森 Phoenix 的浮层 portal 容器（真机里籍贯/民族的下拉都挂在这上面）。
    // 只认根节点：`phoenix-unmodeled-layer__inner/__protect/__content` 都是它的内层。
    '[class*="unmodeled-layer"]:not([class*="__"])',
    '[class*="unmodeled"]:not([class*="__"])'
  ].join(",");
  var OPTION_SEL2 = '[role="option"],li,[class*="option"],[class*="Option"]';
  function collectOptionLeaves(trigger) {
    let all = [];
    try {
      all = [...document.querySelectorAll(OPTION_SEL2)];
    } catch (_) {
      return [];
    }
    return all.filter((el) => {
      if (!isVisible(el)) return false;
      if (trigger && (trigger.contains(el) || el.contains(trigger))) return false;
      if (el.querySelector(OPTION_SEL2)) return false;
      const t = shortText(el, 40);
      return !!t && [...t].length <= 40;
    });
  }
  function collectTextLeaves(trigger) {
    let all = [];
    try {
      all = [...document.querySelectorAll("div,span,li,a,p,dd,dt")];
    } catch (_) {
      return [];
    }
    const out = [];
    for (const el of all) {
      if (el.children.length) continue;
      const t = String(el.textContent || "").trim();
      if (!t || [...t].length > 40) continue;
      if (trigger && (trigger.contains(el) || el.contains(trigger))) continue;
      if (!isVisible(el)) continue;
      out.push(el);
    }
    return out;
  }
  function snapshotCandidates(trigger) {
    const cheap = collectOptionLeaves(trigger);
    if (cheap.length >= 3) return { set: new Set(cheap), broad: false, trigger };
    return { set: new Set(collectTextLeaves(trigger)), broad: true, trigger };
  }
  function panelAround(leaves) {
    const tally = /* @__PURE__ */ new Map();
    for (const leaf of leaves) {
      let n = leaf.parentElement;
      let d = 0;
      while (n && n !== document.body && d < 5) {
        const c = leaves.filter((x) => n.contains(x)).length;
        if (c >= 2) {
          tally.set(n, Math.max(tally.get(n) || 0, c));
          break;
        }
        n = n.parentElement;
        d++;
      }
    }
    let best = null;
    let bestN = 0;
    for (const [n, c] of tally) {
      if (c > bestN) {
        best = n;
        bestN = c;
      }
    }
    return best;
  }
  function collectNativeOptions(sel) {
    return [...sel.options].map((o) => ({
      label: String(o.textContent || "").trim(),
      value: o.value,
      el: o
    }));
  }
  async function writeSelectNative(plan) {
    const sel = plan.field.el;
    if (!sel || sel.tagName !== "SELECT") return { status: "failed", reason: "not-select" };
    const options = collectNativeOptions(sel);
    const m = matchOption(plan.resolved, options);
    if (!m.ok) {
      return { status: "skipped", reason: m.reason, available: options.map((o) => o.label).slice(0, 20) };
    }
    setNativeValue(sel, m.option.value);
    fire(sel, "input", { bubbles: true });
    fire(sel, "change", { bubbles: true });
    await sleep(60);
    const rb = String(sel.selectedOptions[0] && sel.selectedOptions[0].textContent || "").trim();
    if (!rb) return { status: "filled", via: "native-select", readback: "", lowConfidence: true };
    return sameOption(rb, m.option.label) ? { status: "filled", via: "native-select", readback: rb } : { status: "failed", reason: "readback-mismatch", readback: rb, expected: m.option.label };
  }
  function looksLikeCalendar(el) {
    if (!el) return false;
    const cls = String(el.className || "");
    if (/calendar|date-?picker|datepicker|time-?picker/i.test(cls)) return true;
    try {
      if (el.querySelector('.phoenix-calendar, [class*="calendar-panel"], [class*="calendar__"], [class*="calendar-date"]')) {
        return true;
      }
    } catch (_) {
    }
    return false;
  }
  function panelFingerprints() {
    const map = /* @__PURE__ */ new Map();
    try {
      [...document.querySelectorAll(PANEL_SEL)].forEach((el) => {
        try {
          map.set(el, String(el.textContent || "").replace(/\s+/g, ""));
        } catch (_) {
        }
      });
    } catch (_) {
    }
    return map;
  }
  function panelChanged(el, before) {
    if (!before) return true;
    let nowText = "";
    try {
      nowText = String(el.textContent || "").replace(/\s+/g, "");
    } catch (_) {
      return true;
    }
    const was = before.get(el);
    if (was === void 0) return true;
    return was !== nowText;
  }
  function findPanelBySelector(trigger, before) {
    const cands = [...document.querySelectorAll(PANEL_SEL)].filter((el) => {
      if (!isVisible(el)) return false;
      if (el.contains(trigger)) return false;
      if (looksLikeCalendar(el)) return false;
      if (!panelChanged(el, before)) return false;
      return true;
    });
    let best = null;
    let bestN = 0;
    for (const el of cands) {
      const t = String(el.innerText || el.textContent || "").trim();
      if (!t || t.length > 6e3) continue;
      const n = collectPanelOptions(el).length;
      if (n < 1) continue;
      if (n > bestN) {
        best = el;
        bestN = n;
      }
    }
    return best;
  }
  function scrollerCandidates(root) {
    const out = [];
    const push = (el) => {
      if (!el || !isVisible(el)) return;
      if (Number(el.scrollHeight || 0) > Number(el.clientHeight || 0) + 16) out.push(el);
    };
    push(root);
    try {
      [...root.querySelectorAll("*")].forEach(push);
    } catch (_) {
    }
    return out.slice(0, 3);
  }
  function ariaPanelOf(trigger) {
    const hosts = [trigger];
    try {
      const box = trigger.closest && trigger.closest('[role="combobox"],[aria-haspopup]');
      if (box && box !== trigger) hosts.push(box);
      const inner = trigger.querySelector && trigger.querySelector('[role="combobox"],[aria-controls],[aria-owns]');
      if (inner) hosts.push(inner);
    } catch (_) {
    }
    for (const h of hosts) {
      for (const attr of ["aria-controls", "aria-owns"]) {
        const ids = String(h.getAttribute && h.getAttribute(attr) || "").split(/\s+/).filter(Boolean);
        for (const id of ids) {
          const el = document.getElementById(id);
          if (!el || !isVisible(el) || el.contains(trigger)) continue;
          if (collectPanelOptions(el).length < 1) continue;
          return el;
        }
      }
    }
    return null;
  }
  function findOptionPanel(trigger, snap, before) {
    const byAria = ariaPanelOf(trigger);
    if (byAria) return popupRootOf(growToOptions(byAria), trigger);
    const bySel = findPanelBySelector(trigger, before);
    if (bySel) return popupRootOf(growToOptions(bySel), trigger);
    if (!snap) return null;
    const now = snap.broad ? collectTextLeaves(trigger) : collectOptionLeaves(trigger);
    const fresh = now.filter((el) => !snap.set.has(el));
    if (fresh.length < 2) return null;
    const panel = panelAround(fresh);
    if (!panel || looksLikeCalendar(panel)) return null;
    return popupRootOf(growToOptions(panel), trigger);
  }
  function popupRootOf(panel, trigger) {
    let n = panel;
    for (let i = 0; i < 5; i++) {
      let hasInput = false;
      try {
        hasInput = [...n.querySelectorAll("input")].some((x) => x !== trigger && !x.readOnly && !x.disabled);
      } catch (_) {
      }
      if (hasInput) return n;
      const p = n.parentElement;
      if (!p || p === document.body || p === document.documentElement) return panel;
      if (looksLikeCalendar(p)) return panel;
      if (trigger && p.contains(trigger)) return panel;
      n = p;
    }
    return panel;
  }
  var ITEM_SEL = ".list-item-container, .area-item-container, .area-item-name";
  var ITEM_LABEL_SEL = '[class*="item-text-label"], [class*="area-text-label"]';
  var PANE_ROOT_SEL = [".constant-main-selector-container", ".area-selector-container"];
  var PANE_CHIP_SEL = '[class*="select-text-label"], [class*="select-area-text-label"]';
  var ITEM_ICON_RE = /(?:^|\s)(?:area-icon-)?(?:Radio|Checkbox)(?:Checked|Unchecked)(?:-disabled)?(?:\s|$)/;
  function classOf(el) {
    if (!el || typeof el.getAttribute !== "function") return "";
    return String(el.getAttribute("class") || "");
  }
  function listItemOf(el) {
    let n = el;
    for (let i = 0; i < 4 && n && n.nodeType === 1; i++) {
      try {
        if (n.matches && n.matches(ITEM_SEL)) return n;
        const hit = n.closest && n.closest(ITEM_SEL);
        if (hit) return hit;
      } catch (_) {
      }
      n = n.parentElement;
    }
    return null;
  }
  function listIconOf(item) {
    if (!item) return null;
    let list = [];
    try {
      list = [...item.querySelectorAll("svg,span,i")];
    } catch (_) {
      return null;
    }
    return list.find((x) => ITEM_ICON_RE.test(classOf(x))) || null;
  }
  function itemKeyOf(item) {
    if (!item) return "";
    let node = null;
    try {
      node = item.querySelector(ITEM_LABEL_SEL);
    } catch (_) {
    }
    return normalize(shortText(node || item, 40));
  }
  function iconChecked(svg) {
    const c = classOf(svg);
    return ITEM_ICON_RE.test(c) && /Checked/.test(c) && !/-disabled/.test(c);
  }
  function iconUsable(svg) {
    const c = classOf(svg);
    if (!ITEM_ICON_RE.test(c)) return false;
    if (/-disabled/.test(c)) return false;
    try {
      const box = svg.closest && svg.closest(".icon-container");
      if (box && /(?:^|\s)hidden(?:\s|$)/.test(classOf(box))) return false;
    } catch (_) {
    }
    return true;
  }
  function livePopupRoot() {
    for (const sel of PANE_ROOT_SEL) {
      let list = [];
      try {
        list = [...document.querySelectorAll(sel)].filter((el) => isVisible(el));
      } catch (_) {
        continue;
      }
      if (list.length) return list[list.length - 1];
    }
    return null;
  }
  function pickedLabels() {
    const root = livePopupRoot();
    if (!root) return null;
    let pane = null;
    try {
      pane = root.querySelector('[class*="select-data-container"]');
    } catch (_) {
    }
    if (!pane) return null;
    let labels = [];
    try {
      labels = [...pane.querySelectorAll(PANE_CHIP_SEL)].map((el) => normalize(shortText(el, 40))).filter(Boolean);
    } catch (_) {
    }
    return labels;
  }
  function relocateListIcon(key) {
    let items = [];
    try {
      items = [...document.querySelectorAll(ITEM_SEL)];
    } catch (_) {
      return null;
    }
    for (const it of items) {
      if (itemKeyOf(it) !== key) continue;
      const svg = listIconOf(it);
      if (svg && iconUsable(svg)) return svg;
    }
    return null;
  }
  async function selectListItem(el) {
    const item = listItemOf(el);
    if (!item) return null;
    const svg = listIconOf(item);
    if (!svg) return null;
    if (!iconUsable(svg)) return { ok: false, via: "icon-disabled" };
    const key = itemKeyOf(item);
    const isOn = () => {
      const pane = pickedLabels();
      if (pane) return pane.includes(key);
      return iconChecked(relocateListIcon(key) || svg);
    };
    if (isOn()) return { ok: true, via: "icon-already" };
    clickEl(svg);
    await sleep(220);
    if (isOn()) return { ok: true, via: "icon" };
    const again = relocateListIcon(key);
    if (again && again !== svg && !iconChecked(again)) {
      clickEl(again);
      await sleep(220);
      if (isOn()) return { ok: true, via: "icon-retry" };
    }
    return { ok: false, via: "icon-nochange" };
  }
  async function activateOption(el) {
    const hit = await selectListItem(el);
    if (hit) return hit;
    clickOption(el);
    return null;
  }
  function clickOption(el) {
    const ok = clickEl(el);
    try {
      let n = el;
      for (let i = 0; i < 3 && n; i++) {
        const ctls = [...n.querySelectorAll('input[type="radio"],input[type="checkbox"]')];
        if (ctls.length === 1) {
          const ctl = ctls[0];
          if (ctl !== el && !ctl.disabled && !ctl.checked) clickEl(ctl);
          break;
        }
        if (ctls.length > 1) break;
        n = n.parentElement;
      }
    } catch (_) {
    }
    return ok;
  }
  function growToOptions(panel) {
    if (!panel) return panel;
    let n = panel;
    let last = panel;
    for (let i = 0; i < 4; i++) {
      if (collectPanelOptions(n).length >= 1) return n;
      n = n.parentElement;
      if (!n || n === document.body || n === document.documentElement) return last;
      if (looksLikeCalendar(n)) return last;
      last = n;
    }
    return last;
  }
  var JUNK_RE = /^(已选.*|搜索结果.*|共\s*\d+\s*[个条项]?|清空已选|清除|清空|请选择.*|请[在输].*|在选择框中选择.*|确定|取消|搜索|全选|重置|暂无.*|无数据|没有.*|这里什么都没有.*|全部|[\d/]+|\d+|\d+\/\d+)$/;
  function insideSelectedPane(el) {
    let n = el.parentElement;
    for (let i = 0; i < 3 && n; i++) {
      const t = String(n.textContent || "").replace(/\s+/g, "");
      if (t.length < 60 && /^已选\s*\d+\s*\/\s*\d+/.test(t)) return true;
      n = n.parentElement;
    }
    return false;
  }
  function candidateNodes(panel) {
    const set = /* @__PURE__ */ new Set();
    try {
      [...panel.querySelectorAll(OPTION_SEL2)].forEach((el) => set.add(el));
    } catch (_) {
    }
    try {
      [...panel.querySelectorAll(ITEM_LABEL_SEL)].forEach((el) => set.add(el));
    } catch (_) {
    }
    try {
      [...panel.querySelectorAll("div,span,li,a,p,dd,dt")].filter((el) => el.children.length === 0).forEach((el) => set.add(el));
    } catch (_) {
    }
    try {
      const walker = document.createTreeWalker(
        panel,
        4
        /* SHOW_TEXT */
      );
      let n = null;
      let guard = 0;
      while ((n = walker.nextNode()) && guard++ < 4e3) {
        const t = String(n.nodeValue || "").replace(/\s+/g, "");
        if (!t || [...t].length > 40) continue;
        const p = n.parentElement;
        if (p && p !== panel) set.add(p);
      }
    } catch (_) {
    }
    return [...set];
  }
  function newProbe() {
    return {
      nodes: 0,
      invisible: 0,
      hasTextChild: 0,
      inSelected: 0,
      tooLong: 0,
      junk: 0,
      kept: 0,
      samples: { invisible: [], hasTextChild: [], junk: [] }
    };
  }
  function collectPanelOptions(panel, probe) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const nodes = candidateNodes(panel);
    if (probe) probe.nodes = nodes.length;
    for (const el of nodes) {
      if (!isVisible(el)) {
        if (probe) {
          probe.invisible++;
          if (probe.samples.invisible.length < 6) probe.samples.invisible.push(shortText(el, 20));
        }
        continue;
      }
      let labelHost = null;
      try {
        labelHost = el.closest && el.closest(ITEM_LABEL_SEL);
      } catch (_) {
      }
      if (labelHost && labelHost !== el) continue;
      if (!labelHost && [...el.children].some((c) => String(c.textContent || "").trim())) {
        if (probe) {
          probe.hasTextChild++;
          if (probe.samples.hasTextChild.length < 6) probe.samples.hasTextChild.push(shortText(el, 20));
        }
        continue;
      }
      if (insideSelectedPane(el)) {
        if (probe) probe.inSelected++;
        continue;
      }
      const label = shortText(el, 60);
      if (!label || [...label].length > 40) {
        if (probe && label) probe.tooLong++;
        continue;
      }
      if (JUNK_RE.test(label)) {
        if (probe) {
          probe.junk++;
          if (probe.samples.junk.length < 6) probe.samples.junk.push(label);
        }
        continue;
      }
      const key = normalize(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ label, value: null, el });
    }
    if (probe) probe.kept = out.length;
    return out;
  }
  async function waitOptions(panel) {
    let last = [];
    let stable = 0;
    const end = Date.now() + 900;
    while (Date.now() < end) {
      const now = collectPanelOptions(panel);
      if (now.length && now.length === last.length) {
        stable++;
        if (stable >= 2) return now;
      } else {
        stable = 0;
      }
      last = now;
      await sleep(90);
    }
    return last;
  }
  async function harvestOptions(panel) {
    const seen = /* @__PURE__ */ new Map();
    const collect = () => {
      for (const o of collectPanelOptions(panel)) if (!seen.has(o.label)) seen.set(o.label, o);
    };
    collect();
    const scrollers = scrollerCandidates(panel);
    for (const sc of scrollers) {
      let last = -1;
      for (let i = 0; i < 10; i++) {
        if (sc.scrollTop === last) break;
        last = sc.scrollTop;
        sc.scrollTop = Math.min(sc.scrollTop + Math.max(sc.clientHeight || 180, 80), sc.scrollHeight || 0);
        fire(sc, "scroll", { bubbles: false });
        await sleep(110);
        collect();
      }
      sc.scrollTop = 0;
      fire(sc, "scroll", { bubbles: false });
      await sleep(160);
    }
    return [...seen.values()];
  }
  async function relocateOption(panel, label) {
    const now = collectPanelOptions(panel);
    const hit = now.find((o) => normalize(o.label) === normalize(label));
    if (hit) return hit;
    const scrollers = scrollerCandidates(panel);
    for (const sc of scrollers) {
      sc.scrollTop = 0;
      fire(sc, "scroll", { bubbles: false });
      await sleep(150);
      for (let i = 0; i < 10; i++) {
        const cur = collectPanelOptions(panel).find((o) => normalize(o.label) === normalize(label));
        if (cur) return cur;
        sc.scrollTop = sc.scrollTop + Math.max(sc.clientHeight || 180, 80);
        fire(sc, "scroll", { bubbles: false });
        await sleep(110);
      }
      sc.scrollTop = 0;
    }
    return null;
  }
  async function pickFreshOption(panel, label) {
    const key = normalize(label);
    const findNow = () => collectPanelOptions(panel).find((o) => normalize(o.label) === key) || null;
    let hit = findNow() || await relocateOption(panel, label);
    if (!hit) return null;
    try {
      if (hit.el.scrollIntoView) hit.el.scrollIntoView({ block: "nearest" });
    } catch (_) {
    }
    await sleep(160);
    hit = findNow() || await relocateOption(panel, label);
    if (!hit) return null;
    if (normalize(shortText(hit.el, 60)) !== key) return null;
    return hit.el;
  }
  function collapseRepeat(text) {
    const t = String(text || "");
    const chars = [...t];
    for (let n = 1; n <= Math.floor(chars.length / 2); n++) {
      if (chars.length % n !== 0) continue;
      const unit = chars.slice(0, n).join("");
      if (unit.repeat(chars.length / n) === t) return unit;
    }
    return t;
  }
  var VALUE_NODE_SELS = [
    '[class*="calcEle"]',
    '[class*="tipEle"]',
    '[class*="placeholder"]',
    '[class*="Placeholder"]',
    '[class*="selection"]',
    '[class*="Selection"]',
    '[class*="selected"]',
    '[class*="value"]',
    '[class*="Value"]'
  ];
  var EMPTY_HINT_RE = /^(?:请选择.*|请输入.*|请填写.*|选填|必填|--|—|-)$/;
  function cleanValueText(n) {
    const t = String(n.innerText || n.textContent || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    if (EMPTY_HINT_RE.test(t.replace(/\s+/g, ""))) return "";
    return collapseRepeat(t.slice(0, 60));
  }
  function readTriggerText(field) {
    const el = field.el;
    const box = field.container || el && el.parentElement;
    let hasValueNode = false;
    if (box) {
      for (const sel of VALUE_NODE_SELS) {
        let list = [];
        try {
          list = [...box.querySelectorAll(sel)];
        } catch (_) {
          continue;
        }
        if (list.length) hasValueNode = true;
        for (const n of list) {
          if (n.querySelector && n.querySelector("input,textarea,select")) continue;
          if (!isVisible(n)) continue;
          const t = cleanValueText(n);
          if (t) return t;
        }
      }
      if (!hasValueNode) {
        try {
          const inp = [el, ...box.querySelectorAll("input")].find(
            (x) => x && x.tagName === "INPUT" && !x.readOnly && !x.disabled
          );
          const v = inp ? String(inp.value || "").trim() : "";
          if (v && !EMPTY_HINT_RE.test(v)) return collapseRepeat(v.slice(0, 60));
        } catch (_) {
        }
      }
      try {
        const clone = box.cloneNode(true);
        clone.querySelectorAll(
          '.el-form-item__label,.ant-form-item-label,label,[class*="label"],[class*="Label"],[class*="title"],[class*="Title"]'
        ).forEach((n) => n.remove());
        clone.querySelectorAll("input,textarea,select").forEach((n) => n.remove());
        const shown = String(clone.innerText || clone.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
        if (shown && !EMPTY_HINT_RE.test(shown.replace(/\s+/g, ""))) return collapseRepeat(shown);
      } catch (_) {
      }
    }
    if (el && !hasValueNode) {
      const v = String(el.value ?? "").trim();
      if (v && !EMPTY_HINT_RE.test(v)) return v;
    }
    return "";
  }
  function hasValueNodes(field) {
    const box = field.container || field.el && field.el.parentElement;
    if (!box) return false;
    for (const sel of VALUE_NODE_SELS) {
      let list = [];
      try {
        list = [...box.querySelectorAll(sel)];
      } catch (_) {
        continue;
      }
      for (const n of list) {
        if (n.querySelector && n.querySelector("input,textarea,select")) continue;
        return true;
      }
    }
    return false;
  }
  async function waitMaskGone(timeout = 1800) {
    const end = Date.now() + timeout;
    const up = () => {
      try {
        return [...document.querySelectorAll('[class*="message-mask"]')].some(
          (el) => isVisible(el) && /(?:^|\s)show(?:\s|$)/.test(classOf(el))
        );
      } catch (_) {
        return false;
      }
    };
    while (Date.now() < end) {
      if (!up()) return true;
      await sleep(120);
    }
    return false;
  }
  async function closePanel(field) {
    try {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    } catch (_) {
    }
    for (const target of [field.el, document]) {
      try {
        fire(target, "keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true });
      } catch (_) {
      }
    }
    const body = document.body;
    if (body) clickEl(body);
    await sleep(140);
  }
  async function tryTypeFilter(panel, trigger, text) {
    let input = [...panel.querySelectorAll("input")].find(
      (el) => isVisible(el) && !el.readOnly && (el.type === "text" || el.type === "search" || !el.type)
    );
    if (!input && trigger && trigger.tagName === "INPUT" && !trigger.readOnly) input = trigger;
    if (!input) return false;
    try {
      input.focus();
    } catch (_) {
    }
    setNativeValue(input, text);
    fire(input, "input", { bubbles: true });
    fire(input, "keyup", { bubbles: true });
    await sleep(280);
    return true;
  }
  var NO_PANEL = /* @__PURE__ */ new Map();
  function resetPanelMemo() {
    NO_PANEL.clear();
  }
  async function repickOption(field, label) {
    const trigger = field.el;
    await closePanel(field);
    const snap = snapshotCandidates(trigger);
    const panel = await openPanel(field, trigger, snap);
    if (!panel) return "";
    await waitOptions(panel);
    await makeRoom(panel);
    const el = await pickFreshOption(panel, label);
    if (!el) {
      await closePanel(field);
      return "";
    }
    const act = await activateOption(el);
    await sleep(200);
    if (!act || act.ok) await clickConfirm(panel);
    try {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    } catch (_) {
    }
    return readTriggerText(field);
  }
  function componentSigOf(el) {
    let n = el;
    let d = 0;
    while (n && n.nodeType === 1 && d < 5) {
      const toks = String(n.className || "").split(/\s+/).filter(Boolean);
      const hit = toks.find((t) => /select|picker|cascader|dropdown/i.test(t));
      if (hit) return hit;
      n = n.parentElement;
      d++;
    }
    return "unknown";
  }
  async function openPanel(field, trigger, snap) {
    const box = field.container || trigger.parentElement;
    const targets = [trigger];
    if (box) {
      targets.push(box);
      try {
        const inner = box.querySelector('[class*="selection"],[class*="trigger"],[class*="selector"],[class*="value"]');
        if (inner && inner !== trigger) targets.push(inner);
      } catch (_) {
      }
    }
    const before = panelFingerprints();
    for (const t of targets) {
      try {
        t.focus && t.focus();
      } catch (_) {
      }
      clickEl(t);
      const panel = await waitFor(() => findOptionPanel(trigger, snap, before), 520, 60);
      if (panel) return panel;
    }
    return null;
  }
  function selectedCount(panel) {
    try {
      const numEl = panel.querySelector('[class*="select-data-num-text"]');
      const limEl = panel.querySelector('[class*="select-data-num-limit"]');
      if (numEl) {
        const numText = String(numEl.textContent || "").replace(/\s+/g, "");
        const limitText = limEl ? String(limEl.textContent || "").replace(/\s+/g, "") : "";
        const m = numText.match(/^(\d+)(?:\/(\d+))?$/);
        let n = m ? Number(m[1]) : null;
        let max = m && m[2] ? Number(m[2]) : null;
        if (!max && limitText) {
          const l = limitText.match(/(\d+)/);
          if (l) max = Number(l[1]);
        }
        if (n !== null && max) return { n, max };
      }
    } catch (_) {
    }
    try {
      const pane = panel.querySelector('[class*="select-data-container"]');
      if (pane) {
        const empty = !!pane.querySelector('[class*="select-data-empty"]');
        const chips = pane.querySelectorAll(
          '[class*="select-item-container"],[class*="select-text-label"],[class*="select-area-text-label"]'
        ).length;
        const limEl = panel.querySelector('[class*="select-data-num-limit"]');
        const l = limEl ? String(limEl.textContent || "").replace(/\s+/g, "").match(/(\d+)/) : null;
        if (l) return { n: empty ? 0 : chips, max: Number(l[1]) };
      }
    } catch (_) {
    }
    try {
      const t = String(panel.textContent || "").replace(/\s+/g, "");
      const m = t.match(/已选(\d+)\s*\/\s*(\d+)/);
      if (!m) return null;
      return { n: Number(m[1]), max: Number(m[2]) };
    } catch (_) {
      return null;
    }
  }
  async function clearSelected(panel) {
    if (!panel) return false;
    const roots = [];
    let n = panel;
    for (let i = 0; i < 3; i++) {
      if (!n || n === document.body || n === document.documentElement) break;
      roots.push(n);
      n = n.parentElement;
    }
    for (const r of roots) {
      let cands = [];
      try {
        cands = [...r.querySelectorAll('[class*="clear-select-data"],span,div,a,button,[role="button"]')];
      } catch (_) {
        continue;
      }
      const hit = cands.filter((el) => {
        if (!isVisible(el)) return false;
        if (el.children.length > 2) return false;
        if (/(?:^|\s)disabled(?:\s|$)/.test(classOf(el))) return false;
        const t = String(el.textContent || "").replace(/\s+/g, "");
        return /^(?:清空已选|清空|清除|重置)$/.test(t);
      }).sort((a, b) => a.children.length - b.children.length)[0];
      if (hit) {
        clickEl(hit);
        await sleep(240);
        await waitMaskGone();
        const cnt = selectedCount(panel);
        return !cnt || cnt.n === 0;
      }
    }
    return false;
  }
  async function makeRoom(panel) {
    if (!panel) return false;
    const cnt = selectedCount(panel);
    if (!cnt || !cnt.max || cnt.n < cnt.max) return false;
    return clearSelected(panel);
  }
  async function clickConfirm(panel) {
    const roots = [];
    let n = panel;
    for (let i = 0; i < 3; i++) {
      if (!n || n === document.body || n === document.documentElement) break;
      roots.push(n);
      n = n.parentElement;
    }
    for (const r of roots) {
      let cands = [];
      try {
        cands = [
          ...r.querySelectorAll(
            'button,[role="button"],[class*="confirm"],[class*="Confirm"],[class*="ok"],[class*="submit"],[class*="Submit"],span,div,a'
          )
        ];
      } catch (_) {
        continue;
      }
      const hits = cands.filter((el) => {
        if (!isVisible(el)) return false;
        if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;
        if (el.children.length > 2) return false;
        const t = String(el.textContent || "").replace(/\s+/g, "");
        return /^(?:确定|确认|完成|提交|保存|ok|confirm|submit)$/i.test(t);
      });
      if (!hits.length) continue;
      hits.sort((a, b) => a.children.length - b.children.length);
      clickEl(hits[0]);
      await sleep(220);
      return true;
    }
    return false;
  }
  function editableInputOf(field) {
    const trigger = field.el;
    const writable = (el) => el && el.tagName === "INPUT" && !el.readOnly && !el.disabled && ["text", "search", ""].includes(String(el.type || "text").toLowerCase());
    if (writable(trigger)) return trigger;
    const box = field.container;
    if (!box) return null;
    try {
      return [...box.querySelectorAll("input")].find(writable) || null;
    } catch (_) {
      return null;
    }
  }
  function pressKey(el, key, code, keyCode, times = 1) {
    for (let i = 0; i < times; i++) {
      try {
        fire(el, "keydown", { key, code, keyCode, which: keyCode, bubbles: true });
        fire(el, "keyup", { key, code, keyCode, which: keyCode, bubbles: true });
      } catch (_) {
      }
    }
  }
  async function commitByInput(field, panel, plan) {
    const input = editableInputOf(field);
    if (!input) return { ok: false, reason: "no-input" };
    const text = String(plan.resolved && plan.resolved.raw || "").trim();
    if (!text) return { ok: false, reason: "no-text" };
    const original = String(input.value || "");
    const collect = () => {
      if (!panel) return [];
      try {
        return collectPanelOptions(panel);
      } catch (_) {
        return [];
      }
    };
    const restore2 = () => {
      try {
        if (String(input.value || "") === original) return;
        setNativeValue(input, original);
        fire(input, "input", { bubbles: true });
      } catch (_) {
      }
    };
    const retype = async () => {
      setNativeValue(input, text);
      fire(input, "input", { bubbles: true });
      await sleep(220);
    };
    try {
      input.focus();
    } catch (_) {
    }
    if (panel) await makeRoom(panel);
    await retype();
    const typed = collect();
    const m = matchOption(plan.resolved, typed);
    const want = m.ok && m.option.label || text;
    const hit = (rb) => !!rb && (sameOption(rb, want) || sameOption(rb, text));
    let lastItem = null;
    if (panel && m.ok) {
      const el = await pickFreshOption(panel, m.option.label);
      if (el) {
        const act = await activateOption(el);
        await sleep(180);
        if (!act || act.ok) {
          await clickConfirm(panel);
          const rb = readTriggerText(field);
          if (hit(rb)) return { ok: true, via: "input+click", readback: rb };
          pressKey(input, "Enter", "Enter", 13);
          await sleep(220);
          await clickConfirm(panel);
          const rb2 = readTriggerText(field);
          if (hit(rb2)) return { ok: true, via: "input+click+enter", readback: rb2 };
        }
        lastItem = act || null;
      }
    }
    await retype();
    pressKey(input, "Enter", "Enter", 13);
    await sleep(280);
    await clickConfirm(panel);
    const rbEnter = readTriggerText(field);
    if (hit(rbEnter)) return { ok: true, via: "input-enter", readback: rbEnter };
    let lastRead = rbEnter;
    for (const downs of [1, 2]) {
      await retype();
      pressKey(input, "ArrowDown", "ArrowDown", 40, downs);
      await sleep(140);
      pressKey(input, "Enter", "Enter", 13);
      await sleep(260);
      await clickConfirm(panel);
      lastRead = readTriggerText(field);
      if (hit(lastRead)) return { ok: true, via: `input-keys(${downs})`, readback: lastRead };
    }
    await retype();
    try {
      fire(input, "change", { bubbles: true });
      input.blur();
    } catch (_) {
    }
    await sleep(260);
    await clickConfirm(panel);
    const rbBlur = readTriggerText(field);
    if (hit(rbBlur)) return { ok: true, via: "input-blur", readback: rbBlur };
    lastRead = rbBlur || lastRead;
    restore2();
    return {
      ok: false,
      reason: lastRead ? "readback-mismatch" : "no-readback",
      readback: lastRead,
      itemClick: lastItem ? lastItem.via : ""
    };
  }
  async function writeSelectCustom(plan) {
    const field = plan.field;
    const trigger = field.el;
    const sig = componentSigOf(trigger);
    const direct = await commitByInput(field, null, plan);
    if (direct.ok) {
      return {
        status: "filled",
        via: direct.via,
        readback: direct.readback,
        attempts: [`direct:${direct.via}:ok`]
      };
    }
    await closePanel(field);
    if ((NO_PANEL.get(sig) || 0) >= 2) {
      return { status: "skipped", reason: "panel-not-open", hints: [`同类组件已知无法打开：${sig}`] };
    }
    const snap = snapshotCandidates(trigger);
    let panel = await openPanel(field, trigger, snap);
    if (!panel) {
      NO_PANEL.set(sig, (NO_PANEL.get(sig) || 0) + 1);
      return {
        status: "skipped",
        reason: "panel-not-open",
        hints: panelHints()
      };
    }
    const cleared = await makeRoom(panel);
    if (cleared) {
      await sleep(220);
      await waitMaskGone();
      let alive = true;
      try {
        alive = !!(panel && panel.isConnected);
      } catch (_) {
      }
      if (!alive) {
        const again = await openPanel(field, trigger, snapshotCandidates(trigger));
        if (again) panel = again;
      }
    }
    let options = await waitOptions(panel);
    let m = matchOption(plan.resolved, options);
    const raw = plan.resolved && plan.resolved.raw;
    if (raw && (!m.ok || options.length > 30)) {
      const typed = await tryTypeFilter(panel, trigger, raw);
      if (typed) {
        options = await waitOptions(panel);
        const m2 = matchOption(plan.resolved, options);
        if (m2.ok) m = m2;
      }
    }
    if (!m.ok) {
      const harvested = await harvestOptions(panel);
      if (harvested.length > options.length) {
        options = harvested;
        const m3 = matchOption(plan.resolved, options);
        if (m3.ok) m = m3;
      }
    }
    if (!m.ok && raw) {
      const short = [...String(raw)].slice(0, 2).join("");
      if (short && short !== raw) {
        const typed = await tryTypeFilter(panel, trigger, short);
        if (typed) {
          const o2 = await waitOptions(panel);
          const m4 = matchOption(plan.resolved, o2);
          if (m4.ok) {
            m = m4;
            options = o2;
          }
        }
      }
    }
    if (!m.ok) {
      const byInput = await commitByInput(field, panel, plan);
      if (byInput.ok) {
        return { status: "filled", via: byInput.via, readback: byInput.readback, attempts: [`${byInput.via}:ok`] };
      }
      const probe = newProbe();
      let sel = "";
      try {
        collectPanelOptions(panel, probe);
        sel = panel.tagName.toLowerCase() + (typeof panel.className === "string" && panel.className ? "." + panel.className.trim().split(/\s+/).join(".") : "");
      } catch (_) {
      }
      const panelText = String(panel.innerText || panel.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160);
      await closePanel(field);
      return {
        status: "skipped",
        reason: m.reason,
        available: options.map((o) => o.label).slice(0, 20),
        panelText,
        panelSel: sel,
        probe,
        attempts: [`input-enter:${byInput.reason}`]
      };
    }
    const target = await pickFreshOption(panel, m.option.label);
    if (!target) {
      await closePanel(field);
      return { status: "skipped", reason: "option-detached", available: options.map((o) => o.label).slice(0, 12) };
    }
    const act = await activateOption(target);
    await sleep(260);
    if (!act || act.ok) {
      await clickConfirm(panel);
    }
    try {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    } catch (_) {
    }
    await waitMaskGone();
    const readback = readTriggerText(field);
    if (readback && sameOption(readback, m.option.label)) return { status: "filled", via: "panel", readback };
    if (!readback && !hasValueNodes(field)) {
      return { status: "filled", via: "panel", readback: "", lowConfidence: true };
    }
    const byKeys = await commitByInput(field, panel, plan);
    if (byKeys.ok) {
      return {
        status: "filled",
        via: byKeys.via,
        readback: byKeys.readback,
        attempts: ["panel-readback-mismatch", `${byKeys.via}:ok`]
      };
    }
    const retried = await repickOption(field, m.option.label);
    if (retried && sameOption(retried, m.option.label)) {
      return { status: "filled", via: "panel", readback: retried, attempts: ["repick:ok"] };
    }
    return {
      status: "failed",
      reason: readback ? "readback-mismatch" : "readback-empty",
      readback: retried || readback,
      expected: m.option.label,
      // 选项点击的局部反馈：地区弹层能给出 icon / icon-nochange / icon-disabled，
      // 有它就不必再靠"回读为空"去反推到底是点不动还是没提交
      itemClick: act ? act.via : "text",
      attempts: [
        "panel-readback-mismatch",
        `keys:${byKeys.reason}`,
        "repick:" + (retried ? "still-mismatch" : "fail")
      ]
    };
  }

  // src/adapters/date.js
  var pad = (n) => String(n).padStart(2, "0");
  function parseTarget(raw, precision = "day") {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})\s*[-/.年]\s*(\d{1,2})(?:\s*[-/.月]\s*(\d{1,2}))?/);
    if (!m) m = s.match(/^(\d{4})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = m[2] ? Number(m[2]) : 1;
    const d = m[3] ? Number(m[3]) : 1;
    if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return { y, m: mo, d, precision };
  }
  function toISO(target, precision = "day") {
    if (precision === "year") return String(target.y);
    if (precision === "month") return `${target.y}-${pad(target.m)}`;
    return `${target.y}-${pad(target.m)}-${pad(target.d)}`;
  }
  function rawPrecision(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "day";
    if (/^\d{4}\s*年?$/.test(s)) return "year";
    if (/^\d{4}\s*[-/.年]\s*\d{1,2}\s*月?$/.test(s)) return "month";
    return "day";
  }
  var PRECISION_RANK = { year: 0, month: 1, day: 2 };
  function coarserPrecision(a, b) {
    const ra = PRECISION_RANK[a];
    const rb = PRECISION_RANK[b];
    if (ra == null) return rb == null ? "day" : b;
    if (rb == null) return a;
    return ra <= rb ? a : b;
  }
  function parseReadback(text) {
    const s = String(text || "");
    let m = s.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})(?:\s*[-/.月]\s*(\d{1,2}))?/);
    if (m) return { y: +m[1], m: +m[2], d: m[3] ? +m[3] : null };
    m = s.match(/(19|20)\d{2}(\d{2})(\d{2})?/);
    if (m) return { y: +m[0].slice(0, 4), m: +m[2], d: m[3] ? +m[3] : null };
    return null;
  }
  function verifyDate(rb, target) {
    if (!rb) return "fail";
    if (target.precision === "year") return rb.y === target.y ? "ok" : "fail";
    if (rb.y !== target.y || rb.m !== target.m) return "fail";
    if (target.precision === "month") return "ok";
    if (rb.d == null) return "month-ok";
    return rb.d === target.d ? "ok" : "fail";
  }
  async function readDateBack(field, deps) {
    const el = field.el;
    if (deps && deps.bridge && el) {
      const r = await deps.bridge.readModel(el);
      if (r && r.ok && r.value) return String(r.value);
    }
    if (el && "value" in el && String(el.value || "").trim()) return String(el.value).trim();
    const box = field.container || el && el.parentElement;
    if (box) return String(box.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return "";
  }
  function rawValueOf(field) {
    try {
      return field.el && "value" in field.el ? String(field.el.value || "") : "";
    } catch (_) {
      return "";
    }
  }
  function restore(field, original) {
    try {
      if (!field.el || field.el.readOnly) return;
      if (rawValueOf(field) === original) return;
      setNativeValue(field.el, original);
      fire(field.el, "input", { bubbles: true });
      fire(field.el, "change", { bubbles: true });
    } catch (_) {
    }
  }
  function writeNativeDate(el, target, mode) {
    const v = mode === "month" ? `${target.y}-${pad(target.m)}` : `${target.y}-${pad(target.m)}-${pad(target.d)}`;
    try {
      setNativeValue(el, v);
      fire(el, "input", { bubbles: true });
      fire(el, "change", { bubbles: true });
      return { ok: String(el.value || "") !== "", readback: String(el.value || "") };
    } catch (_) {
      return { ok: false };
    }
  }
  function classifySelect(sel) {
    const nums = [...sel.options].map((o) => {
      const raw = String(o.value || o.textContent || "").replace(/[^\d]/g, "");
      return raw ? Number(raw) : NaN;
    }).filter((n) => !Number.isNaN(n));
    if (!nums.length) return "unknown";
    const max = Math.max(...nums);
    const min = Math.min(...nums);
    if (max > 1900) return "year";
    if (max === 12 && min <= 1) return "month";
    if (max >= 28) return "day";
    return "unknown";
  }
  async function writeTripleSelect(selects, target) {
    if (!selects || !selects.length) return { ok: false };
    const want = { year: target.y, month: target.m, day: target.d };
    const order = ["year", "month", "day"];
    let allOk = true;
    const readback = [];
    selects.forEach((sel, i) => {
      let kind = classifySelect(sel);
      if (kind === "unknown") kind = order[i] || "unknown";
      const value = want[kind];
      if (value == null) return;
      const opts = [...sel.options];
      let hit = opts.find((o) => Number(String(o.value || o.textContent).replace(/[^\d]/g, "")) === value);
      if (!hit) hit = opts.find((o) => String(o.textContent).trim() === String(value));
      if (!hit) {
        allOk = false;
        return;
      }
      try {
        setNativeValue(sel, hit.value);
        fire(sel, "input", { bubbles: true });
        fire(sel, "change", { bubbles: true });
        readback.push(String(hit.textContent || "").trim());
      } catch (_) {
        allOk = false;
      }
    });
    await sleep(80);
    return { ok: allOk, readback: readback.join("-") };
  }
  var PANEL_SEL2 = [
    '[class*="calendar"]',
    '[class*="Calendar"]',
    '[class*="datepicker"]',
    '[class*="date-picker"]',
    '[class*="picker-panel"]',
    '[class*="date-panel"]',
    '[class*="DatePanel"]'
  ].join(",");
  function dateInputVariants(target, precision = "day") {
    const iso = toISO(target, precision);
    const y = target.y;
    const m = target.m || 1;
    const d = target.d || 1;
    const out = [];
    if (precision === "year") {
      out.push(String(y), `${y}年`);
      return out;
    }
    if (precision === "month") {
      out.push(iso, iso.replace(/-/g, "/"), iso.replace(/-/g, "."), String(y) + pad(m), `${y}年${m}月`, `${y}-${m}`);
      return out;
    }
    out.push(
      iso,
      iso.replace(/-/g, "/"),
      iso.replace(/-/g, "."),
      `${y}/${m}/${d}`,
      `${y}年${m}月${d}日`,
      `${y}年${pad(m)}月${pad(d)}日`,
      `${y}${pad(m)}${pad(d)}`,
      // 以下四种是"网页只到年月"时的降级写法：控件会拒收完整日期，只认年月
      iso.slice(0, 7),
      iso.slice(0, 7).replace("-", "/"),
      `${y}年${m}月`,
      `${y}${pad(m)}`
    );
    return [...new Set(out)];
  }
  function canTypeInto(field) {
    const el = field && field.el;
    if (!el || !el.tagName) return false;
    const tag = el.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA") return false;
    if (el.readOnly || el.disabled) return false;
    return (el.type || "text").toLowerCase() !== "file";
  }
  function depthOf(el) {
    let d = 0;
    let n = el;
    while (n && n !== document.body) {
      d++;
      n = n.parentElement;
    }
    return d;
  }
  function findCalendarPanel(field, known) {
    const trig = field.el;
    const cands = [];
    for (const el of document.querySelectorAll(PANEL_SEL2)) {
      if (!isVisible(el)) continue;
      if (trig && el.contains(trig)) continue;
      const leaves = leavesOf(el);
      const numeric = leaves.filter((l) => /^\d{1,4}$/.test(String(l.textContent).trim())).length;
      const txt = String(el.innerText || el.textContent || "");
      const hasYM = /(19|20)\d{2}\s*年/.test(txt) && /\d{1,2}\s*月/.test(txt);
      const hasDateInput = [...el.querySelectorAll("input")].some((x) => {
        const meta = String(x.className || "") + " " + String(x.getAttribute("name") || "") + " " + String(x.getAttribute("type") || "");
        const v = String(x.value || "") + " " + String(x.placeholder || "");
        return /date/i.test(meta) || /\d{4}\s*[-/年]/.test(v) || /请选择|请输入日期|日期/.test(v);
      });
      if (numeric < 10 && !hasYM) continue;
      const isNew = known ? !known.has(el) : 0;
      cands.push({ el, numeric, hasYM, hasDateInput, depth: depthOf(el), isNew });
    }
    if (!cands.length) return null;
    const tops = cands.filter((c) => !cands.some((o) => o !== c && o.el.contains(c.el)));
    const pool = tops.length ? tops : cands;
    pool.sort(
      (a, b) => b.isNew - a.isNew || b.hasDateInput - a.hasDateInput || b.hasYM - a.hasYM || b.numeric - a.numeric || b.depth - a.depth
    );
    return pool[0].el;
  }
  async function typeInto(el, text) {
    try {
      el.focus();
    } catch (_) {
    }
    setNativeValue(el, text);
    fire(el, "input", { bubbles: true });
    fire(el, "change", { bubbles: true });
    await sleep(150);
    return String(el.value || "").trim();
  }
  async function commitPanelDate(panel, el, text, target, field) {
    const kept = await typeInto(el, text);
    if (!kept || !new RegExp(String(target.y)).test(kept)) return false;
    try {
      fire(el, "keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true });
    } catch (_) {
    }
    await sleep(240);
    const after = String(el.value || "").trim();
    if (after) return true;
    const stillOpen = document.body.contains(panel) && isVisible(panel);
    if (stillOpen) return false;
    const trig = String(field && field.el && field.el.value || "");
    return new RegExp(String(target.y)).test(trig);
  }
  async function clickConfirm2(panel) {
    const confirm = [...panel.querySelectorAll('button,[role="button"],[class*="confirm"],[class*="ok"]')].find(
      (b) => isVisible(b) && /^(确定|确认|完成|ok|confirm)$/i.test(String(b.textContent || "").trim().slice(0, 4))
    );
    if (!confirm) return false;
    clickEl(confirm);
    await sleep(180);
    return true;
  }
  async function fillPanelInput(panel, target, field) {
    const cands = [...panel.querySelectorAll("input")].filter((el2) => {
      if (!isVisible(el2) || el2.readOnly || el2.disabled) return false;
      const t = String(el2.type || "text").toLowerCase();
      return ["text", "search", ""].includes(t) || t === "tel";
    });
    if (!cands.length) return false;
    const el = cands.find((x) => /\d{4}\s*[-/年]/.test(String(x.value || "") + String(x.placeholder || ""))) || cands[0];
    const variants = [toISO(target, target.precision)];
    if (target.precision !== "day") {
      variants.push(toISO({ ...target, m: target.m || 1, d: 1 }, "day"));
      variants.push(toISO({ ...target, d: target.d || 1 }, "day"));
    }
    let accepted = false;
    for (const text of [...new Set(variants)]) {
      if (await commitPanelDate(panel, el, text, target, field)) {
        accepted = true;
        break;
      }
    }
    if (!accepted) return false;
    if (document.body.contains(panel) && isVisible(panel)) await clickConfirm2(panel);
    return true;
  }
  async function closeDatePanel(field) {
    try {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    } catch (_) {
    }
    if (field && field.el) {
      fire(field.el, "keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true });
    }
    try {
      if (document.body) clickEl(document.body);
    } catch (_) {
    }
    await sleep(160);
  }
  async function settleAfterFill(field, out) {
    if (out && out.status === "filled") {
      try {
        await closeDatePanel(field);
      } catch (_) {
      }
    }
    return out;
  }
  function readView(panel) {
    const txt = String(panel.innerText || panel.textContent || "");
    const years = txt.match(/(19|20)\d{2}/g);
    const mm = txt.match(/(\d{1,2})\s*月/);
    let y = years ? Number(years[0]) : null;
    let m = mm ? Number(mm[1]) : null;
    if (m == null || y == null) {
      for (const el of panel.querySelectorAll("input")) {
        const hit = String(el.value || "").match(/(\d{4})\s*[-/年]\s*(\d{1,2})/);
        if (hit) {
          y = Number(hit[1]);
          m = Number(hit[2]);
          break;
        }
      }
    }
    return { y, m };
  }
  function probePanel(panel) {
    const leaves = leavesOf(panel).filter((l) => isVisible(l));
    const numLeaves = leaves.filter((l) => /^\d{1,4}$/.test(String(l.textContent).trim()));
    const years = numLeaves.filter((l) => {
      const n = Number(l.textContent);
      return n > 1900 && n < 2100;
    });
    const small = numLeaves.filter((l) => {
      const n = Number(l.textContent);
      return n >= 1 && n <= 31;
    });
    const months = numLeaves.filter((l) => {
      const n = Number(l.textContent);
      return n >= 1 && n <= 12;
    });
    return {
      leaves,
      years,
      small,
      months,
      selects: [...panel.querySelectorAll("select")].filter(isVisible),
      hasYearGrid: years.length >= 8,
      hasDayGrid: small.length >= 20,
      hasMonthGrid: months.length >= 10 && small.length < 20,
      view: readView(panel)
    };
  }
  function clickLeaf(leaf) {
    if (!leaf) return false;
    clickEl(leaf);
    if (leaf.parentElement) clickEl(leaf.parentElement);
    return true;
  }
  function pickExact(leaves, value) {
    const hit = leaves.filter((l) => String(l.textContent).trim() === String(value));
    if (!hit.length) return false;
    return clickLeaf(hit[0]);
  }
  function findNav(panel, targetYear) {
    const p = probePanel(panel);
    const cur = p.years.map((l) => Number(l.textContent));
    if (!cur.length) return null;
    const dir = targetYear < Math.min(...cur) ? "prev" : "next";
    const pat = dir === "prev" ? /prev|before|left|上一|前一|last/i : /next|after|right|下一|后一|forward/i;
    const cands = [...panel.querySelectorAll('button,[role="button"],a,span,i')].filter(
      (el) => isVisible(el) && el.children.length <= 1
    );
    return cands.find((el) => {
      const cls = String(el.className || "");
      const aria = el.getAttribute("aria-label") || "";
      const title = el.getAttribute("title") || "";
      return pat.test(cls) || pat.test(aria) || pat.test(title);
    }) || null;
  }
  async function pickYear(panel, target) {
    let p = probePanel(panel);
    if (!p.hasYearGrid) {
      const label = p.leaves.find((l) => {
        const t = String(l.textContent).trim();
        if ([...t].length > 8) return false;
        return /^(19|20)\d{2}\s*年?$/.test(t) || /^(19|20)\d{2}\s*年/.test(t) && /年/.test(t);
      });
      if (label) {
        clickLeaf(label);
        await sleep(220);
        p = probePanel(panel);
      }
    }
    if (!p.hasYearGrid) return false;
    for (let i = 0; i < 14; i++) {
      if (p.years.some((l) => Number(l.textContent) === target)) {
        if (pickExact(p.years, target)) {
          await sleep(220);
          return true;
        }
        return false;
      }
      const nav = findNav(panel, target);
      if (!nav) return false;
      clickEl(nav);
      await sleep(220);
      p = probePanel(panel);
    }
    return false;
  }
  async function pickMonth(panel, target) {
    let p = probePanel(panel);
    if (!p.hasMonthGrid) {
      const label = p.leaves.find((l) => {
        const t = String(l.textContent).trim();
        if (!/^\d{1,2}$/.test(t)) return false;
        const near = String(l.parentElement && l.parentElement.textContent || "");
        return /月/.test(near);
      });
      if (label) {
        clickLeaf(label);
        await sleep(200);
        p = probePanel(panel);
      }
    }
    if (p.hasDayGrid) {
      return false;
    }
    if (!p.hasMonthGrid) return false;
    if (!pickExact(p.months, target)) return false;
    await sleep(220);
    return true;
  }
  function findNavByDir(panel, dir, preferMonth = false) {
    const pat = dir === "prev" ? /prev|before|left|上一|前一|last/i : /next|after|right|下一|后一|forward/i;
    const monthPat = dir === "prev" ? /(prev|last|上一|前一).*month|month.*(prev|last)/i : /(next|后一|下一).*month|month.*(next)/i;
    const cands = [...panel.querySelectorAll('button,[role="button"],a,span,i')].filter(
      (el) => isVisible(el) && el.children.length <= 1
    );
    const match = (el) => {
      const cls = String(el.className || "");
      const aria = el.getAttribute("aria-label") || "";
      const title = el.getAttribute("title") || "";
      return pat.test(cls) || pat.test(aria) || pat.test(title) || pat.test(String(el.textContent || ""));
    };
    if (preferMonth) {
      const m = cands.find((el) => monthPat.test(String(el.className || "")) || monthPat.test(el.getAttribute("aria-label") || ""));
      if (m) return m;
    }
    return cands.find(match) || null;
  }
  async function shiftMonth(panel, target) {
    for (let i = 0; i < 24; i++) {
      const v = readView(panel);
      if (v.y == null || v.m == null) return false;
      if (v.y === target.y && v.m === target.m) return true;
      const back = target.y < v.y || target.y === v.y && target.m < v.m;
      const nav = findNavByDir(panel, back ? "prev" : "next", true);
      if (!nav) return false;
      clickEl(nav);
      await sleep(170);
    }
    return false;
  }
  function panelHint(panel) {
    if (!panel) return {};
    const leaves = leavesOf(panel).map((l) => String(l.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean);
    const nums = leaves.filter((t) => /^\d{1,4}$/.test(t));
    const keep = nums.length >= 20 ? leaves.filter((t) => !/^\d{1,4}$/.test(t)) : leaves;
    const txt = [...new Set(keep)].join(" ").slice(0, 120);
    return { panelSel: tagOf(panel), panelText: txt };
  }
  async function clickTextLeaf(re, roots, exclude) {
    const blocked = (el) => {
      if (!exclude) return false;
      try {
        return el === exclude || exclude.contains(el);
      } catch (_) {
        return false;
      }
    };
    for (const root of roots) {
      if (!root || blocked(root)) continue;
      let nodes = [];
      try {
        nodes = [...root.querySelectorAll("li,td,div,span,a,p")];
      } catch (_) {
        continue;
      }
      const hit = nodes.find((el) => {
        if (blocked(el)) return false;
        if (!isVisible(el)) return false;
        if (el.children.length > 2) return false;
        const t = String(el.textContent || "").replace(/\s+/g, "");
        return t && re.test(t);
      });
      if (hit) {
        clickLeaf(hit);
        await sleep(240);
        return true;
      }
    }
    return false;
  }
  async function clickTextLeafScrollable(re, roots, exclude) {
    if (await clickTextLeaf(re, roots, exclude)) return true;
    const scrollables = [];
    for (const root of roots) {
      if (!root || root === exclude) continue;
      let els = [];
      try {
        els = [...root.querySelectorAll("*")];
      } catch (_) {
        continue;
      }
      for (const el of els) {
        try {
          if (el.scrollHeight > el.clientHeight + 8 && el.clientHeight > 20) scrollables.push(el);
        } catch (_) {
        }
        if (scrollables.length > 6) break;
      }
      if (scrollables.length > 6) break;
    }
    for (const sc of scrollables) {
      const saved = sc.scrollTop;
      let top = 0;
      try {
        top = Math.max(0, (sc.scrollHeight || 0) - (sc.clientHeight || 0));
      } catch (_) {
      }
      for (let y = 0; y <= top; y += 160) {
        try {
          sc.scrollTop = y;
        } catch (_) {
        }
        await sleep(90);
        if (await clickTextLeaf(re, roots, exclude)) return true;
      }
      try {
        sc.scrollTop = saved;
      } catch (_) {
      }
    }
    return false;
  }
  async function driveYmPanel(panel, target, attempts) {
    let head = null;
    try {
      head = [...panel.querySelectorAll('[class*="ym-select"],[class*="ymSelect"]')].find(isVisible);
    } catch (_) {
    }
    if (!head) {
      head = leavesOf(panel).find((l) => {
        const t = String(l.textContent || "").replace(/\s+/g, "");
        return /^\d{4}年\d{1,2}月?$/.test(t);
      });
    }
    if (!head) {
      const selfText = String(panel.textContent || "").replace(/\s+/g, "");
      if (/^\d{4}年\d{1,2}月?$/.test(selfText)) head = panel;
    }
    if (!head) return false;
    if (head === panel) clickEl(head);
    else clickLeaf(head);
    await sleep(320);
    const roots = [panel];
    try {
      roots.push(
        ...[...document.querySelectorAll('[class*="unmodeled-layer"],[class*="calendar"],[class*="dropdown"]')].filter(
          (el) => isVisible(el) && el.tagName !== "INPUT"
        )
      );
    } catch (_) {
    }
    const yOk = await clickTextLeafScrollable(new RegExp("^" + target.y + "年?$"), roots, head);
    attempts.push("ym-year:" + (yOk ? "ok" : "fail"));
    if (yOk) await sleep(280);
    if (!yOk) {
      let headYear = null;
      try {
        const m = String(head && head.textContent || "").match(/(19|20)\d{2}/);
        if (m) headYear = Number(m[0]);
      } catch (_) {
      }
      if (headYear !== target.y) {
        attempts.push("ym-year-mismatch:" + headYear);
        return false;
      }
    }
    const mOk = await clickTextLeafScrollable(new RegExp("^0?" + target.m + "月?$"), roots, head);
    attempts.push("ym-month:" + (mOk ? "ok" : "fail"));
    await sleep(260);
    return mOk;
  }
  function trigHasYm(field, y, m) {
    try {
      const v = String(field && field.el && field.el.value || "");
      if (!v) return false;
      return new RegExp(String(y) + "\\s*[-/年]\\s*0?" + m + "(月|\\D|$)").test(v);
    } catch (_) {
      return false;
    }
  }
  async function driveYmViaIntermediate(field, panel, target, attempts) {
    const trigger = field && field.el;
    if (!trigger) return false;
    const cands = [target.m === 1 ? 2 : target.m - 1, target.m === 12 ? 11 : target.m + 1, 1, 12].filter(
      (m) => m !== target.m
    );
    let interOk = false;
    for (const im of [...new Set(cands)]) {
      if (await clickTextLeafScrollable(new RegExp("^0?" + im + "月$"), [panel], null)) {
        interOk = true;
        break;
      }
    }
    attempts.push("ymsel-inter-month:" + (interOk ? "ok" : "fail"));
    await sleep(320);
    let panel2 = panel;
    const stillOpen = document.body.contains(panel) && isVisible(panel);
    if (stillOpen) {
      attempts.push("ymsel-reopen:reuse");
    } else {
      const known = /* @__PURE__ */ new Set();
      try {
        for (const el of document.querySelectorAll(PANEL_SEL2)) known.add(el);
      } catch (_) {
      }
      try {
        trigger.focus();
      } catch (_) {
      }
      clickEl(trigger);
      panel2 = await waitFor(() => findCalendarPanel(field, known), 1e3, 80);
      attempts.push("ymsel-reopen:" + (panel2 ? "ok" : "fail"));
      if (!panel2) return false;
    }
    const mOk = await clickTextLeafScrollable(new RegExp("^0?" + target.m + "月?$"), [panel2], null);
    attempts.push("ymsel-inter-target:" + (mOk ? "ok" : "fail"));
    await clickConfirm2(panel2);
    await sleep(300);
    return trigHasYm(field, target.y, target.m);
  }
  async function driveYmSelector(field, panel, target, attempts) {
    let view = readView(panel);
    if (!view || view.y == null || view.m == null) return false;
    if (view.y !== target.y) {
      const ok = await pickYear(panel, target.y);
      attempts.push("ymsel-year:" + (ok ? "ok" : "fail"));
      if (!ok) return false;
      await sleep(220);
      view = readView(panel);
    } else {
      attempts.push("ymsel-year:already");
    }
    view = readView(panel);
    if (view && view.m != null) {
      const back = await clickTextLeafScrollable(new RegExp("^0?" + view.m + "月$"), [panel], null);
      attempts.push("ymsel-month-view:" + (back ? "ok" : "none"));
      if (back) await sleep(200);
      view = readView(panel);
    }
    let mOk = !!(view && view.m === target.m);
    if (mOk) {
      attempts.push("ymsel-month:already");
    } else {
      mOk = await clickTextLeafScrollable(new RegExp("^0?" + target.m + "月?$"), [panel], null);
      attempts.push("ymsel-month:" + (mOk ? "ok" : "fail"));
    }
    if (!mOk) return false;
    await clickTextLeafScrollable(/^(本月|这个月|当前月|今月)$/, [panel], null);
    await clickConfirm2(panel);
    await sleep(260);
    if (trigHasYm(field, target.y, target.m)) return true;
    attempts.push("ymsel-this-month:no-commit");
    return await driveYmViaIntermediate(field, panel, target, attempts);
  }
  async function drivePanel(field, target) {
    const trigger = field.el;
    const attempts = [];
    const knownPanels = new Set(document.querySelectorAll(PANEL_SEL2));
    try {
      trigger.focus();
    } catch (_) {
    }
    clickEl(trigger);
    let panel = await waitFor(() => findCalendarPanel(field, knownPanels), 1e3, 80);
    if (!panel) return { ok: false, reason: "panel-not-open", attempts };
    const done = (extra) => ({ ok: true, ...extra, panel, ...panelHint(panel) });
    const typed = await fillPanelInput(panel, target, field);
    attempts.push("panel-input:" + (typed ? "ok" : "none"));
    if (typed) {
      const closed = !document.body.contains(panel) || !isVisible(panel);
      if (closed) return done({ via: "panel-input", attempts });
      const pv = probePanel(panel);
      if (pv.view.y === target.y && pv.view.m === target.m) {
        if (target.precision === "day" && pv.hasDayGrid) {
          const hit = pickExact(pv.small, target.d);
          attempts.push("panel-input-day:" + (hit ? "ok" : "fail"));
          await sleep(200);
          return done({ ok: hit, via: "panel-input", attempts });
        }
        return done({ via: "panel-input", attempts });
      }
    }
    let p = probePanel(panel);
    if (!p.hasDayGrid && !p.hasMonthGrid) {
      const okYm = await driveYmPanel(panel, target, attempts);
      attempts.push("ym-panel:" + (okYm ? "ok" : "fail"));
      if (okYm) {
        await clickConfirm2(panel);
        return done({ via: "panel-ym", precision: "month", attempts });
      }
      const okYm2 = await driveYmSelector(field, panel, target, attempts);
      attempts.push("ymsel-panel:" + (okYm2 ? "ok" : "fail"));
      if (okYm2) {
        return done({ via: "panel-ym", precision: "month", attempts });
      }
    }
    if (p.selects.length >= 2) {
      const r = await writeTripleSelect(p.selects, target);
      attempts.push("panel-selects:" + (r.ok ? "ok" : "fail"));
      if (r.ok) return done({ via: "panel-selects", attempts });
    }
    if (p.view.y !== target.y || !p.hasDayGrid && !p.hasMonthGrid) {
      const ok2 = await pickYear(panel, target.y);
      attempts.push("year:" + (ok2 ? "ok" : "fail"));
      await sleep(160);
      p = probePanel(panel);
    }
    if (target.precision === "year") {
      return done({ ok: p.view.y === target.y, via: "panel-year", attempts });
    }
    if (target.precision === "day" && !p.hasDayGrid && p.hasMonthGrid) {
      const rightMonth = p.view.y === target.y && p.view.m === target.m;
      const okM = rightMonth ? true : await pickMonth(panel, target.m);
      attempts.push("month-fallback:" + (okM ? "ok" : "fail"));
      if (!okM) return { ok: false, reason: "no-month-grid", attempts, panel, ...panelHint(panel) };
      await clickConfirm2(panel);
      return done({ via: "panel-month", precision: "month", attempts });
    }
    if (target.precision === "month") {
      const alreadyRight = p.view.y === target.y && p.view.m === target.m && !p.hasMonthGrid;
      if (!alreadyRight) {
        const ok2 = await pickMonth(panel, target.m);
        attempts.push("month:" + (ok2 ? "ok" : "fail"));
        await sleep(160);
        p = probePanel(panel);
      }
      return done({ ok: p.view.m === target.m || alreadyRight, via: "panel-month", attempts });
    }
    p = probePanel(panel);
    if (p.view.m !== target.m || p.view.y !== target.y) {
      const shifted = await shiftMonth(panel, target);
      attempts.push("shift-month:" + (shifted ? "ok" : "fail"));
      if (!shifted) {
        const head = p.leaves.find((l) => {
          const t = String(l.textContent || "").trim();
          return [...t].length <= 12 && /年|\d{1,2}\s*月/.test(t);
        });
        if (head) {
          clickLeaf(head);
          await sleep(240);
          let q = probePanel(panel);
          if (q.hasYearGrid && q.view.y !== target.y) {
            await pickYear(panel, target.y);
            await sleep(200);
            q = probePanel(panel);
          }
          const okM = q.hasMonthGrid ? await pickMonth(panel, target.m) : false;
          attempts.push("month-view:" + (okM ? "ok" : "fail"));
          await sleep(200);
        }
      }
      await sleep(160);
      p = probePanel(panel);
    }
    if (!p.hasDayGrid) return { ok: false, reason: "no-day-grid", attempts, panel, ...panelHint(panel) };
    const view = readView(panel);
    if (view.y !== target.y || view.m !== target.m) {
      attempts.push("day:view-mismatch(" + view.y + "-" + view.m + ")");
      return { ok: false, reason: "view-mismatch", attempts, panel, ...panelHint(panel) };
    }
    const ok = pickExact(p.small, target.d);
    attempts.push("day:" + (ok ? "ok" : "fail"));
    await sleep(200);
    return done({ ok, via: "panel", attempts });
  }
  var preferredFormat = null;
  async function typeDate(field, target) {
    const el = field.el;
    if (!el || el.readOnly || el.disabled) return { ok: false, reason: "readonly" };
    const all = dateInputVariants(target, target.precision);
    const variants = preferredFormat && all.includes(preferredFormat) ? [preferredFormat, ...all.filter((v) => v !== preferredFormat)] : all;
    for (const v of variants) {
      try {
        el.focus();
      } catch (_) {
      }
      setNativeValue(el, v);
      fire(el, "input", { bubbles: true });
      await sleep(70);
      let kept = String(el.value || "").trim();
      if (!kept) continue;
      fire(el, "change", { bubbles: true });
      await sleep(30);
      kept = String(el.value || "").trim();
      if (!kept) continue;
      const rb = parseReadback(kept);
      if (rb && rb.y === target.y && (rb.m == null || rb.m === target.m)) {
        fire(el, "blur", { bubbles: false });
        await sleep(60);
        preferredFormat = v;
        return { ok: true, typed: v, kept: String(el.value || "").trim() || kept, format: v };
      }
    }
    try {
      setNativeValue(el, "");
    } catch (_) {
    }
    return { ok: false, reason: "value-rejected" };
  }
  async function writeDate(plan, deps) {
    const declared = plan.precision || "day";
    const parsed = parseTarget(plan.value, declared);
    if (!parsed) return { status: "skipped", reason: "value-not-a-date" };
    const target = { ...parsed, precision: coarserPrecision(declared, rawPrecision(plan.value)) };
    const field = plan.field;
    const ck = field.controlKind;
    const original = rawValueOf(field);
    const attempts = [];
    const finish = async (info) => {
      const prec = info.precision || target.precision;
      const rb = await readDateBack(field, deps);
      const verdict = verifyDate(parseReadback(rb), { ...target, precision: prec });
      const downgraded = prec !== target.precision ? prec : void 0;
      if (verdict === "ok") {
        return { status: "filled", via: info.via, readback: rb, attempts, ...downgraded ? { downgraded } : {} };
      }
      if (verdict === "month-ok") {
        return { status: "filled", via: info.via, readback: rb, downgraded: "month", attempts };
      }
      return { status: "skipped", reason: "date-verify-failed", readback: rb, attempts };
    };
    if (ck === "DATE_NATIVE_DAY" || ck === "DATE_NATIVE_MONTH") {
      const controlPrec = ck === "DATE_NATIVE_MONTH" ? "month" : "day";
      const r = writeNativeDate(field.el, target, controlPrec === "month" ? "month" : "day");
      attempts.push("native:" + (r.ok ? "ok" : "fail"));
      if (r.ok) {
        const out = await finish({ via: "native", precision: coarserPrecision(target.precision, controlPrec) });
        if (out.status === "filled") return settleAfterFill(field, out);
      }
    }
    if (ck === "DATE_TRIPLE_SELECT") {
      const selects = field.inputs || [];
      const controlPrec = selects.length >= 3 ? "day" : "month";
      const r = await writeTripleSelect(selects, target);
      attempts.push("triple:" + (r.ok ? "ok" : "fail"));
      if (r.ok) {
        const out = await finish({ via: "triple-select", precision: coarserPrecision(target.precision, controlPrec) });
        if (out.status === "filled") return settleAfterFill(field, out);
      }
    }
    if (deps && deps.bridge) {
      const iso = toISO(target, target.precision);
      const r2 = await deps.bridge.setModelValue(field.el, iso);
      attempts.push("model:" + (r2 && r2.ok ? "ok" : r2 && r2.reason || "fail"));
      if (r2 && r2.ok) {
        const out = await finish({ via: "model" });
        if (out.status === "filled") return settleAfterFill(field, out);
      }
    }
    const wantsPanelFirst = ck === "DATE_CUSTOM" || ck === "PICKER" || ck === "SELECT_CUSTOM" || !canTypeInto(field);
    if (!wantsPanelFirst) {
      const r = await typeDate(field, target);
      attempts.push("typing:" + (r.ok ? "ok(" + r.format + ")" : r.reason || "fail"));
      if (r.ok) {
        const out = await finish({ via: "typing" });
        if (out.status === "filled") return settleAfterFill(field, out);
        attempts.push("typing-verify:fail");
      }
    }
    const r3 = await drivePanel(field, target);
    attempts.push("panel:" + (r3.ok ? "ok" : r3.reason || "fail"));
    if (r3.attempts && r3.attempts.length) attempts.push(...r3.attempts.map((a) => "panel>" + a));
    if (r3.ok) {
      const stillOpen = !!(r3.panel && document.body.contains(r3.panel) && isVisible(r3.panel));
      if (stillOpen) {
        attempts.push("panel-open");
        if (await clickConfirm2(r3.panel)) attempts.push("panel-confirm");
        await sleep(200);
      }
      const out = await finish({ via: r3.via || "panel", precision: r3.precision });
      if (out.status === "filled") return settleAfterFill(field, out);
      if (r3.panelSel) attempts.push("panel-sel:" + r3.panelSel);
      if (r3.panelText) attempts.push("panel-text:" + String(r3.panelText).slice(0, 40));
    }
    if (canTypeInto(field)) {
      await closeDatePanel(field);
      attempts.push("panel-closed");
      const r4 = await typeDate(field, target);
      attempts.push("typing2:" + (r4.ok ? "ok(" + r4.format + ")" : r4.reason || "fail"));
      if (r4.ok) {
        const out = await finish({ via: "typing" });
        if (out.status === "filled") return settleAfterFill(field, out);
      }
    }
    if (target.precision === "day") {
      await closeDatePanel(field);
      const monthPlan = { ...plan, precision: "month", value: toISO(target, "month") };
      const r5 = await writeDate(monthPlan, deps);
      attempts.push("downgrade-month:" + (r5.status === "filled" ? "ok" : r5.reason || "fail"));
      if (r5.status === "filled") {
        return {
          ...r5,
          attempts: [...attempts, ...(r5.attempts || []).map((a) => "m>" + a)],
          downgraded: "month",
          precision: "month"
        };
      }
    }
    await closeDatePanel(field);
    restore(field, original);
    return {
      status: "skipped",
      reason: "date-failed",
      attempts,
      ...r3 && r3.panelSel ? { panelSel: r3.panelSel } : {},
      ...r3 && r3.panelText ? { panelText: String(r3.panelText).slice(0, 120) } : {}
    };
  }

  // src/adapters/upload.js
  function dataUrlToBlob(dataUrl) {
    const [head, b64] = String(dataUrl).split(",");
    const mime = (head.match(/:(.*?);/) || [])[1] || "image/jpeg";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  async function writeUpload(plan) {
    const v = plan.value;
    if (!v || typeof v !== "object" || !v.dataUrl) return { status: "skipped", reason: "no-photo" };
    let input = plan.field.el;
    if (!input || input.type !== "file") {
      const box = plan.field.container;
      let near = null;
      for (let n = box, d = 0; n && !near && d < 3; n = n.parentElement, d++) {
        try {
          const all = n.querySelectorAll('input[type="file"]');
          if (all.length === 1) near = all[0];
        } catch (_) {
        }
      }
      if (!near) return { status: "skipped", reason: "not-file-input" };
      input = near;
    }
    const accept = String(input.getAttribute("accept") || "").toLowerCase();
    const mime = String(v.type || "").toLowerCase();
    if (accept && mime) {
      const okAccept = accept.split(",").map((x) => x.trim()).some((a) => a === mime || a.endsWith("/*") && mime.startsWith(a.slice(0, -1)) || a.startsWith(".") && String(v.name || "").toLowerCase().endsWith(a));
      if (!okAccept) return { status: "skipped", reason: "upload-type-mismatch" };
    }
    try {
      const blob = dataUrlToBlob(v.dataUrl);
      const file = new File([blob], v.name || "photo.jpg", { type: v.type || blob.type || "image/jpeg" });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      fire(input, "change", { bubbles: true });
      await sleep(100);
      const ok = input.files && input.files.length > 0;
      return ok ? { status: "filled", via: "upload", readback: input.files[0].name } : { status: "failed", reason: "upload-failed" };
    } catch (e) {
      return { status: "failed", reason: "upload-error:" + String(e && e.message).slice(0, 60) };
    }
  }

  // src/adapters/index.js
  async function writeField(plan, deps) {
    const field = plan.field;
    if (!field || !field.el) return { status: "failed", reason: "no-el" };
    const ck = field.controlKind || "TEXT";
    const kind = plan.kind;
    if (kind === "upload" || ck === "UPLOAD") return writeUpload(plan);
    if (ck === "CHECKBOX_GROUP") return { status: "skipped", reason: "checkbox-unsupported" };
    if (ck === "CASCADER") return { status: "skipped", reason: "cascader-unsupported" };
    if (kind === "date") return writeDate(plan, deps);
    if (ck === "DATE_TRIPLE_SELECT") return { status: "skipped", reason: "control-kind-mismatch" };
    if (ck === "DATE_CUSTOM" || ck === "DATE_NATIVE_DAY" || ck === "DATE_NATIVE_MONTH") {
      return writeSelectCustom(plan);
    }
    if (ck === "RADIO_GROUP") return writeRadio(plan);
    if (ck === "SELECT_NATIVE") return writeSelectNative(plan);
    if (ck === "SELECT_CUSTOM" || ck === "PICKER") return writeSelectCustom(plan);
    return writeText(plan);
  }

  // src/cards.js
  var FIELD_SEL2 = 'input, textarea, select, [contenteditable="true"], [role="combobox"]';
  var BTN_SEL = 'button,[role="button"],a,[class*="btn"],[class*="Btn"],[class*="button"]';
  var COMMIT_RE = /^(确认|确定|保存|完成|保存并关闭|确认保存|ok|save|confirm|done)$/i;
  var CANCEL_RE = /^(取消|放弃|cancel)$/i;
  var NEVER_RE = /(提交|投递|申请|报名|submit|apply)/i;
  var ERROR_SEL = '.ant-form-explain,.ant-form-item-explain,.el-form-item__error,.ivu-form-item-error-tip,[class*="error-tip"],[class*="errorTip"],[class*="error-msg"],[class*="errorMsg"],[class*="form-error"]';
  var btnText = (el) => String(el && el.textContent || "").replace(/\s+/g, "").trim();
  function editableFieldsIn(root) {
    if (!root || !root.querySelectorAll) return [];
    return [...root.querySelectorAll(FIELD_SEL2)].filter((el) => {
      if (el.disabled) return false;
      if (el.tagName === "INPUT" && /^(hidden|submit|button|reset|image)$/i.test(el.type || "")) return false;
      return true;
    });
  }
  function insideControl(node, stop) {
    let n = node.parentElement;
    for (let d = 0; n && n !== stop && d < 5; d++, n = n.parentElement) {
      if (n.matches && n.matches(FIELD_SEL2)) return true;
      if (n.querySelector && n.querySelector(FIELD_SEL2)) return true;
    }
    return false;
  }
  function readonlyTextOf(area) {
    if (!area) return "";
    const doc = area.ownerDocument || document;
    const walker = doc.createTreeWalker(
      area,
      4
      /* SHOW_TEXT */
    );
    let out = "";
    let n;
    let guard = 0;
    while ((n = walker.nextNode()) && guard++ < 5e3) {
      const t = String(n.textContent || "").trim();
      if (!t) continue;
      if (insideControl(n, area)) continue;
      out += " " + t;
    }
    return out;
  }
  function areasOf(category, model) {
    const names = [category.name, ...category.sectionKeys || []].filter(Boolean);
    const out = /* @__PURE__ */ new Set();
    for (const s of model && model.sections || []) {
      if (s.categoryId === category.id && s.container) out.add(s.container);
    }
    let btns = [];
    try {
      btns = [...document.querySelectorAll(BTN_SEL)].filter((b) => {
        const t = btnText(b);
        return t.length <= 20 && /(添加|新增|增加)/.test(t) && names.some((n) => t.includes(n));
      });
    } catch (_) {
    }
    for (const b of btns) {
      let n = b.parentElement;
      for (let d = 0; n && n !== document.body && d < 6; d++, n = n.parentElement) {
        const heads = n.querySelectorAll('[class*="title"],[class*="Title"],[class*="header"],h1,h2,h3,h4,h5,legend');
        const hit = [...heads].some((h) => {
          if (h.contains(b)) return false;
          const t = normalize(h.textContent).slice(0, 20);
          return names.some((k) => t.includes(normalize(k)));
        });
        if (hit) {
          out.add(n);
          break;
        }
      }
    }
    return [...out];
  }
  function variantsOf(field, raw) {
    const v = String(raw ?? "").trim();
    if (!v) return [];
    const out = /* @__PURE__ */ new Set([normalize(v)]);
    if (field && field.enumRef && ENUMS[field.enumRef]) {
      const nv = normalize(v);
      for (const syns of Object.values(ENUMS[field.enumRef])) {
        if (syns.some((s) => normalize(s) === nv)) syns.forEach((s) => out.add(normalize(s)));
      }
    }
    return [...out].filter((x) => [...x].length >= 2 || /^\d+$/.test(x));
  }
  function recordShownIn(text, record, category, strongSlots) {
    const fields = category.fields.filter((f) => f.kind !== "upload" && f.kind !== "date");
    const filled = fields.filter((f) => String(record[f.label] ?? "").trim());
    if (!filled.length) return false;
    const hit = (f) => variantsOf(f, record[f.label]).some((v) => text.includes(v));
    const strong = filled.filter((f) => strongSlots.includes(f.slot));
    if (strong.length) return strong.every(hit);
    const short = filled.filter((f) => String(record[f.label]).length <= 30);
    if (!short.length) return false;
    const n = short.filter(hit).length;
    return short.length === 1 ? n === 1 : n >= Math.ceil(short.length * 0.6) && n >= 2;
  }
  function withoutSavedRecords(profile, model, strongKeys = {}) {
    const log = [];
    const saved = [];
    const next = { ...profile };
    for (const category of CATEGORIES) {
      if (!category.multiple || category.custom) continue;
      const records = profile[category.id];
      if (!Array.isArray(records) || !records.length) continue;
      let text = "";
      try {
        text = normalize(areasOf(category, model).map(readonlyTextOf).join(" "));
      } catch (_) {
        text = "";
      }
      if (!text) continue;
      const keep = [];
      records.forEach((r, i) => {
        if (r && typeof r === "object" && recordShownIn(text, r, category, strongKeys[category.id] || [])) {
          saved.push({ categoryId: category.id, recordIndex: i });
          log.push(`${category.name} 第 ${i + 1} 段已保存在页面上，不再重复添加`);
        } else {
          keep.push(r);
        }
      });
      if (keep.length !== records.length) next[category.id] = keep;
    }
    return { profile: next, saved, log };
  }
  function cardRootOf(block, section) {
    const els = (block && block.fields || []).map((f) => f.el).filter(Boolean);
    if (!els.length) return null;
    let root = els[0].parentElement;
    while (root && !els.every((e) => root.contains(e))) root = root.parentElement;
    if (!root || root === document.body) return null;
    const others = (section && section.blocks || []).filter((b) => b !== block).flatMap((b) => (b.fields || []).map((f) => f.el));
    let best = others.some((e) => root.contains(e)) ? null : root;
    let n = best;
    for (let d = 0; n && d < 2; d++) {
      if (findCommitIn(n)) return n;
      const up = n.parentElement;
      if (!up || up === document.body || others.some((e) => up.contains(e))) break;
      n = up;
    }
    return best;
  }
  function findCommitIn(root) {
    if (!root || !root.querySelectorAll) return null;
    let btns = [];
    try {
      btns = [...root.querySelectorAll(BTN_SEL)].filter((b) => isVisible(b) && !b.disabled);
    } catch (_) {
      return null;
    }
    btns = btns.filter((b) => !b.querySelector(FIELD_SEL2));
    const commit = btns.find((b) => {
      const t = btnText(b);
      return t && COMMIT_RE.test(t) && !NEVER_RE.test(t);
    });
    if (!commit) return null;
    const hasCancel = btns.some((b) => CANCEL_RE.test(btnText(b)));
    return hasCancel ? commit : null;
  }
  function errorsIn(root) {
    if (!root || !root.querySelectorAll) return [];
    return [...root.querySelectorAll(ERROR_SEL)].filter((e) => isVisible(e)).map((e) => String(e.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 5);
  }
  function committed(root, btn) {
    if (!root.isConnected) return true;
    if (!editableFieldsIn(root).some(isVisible)) return true;
    if (!btn.isConnected || !isVisible(btn)) return true;
    return false;
  }
  async function commitCards(targets) {
    const rows = [];
    for (const t of targets) {
      const root = cardRootOf(t.block, t.section);
      const btn = root && findCommitIn(root);
      if (!btn) continue;
      clickEl(btn);
      let ok = false;
      try {
        ok = await waitFor(() => committed(root, btn), 1200, 80);
      } catch (_) {
        ok = committed(root, btn);
      }
      await sleep(120);
      const base = {
        section: t.section.title || "",
        categoryId: t.section.categoryId || "",
        block: t.block.index,
        label: `「${btnText(btn)}」本段`,
        slot: "",
        value: "",
        kind: "card",
        controlKind: "CARD_COMMIT"
      };
      if (ok) {
        rows.push({ ...base, status: "filled", via: "card-commit", note: "card-committed" });
      } else {
        const errs = errorsIn(root);
        rows.push({
          ...base,
          status: "failed",
          reason: "card-commit-blocked",
          note: errs.length ? errs.join("；") : "点了确认但卡片没收起（可能有必填项没填）"
        });
      }
    }
    return rows;
  }

  // src/bridge.js
  var bridge_exports = {};
  __export(bridge_exports, {
    ensureId: () => ensureId,
    optionValue: () => optionValue,
    ping: () => ping,
    reactClick: () => reactClick,
    readModel: () => readModel,
    setModelValue: () => setModelValue
  });
  var seq = 0;
  var pending = /* @__PURE__ */ new Map();
  function onResponse(e) {
    let msg;
    try {
      msg = JSON.parse(e.detail);
    } catch (_) {
      return;
    }
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    p.resolve(msg);
  }
  var listening = false;
  function ensureListener() {
    if (listening) return;
    document.addEventListener("saa-rw-response", onResponse);
    listening = true;
  }
  function call(op, payload = {}, timeout = 1400) {
    ensureListener();
    return new Promise((resolve) => {
      const id = `r${++seq}`;
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ ok: false, reason: "bridge-timeout" });
      }, timeout);
      pending.set(id, {
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        }
      });
      try {
        document.dispatchEvent(
          new CustomEvent("saa-rw-request", { detail: JSON.stringify({ id, op, ...payload }) })
        );
      } catch (e) {
        clearTimeout(timer);
        pending.delete(id);
        resolve({ ok: false, reason: "bridge-dispatch-failed" });
      }
    });
  }
  function ensureId(el) {
    if (!el) return "";
    let id = el.getAttribute("data-saa-id");
    if (!id) {
      id = `e${++seq}_${Math.random().toString(36).slice(2, 8)}`;
      el.setAttribute("data-saa-id", id);
    }
    return id;
  }
  async function ping() {
    const r = await call("ping", {}, 600);
    return !!r.ok;
  }
  function reactClick(el) {
    return call("reactClick", { elId: ensureId(el) }, 900);
  }
  function setModelValue(el, value) {
    return call("setFieldValue", { elId: ensureId(el), value }, 1600);
  }
  function readModel(el) {
    return call("readModel", { elId: ensureId(el) }, 700);
  }
  function optionValue(el) {
    return call("optionValue", { elId: ensureId(el) }, 700);
  }

  // src/fill.js
  var blockIds = /* @__PURE__ */ new WeakMap();
  var blockSeq = 0;
  function blockIdOf(plan) {
    const b = plan.block;
    if (!b || typeof b !== "object") return `${plan.sectionTitle || ""}#${plan.blockIndex}`;
    if (!blockIds.has(b)) blockIds.set(b, ++blockSeq);
    return "b" + blockIds.get(b);
  }
  function hasValue(v) {
    if (v == null) return false;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return String(v).trim() !== "";
  }
  async function fillPage(profile, options = {}) {
    const bridge = options.bridge || bridge_exports;
    resetPanelMemo();
    let model;
    let plans;
    let expand = { added: 0, log: [] };
    let savedLog = [];
    try {
      model = buildFormModel();
      try {
        const sv = withoutSavedRecords(profile, model, STRONG_KEYS);
        profile = sv.profile;
        savedLog = sv.log;
      } catch (_) {
      }
      if (options.expand !== false) {
        try {
          const ex = await expandSections(profile, model, options);
          if (ex && ex.model) {
            expand = ex;
            model = ex.model;
          }
        } catch (e) {
          expand = { added: 0, log: ["扩充经历区块时出错：" + String(e && e.message || e)] };
          model = buildFormModel();
        }
      }
      if (savedLog.length) expand = { ...expand, log: [...savedLog, ...expand.log || []] };
      plans = bind(model, profile);
      plans.sort((a, b) => (a.weak ? 1 : 0) - (b.weak ? 1 : 0));
    } catch (e) {
      return {
        found: false,
        error: "扫描或绑定失败：" + String(e && e.message || e),
        total: 0,
        filled: 0,
        lowConfidence: 0,
        skipped: 0,
        failed: 0,
        empty: 0,
        repeat: { added: 0, log: [] },
        sections: [],
        results: []
      };
    }
    const results = [];
    const planResults = /* @__PURE__ */ new Map();
    const seen = /* @__PURE__ */ new Set();
    const filledTexts = [];
    for (const plan of plans) {
      const base = {
        section: plan.sectionTitle || "",
        categoryId: plan.categoryId || "",
        block: plan.blockIndex,
        label: plan.label || plan.field.label,
        slot: plan.slot || "",
        value: typeof plan.value === "object" ? "[文件]" : String(plan.value ?? ""),
        kind: plan.kind || "",
        controlKind: plan.field.controlKind,
        container: tagOf(plan.field.container)
      };
      if (plan.dup) {
        results.push({
          ...base,
          status: "skipped",
          reason: "duplicate-slot",
          parts: (plan.field && plan.field.labelParts || []).slice(0, 4),
          path: pathOf(plan.field.el)
        });
        continue;
      }
      if (!plan.slot) {
        results.push({
          ...base,
          status: "skipped",
          reason: "label-uncertain",
          parts: (plan.field && plan.field.labelParts || []).slice(0, 4),
          el: tagOf(plan.field.el),
          path: pathOf(plan.field.el)
        });
        continue;
      }
      if (!plan.hasRecord) {
        results.push({ ...base, status: "skipped", reason: "no-record" });
        continue;
      }
      if (!hasValue(plan.value)) {
        results.push({ ...base, status: "empty" });
        continue;
      }
      const key = `${blockIdOf(plan)}:${plan.categoryId}:${plan.slot}`;
      const slotKey = `${plan.categoryId}:${plan.blockIndex}:${plan.slot}`;
      if (seen.has(key) || plan.weak && seen.has(slotKey)) continue;
      seen.add(key);
      seen.add(slotKey);
      let res;
      try {
        plan.resolved = plan.kind === "upload" ? null : resolveValue(plan.value, plan.enumRef || null);
        res = await writeField(plan, { bridge });
      } catch (e) {
        res = { status: "failed", reason: "exception:" + String(e && e.message || e).slice(0, 80) };
      }
      const pushed = { ...base, ...res, resolvedCode: plan.resolved && plan.resolved.code || "" };
      results.push(pushed);
      planResults.set(plan, pushed);
      if (res.status !== "filled") results[results.length - 1].path = pathOf(plan.field.el);
      if (res.status === "filled" && res.via === "native" && (plan.kind === "text" || plan.kind === "number")) {
        filledTexts.push({ plan, res: pushed });
      }
      await sleep(40);
    }
    const readVal = (el) => {
      try {
        return String(el.value ?? "").trim();
      } catch (_) {
        return null;
      }
    };
    let clearedAny = false;
    const recheckCleared = async (maxAttempts) => {
      for (const item of filledTexts) {
        if (item.dead) continue;
        const el = item.plan.field && item.plan.field.el;
        if (!el || !el.tagName) {
          item.dead = true;
          continue;
        }
        const cur = readVal(el);
        if (cur == null) {
          item.dead = true;
          continue;
        }
        if (cur) continue;
        clearedAny = true;
        let v = String(item.plan.value ?? "");
        if (item.plan.kind === "number") v = numericOf(v) || v;
        if (!v.trim()) {
          item.dead = true;
          continue;
        }
        const waits = [80, 300, 500, 800];
        let recovered = false;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            el.focus();
          } catch (_) {
          }
          setNativeValue(el, v);
          fire(el, "input", { bubbles: true });
          fire(el, "change", { bubbles: true });
          await sleep(waits[Math.min(attempt - 1, waits.length - 1)]);
          let now = readVal(el);
          if (now) {
            await sleep(450);
            now = readVal(el);
          }
          if (now) {
            item.res.readback = now;
            item.res.note = "recovered-after-clear";
            item.res.status = "filled";
            delete item.res.reason;
            delete item.res.path;
            recovered = true;
            break;
          }
        }
        if (!recovered) {
          item.res.status = "failed";
          item.res.reason = "cleared-by-site";
          item.res.path = pathOf(item.plan.field.el);
        }
      }
    };
    await recheckCleared(4);
    if (clearedAny) {
      await sleep(1200);
      await recheckCleared(1);
    }
    if (options.commitCards !== false) {
      try {
        const targets = [];
        const seenBlocks = /* @__PURE__ */ new Set();
        plans.forEach((plan, i) => {
          const r = planResults.get(plan);
          if (!r || r.status !== "filled" || !plan.block || !plan.section) return;
          const cat = categoryById(plan.section.categoryId || plan.categoryId);
          if (!cat || !cat.multiple) return;
          if (seenBlocks.has(plan.block)) return;
          seenBlocks.add(plan.block);
          targets.push({ section: plan.section, block: plan.block, order: i });
        });
        results.push(...await commitCards(targets));
      } catch (e) {
        results.push({ section: "", label: "卡片确认", status: "failed", reason: "exception:" + String(e && e.message || e).slice(0, 80) });
      }
    }
    return summarize(withCustomDiagnostics(profile, model, results), model, expand);
  }
  function withCustomDiagnostics(profile, model, results) {
    let defined;
    try {
      defined = customFieldsOf(profile);
    } catch (_) {
      return results;
    }
    if (!defined.length) return results;
    const matched = new Set(results.map((r) => r.slot).filter(Boolean));
    const categoriesInPlay = new Set(results.map((r) => r.categoryId).filter(Boolean));
    for (const s of model && model.sections || []) {
      if (s && s.categoryId) categoriesInPlay.add(s.categoryId);
    }
    const extra = [];
    for (const f of defined) {
      if (matched.has(f.slot)) continue;
      if (f.categoryId !== "custom" && !categoriesInPlay.has(f.categoryId)) continue;
      extra.push({
        section: "",
        categoryId: f.categoryId,
        block: 0,
        label: f.name,
        slot: f.slot,
        value: f.value,
        kind: "text",
        controlKind: "",
        status: "skipped",
        reason: "custom-no-match"
      });
    }
    return extra.length ? [...results, ...extra] : results;
  }
  function summarize(results, model, expand) {
    const filled = results.filter((r) => r.status === "filled");
    const lowConfidence = filled.filter((r) => r.lowConfidence);
    const skipped = results.filter((r) => r.status === "skipped");
    const failed = results.filter((r) => r.status === "failed");
    const empty = results.filter((r) => r.status === "empty");
    const reasonCounts = {};
    for (const r of results) {
      if (!r.reason) continue;
      reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
    }
    return {
      found: results.length > 0,
      total: results.length,
      filled: filled.length,
      lowConfidence: lowConfidence.length,
      skipped: skipped.length,
      failed: failed.length,
      empty: empty.length,
      repeat: { added: expand && expand.added || 0, log: expand && expand.log || [] },
      sections: (model.sections || []).map((s) => ({
        title: s.title,
        blocks: (s.blocks || []).length,
        fields: (s.blocks || []).reduce((n, b) => n + (b.fields || []).length, 0)
      })),
      reasonCounts,
      results
    };
  }

  // src/content-entry.js
  if (!window.__saaContentReady) {
    window.__saaContentReady = true;
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || msg.type !== "FILL_FORM") return false;
      (async () => {
        try {
          const report = await fillPage(msg.profile || {}, { bridge: bridge_exports });
          sendResponse(report);
        } catch (e) {
          sendResponse({ error: String(e && e.message || e), found: false });
        }
      })();
      return true;
    });
  }
})();
