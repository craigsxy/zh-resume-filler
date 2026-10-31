(() => {
  // src/schema.js
  var SCHEMA_VERSION = 2;
  var T = (label, slot, alias, kind = "text") => ({ label, slot, kind, alias });
  var A = (label, slot, alias) => ({ label, slot, kind: "textarea", alias });
  var N = (label, slot, alias) => ({ label, slot, kind: "number", alias });
  var E = (label, slot, enumRef, alias) => ({ label, slot, kind: "enum", enumRef, alias });
  var D = (label, slot, precision, alias) => ({ label, slot, kind: "date", precision, alias });
  var U = (label, slot, alias) => ({ label, slot, kind: "upload", alias });
  var Y = (label, slot, alias) => E(label, slot, "yesNo", alias);
  var CATEGORIES = [
    {
      id: "personal",
      name: "个人信息",
      multiple: false,
      sectionKeys: ["个人信息", "基本信息", "个人资料", "基本资料", "个人基本信息", "个人信息填写", "联系方式", "其他个人信息"],
      fields: [
        T("姓名", "personal.name", ["姓名", "名字", "真实姓名", "中文姓名", "申请人姓名"]),
        T("姓名拼音", "personal.pinyin", ["姓名拼音", "拼音", "拼音姓名", "姓名全拼", "中文拼音"]),
        T("英文名", "personal.englishName", ["英文名", "英文姓名", "英文名字", "englishname"]),
        E("性别", "personal.gender", "gender", ["性别"]),
        D("出生日期", "personal.birth", "day", ["出生日期", "生日", "出生年月", "出生年月日"]),
        N("年龄", "personal.age", ["年龄", "周岁"]),
        T("国籍", "personal.nationality", ["国籍", "国家/地区", "国籍/地区"]),
        E("证件类型", "personal.idType", "idType", ["证件类型", "证件种类", "证件"]),
        T("证件号码", "personal.idNo", ["证件号码", "证件号", "身份证号", "身份证号码", "证件编号"]),
        E("政治面貌", "personal.politics", "politics", ["政治面貌", "政治背景"]),
        D("入党/入团时间", "personal.partyTime", "day", ["入党时间", "入团时间", "入团/入党时间", "入党/入团时间", "加入党组织时间", "入党日期"]),
        E("民族", "personal.ethnicity", "ethnicity", ["民族"]),
        E("婚姻状况", "personal.marital", "marital", ["婚姻状况", "婚姻状态", "婚否", "婚育状况"]),
        // 最高学历是"人"的属性（网申基本信息区常单独问一次），教育经历里的"学历"是"这段经历"的属性
        E("最高学历", "personal.highestDegree", "degreeLevel", ["最高学历", "最高学历层次"]),
        // 下面五项留空时会按"教育经历里学历最高的那段"自动带出（见 derive.js）
        E("最高学位", "personal.highestDegreeName", "degreeName", ["最高学位", "最高学历学位", "最高学历对应学位"]),
        T("毕业院校", "personal.gradSchool", ["毕业院校", "最高学历毕业院校", "最高学历院校"]),
        T("毕业专业", "personal.gradMajor", ["毕业专业", "最高学历专业", "最高学历所学专业"]),
        D("毕业时间", "personal.gradTime", "day", ["毕业时间", "最高学历毕业时间", "预计毕业时间", "毕业日期"]),
        E("学习形式", "personal.studyMode", "studyMode", ["最高学历学习形式", "学习形式", "培养方式"]),
        Y("是否应届生", "personal.freshGrad", ["是否应届生", "是否应届毕业生", "应届生", "是否应届"]),
        T("工作状态", "personal.workStatus", ["工作状态", "求职状态", "当前状态", "目前状态"]),
        N("工作年限", "personal.workYears", ["工作年限", "工作经验年限", "工龄", "工作年数"]),
        T("上一家公司", "personal.lastCompany", ["上一家公司", "最近工作单位", "最近公司", "目前公司", "当前公司", "现单位"]),
        T("籍贯", "personal.nativePlace", ["籍贯", "祖籍"]),
        T("生源地", "personal.origin", ["生源地", "生源所在地", "毕业生生源地"]),
        T("参加高考城市", "personal.gaokaoCity", ["参加高考城市", "高考所在地", "高考省份"]),
        D("高考时间", "personal.gaokaoTime", "day", ["高考时间", "高考年份", "参加高考时间"]),
        T("高考分数", "personal.gaokaoScore", ["高考分数", "高考成绩", "高考总分"]),
        T("高考科目", "personal.gaokaoSubjects", ["高考科目", "高考选科", "选考科目", "高考科类", "文理科"]),
        E("户口性质", "personal.hukouType", "hukouType", ["户口性质", "户籍性质", "户口类型", "户籍类型"]),
        T("户籍所在地", "personal.hukou", ["户籍所在地", "户口所在地", "户籍地", "户口所在地区"]),
        T("档案所在地", "personal.archive", ["档案所在地", "人事档案所在地", "档案存放地", "档案所在单位"]),
        T("当前所在城市", "personal.currentCity", ["当前所在城市", "现居城市", "所在城市", "目前所在城市", "现居住城市", "当前城市", "现所在城市", "居住城市", "现居住地城市"]),
        T("现居地址", "personal.address", ["现居地址", "现居住地址", "居住地址", "现住址", "目前居住地", "现居住地", "家庭住址"]),
        T("通讯地址", "personal.mailingAddress", ["通讯地址", "通信地址", "联系地址", "邮寄地址"]),
        T("邮政编码", "personal.postcode", ["邮政编码", "邮编"]),
        T("手机", "personal.mobile", ["手机", "手机号", "手机号码", "移动电话", "本人手机", "电话", "联系电话"]),
        T("邮箱", "personal.email", ["邮箱", "电子邮箱", "邮件", "email", "常用邮箱"]),
        T("微信号", "personal.wechat", ["微信号", "微信", "微信账号", "wechat"]),
        T("QQ号", "personal.qq", ["qq号", "qq", "qq号码"]),
        T("个人主页/作品链接", "personal.homepage", ["个人主页", "作品链接", "个人主页/作品链接", "个人网站", "作品集", "博客", "github", "代码仓库"]),
        T("英语等级", "personal.englishLevel", ["英语等级", "英语水平", "外语等级", "最高英语等级"]),
        T("专业技术职级", "personal.techTitle", ["专业技术职级", "职称", "专业技术资格", "技术职称"]),
        T("紧急联系人", "personal.emergencyContact", ["紧急联系人", "紧急联系人姓名"]),
        T("紧急联系人关系", "personal.emergencyRelation", ["紧急联系人关系", "与紧急联系人关系", "紧急联系人与本人关系"]),
        T("紧急联系电话", "personal.emergencyPhone", ["紧急联系电话", "紧急联系人电话", "紧急联系人手机"]),
        E("健康状况", "personal.health", "health", ["健康状况", "身体状况", "健康状态"]),
        E("血型", "personal.bloodType", "bloodType", ["血型"]),
        N("身高", "personal.height", ["身高", "身高cm"]),
        N("体重", "personal.weight", ["体重", "体重kg"]),
        Y("是否有长期病史", "personal.chronic", ["是否有长期病史", "有无长期病史", "是否有重大疾病", "有无重大疾病史", "既往病史"]),
        Y("是否有犯罪记录", "personal.criminal", ["是否有犯罪记录", "有无犯罪记录", "是否有违法犯罪记录", "有无违法记录"]),
        Y("是否服兵役", "personal.military", ["是否服兵役", "是否服过兵役", "是否曾服兵役", "兵役状况"]),
        Y("是否退伍军人", "personal.veteran", ["是否退伍军人", "是否为退伍军人", "退役军人"]),
        Y("是否保研", "personal.postgradRecommend", ["是否保研", "是否推免", "是否推荐免试", "是否推荐免试攻读研究生"]),
        Y("是否有留学经历", "personal.studyAbroad", ["是否有留学经历", "有无留学经历", "是否有海外留学经历", "是否留学生", "是否有海外经历"]),
        Y("是否贫困生", "personal.poverty", ["是否贫困生", "是否家庭经济困难", "是否为家庭经济困难学生"]),
        Y("是否色弱", "personal.colorWeak", ["是否色弱", "是否色盲", "是否色弱色盲", "有无色弱色盲", "辨色力"]),
        Y("是否具有境外身份", "personal.foreignStatus", ["是否具有境外身份", "是否有境外永久居留权", "是否有绿卡", "是否具有外国国籍"]),
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
        T("意向岗位", "intent.position", ["意向岗位", "应聘岗位", "期望职位", "求职岗位", "意向职位", "应聘职位", "目标岗位", "目标职位"]),
        T("意向城市", "intent.city", ["意向城市", "期望工作城市", "意向工作地点", "期望城市", "期望工作地点", "意向工作城市"]),
        T("面试城市", "intent.interviewCity", ["面试城市", "可参与面试城市", "面试地点", "笔试城市", "笔面试城市"]),
        T("意向行业", "intent.industry", ["意向行业", "期望行业", "期望从事行业"]),
        T("当前行业", "intent.currentIndustry", ["当前行业", "目前行业", "所在行业"]),
        T("期望薪资", "intent.salary", ["期望薪资", "期望月薪", "薪资要求", "期望薪酬", "期望工资", "期望税前月薪"]),
        T("期望年薪", "intent.yearSalary", ["期望年薪", "期望年收入"]),
        T("当前薪资", "intent.currentSalary", ["当前薪资", "目前薪资", "当前月薪", "目前月薪", "现薪资"]),
        D("到岗时间", "intent.onboard", "day", ["到岗时间", "可到岗时间", "最快到岗时间", "入职时间", "最早到岗时间", "预计到岗时间", "预计入职时间", "可入职时间"]),
        E("求职类型", "intent.jobType", "jobType", ["求职类型", "工作性质", "应聘类型"]),
        // 实习岗网申的高频问题（辉瑞 / 图谱 tupu360 一类站点都会问）
        D("最早可实习时间", "intent.internStart", "day", ["最早可实习时间", "毕业前最早可实习时间", "可实习开始时间", "可开始实习时间", "最早实习时间", "可实习时间"]),
        T("每周实习天数", "intent.daysPerWeek", ["每周实习天数", "每周可出勤天数", "每周可实习天数", "每周出勤天数", "每周到岗天数", "每周可工作天数", "一周可实习天数"]),
        T("实习时长", "intent.internDuration", ["实习时长", "可实习时长", "实习周期", "可实习月数", "实习期限", "可连续实习时长"]),
        T("是否服从调剂", "intent.adjust", ["是否服从调剂", "是否服从岗位调剂", "是否接受调剂", "服从调剂", "是否接受调配", "是否服从分配", "是否接受岗位调剂", "是否服从专业调剂"]),
        Y("是否有亲属在本公司", "intent.relative", ["是否有亲属在本公司", "是否有亲人在当前求职公司", "是否有亲属在本公司任职", "是否有亲属在我司", "有无亲属在本公司", "是否有亲友在本公司工作"]),
        T("信息来源", "intent.source", ["信息来源", "招聘信息来源", "你是从哪个渠道获取招聘信息的", "您是从哪个渠道获取招聘信息的", "获知渠道", "了解渠道", "信息获取渠道", "获取招聘信息渠道", "从何处得知招聘信息", "招聘渠道"])
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
        T("起止时间", "edu.period", ["起止时间", "在校时间", "就读时间", "起止日期", "学习时间"]),
        T("学校名称", "edu.school", ["学校名称", "学校", "毕业院校", "院校", "院校名称", "就读学校"]),
        T("学校城市", "edu.city", ["学校城市", "学校所在城市", "学校所在地", "院校所在地"]),
        E("学校类型", "edu.schoolType", "schoolType", ["学校类型", "院校类型", "学校性质", "院校层次", "学校层次"]),
        Y("是否海外学校", "edu.overseas", ["是否海外学校", "是否海外院校", "是否留学", "是否海外学校是否留学", "是否境外院校"]),
        T("学院名称", "edu.college", ["学院名称", "学院", "所在学院", "院系", "院系名称", "所在院系"]),
        // 专业类别必须单列：没有它时「专业类别」靠"包含专业"抢走 edu.major，
        // 真正的「专业名称」反而撞槽被跳过（tupu360 真机快照）
        T("专业类别", "edu.majorCategory", ["专业类别", "专业类型", "学科门类", "专业大类", "学科类别", "专业所属类别", "最高学历专业类别"]),
        T("专业名称", "edu.major", ["专业名称", "专业", "所学专业", "就读专业"]),
        // 别名里刻意不放"最高学历"：那是 personal.highestDegree 的别名。
        // 教育区块里出现"最高学历"时，靠"包含"打分（最高学历 ⊃ 学历）仍能落到这里。
        E("学历", "edu.degreeLevel", "degreeLevel", ["学历", "学历层次", "培养层次"]),
        Y("是否专升本", "edu.upgrade", ["是否专升本", "专升本"]),
        E("学历状态", "edu.status", "eduStatus", ["学历状态", "就读状态", "在读状态", "毕业状态"]),
        N("学制", "edu.years", ["学制", "学制年", "学习年限"]),
        D("学历授予日期", "edu.certDate", "day", ["学历授予日期", "学历证书授予日期", "毕业证书日期", "取得学历时间"]),
        E("学位", "edu.degreeName", "degreeName", ["学位", "所获学位", "学位名称"]),
        E("学位类型", "edu.degreeType", "degreeType", ["学位类型", "学位性质", "学术学位专业学位"]),
        T("学位类别", "edu.degreeCategory", ["学位类别", "学位门类", "学科门类学位"]),
        T("学习形式", "edu.studyMode", ["学习形式", "培养方式", "学习方式", "就读形式", "教育形式", "教育方式"]),
        E("招生类别", "edu.enrollType", "enrollType", ["招生类别", "招生类型", "招生方式", "入学方式"]),
        Y("是否统招", "edu.unified", ["是否统招", "是否全日制统招", "统招"]),
        T("成绩（GPA）", "edu.gpa", ["成绩gpa", "gpa", "平均绩点", "绩点", "平均分", "成绩", "成绩绩点", "绩点gpa"]),
        N("挂科数", "edu.failCount", ["挂科数", "挂科数量", "不及格科目数", "挂科门数"]),
        T("班级排名", "edu.classRank", ["班级排名", "班级排名百分比", "班排名"]),
        N("专业人数", "edu.classSize", ["专业人数", "专业总人数", "年级人数"]),
        T("专业排名", "edu.rank", ["专业排名", "成绩排名", "排名", "专业排名百分比", "年级排名"]),
        T("学历证书编号", "edu.certNo", ["学历证书编号", "毕业证书编号", "毕业证编号"]),
        T("学位证书编号", "edu.degreeCertNo", ["学位证书编号", "学位证编号"]),
        T("学号", "edu.studentNo", ["学号", "在校学号"]),
        T("导师姓名", "edu.advisor", ["导师姓名", "导师", "指导老师", "指导教师"]),
        T("实验室名称", "edu.lab", ["实验室名称", "实验室", "所在实验室", "课题组"]),
        Y("是否国家重点实验室", "edu.keyLab", ["是否国家重点实验室", "是否重点实验室"]),
        Y("是否联合培养", "edu.joint", ["是否联合培养", "联合培养", "是否联培"]),
        T("辅导员姓名", "edu.counselor", ["辅导员姓名", "辅导员"]),
        T("辅导员联系方式", "edu.counselorPhone", ["辅导员联系方式", "辅导员电话", "辅导员手机"]),
        A("专业课程", "edu.courses", ["专业课程", "主修课程", "主要课程", "核心课程"]),
        A("研究方向", "edu.research", ["研究方向", "研究领域", "课题方向"]),
        T("毕业论文", "edu.thesis", ["毕业论文", "毕业论文题目", "学位论文", "论文题目"]),
        A("专业描述", "edu.majorDesc", ["专业描述", "专业方向描述", "专业介绍"]),
        A("教育描述", "edu.desc", ["教育描述", "教育经历描述", "在校情况", "在校表现"])
      ]
    },
    {
      id: "internships",
      name: "实习经历",
      multiple: true,
      sectionKeys: ["实习经历", "实习经验", "实习情况", "实习及工作经历", "实习工作经历"],
      fields: [
        D("开始时间", "exp.start", "day", ["开始时间", "起始时间", "开始日期", "入职时间", "入职日期", "实习开始日期", "实习开始时间"]),
        D("结束时间", "exp.end", "day", ["结束时间", "结束日期", "离职时间", "离职日期", "实习结束日期", "实习结束时间"]),
        T("起止时间", "exp.period", ["起止时间", "实习时间", "起止日期", "实习起止时间", "在职时间"]),
        T("单位名称", "exp.company", ["单位名称", "公司名称", "实习单位", "实习公司", "工作单位", "公司/组织名称", "组织名称", "企业名称", "实习单位名称", "公司/单位名称", "单位/公司名称", "实习公司名称", "公司"]),
        T("公司规模", "exp.companySize", ["公司规模", "企业规模", "单位规模", "公司人数"]),
        T("所属行业", "exp.industry", ["所属行业", "公司行业", "行业", "单位行业"]),
        T("实习岗位", "exp.position", ["实习岗位", "实习岗位名称", "岗位名称", "职位名称", "实习职位", "实习职位名称", "担任职位", "岗位", "职位", "所任职位"]),
        T("所在部门", "exp.department", ["所在部门", "部门", "实习部门", "任职部门", "所属部门"]),
        T("实习地点", "exp.location", ["实习地点", "实习城市", "工作地点", "工作城市", "实习地址", "实习所在地区"]),
        Y("是否海外经历", "exp.overseas", ["是否海外经历", "是否海外实习", "是否境外"]),
        T("用工性质", "exp.empType", ["用工性质", "工作性质", "雇佣类型", "工作类型"]),
        T("职位年薪", "exp.salary", ["职位年薪", "薪资", "月薪", "实习薪资", "薪酬"]),
        T("证明人姓名", "exp.refName", ["证明人姓名", "证明人", "直属上级", "上级姓名", "推荐人"]),
        T("证明人联系方式", "exp.refPhone", ["证明人联系方式", "证明人电话", "上级联系方式", "证明人手机"]),
        T("证明人职位", "exp.refTitle", ["证明人职位", "证明人职务", "上级职位"]),
        A("实习内容", "exp.desc", ["实习内容", "工作内容", "实习描述", "工作描述", "实习职责", "工作职责", "实习工作职责/内容", "实习职责/内容", "工作职责/内容", "主要职责", "职责描述", "工作内容描述", "实习工作内容"]),
        A("离职原因", "exp.leaveReason", ["离职原因", "离开原因", "实习离职原因"])
      ]
    },
    {
      id: "projects",
      name: "项目经历",
      multiple: true,
      sectionKeys: ["项目经历", "项目经验", "科研经历", "科研项目经历", "科研经验", "科研及项目经历", "项目信息"],
      fields: [
        T("项目名称", "proj.name", ["项目名称", "项目", "项目名", "科研项目名称", "课题名称"]),
        T("项目职务", "proj.role", ["项目职务", "担任角色", "项目角色", "角色", "担任职务", "项目中的角色"]),
        T("团队规模", "proj.teamSize", ["团队规模", "团队人数", "项目人数", "项目规模"]),
        T("实践方式", "proj.type", ["实践方式", "项目类型", "项目性质", "项目来源"]),
        Y("是否海外经历", "proj.overseas", ["是否海外经历", "是否海外项目"]),
        D("开始时间", "proj.start", "day", ["开始时间", "起始时间", "开始日期", "项目开始时间", "项目开始日期"]),
        D("结束时间", "proj.end", "day", ["结束时间", "结束日期", "完成时间", "项目结束时间", "项目结束日期"]),
        T("起止时间", "proj.period", ["起止时间", "项目时间", "起止日期", "项目起止时间"]),
        T("项目地址", "proj.location", ["项目地址", "项目地点", "项目所在地", "项目所在地区"]),
        T("项目链接", "proj.link", ["项目链接", "项目地址链接", "项目网址", "链接"]),
        T("证明人姓名", "proj.refName", ["证明人姓名", "证明人", "项目证明人", "指导老师"]),
        T("证明人联系方式", "proj.refPhone", ["证明人联系方式", "证明人电话"]),
        T("证明人职位", "proj.refTitle", ["证明人职位", "证明人职务"]),
        A("项目描述", "proj.desc", ["项目描述", "项目内容", "项目简介", "项目介绍", "项目详细描述"]),
        A("项目职责", "proj.duty", ["项目职责", "个人职责", "主要职责", "负责内容", "职责与贡献", "个人贡献"]),
        A("项目成果", "proj.result", ["项目成果", "项目业绩", "成果", "项目结果", "取得成果"])
      ]
    },
    {
      id: "positions",
      name: "校园经历",
      multiple: true,
      sectionKeys: ["在校职务", "校园经历", "学生工作", "社团经历", "在校经历", "学生干部经历", "校内职务", "社团活动"],
      fields: [
        T("组织名称", "pos.org", ["组织名称", "社团名称", "组织/社团名称", "所在组织", "学生组织", "社团/组织"]),
        T("在校职务类别", "pos.type", ["在校职务类别", "职务类别"]),
        T("在校职务名称", "pos.name", ["在校职务名称", "在校职务", "职务名称", "担任职务", "职务"]),
        D("开始时间", "pos.start", "day", ["开始时间", "起始时间", "开始日期", "任职开始时间"]),
        D("结束时间", "pos.end", "day", ["结束时间", "结束日期", "离任时间", "任职结束时间"]),
        T("起止时间", "pos.period", ["起止时间", "任职时间", "起止日期"]),
        A("在校职务描述", "pos.desc", ["在校职务描述", "职务描述", "工作描述", "经历描述", "主要工作"])
      ]
    },
    {
      id: "work",
      name: "工作经历",
      multiple: true,
      // 应届生网申的「工作经历」大多就是实习：本分类没填时，自动用实习经历去填（见 derive.js）
      sectionKeys: ["工作经历", "工作经验", "职业经历", "工作履历", "全职经历"],
      fields: [
        D("开始时间", "work.start", "day", ["开始时间", "起始时间", "开始日期", "入职时间", "入职日期"]),
        D("结束时间", "work.end", "day", ["结束时间", "结束日期", "离职时间", "离职日期"]),
        T("起止时间", "work.period", ["起止时间", "工作时间", "在职时间", "起止日期"]),
        T("单位名称", "work.company", ["单位名称", "公司名称", "工作单位", "企业名称", "公司/组织名称", "公司", "组织名称"]),
        T("公司规模", "work.companySize", ["公司规模", "企业规模", "单位规模"]),
        T("所属行业", "work.industry", ["所属行业", "公司行业", "行业"]),
        T("职位", "work.position", ["职位", "职位名称", "岗位", "岗位名称", "担任职位", "所任职位"]),
        T("所在部门", "work.department", ["所在部门", "部门", "所属部门"]),
        T("工作地点", "work.location", ["工作地点", "工作城市", "工作地址"]),
        T("用工性质", "work.empType", ["用工性质", "工作性质", "雇佣类型"]),
        T("薪资", "work.salary", ["薪资", "月薪", "年薪", "税前月薪", "职位年薪"]),
        T("证明人姓名", "work.refName", ["证明人姓名", "证明人", "直属上级"]),
        T("证明人联系方式", "work.refPhone", ["证明人联系方式", "证明人电话"]),
        T("证明人职位", "work.refTitle", ["证明人职位", "证明人职务"]),
        A("工作内容", "work.desc", ["工作内容", "工作描述", "工作职责", "主要职责", "职责描述"]),
        A("离职原因", "work.leaveReason", ["离职原因", "离开原因"])
      ]
    },
    {
      id: "practice",
      name: "社会实践",
      multiple: true,
      sectionKeys: ["在校实践", "实践经历", "科研及实践", "实践活动经验", "实践活动", "社会实践", "校内外实践", "实践经验", "活动经历", "志愿者经历", "志愿服务"],
      fields: [
        T("在校科研及实践项目", "prac.project", ["在校科研及实践项目", "实践项目", "活动名称", "实践名称", "实践活动名称", "项目名称"]),
        T("担任角色", "prac.role", ["担任角色", "项目角色", "角色", "职务"]),
        D("开始时间", "prac.start", "day", ["开始时间", "起始时间", "开始日期"]),
        D("结束时间", "prac.end", "day", ["结束时间", "结束日期", "完成时间"]),
        T("起止时间", "prac.period", ["起止时间", "实践时间", "起止日期"]),
        A("实践描述", "prac.desc", ["实践描述", "项目描述", "实践内容", "项目内容", "活动描述", "活动内容", "经历描述"])
      ]
    },
    {
      id: "awards",
      name: "获奖经历",
      multiple: true,
      sectionKeys: ["获奖情况", "获奖经历", "荣誉奖励", "获奖信息", "奖励情况", "荣誉奖项", "获奖经验", "奖励荣誉", "所获荣誉", "荣誉证书", "获奖记录", "奖学金"],
      fields: [
        T("奖项", "award.name", ["奖项", "奖项名称", "获奖名称", "获奖情况", "荣誉名称", "奖励名称", "所获奖项", "奖学金名称"]),
        T("颁发机构", "award.issuer", ["颁发机构", "颁奖单位", "授予单位", "颁发单位", "授奖单位"]),
        D("获奖时间", "award.time", "day", ["获奖时间", "获奖日期", "获奖年月", "获得时间", "获奖年份"]),
        D("结束时间", "award.end", "day", ["结束时间", "获奖结束时间"]),
        E("获奖级别", "award.level", "awardLevel", ["获奖级别", "奖项级别", "奖励级别", "级别"]),
        E("奖励类型", "award.type", "awardType", ["奖励类型", "获奖类型", "个人团体"]),
        E("奖励等级", "award.grade", "awardGrade", ["奖励等级", "获奖等级", "奖项等级", "等级", "名次"]),
        A("获奖描述", "award.desc", ["获奖描述", "奖项描述", "获奖说明", "奖项说明"])
      ]
    },
    {
      id: "certificates",
      name: "证书",
      multiple: true,
      sectionKeys: ["证书", "证书信息", "资格证书", "职业资格", "技能证书", "证书情况", "证书认证"],
      fields: [
        T("证书名称", "cert.name", ["证书名称", "证书", "资格证书名称", "证书全称"]),
        D("获得时间", "cert.time", "day", ["获得时间", "获证时间", "取得时间", "发证日期", "颁发时间", "获得日期"]),
        T("颁发机构", "cert.issuer", ["颁发机构", "发证机构", "发证单位", "颁发单位"]),
        T("证书编号", "cert.no", ["证书编号", "证书号"]),
        T("证书成绩", "cert.score", ["证书成绩", "成绩", "分数", "等级"])
      ]
    },
    {
      id: "languages",
      name: "外语能力",
      multiple: true,
      sectionKeys: ["语言能力", "外语水平", "语言水平", "语言证书", "英语水平", "外语能力", "语言技能", "英语能力", "外语等级"],
      fields: [
        T("语言能力", "lang.name", ["语言能力", "语种", "语言", "外语语种"]),
        E("证书类型", "lang.certType", "certType", ["证书类型", "语言证书", "证书名称", "考试类型", "英语等级", "外语等级", "语言等级", "考试名称", "英语证书"]),
        T("语言成绩", "lang.score", ["语言成绩", "分数", "成绩", "等级", "考试成绩", "英语成绩", "分值"]),
        T("掌握程度", "lang.level", ["掌握程度", "熟练程度", "精通程度", "语言水平"]),
        T("听说能力", "lang.speak", ["听说能力", "听说水平", "口语能力"]),
        T("读写能力", "lang.write", ["读写能力", "读写水平"]),
        D("获得时间", "lang.time", "day", ["获得时间", "考试时间", "获证时间"])
      ]
    },
    {
      id: "skills",
      name: "技能专长",
      multiple: false,
      sectionKeys: ["技能专长", "专业技能", "技能特长", "技能信息", "个人技能", "技能"],
      fields: [
        A("技术技能", "skill.tech", ["技术技能", "专业技能", "技能特长", "专业技术技能", "技能"]),
        A("语言技能", "skill.lang", ["语言技能", "掌握的语言", "语言掌握"]),
        A("软件技能", "skill.software", ["软件技能", "计算机技能", "计算机能力", "计算机水平", "软件使用", "办公软件"]),
        // 留空时按「证书」列表的证书名称自动拼出来（见 derive.js）
        A("证书认证", "skill.certs", ["证书认证", "所获证书", "证书情况", "资格认证"]),
        A("软技能", "skill.soft", ["软技能", "沟通能力", "综合能力"])
      ]
    },
    {
      id: "family",
      name: "家庭情况",
      multiple: true,
      sectionKeys: ["家庭情况", "家庭成员", "家庭关系", "家庭信息", "主要家庭成员"],
      fields: [
        T("姓名", "family.name", ["成员姓名", "家庭成员姓名", "姓名", "名字"]),
        T("与本人关系", "family.relation", ["与本人关系", "关系", "称谓", "家庭成员关系"]),
        N("年龄", "family.age", ["年龄"]),
        E("政治面貌", "family.politics", "politics", ["政治面貌"]),
        T("工作单位", "family.company", ["工作单位", "所在单位", "单位"]),
        T("职务", "family.title", ["职务", "职位", "担任职务"]),
        T("工作所在地", "family.location", ["工作所在地", "工作地点", "所在地"]),
        T("联系电话", "family.phone", ["联系电话", "电话", "手机", "联系方式"])
      ]
    },
    {
      id: "patents",
      name: "专利信息",
      multiple: true,
      sectionKeys: ["专利信息", "专利", "专利情况", "知识产权", "发明专利"],
      fields: [
        T("专利名称", "patent.name", ["专利名称", "专利", "专利题目"]),
        T("专利号", "patent.no", ["专利号", "专利编号", "申请号", "授权号", "公开号"]),
        E("专利类型", "patent.type", "patentType", ["专利类型", "专利类别"]),
        T("专利状态", "patent.status", ["专利状态", "法律状态", "授权状态"]),
        D("申请时间", "patent.applyTime", "day", ["申请时间", "申请日期", "专利申请日"]),
        D("授权时间", "patent.grantTime", "day", ["授权时间", "授权日期", "授权公告日"]),
        T("发明人排名", "patent.rank", ["发明人排名", "排名", "本人排名", "发明人排序", "作者排名"]),
        A("专利描述", "patent.desc", ["专利描述", "专利简介", "专利摘要"])
      ]
    },
    {
      id: "publications",
      name: "论文发表",
      multiple: true,
      sectionKeys: ["论文", "专著", "发表", "出版物", "论文发表", "学术成果", "科研成果", "论文情况"],
      fields: [
        T("名称", "pub.name", ["名称", "论文名称", "专著名称", "论文专著名称", "题目", "论文题目", "论文标题"]),
        D("发布时间", "pub.time", "day", ["发布时间", "发表日期", "发表时间", "出版时间", "录用时间"]),
        T("期刊/会议", "pub.venue", ["期刊/会议", "期刊名称", "发表期刊", "会议名称", "刊物名称", "期刊", "出版社"]),
        T("作者排名", "pub.rank", ["作者排名", "作者排序", "本人排名", "第几作者", "排名"]),
        T("收录情况", "pub.index", ["收录情况", "检索情况", "收录类型", "期刊级别", "论文级别"]),
        T("论文链接", "pub.link", ["论文链接", "doi", "链接", "论文地址"]),
        A("论文描述", "pub.desc", ["论文描述", "论文摘要", "摘要", "成果描述"])
      ]
    },
    {
      id: "trainings",
      name: "培训经历",
      multiple: true,
      sectionKeys: ["培训经历", "培训经验", "培训情况", "培训信息", "进修经历"],
      fields: [
        T("培训机构", "train.org", ["培训机构", "培训单位", "培训组织", "机构名称"]),
        T("培训课程", "train.course", ["培训课程", "培训名称", "课程名称", "培训内容名称", "培训项目"]),
        D("开始时间", "train.start", "day", ["开始时间", "起始时间", "开始日期"]),
        D("结束时间", "train.end", "day", ["结束时间", "结束日期"]),
        T("起止时间", "train.period", ["起止时间", "培训时间", "起止日期"]),
        T("获得证书", "train.cert", ["获得证书", "培训证书", "证书"]),
        A("培训描述", "train.desc", ["培训描述", "培训内容", "培训说明"])
      ]
    },
    {
      id: "additional",
      name: "附加信息",
      multiple: false,
      sectionKeys: ["附加信息", "其他信息", "自我评价", "补充信息", "其他说明", "个人评价", "自我介绍"],
      fields: [
        A("评价自身的优势和不足", "extra.selfEval", ["评价自身的优势和不足", "自我评价", "优势与不足", "个人评价", "自我描述", "自我介绍", "自我介绍自我评价"]),
        A("个人优势", "extra.strengths", ["个人优势", "个人特长", "优势特长", "核心优势"]),
        A("兴趣爱好", "extra.hobbies", ["兴趣爱好", "爱好", "兴趣"]),
        A("特殊技能", "extra.skills", ["特殊技能", "特长"]),
        A("职业规划", "extra.careerPlan", ["职业规划", "职业生涯规划", "未来规划", "职业发展规划"])
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
  var HINTS = {
    "personal.pinyin": "如 Shao Xinyi，英文表单常用",
    "personal.englishName": "完整英文名，如 Xinyi (Craig) Shao",
    "personal.age": "留空时按出生日期自动计算",
    "personal.highestDegreeName": "留空时取教育经历里学历最高那段的学位",
    "personal.gradSchool": "留空时取教育经历里学历最高那段的学校",
    "personal.gradMajor": "留空时取教育经历里学历最高那段的专业",
    "personal.gradTime": "留空时取教育经历里学历最高那段的毕业时间",
    "personal.studyMode": "留空时取最高学历那段的学习形式",
    "personal.workYears": "在读 / 应届填 0",
    "personal.nativePlace": "省 / 市 / 区，如 江苏省 / 扬州市 / 高邮市",
    "personal.hukou": "省 / 市 / 区",
    "personal.address": "如 上海市 / 黄浦区",
    "personal.englishLevel": "已取得的最高英语等级，如 托福 / CET-6",
    "personal.foreignStatus": "外国国籍、境外永久居留权（绿卡）等；与留学经历分开填",
    "intent.city": "多个用顿号或逗号隔开：上海、深圳、北京",
    "intent.salary": "税前月薪（元），或写「面议」",
    "intent.daysPerWeek": "照网页选项写，如 5天",
    "intent.internDuration": "照网页选项写，如 6个月以上",
    "intent.source": "如 官网 / 高校微信公众号；可写备选：官网 | 高校微信公众号（网页没有前一个就选后一个）",
    "edu.period": "留空时按开始/结束时间自动拼接",
    "edu.majorCategory": "如 工学 / 机械类；三级路径照写；各站分类不同可加备选：学术型硕士 / 工学 / 机械工程 | 信息科学与技术类",
    "edu.schoolType": "985 / 211 / 双一流 / QS前100 …",
    "edu.classRank": "百分比数字，前 5% 写 5",
    "edu.rank": "如 3/120 或前 5%",
    "edu.gpa": "如 3.8/4.0",
    "exp.period": "留空时按开始/结束时间自动拼接",
    "exp.desc": "实习工作内容，建议按 STAR 写 3~5 条",
    "proj.period": "留空时按开始/结束时间自动拼接",
    "proj.result": "量化成果，如 成本降低 18%",
    "pos.period": "留空时按开始/结束时间自动拼接",
    "work.company": "应届生可留空：网页的「工作经历」会自动用实习经历去填",
    "prac.period": "留空时按开始/结束时间自动拼接",
    "award.name": "奖学金直接写奖学金名字",
    "award.grade": "一等 / 二等 / 三等 / 特等 / 优秀奖 / 其他",
    "skill.certs": "留空时按「证书」列表自动生成",
    "train.period": "留空时按开始/结束时间自动拼接"
  };
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
      COMPANY: ["公司级", "企业", "企业级"],
      INTERNATIONAL: ["国际级", "国际"],
      OTHER: ["其他", "其它"]
    },
    yesNo: {
      Y: ["是", "有", "yes", "y", "是的"],
      N: ["否", "无", "没有", "no", "n", "不是"]
    },
    marital: {
      SINGLE: ["未婚", "单身"],
      MARRIED: ["已婚", "已婚未育", "已婚已育"],
      DIVORCED: ["离异", "离婚"],
      WIDOWED: ["丧偶"],
      SECRET: ["保密", "不愿透露"]
    },
    hukouType: {
      URBAN: ["城镇", "城镇户口", "非农业", "非农业户口", "非农", "城市"],
      RURAL: ["农村", "农村户口", "农业", "农业户口"],
      OTHER: ["其他", "其它"]
    },
    health: {
      GOOD: ["健康", "良好", "优秀", "身体健康"],
      FAIR: ["一般", "较好"],
      POOR: ["较差", "有慢性病"]
    },
    bloodType: {
      A: ["a型", "a"],
      B: ["b型", "b"],
      AB: ["ab型", "ab"],
      O: ["o型", "o"],
      OTHER: ["其他", "其它", "不详", "未知"]
    },
    studyMode: {
      FULL: ["全日制", "统招全日制", "脱产"],
      PART: ["非全日制", "在职", "业余"],
      CORR: ["函授", "远程教育", "网络教育", "自考", "成人教育"]
    },
    schoolType: {
      C9: ["c9", "c9联盟"],
      P985: ["985", "985工程", "985院校"],
      P211: ["211", "211工程", "211院校"],
      DOUBLE: ["双一流", "双一流建设高校", "一流大学", "一流学科"],
      QS100: ["qs前100", "qs100", "海外qs前100"],
      QS200: ["qs前200", "qs200"],
      OVERSEAS: ["海外院校", "海外", "境外院校"],
      NORMAL: ["普通本科", "普通院校", "一本", "二本"],
      OTHER: ["其他", "其它"]
    },
    eduStatus: {
      STUDYING: ["在读", "就读中", "在校"],
      GRADUATED: ["毕业", "已毕业", "正常毕业"],
      COMPLETED: ["结业"],
      DROPPED: ["肄业"]
    },
    degreeType: {
      ACADEMIC: ["学术学位", "学术型", "学硕"],
      PROFESSIONAL: ["专业学位", "专业型", "专硕"]
    },
    enrollType: {
      UNIFIED: ["统招", "统一招生", "普通招生"],
      SINGLE: ["单招", "单独招生"],
      UPGRADE: ["专升本"],
      DIRECTED: ["定向", "定向培养"],
      COMMISSIONED: ["委培", "委托培养"],
      OTHER: ["其他", "其它"]
    },
    awardType: {
      PERSONAL: ["个人", "个人奖"],
      TEAM: ["团体", "团队", "集体"]
    },
    awardGrade: {
      SPECIAL: ["特等奖", "特等"],
      FIRST: ["一等奖", "一等", "金奖", "第一名"],
      SECOND: ["二等奖", "二等", "银奖", "第二名"],
      THIRD: ["三等奖", "三等", "铜奖", "第三名"],
      EXCELLENT: ["优秀奖", "优秀", "鼓励奖"],
      OTHER: ["其他", "其它"]
    },
    patentType: {
      INVENTION: ["发明专利", "发明"],
      UTILITY: ["实用新型", "实用新型专利"],
      DESIGN: ["外观设计", "外观设计专利"],
      SOFTWARE: ["软件著作权", "软著"]
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
    "personal.highestDegree": ["学历", "学位", "学历层次", "培养层次", "毕业学历"],
    // 手机号旁的「国家/地区（区号）」下拉会被切成「国家」：这不是国籍
    "personal.nationality": ["国家", "国家地区", "国家区号", "地区"]
  };
  var DENY_RE = {
    "personal.highestDegree": /专业/,
    "edu.degreeLevel": /专业/,
    // 专业类别的标签一定带"类/门"（专业类别 / 学科门类 / 专业大类）；
    // 否则「最高学历」会因为"被最高学历专业类别包含"而和学历打成平手
    "edu.majorCategory": /^[^类门]*$/,
    "personal.nationality": /(区号|电话|手机)/
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

  // src/util.js
  var normalize = (s) => String(s ?? "").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
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

  // src/resolver.js
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
    return { code, labels: [...new Set(labels)], raw: text, confidence, enumRef: enumRef || null };
  }

  // src/panel/library.js
  var EXPORT_TYPE = "resume-fill-assistant/profile";
  var has = (v) => {
    if (v == null) return false;
    if (typeof v === "object") return !!v.dataUrl;
    return String(v).trim() !== "";
  };
  function completion(profile2) {
    let filled = 0;
    let total = 0;
    const byCategory = {};
    for (const c of CATEGORIES) {
      if (c.custom) continue;
      const records = Array.isArray(profile2 && profile2[c.id]) ? profile2[c.id] : [];
      const stat = { filled: 0, total: 0, records: [] };
      for (const r of records) {
        const rec = r || {};
        const missing = c.fields.filter((f) => !has(rec[f.label])).map((f) => f.label);
        const rs = { total: c.fields.length, filled: c.fields.length - missing.length, missing };
        stat.records.push(rs);
        stat.filled += rs.filled;
        stat.total += rs.total;
      }
      byCategory[c.id] = stat;
      filled += stat.filled;
      total += stat.total;
    }
    return { filled, total, percent: total ? Math.round(filled / total * 100) : 0, byCategory };
  }
  function sanitizeProfile(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const out = { schemaVersion: SCHEMA_VERSION };
    for (const c of CATEGORIES) {
      let v = src[c.id];
      if (!Array.isArray(v)) v = v && typeof v === "object" ? [v] : [];
      v = v.filter((r) => r && typeof r === "object").map((r) => ({ ...r }));
      if (!c.multiple) v = [v[0] || {}];
      out[c.id] = v;
    }
    return out;
  }
  function exportPayload(name, profile2) {
    return { type: EXPORT_TYPE, version: SCHEMA_VERSION, name: name || "我的简历", exportedAt: (/* @__PURE__ */ new Date()).toISOString(), data: profile2 };
  }
  function parseImport(text) {
    let obj;
    try {
      obj = JSON.parse(String(text || ""));
    } catch (_) {
      return { ok: false, error: "不是合法的 JSON 文件" };
    }
    if (!obj || typeof obj !== "object") return { ok: false, error: "文件内容为空" };
    const data = obj.type === EXPORT_TYPE && obj.data ? obj.data : obj;
    const known = CATEGORIES.some((c) => data && data[c.id] != null);
    if (!known) return { ok: false, error: "文件里没有可识别的简历分类（个人信息 / 教育经历…）" };
    return { ok: true, name: String(obj.name || "").trim() || "导入的简历", profile: sanitizeProfile(data) };
  }
  var DEGREE_RANK = { DOCTOR: 6, MASTER: 5, BACHELOR: 4, ASSOCIATE: 3, VOCATIONAL: 2, HIGH_SCHOOL: 1 };
  function sortEducation(list) {
    const rank = (r) => {
      const res = resolveValue(r && r["学历"], "degreeLevel");
      return res && DEGREE_RANK[res.code] || 0;
    };
    return (list || []).map((r, i) => ({ r, i })).sort((a, b) => rank(b.r) - rank(a.r) || String(b.r["开始时间"] || "").localeCompare(String(a.r["开始时间"] || "")) || a.i - b.i).map((x) => x.r);
  }
  function sampleProfile() {
    return sanitizeProfile({
      personal: [
        {
          姓名: "林小满",
          姓名拼音: "Lin Xiaoman",
          性别: "女",
          出生日期: "2002-03-18",
          民族: "汉族",
          政治面貌: "共青团员",
          婚姻状况: "未婚",
          证件类型: "身份证",
          手机: "13800000000",
          邮箱: "xiaoman@example.com",
          当前所在城市: "上海市",
          现居地址: "上海市 / 杨浦区",
          籍贯: "浙江省 / 杭州市",
          户口性质: "城镇",
          是否应届生: "是",
          工作年限: "0",
          英语等级: "CET-6",
          健康状况: "健康"
        }
      ],
      intention: [{ 意向岗位: "产品经理", 意向城市: "上海、杭州", 期望薪资: "面议", 是否服从调剂: "是", 信息来源: "官网" }],
      education: [
        { 学校名称: "示例大学", 学历: "硕士", 学位: "硕士", 专业名称: "计算机技术", 专业类别: "工学", 开始时间: "2024-09-01", 结束时间: "2027-06-30", 学习形式: "全日制", 学历状态: "在读" },
        { 学校名称: "样例理工大学", 学历: "本科", 学位: "学士", 专业名称: "软件工程", 专业类别: "工学", 开始时间: "2020-09-01", 结束时间: "2024-06-30", 学习形式: "全日制", 学历状态: "毕业" }
      ],
      internships: [
        { 单位名称: "示例科技有限公司", 实习岗位: "产品实习生", 所在部门: "用户增长部", 开始时间: "2025-06-01", 结束时间: "2025-09-30", 实习地点: "上海市", 实习内容: "负责新手引导改版，次日留存提升 6%" }
      ],
      projects: [{ 项目名称: "校园二手交易小程序", 项目职务: "负责人", 开始时间: "2023-03-01", 结束时间: "2023-07-01", 项目描述: "从 0 到 1 搭建并运营", 项目成果: "注册用户 3000+" }],
      awards: [{ 奖项: "校级一等奖学金", 获奖时间: "2023-10-01", 获奖级别: "校级", 奖励等级: "一等奖", 奖励类型: "个人" }],
      languages: [{ 语言能力: "英语", 证书类型: "CET-6", 语言成绩: "560" }],
      certificates: [{ 证书名称: "计算机二级（Python）", 获得时间: "2021-12-01" }],
      skills: [{ 技术技能: "SQL、Python 数据分析", 软件技能: "Figma、Axure、Office" }]
    });
  }

  // src/panel/index.js
  var STORAGE_KEY = "resumeProfile";
  var LIB_KEY = "resumeLibrary";
  var APPS_KEY = "applications";
  var APPS_VIEW = "__apps";
  var SETTINGS_VIEW = "__settings";
  var AI_KEY = "aiSettings";
  var UI_KEY = "uiSettings";
  var AI_DEFAULTS = { enabled: false, apiKey: "", baseUrl: "https://openrouter.ai/api/v1", model: "deepseek/deepseek-v4.1-flash" };
  var aiSettings = { ...AI_DEFAULTS };
  var uiSettings = { floatButton: true };
  var library = { activeId: "r1", items: [{ id: "r1", name: "我的简历", updatedAt: Date.now() }] };
  var applications = [];
  var lastTab = null;
  var CORE_SLOTS = /* @__PURE__ */ new Set([
    "personal.name",
    "personal.gender",
    "personal.birth",
    "personal.idType",
    "personal.idNo",
    "personal.politics",
    "personal.ethnicity",
    "personal.mobile",
    "personal.email",
    "personal.nativePlace",
    "personal.hukou",
    "personal.highestDegree",
    "personal.photo",
    "personal.resume",
    "intent.position",
    "intent.city",
    "edu.start",
    "edu.end",
    "edu.school",
    "edu.major",
    "edu.degreeLevel",
    "edu.degreeName",
    "edu.college",
    "exp.start",
    "exp.end",
    "exp.company",
    "exp.position",
    "exp.desc",
    "proj.name",
    "proj.start",
    "proj.end",
    "proj.role",
    "proj.desc",
    "award.name",
    "award.time",
    "lang.certType",
    "lang.score"
  ]);
  var TODO_SLOTS = /* @__PURE__ */ new Set([
    "personal.idNo",
    "personal.birth",
    "personal.emergencyContact",
    "personal.emergencyPhone",
    "personal.hukou",
    "personal.address",
    "personal.ethnicity"
  ]);
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
      const item = activeItem();
      if (item) item.updatedAt = Date.now();
      chrome.storage.local.set({ [STORAGE_KEY]: profile, [LIB_KEY]: library });
    }, 180);
    renderProgress();
  }
  function activeItem() {
    return (library.items || []).find((x) => x.id === library.activeId) || null;
  }
  var uid = () => "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function renderProgress() {
    const box = $("#progress");
    if (!box) return;
    const st = completion(profile);
    box.querySelector(".progress-text").innerHTML = `已填写 <b>${st.filled}</b> / ${st.total} 个字段 · 完成度 <b>${st.percent}%</b>` + (st.total - st.filled > 0 ? ` · 未补齐 ${st.total - st.filled} 项` : "");
    box.querySelector(".progress-fill").style.width = st.percent + "%";
    const ml = $("#missing-list");
    if (ml && !ml.hidden) renderMissing(st);
    const onb = $("#onboarding");
    if (onb) onb.hidden = !(st.filled < 8 && activeId !== APPS_VIEW && activeId !== SETTINGS_VIEW);
    document.querySelectorAll("#category-nav .nav-item").forEach((b) => {
      const c = CATEGORIES.find((x) => x.id === b.dataset.id);
      const cnt = b.querySelector(".nav-count");
      if (!c || !cnt) return;
      const cs = st.byCategory[c.id];
      if (c.custom) cnt.textContent = String((profile[c.id] || []).length || "");
      else cnt.textContent = cs && cs.total ? `${cs.filled}/${cs.total}` : "";
      cnt.classList.toggle("done", !!(cs && cs.total && cs.filled === cs.total));
    });
    const cat = CATEGORIES.find((x) => x.id === activeId);
    if (cat && !cat.custom) {
      const recs = (st.byCategory[cat.id] || {}).records || [];
      document.querySelectorAll("#records .record-card").forEach((card, i) => {
        const tag = card.querySelector(".record-missing");
        if (!tag || !recs[i]) return;
        const n = recs[i].missing.length;
        tag.textContent = n ? `未补齐 ${n} 项` : "已填全";
      });
    }
  }
  function renderMissing(st) {
    const ml = $("#missing-list");
    ml.replaceChildren();
    let any = false;
    for (const c of CATEGORIES) {
      if (c.custom) continue;
      const recs = (st.byCategory[c.id] || {}).records || [];
      recs.forEach((r, i) => {
        if (!r.missing.length) return;
        any = true;
        const g = document.createElement("div");
        g.className = "missing-group";
        const t = document.createElement("b");
        t.textContent = (c.multiple ? `${c.name} ${i + 1}` : c.name) + ` · 未补齐 ${r.missing.length} 项`;
        g.append(t);
        const meta = (l) => c.fields.find((f) => f.label === l);
        const sorted = r.missing.slice().sort((a, b) => (CORE_SLOTS.has(meta(b).slot) ? 1 : 0) - (CORE_SLOTS.has(meta(a).slot) ? 1 : 0));
        for (const label of sorted) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "missing-item" + (CORE_SLOTS.has(meta(label).slot) ? " core" : "");
          chip.textContent = label;
          chip.onclick = () => jumpToField(c.id, i, label);
          g.append(chip);
        }
        ml.append(g);
      });
    }
    if (!any) {
      const p = document.createElement("div");
      p.className = "missing-group";
      p.textContent = "全部填齐了（没有记录的分类不算缺）。";
      ml.append(p);
    }
  }
  function jumpToField(categoryId, index, label) {
    activeId = categoryId;
    renderNav();
    renderSection();
    const card = document.querySelectorAll("#records .record-card")[index];
    const input = card && [...card.querySelectorAll(".field input, .field textarea")].find((x) => x.getAttribute("aria-label") === label);
    if (!input) return;
    const f = input.closest(".field");
    try {
      input.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch (_) {
    }
    try {
      input.focus();
    } catch (_) {
    }
    f.classList.add("flash");
    setTimeout(() => f.classList.remove("flash"), 1600);
  }
  function addCustomFieldFromPage(label, categoryId) {
    const name = String(label || "").trim();
    if (!name) return false;
    const c = CATEGORIES.find((x) => x.id === categoryId && !x.custom) || CATEGORIES.find((x) => x.id === "personal");
    if (!Array.isArray(profile[c.id])) profile[c.id] = [];
    if (!profile[c.id].length) profile[c.id].push({});
    const key = normalize(name);
    for (const r of profile[c.id]) {
      if (!Array.isArray(r.__custom)) r.__custom = [];
      if (!r.__custom.some((x) => normalize(x.name) === key)) r.__custom.push({ name, value: "" });
    }
    save();
    activeId = c.id;
    renderNav();
    renderSection();
    showNotice(`已在「${c.name}」加上自定义字段「${name}」，填上内容后再点一次填写。`);
    return true;
  }
  function persistAll() {
    profile.schemaVersion = SCHEMA_VERSION;
    return chrome.storage.local.set({ [STORAGE_KEY]: profile, [LIB_KEY]: library });
  }
  function renderLibrary() {
    const sel = $("#resume-select");
    const name = $("#resume-name");
    if (!sel || !name) return;
    sel.replaceChildren();
    for (const it of library.items) {
      const o = document.createElement("option");
      o.value = it.id;
      o.textContent = it.name || "未命名简历";
      if (it.id === library.activeId) o.selected = true;
      sel.append(o);
    }
    const cur = activeItem();
    name.value = cur && cur.name || "";
    $("#resume-delete").disabled = library.items.length <= 1;
  }
  function rerenderAll() {
    renderLibrary();
    renderNav();
    renderSection();
    renderProgress();
  }
  async function switchResume(id) {
    if (id === library.activeId) return;
    const cur = activeItem();
    const next = library.items.find((x) => x.id === id);
    if (!next) return;
    if (cur) cur.data = JSON.parse(JSON.stringify(profile));
    profile = sanitizeProfile(next.data || {});
    delete next.data;
    library.activeId = id;
    normalizeDates();
    await persistAll();
    rerenderAll();
  }
  async function createResume(name, data) {
    const cur = activeItem();
    if (cur) cur.data = JSON.parse(JSON.stringify(profile));
    const item = { id: uid(), name, updatedAt: Date.now() };
    library.items.push(item);
    library.activeId = item.id;
    profile = sanitizeProfile(data || {});
    normalizeDates();
    await persistAll();
    rerenderAll();
    return item;
  }
  function downloadJSON(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  async function importResumeText(text, fallbackName = "导入的简历") {
    const r = parseImport(text);
    if (!r.ok) {
      showNotice("导入失败：" + r.error, true);
      return null;
    }
    const item = await createResume(r.name || fallbackName, r.profile);
    showNotice(`已导入「${item.name}」并切换过去。`);
    return item;
  }
  function wireLibrary() {
    const sel = $("#resume-select");
    if (!sel) return;
    $("#missing-toggle").onclick = () => {
      const ml = $("#missing-list");
      ml.hidden = !ml.hidden;
      $("#missing-toggle").textContent = ml.hidden ? "查看未补齐项" : "收起未补齐项";
      renderProgress();
    };
    $("#onb-import").onclick = () => $("#resume-import-file").click();
    $("#onb-sample").onclick = () => $("#resume-sample").click();
    $("#report-feedback").onclick = async () => {
      const r = lastReport || {};
      const rows = r.results || [];
      const miss = [...new Set(rows.filter((x) => x.reason === "label-uncertain").map((x) => (x.parts || [])[0]).filter(Boolean))];
      const unmatched = [...new Set(rows.filter((x) => x.reason === "custom-no-match" || x.reason === "option-no-match").map((x) => `${x.label}（${x.reason === "option-no-match" ? "选项对不上：" + x.value : "网页上没对上"}）`))];
      const text = [
        `站点：${lastTab && lastTab.url || "（未知）"}`,
        `页面：${lastTab && lastTab.title || ""}`,
        `插件版本：${chrome.runtime && chrome.runtime.getManifest && chrome.runtime.getManifest().version || ""}`,
        `没认出的网页标签：${miss.join("、") || "无"}`,
        `资料里有、但没填上：${unmatched.join("、") || "无"}`
      ].join("\n");
      try {
        await navigator.clipboard.writeText(text);
        showNotice("缺少字段清单已复制，发给开发者即可（不含你的资料内容）。");
      } catch (_) {
        showNotice("复制失败。", true);
      }
    };
    sel.onchange = () => switchResume(sel.value);
    $("#resume-name").oninput = () => {
      const cur = activeItem();
      if (!cur) return;
      cur.name = $("#resume-name").value;
      const opt = sel.querySelector(`option[value="${cur.id}"]`);
      if (opt) opt.textContent = cur.name || "未命名简历";
      save();
    };
    $("#resume-new").onclick = () => createResume(`简历 ${library.items.length + 1}`, {});
    $("#resume-copy").onclick = () => {
      const cur = activeItem();
      return createResume(`${cur && cur.name || "简历"} 副本`, JSON.parse(JSON.stringify(profile)));
    };
    let armed = 0;
    $("#resume-delete").onclick = async () => {
      const btn = $("#resume-delete");
      if (library.items.length <= 1) return;
      if (Date.now() - armed > 3e3) {
        armed = Date.now();
        btn.textContent = "再点一次确认删除";
        setTimeout(() => btn.textContent = "删除", 3e3);
        return;
      }
      armed = 0;
      btn.textContent = "删除";
      const goneId = library.activeId;
      const next = library.items.find((x) => x.id !== goneId);
      library.items = library.items.filter((x) => x.id !== goneId);
      library.activeId = next.id;
      profile = sanitizeProfile(next.data || {});
      delete next.data;
      normalizeDates();
      await persistAll();
      rerenderAll();
      showNotice("已删除这份简历。");
    };
    $("#resume-export").onclick = () => {
      const cur = activeItem();
      const name = cur && cur.name || "我的简历";
      downloadJSON(`${name}.json`, exportPayload(name, profile));
    };
    $("#resume-import").onclick = () => $("#resume-import-file").click();
    $("#resume-import-file").onchange = async () => {
      const input = $("#resume-import-file");
      const file = input.files && input.files[0];
      if (!file) return;
      const text = await file.text();
      input.value = "";
      await importResumeText(text, file.name.replace(/\.json$/i, ""));
    };
    $("#resume-sample").onclick = async () => {
      await createResume("示例简历（虚构）", sampleProfile());
      showNotice("已新建一份示例简历，可以直接拿去测试网申页面。");
    };
  }
  function renderAiBadge() {
    const b = $("#ai-badge");
    if (b) b.textContent = aiSettings.enabled && aiSettings.apiKey ? "AI 开" : "AI 关";
  }
  function aiReady() {
    return !!(aiSettings.enabled && aiSettings.apiKey);
  }
  function saveAi() {
    chrome.storage.local.set({ [AI_KEY]: aiSettings });
    renderAiBadge();
  }
  function renderSettings() {
    const en = $("#ai-enabled");
    if (!en) return;
    en.checked = !!aiSettings.enabled;
    $("#ai-key").value = aiSettings.apiKey || "";
    $("#ai-model").value = aiSettings.model || "";
    $("#ai-base").value = aiSettings.baseUrl || "";
    $("#float-enabled").checked = uiSettings.floatButton !== false;
    $("#ai-always").checked = !!aiSettings.always;
  }
  function wireSettings() {
    const en = $("#ai-enabled");
    if (!en) return;
    en.onchange = () => {
      aiSettings.enabled = en.checked;
      if (en.checked && !aiSettings.apiKey) showNotice("先填 API Key，AI 辅助才会生效。", true);
      saveAi();
    };
    const bind = (sel, key, fallback) => {
      $(sel).oninput = () => {
        aiSettings[key] = $(sel).value.trim() || fallback;
        saveAi();
      };
    };
    $("#ai-key").oninput = () => {
      aiSettings.apiKey = $("#ai-key").value.trim();
      if (aiSettings.apiKey && !aiSettings.enabled) {
        aiSettings.enabled = true;
        $("#ai-enabled").checked = true;
        showNotice("已填 Key，AI 辅助已自动开启。可以点「测试连接」确认一下。");
      }
      saveAi();
    };
    bind("#ai-model", "model", AI_DEFAULTS.model);
    bind("#ai-base", "baseUrl", AI_DEFAULTS.baseUrl);
    $("#ai-always").onchange = () => {
      aiSettings.always = $("#ai-always").checked;
      if (aiSettings.always && !aiSettings.apiKey) showNotice("先填 API Key，AI 复核才会生效。", true);
      saveAi();
    };
    $("#float-enabled").onchange = () => {
      uiSettings.floatButton = $("#float-enabled").checked;
      chrome.storage.local.set({ [UI_KEY]: uiSettings });
    };
    $("#ai-test").onclick = async () => {
      const out = $("#ai-test-result");
      out.className = "settings-result";
      out.textContent = "测试中…";
      try {
        const res = await chrome.runtime.sendMessage({ type: "AI_TEST", settings: { ...aiSettings } });
        if (res && res.ok) {
          out.className = "settings-result ok";
          out.textContent = `连接成功（${aiSettings.model}）`;
        } else {
          out.className = "settings-result bad";
          out.textContent = "失败：" + (res && res.error || "没有响应");
        }
      } catch (e) {
        out.className = "settings-result bad";
        out.textContent = "失败：" + String(e && e.message || e);
      }
    };
  }
  var APP_STATUS = ["已填写", "已收藏", "已投递", "筛选沟通", "测评/笔试", "面试中", "Offer", "已接受", "已拒绝", "放弃"];
  var EVENT_TYPES = ["笔试", "面试", "测评", "跟进", "截止", "其他"];
  var appFilter = "";
  async function logApplication(tab, report) {
    try {
      const url = String(tab && tab.url || "");
      const host = (() => {
        try {
          return new URL(url).host;
        } catch (_) {
          return "";
        }
      })();
      const key = url.split("#")[0];
      let row = applications.find((a) => a.key === key);
      if (!row) {
        row = { id: uid(), key, url, host, title: String(tab && tab.title || host), company: "", position: "", status: "已填写", note: "", events: [], createdAt: Date.now() };
        applications.unshift(row);
      }
      row.updatedAt = Date.now();
      row.resume = activeItem() && activeItem().name || "";
      row.filled = report && report.filled || 0;
      row.failed = report && report.failed || 0;
      applications = applications.slice(0, 500);
      await chrome.storage.local.set({ [APPS_KEY]: applications });
      renderAppsCount();
      if (activeId === APPS_VIEW) renderApps();
    } catch (_) {
    }
  }
  function renderAppsCount() {
    const c = $("#apps-count");
    if (c) c.textContent = applications.length ? String(applications.length) : "";
  }
  function saveApps() {
    chrome.storage.local.set({ [APPS_KEY]: applications });
  }
  function addApplicationManually() {
    applications.unshift({
      id: uid(),
      key: "manual:" + uid(),
      url: "",
      host: "",
      title: "新的求职记录",
      company: "",
      position: "",
      status: "已收藏",
      note: "",
      events: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      manual: true
    });
    saveApps();
    renderAppsCount();
    renderApps();
  }
  function upcomingEvents(apps, now = Date.now()) {
    const out = [];
    for (const a of apps || []) {
      for (const ev of a.events || []) {
        const t = Date.parse(ev.at || "");
        if (!isFinite(t) || t < now - 36e5 || t > now + 30 * 864e5) continue;
        out.push({ app: a, ev, t });
      }
    }
    return out.sort((x, y) => x.t - y.t);
  }
  function exportAppsCsv() {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["公司/页面", "岗位", "状态", "简历", "网址", "备注", "日程", "最近更新"]];
    for (const a of applications) {
      rows.push([
        a.company || a.title,
        a.position || "",
        a.status,
        a.resume || "",
        a.url || "",
        a.note || "",
        (a.events || []).map((e) => `${e.type} ${String(e.at || "").replace("T", " ")} ${e.note || ""}`.trim()).join("；"),
        new Date(a.updatedAt || a.createdAt || Date.now()).toLocaleString()
      ]);
    }
    const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "求职进度.csv";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  function renderApps() {
    const view = $("#apps-view");
    view.replaceChildren();
    const bar = document.createElement("div");
    bar.className = "apps-bar";
    const counts = {};
    for (const a of applications) counts[a.status] = (counts[a.status] || 0) + 1;
    const chip = (label, value) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip app-filter" + (appFilter === value ? " on" : "");
      b.innerHTML = `<b>${value ? counts[value] || 0 : applications.length}</b> ${label}`;
      b.onclick = () => {
        appFilter = appFilter === value ? "" : value;
        renderApps();
      };
      return b;
    };
    bar.append(chip("全部", ""));
    for (const st of APP_STATUS) if (counts[st]) bar.append(chip(st, st));
    const tools = document.createElement("div");
    tools.className = "apps-tools";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "secondary";
    addBtn.id = "app-add";
    addBtn.textContent = "＋ 手动添加";
    addBtn.onclick = addApplicationManually;
    const csvBtn = document.createElement("button");
    csvBtn.type = "button";
    csvBtn.className = "link-button";
    csvBtn.textContent = "导出 CSV";
    csvBtn.onclick = exportAppsCsv;
    tools.append(addBtn, csvBtn);
    view.append(bar, tools);
    const soon = upcomingEvents(applications);
    if (soon.length) {
      const box = document.createElement("div");
      box.className = "app-upcoming";
      const h = document.createElement("b");
      h.textContent = "近期日程";
      box.append(h);
      for (const { app, ev, t } of soon.slice(0, 8)) {
        const line = document.createElement("div");
        const d = new Date(t);
        line.textContent = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} · ${ev.type} · ${app.company || app.title}${ev.note ? " · " + ev.note : ""}`;
        box.append(line);
      }
      view.append(box);
    }
    if (!applications.length) {
      const p = document.createElement("div");
      p.className = "empty-state";
      p.textContent = "还没有求职记录。每次点「填写当前网页」都会自动记一笔（同一页面不重复），也可以手动添加。";
      view.append(p);
      return;
    }
    const list = appFilter ? applications.filter((a) => a.status === appFilter) : applications;
    for (const a of list) {
      if (!Array.isArray(a.events)) a.events = [];
      const row = document.createElement("div");
      row.className = "app-row";
      const top = document.createElement("div");
      top.className = "app-top";
      const title = document.createElement(a.url ? "a" : "span");
      title.className = "app-title";
      title.textContent = a.company || a.title || a.host;
      if (a.url) {
        title.href = a.url;
        title.target = "_blank";
        title.rel = "noreferrer";
      }
      const meta = document.createElement("span");
      meta.className = "app-meta";
      const d = new Date(a.updatedAt || a.createdAt || Date.now());
      meta.textContent = `${d.getMonth() + 1}/${d.getDate()}${a.manual ? " · 手动" : ` · 填 ${a.filled || 0}${a.failed ? " · 失败 " + a.failed : ""}`}${a.resume ? " · " + a.resume : ""}`;
      top.append(title, meta);
      const info = document.createElement("div");
      info.className = "app-ctl";
      const comp = document.createElement("input");
      comp.type = "text";
      comp.placeholder = "公司";
      comp.value = a.company || "";
      comp.setAttribute("aria-label", "公司");
      comp.oninput = () => {
        a.company = comp.value;
        title.textContent = a.company || a.title || a.host;
        saveApps();
      };
      const pos = document.createElement("input");
      pos.type = "text";
      pos.placeholder = "岗位";
      pos.value = a.position || "";
      pos.setAttribute("aria-label", "岗位");
      pos.oninput = () => {
        a.position = pos.value;
        saveApps();
      };
      info.append(comp, pos);
      const ctl = document.createElement("div");
      ctl.className = "app-ctl";
      const st = document.createElement("select");
      st.setAttribute("aria-label", "求职状态");
      for (const s0 of APP_STATUS) {
        const o = document.createElement("option");
        o.value = o.textContent = s0;
        if (s0 === a.status) o.selected = true;
        st.append(o);
      }
      st.onchange = () => {
        a.status = st.value;
        a.updatedAt = Date.now();
        saveApps();
        renderApps();
      };
      const note = document.createElement("input");
      note.type = "text";
      note.placeholder = "备注（内推人 / 笔试链接…）";
      note.value = a.note || "";
      note.oninput = () => {
        a.note = note.value;
        saveApps();
      };
      const addEv = document.createElement("button");
      addEv.type = "button";
      addEv.className = "link-button";
      addEv.textContent = "＋日程";
      addEv.onclick = () => {
        a.events.push({ id: uid(), type: "笔试", at: "", note: "" });
        saveApps();
        renderApps();
      };
      const del = document.createElement("button");
      del.type = "button";
      del.className = "delete-button";
      del.textContent = "✕";
      del.title = "删除这条记录";
      del.onclick = () => {
        applications = applications.filter((x) => x !== a);
        saveApps();
        renderAppsCount();
        renderApps();
      };
      ctl.append(st, note, addEv, del);
      row.append(top, info, ctl);
      for (const ev of a.events) {
        const er = document.createElement("div");
        er.className = "app-ctl app-event";
        const ty = document.createElement("select");
        ty.setAttribute("aria-label", "日程类型");
        for (const t0 of EVENT_TYPES) {
          const o = document.createElement("option");
          o.value = o.textContent = t0;
          if (t0 === ev.type) o.selected = true;
          ty.append(o);
        }
        ty.onchange = () => {
          ev.type = ty.value;
          saveApps();
        };
        const at = document.createElement("input");
        at.type = "datetime-local";
        at.value = ev.at || "";
        at.setAttribute("aria-label", "日程时间");
        at.onchange = () => {
          ev.at = at.value;
          saveApps();
        };
        const en = document.createElement("input");
        en.type = "text";
        en.placeholder = "说明（地点 / 链接）";
        en.value = ev.note || "";
        en.oninput = () => {
          ev.note = en.value;
          saveApps();
        };
        const ed = document.createElement("button");
        ed.type = "button";
        ed.className = "delete-button";
        ed.textContent = "✕";
        ed.onclick = () => {
          a.events = a.events.filter((x) => x !== ev);
          saveApps();
          renderApps();
        };
        er.append(ty, at, en, ed);
        row.append(er);
      }
      view.append(row);
    }
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
    try {
      const lib = (await chrome.storage.local.get(LIB_KEY))[LIB_KEY];
      if (lib && Array.isArray(lib.items) && lib.items.length) library = lib;
      const apps = (await chrome.storage.local.get(APPS_KEY))[APPS_KEY];
      if (Array.isArray(apps)) applications = apps;
      const ai = (await chrome.storage.local.get(AI_KEY))[AI_KEY];
      if (ai && typeof ai === "object") aiSettings = { ...AI_DEFAULTS, ...ai };
      const ui = (await chrome.storage.local.get(UI_KEY))[UI_KEY];
      if (ui && typeof ui === "object") uiSettings = { ...uiSettings, ...ui };
    } catch (_) {
    }
    if (!library.items.some((x) => x.id === library.activeId)) library.activeId = library.items[0].id;
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
    renderLibrary();
    renderNav();
    renderSection();
    renderAppsCount();
    save();
  }
  function renderNav() {
    const nav = $("#category-nav");
    nav.replaceChildren();
    CATEGORIES.forEach((c) => {
      const b = document.createElement("button");
      b.className = "nav-item" + (activeId === c.id ? " active" : "");
      b.type = "button";
      b.dataset.id = c.id;
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
    const st = $("#settings-nav");
    if (st) {
      st.classList.toggle("active", activeId === SETTINGS_VIEW);
      st.onclick = () => {
        activeId = SETTINGS_VIEW;
        renderNav();
        renderSection();
      };
    }
    renderAiBadge();
    const apps = $("#apps-nav");
    if (apps) {
      apps.classList.toggle("active", activeId === APPS_VIEW);
      apps.onclick = () => {
        activeId = APPS_VIEW;
        renderNav();
        renderSection();
      };
    }
    renderProgress();
  }
  function addTag(label, text) {
    const tag = document.createElement("span");
    tag.className = "field-tag";
    tag.textContent = text;
    label.append(tag);
  }
  var DOC_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];
  function createField(field, record) {
    const wrap = document.createElement("div");
    wrap.className = "field" + (field.kind === "textarea" ? " wide" : "");
    const label = document.createElement("label");
    label.textContent = field.label;
    const isPhoto = field.kind === "upload";
    const isDoc = isPhoto && field.slot === "personal.resume";
    const el = field.kind === "textarea" ? document.createElement("textarea") : document.createElement("input");
    if (el.tagName === "INPUT") {
      if (isPhoto) {
        el.type = "file";
        el.accept = isDoc ? "application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" : "image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp";
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
    if (TODO_SLOTS.has(field.slot) && !String(raw ?? "").trim()) {
      addTag(label, "待填写");
      label.lastChild.classList.add("todo");
    }
    if (!isPhoto) {
      el.value = raw || "";
      if (monthOnly) el.value = `${raw}-01`;
      if (!el.placeholder) el.placeholder = HINTS[field.slot] || "选填";
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
        if (isDoc) {
          const okType = DOC_TYPES.includes(file.type) || /\.(pdf|docx?)$/i.test(file.name || "");
          if (!okType || file.size > 8 * 1024 * 1024) {
            el.value = "";
            showNotice("请选择 8MB 以内的 PDF、DOC 或 DOCX 简历。", true);
            return;
          }
        } else if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
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
    if (isDoc && current && current.dataUrl) {
      const note = document.createElement("p");
      note.className = "section-description";
      note.textContent = `已选：${current.name || "简历"}`;
      wrap.append(note);
    } else if (isPhoto && current && current.dataUrl) {
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
    const appsView = $("#apps-view");
    const settingsView = $("#settings-view");
    if (settingsView) settingsView.hidden = activeId !== SETTINGS_VIEW;
    if (activeId === SETTINGS_VIEW) {
      $("#section-title").textContent = "设置";
      $("#section-description").textContent = "只存在本机浏览器。";
      $("#add-record").hidden = true;
      const sortBtn = $("#sort-edu");
      if (sortBtn) sortBtn.hidden = true;
      $("#records").replaceChildren();
      $("#empty-state").hidden = true;
      if (appsView) appsView.hidden = true;
      renderSettings();
      return;
    }
    if (activeId === APPS_VIEW) {
      $("#section-title").textContent = "求职进度";
      $("#section-description").textContent = "每次填写网页自动记一笔（同一页面不重复）；状态、日程、备注自己维护，只存在本机，不限保留时间。";
      $("#add-record").hidden = true;
      const sortBtn = $("#sort-edu");
      if (sortBtn) sortBtn.hidden = true;
      $("#records").replaceChildren();
      $("#empty-state").hidden = true;
      if (appsView) {
        appsView.hidden = false;
        renderApps();
      }
      return;
    }
    if (appsView) appsView.hidden = true;
    const c = CATEGORIES.find((x) => x.id === activeId);
    $("#section-title").textContent = c.name;
    ensureSortButton(c);
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
      if (!c.custom) {
        const missing = document.createElement("span");
        missing.className = "record-missing";
        title.append(missing);
      }
      head.append(title);
      if (c.multiple) {
        const tools = document.createElement("div");
        tools.className = "record-tools";
        const move = (dir, text) => {
          const b = document.createElement("button");
          b.className = "link-button";
          b.type = "button";
          b.textContent = text;
          const to = index + dir;
          b.disabled = to < 0 || to >= records.length;
          b.onclick = () => {
            const arr = profile[c.id];
            [arr[index], arr[to]] = [arr[to], arr[index]];
            save();
            renderSection();
          };
          return b;
        };
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
        tools.append(move(-1, "上移"), move(1, "下移"), del);
        head.append(tools);
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
    renderProgress();
  }
  function ensureSortButton(c) {
    let b = $("#sort-edu");
    if (!b) {
      b = document.createElement("button");
      b.id = "sort-edu";
      b.type = "button";
      b.className = "secondary";
      b.textContent = "按学历排序";
      b.onclick = () => {
        profile.education = sortEducation(profile.education || []);
        save();
        renderSection();
        showNotice("已按学历从高到低排好。");
      };
      $("#add-record").before(b);
    }
    b.hidden = c.id !== "education" || (profile.education || []).length < 2;
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
    "no-photo": "资料库未上传照片/简历附件",
    "card-commit-blocked": "点了卡片里的「确认」，但网页没保存",
    "consent-manual": "授权 / 同意类勾选：插件不替你勾，请自己确认后勾选",
    "not-file-input": "网页不是文件上传控件",
    "upload-type-mismatch": "网页上传控件不收这种文件类型（照片 / 简历附件放错了位置），未上传",
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
      const onlySaved = (report.repeat.log || []).every((l) => /已保存在页面上/.test(l));
      line.textContent = (added > 0 ? `自动新增 ${added} 个经历区块：` : onlySaved ? "多段经历：" : "未能自动新增经历区块：") + log;
      body.append(line);
    }
    if (!report.ai && report.aiOff > 0) {
      const line = document.createElement("p");
      line.className = "ai-off";
      line.textContent = `AI 未开启：这次有 ${report.aiOff} 处规则没处理好（标签认不出 / 选项对不上），开启 AI 辅助可以自动善后。`;
      const go = document.createElement("button");
      go.type = "button";
      go.textContent = "去设置开启";
      go.onclick = () => {
        activeId = SETTINGS_VIEW;
        renderNav();
        renderSection();
      };
      line.append(go);
      body.append(line);
    }
    if (report.ai) {
      const line = document.createElement("p");
      line.className = "report-sections";
      const a = report.ai;
      line.textContent = a.error ? `AI 善后出错：${a.error}（规则部分照常完成）` : `AI 善后：调用 ${a.calls} 次，补认标签 ${a.mapped} 个，补选下拉 ${a.options} 个。`;
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
      const why = r.reason === "card-commit-blocked" && r.note ? `（${r.note}）` : r.note === "derived-yesno" ? "（按你资料里有没有这类记录推断）" : r.note === "already-has-value" ? "（网页上已有内容，没有覆盖）" : r.note === "padded-day" ? "（资料只到年月，网页要完整日期，已补成 1 号）" : "";
      const cells = [
        r.section ? `${r.section}${r.block > 0 ? " #" + (r.block + 1) : ""}` : "未识别区块",
        r.label || "（未取到标签）",
        r.value,
        (STATUS_TEXT[statusKey] || r.status) + (r.ai && r.status === "filled" ? "（AI）" : ""),
        [reason + why + downgraded + padded + extra + attempts + parts + hints + panelText, r.readback && r.status !== "filled" ? `回读：${r.readback}` : ""].filter(Boolean).join("；")
      ];
      cells.forEach((text, i) => {
        const td = document.createElement("td");
        td.textContent = text || "";
        if (i === 3) td.className = `st st-${statusKey}`;
        if (i === 4 && r.reason === "label-uncertain") {
          const lbl = String((r.parts || [])[0] || "").trim();
          if (lbl.length >= 2 && lbl.length <= 30 && !/(同意|授权|隐私|协议|条款)/.test(lbl)) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "add-custom";
            b.textContent = `＋把「${lbl}」加为自定义字段`;
            b.onclick = () => addCustomFieldFromPage(lbl, r.categoryId);
            td.append(document.createElement("br"), b);
          }
        }
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
  var forceAiOnce = false;
  $("#report-ai").onclick = () => {
    if (!aiReady()) {
      showNotice("AI 还没开启：先去「设置」填 API Key。", true);
      activeId = SETTINGS_VIEW;
      renderNav();
      renderSection();
      return;
    }
    forceAiOnce = true;
    $("#fill-page").click();
  };
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
      const ai = aiReady();
      const aiForce = ai && (forceAiOnce || !!aiSettings.always);
      forceAiOnce = false;
      btn.textContent = "填写中…";
      showFillProgress({ stage: "scan", text: ai ? "正在识别网页表单…（AI 辅助已开启）" : "正在识别网页表单…" });
      const send = () => chrome.tabs.sendMessage(tab.id, { type: "FILL_FORM", profile, ai, aiForce });
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
      lastTab = { url: tab.url, title: tab.title };
      if (result && !result.error && result.found) logApplication(tab, result);
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
      btn.textContent = "填写当前网页";
      showFillProgress({ stage: "done", text: "填写完成" });
      btn.disabled = false;
    }
  };
  var progressTimer = null;
  function showFillProgress(info) {
    const box = $("#fill-progress");
    if (!box || !info) return;
    clearTimeout(progressTimer);
    box.hidden = false;
    box.querySelector(".fp-text").textContent = info.text || "";
    const pct = info.stage === "done" ? 100 : info.total ? Math.round(info.done / info.total * 100) : { scan: 5, expand: 12, ai: 92, commit: 96 }[info.stage] || 0;
    box.querySelector(".progress-fill").style.width = pct + "%";
    if (info.stage === "done") progressTimer = setTimeout(() => box.hidden = true, 1500);
  }
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "FILL_PROGRESS") showFillProgress(msg);
    });
  } catch (_) {
  }
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.lastFillReport && changes.lastFillReport.newValue) {
        const v = changes.lastFillReport.newValue;
        lastReport = v.report;
        lastTab = { url: v.url, title: v.title };
        renderReport(v.report);
      }
      if (changes.applications && Array.isArray(changes.applications.newValue)) {
        applications = changes.applications.newValue;
        renderAppsCount();
        if (activeId === APPS_VIEW) renderApps();
      }
    });
  } catch (_) {
  }
  wireLibrary();
  wireSettings();
  load();
})();
