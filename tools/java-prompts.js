// ===== Browser Helper - Java Prompts Module =====
// Scoped to #panel-java-prompts
// 内置常用 Java 编码 AI 提示词（system / user 两段），支持搜索、分类、展开、一键复制。

const JavaPrompts = (function() {
  let initialized = false;

  // ===== 模板数据（内置，独立可用） =====
  const TEMPLATES = [
    {
      "name": "code-gen-entity-from-spec",
      "category": "code-gen",
      "description": "根据字段清单生成 JPA / MyBatis 实体类与 DTO",
      "variables": ["entity", "fields", "orm"],
      "tags": ["entity", "dto", "jpa", "mybatis"],
      "system": "你是一名 Java 持久层专家，熟悉 JPA / MyBatis 的映射约定、Lombok 与校验注解。你生成的类必须可编译、字段类型合理、并考虑空值与校验。",
      "user": "请为实体 ${entity} 生成持久化类与 DTO。\n\n字段清单：${fields}\nORM 框架：${orm}\n\n要求：\n1. 生成实体类（含主键、字段、Getter/Setter、toString），按 ${orm} 习惯加映射注解。\n2. 生成对应的创建/查询 DTO，仅暴露必要字段，并加 @NotNull / @Size 等校验注解。\n3. 类型推断需合理（金额用 BigDecimal，时间用 LocalDateTime，标识用 Long）。\n4. 加简洁中文 Javadoc / 字段注释。\n5. 如需二者转换（Entity 与 DTO），给出转换方法或 MapStruct 接口。\n\n只输出代码与简短说明。"
    },
    {
      "name": "code-gen-spring-controller",
      "category": "code-gen",
      "description": "根据实体与接口描述生成 Spring Boot REST 控制器（仅控制器层）",
      "variables": ["entity", "spec", "basePath"],
      "tags": ["spring", "rest", "controller", "scaffold"],
      "system": "你是一名资深 Java / Spring Boot 工程师，精通 RESTful 设计、Spring MVC、Bean Validation 与统一响应封装。你产出的代码必须可直接编译、符合团队规范，并包含关键路径的 Javadoc。",
      "user": "请为以下实体生成一个 Spring Boot REST 控制器：\n\n实体名称：${entity}\n接口描述：${spec}\n基础路径：${basePath}\n\n要求：\n1. 使用 @RestController + @RequestMapping(\"${basePath}\")，方法用 @GetMapping / @PostMapping 等语义化注解。\n2. 入参使用 @Validated DTO，返回统一响应体（如 Result<T>），不要直接返回裸 Map 或实体。\n3. 仅编写控制器层；依赖的 Service 用接口声明并 @Autowired，不要在此实现 Service 逻辑。\n4. 关键方法加 Javadoc，说明用途、入参与状态码。\n5. 若描述有歧义，列出你的假设，不要臆造字段。\n\n请只输出代码与必要的简短说明。"
    },
    {
      "name": "code-review-bugs-security",
      "category": "code-review",
      "description": "对 Java 代码做缺陷、性能与安全风险评审",
      "variables": ["code", "language", "focus"],
      "tags": ["review", "bug", "security", "quality"],
      "system": "你是一名严谨的代码评审专家，擅长发现空指针、并发、资源泄漏、注入与权限等隐患。你逐条给出问题、位置、严重级与修复建议，并优先处理高风险项。",
      "user": "请评审以下${language}代码（关注点：${focus}）：\n\n```\n${code}\n```\n\n请按以下结构输出：\n1. 严重问题（会导致故障 / 安全漏洞）：问题描述、行号或片段、修复示例。\n2. 中等问题（可维护性 / 性能隐患）：同上。\n3. 轻微问题（风格 / 冗余）：简要列出。\n4. 亮点（做得好的地方）：一句话。\n\n不要重写整段代码，只针对问题给出最小可行修复。"
    },
    {
      "name": "data-mybatis-mapper",
      "category": "data",
      "description": "生成 MyBatis Mapper 接口、XML 与对应实体映射",
      "variables": ["table", "entity", "operations"],
      "tags": ["mybatis", "sql", "mapper", "dao"],
      "system": "你是一名 MyBatis 专家，熟悉动态 SQL、ResultMap、批量与分页。你生成的映射正确、可防注入、并考虑字段命名约定。",
      "user": "请为表 ${table}（对应实体 ${entity}）生成 MyBatis 持久层。\n\n需要支持的操作：${operations}\n\n要求：\n1. 生成 Mapper 接口（方法签名清晰，参数用 @Param）。\n2. 生成对应 XML：含 resultMap、必要动态 SQL（if / foreach / choose），字段与实体映射正确。\n3. 使用 #{} 占位防 SQL 注入；批量 / 分页给出可行写法。\n4. 如字段命名不一致（下划线 与 驼峰），在 resultMap 显式映射。\n\n输出 Mapper 接口 + XML 完整内容。"
    },
    {
      "name": "debug-stacktrace",
      "category": "debug",
      "description": "根据异常堆栈定位根因并给出修复方案",
      "variables": ["stacktrace", "context"],
      "tags": ["debug", "stacktrace", "root-cause"],
      "system": "你是一名排障专家，擅长从异常堆栈中剥离噪声、定位根因，并区分「表象」与「根因」。你给出的修复方案可落地、低风险。",
      "user": "请分析以下异常堆栈（背景信息：${context}）：\n\n```\n${stacktrace}\n```\n\n请输出：\n1. 根因判断：最可能的直接原因，并指出堆栈中真正相关的那几行。\n2. 触发条件：什么输入 / 状态会触发。\n3. 修复方案：最小改动代码示例 + 为什么这样改。\n4. 防御建议：如何避免同类问题（校验、日志、监控）。\n\n如果信息不足，明确指出还需要哪些上下文。"
    },
    {
      "name": "design-pattern-selection",
      "category": "design",
      "description": "根据问题特征推荐合适的设计模式并给出结构",
      "variables": ["problem", "constraints"],
      "tags": ["design", "pattern", "architecture"],
      "system": "你是一名软件架构师，善于把模糊问题映射到合适的设计模式，并清楚说明取舍，而不是为了用模式而用模式。",
      "user": "请为以下问题推荐合适的设计模式：\n\n问题背景：${problem}\n约束条件：${constraints}\n\n请输出：\n1. 候选模式（1-3 个）：每个说明「为什么适合」与「代价 / 不适用场景」。\n2. 推荐结论：首选哪个，理由是什么。\n3. 简要结构：关键角色（类名 / 接口）与协作关系，可用伪代码或类图文字描述。\n4. 落地注意：接入现有代码时最容易踩的坑。\n\n不要堆砌全部 23 个 GoF 模式，聚焦最契合的几个。"
    },
    {
      "name": "doc-javadoc-generator",
      "category": "doc",
      "description": "为 Java 代码生成规范化 Javadoc / 文档注释",
      "variables": ["code", "style"],
      "tags": ["doc", "javadoc", "documentation"],
      "system": "你是一名注重文档质量的工程师，生成的 Javadoc 准确、简洁，说明「做什么、参数含义、返回值、异常、线程安全」，避免废话。",
      "user": "请为以下代码补全文档注释（风格：${style}）：\n\n```\n${code}\n```\n\n要求：\n1. 类 / 接口：说明职责、使用场景、线程安全性。\n2. 公共方法：@param、@return、@throws 齐全，必要时给示例。\n3. 不写显而易见的内容（如「设置 name」），写「为什么」与「约束」。\n4. 输出完整代码，注释可直接使用。\n\n只输出带注释的代码。"
    },
    {
      "name": "explain-legacy-code",
      "category": "explain",
      "description": "解读遗留代码的设计意图、数据流与风险点",
      "variables": ["code", "audience"],
      "tags": ["explain", "legacy", "onboarding"],
      "system": "你是一名善于带人的技术导师，能把晦涩的遗留代码讲清楚：从「这段代码解决什么问题」到「它怎么做到」，再到「哪里有坑」。",
      "user": "请向「${audience}」讲解以下代码：\n\n```\n${code}\n```\n\n请按以下结构：\n1. 一句话概括：这段代码负责什么。\n2. 关键入口与数据流：从输入到输出的主路径。\n3. 关键设计点：用了哪些模式 / 约定，为什么这样设计。\n4. 风险与注意点：易错、易误解、隐藏依赖。\n5. 可选：如果让你改，你会先动哪里。\n\n讲解用通俗语言，避免堆砌术语。"
    },
    {
      "name": "perf-hotpath",
      "category": "perf",
      "description": "针对高并发 / 热点路径做 Java 性能优化分析",
      "variables": ["code", "scenario"],
      "tags": ["performance", "optimization", "concurrency"],
      "system": "你是一名 JVM 性能优化专家，熟悉热点分析、对象分配、锁竞争与 I/O 瓶颈。你优先做「低风险高收益」的优化，并量化预期收益。",
      "user": "请优化以下代码，场景为「${scenario}」：\n\n```\n${code}\n```\n\n请输出：\n1. 瓶颈定位：最可能影响吞吐 / 延迟的点（对象分配、锁、循环、I/O、反射等）。\n2. 优化方案：逐项给出改动代码 + 收益说明，标注是否改变行为 / 需要压测验证。\n3. 风险提示：优化可能引入的副作用（如并发安全）。\n4. 度量建议：用哪些指标（QPS、P99、GC）验证。\n\n先讲思路，再给代码。"
    },
    {
      "name": "refactor-clean-code",
      "category": "refactor",
      "description": "对异味代码做安全重构，提升可读性并保持行为不变",
      "variables": ["code", "goal"],
      "tags": ["refactor", "clean-code", "readability"],
      "system": "你是一名遵循 Clean Code 与重构原则的资深工程师。你坚持「小步、可编译、行为不变」的重构纪律，每一步都说明意图与收益。",
      "user": "请重构以下代码，目标侧重「${goal}」：\n\n```\n${code}\n```\n\n要求：\n1. 保持外部可观察行为完全不变（不改公共 API 语义）。\n2. 优先处理明显坏味道：过长方法、重复代码、魔法值、过大的类、不当注释。\n3. 给出重构后的完整代码，并对每处关键改动用注释或简短说明其意图。\n4. 若某处不建议改，说明原因，不要为改而改。\n\n只输出重构结果 + 改动说明。"
    },
    {
      "name": "test-gen-junit5-mockito",
      "category": "test-gen",
      "description": "为 Java 类生成 JUnit5 + Mockito 单元测试，覆盖主要分支",
      "variables": ["code", "framework"],
      "tags": ["test", "junit5", "mockito", "coverage"],
      "system": "你是一名测试专家，熟悉 JUnit5、Mockito 与边界值 / 异常路径测试。你写的测试可独立运行、断言明确、命名表达意图。",
      "user": "请为以下代码生成单元测试（框架：${framework}）：\n\n```\n${code}\n```\n\n要求：\n1. 覆盖正常路径、边界条件与异常路径，每个用例一个 @Test，方法名描述场景。\n2. 依赖项用 @Mock 模拟，用 when / verify 精确约束交互。\n3. 断言使用 Assertions，避免无意义断言（如只断言非空）。\n4. 如有不可测设计（静态依赖、new 硬编码），指出并提供可测试化建议。\n5. 给出测试类完整代码，可直接放入 src/test/java。\n\n只输出测试代码 + 必要的依赖说明（import）。"
    }
  ];

  const DESIGN_PATTERNS = [
    {
      n: "01",
      color: "#2563eb",
      cn: "提示词链",
      en: "Prompt Chaining",
      what: "把复杂任务拆成多个小步骤，让 AI 按顺序一步步完成。",
      problem: "AI 一次处理太多内容容易跑偏、遗漏、质量不稳定。",
      logic: "任务 → 第一步输出 → 第二步输入 → 继续处理 → 最终结果",
      usage: "写文章时先分析读者，再列大纲，再写正文，再检查优化。",
      life: "像做饭：先买菜、洗菜、切菜、炒菜，不能一句“做一桌饭”就完事。",
      memory: "一句话记忆：提示词链 = 把大任务拆成小任务，交给 AI 按步骤做。"
    },
    {
      n: "02",
      color: "#047857",
      cn: "路由",
      en: "Routing",
      what: "先判断任务类型，再把任务交给最合适的模型、提示词或处理流程。",
      problem: "不同问题需要不同处理方式，用一套方法硬做容易低效或答错。",
      logic: "用户问题 → 分类判断 → 选择路线 → 专门处理 → 输出答案",
      usage: "客服系统先判断是退款、物流、投诉还是技术问题，再转到对应流程。",
      life: "像医院分诊台：先看你是牙疼、发烧还是骨折，再安排去对应科室。",
      memory: "一句话记忆：路由 = 先分清问题，再走正确通道。"
    },
    {
      n: "03",
      color: "#b45309",
      cn: "并行化",
      en: "Parallelization",
      what: "把可以同时做的子任务分开处理，最后再合并结果。",
      problem: "串行处理太慢，或者单个 AI 视角太单一。",
      logic: "任务 → 拆成 A/B/C → 同时处理 → 汇总比较 → 最终答案",
      usage: "让 AI 同时从市场、技术、成本三个角度分析一个产品方案。",
      life: "像搬家：有人打包厨房，有人打包卧室，有人搬箱子，最后统一装车。",
      memory: "一句话记忆：并行化 = 能同时做的事，就别排队等。"
    },
    {
      n: "04",
      color: "#be123c",
      cn: "反思",
      en: "Reflection",
      what: "让 AI 先产出答案，再自己检查、挑错、修改。",
      problem: "AI 第一次回答可能粗糙、漏条件、有逻辑漏洞。",
      logic: "生成初稿 → 检查问题 → 提出修改点 → 生成改进版",
      usage: "让 AI 写完方案后，再按“是否清楚、是否可执行、是否有风险”检查。",
      life: "像写作文：先写草稿，再自己读一遍，把错字和不通顺的地方改掉。",
      memory: "一句话记忆：反思 = 让 AI 先做，再回头检查自己。"
    },
    {
      n: "05",
      color: "#6d28d9",
      cn: "工具使用",
      en: "Tool Use",
      what: "让 AI 调用外部工具，比如搜索、计算器、数据库、代码执行器。",
      problem: "AI 只靠脑子会算错、查不到最新信息，也不能直接操作系统。",
      logic: "判断需要工具 → 调用工具 → 读取结果 → 继续推理或回答",
      usage: "问天气、股票、订单状态、文件内容时，让 AI 查工具后再回答。",
      life: "像会计不会心算所有账，而是用计算器和表格保证准确。",
      memory: "一句话记忆：工具使用 = AI 不硬猜，需要时去查、去算、去操作。"
    },
    {
      n: "06",
      color: "#2563eb",
      cn: "规划",
      en: "Planning",
      what: "让 AI 先制定行动计划，再按计划执行任务。",
      problem: "复杂任务如果直接开做，容易方向错、步骤乱、漏掉关键事项。",
      logic: "理解目标 → 拆步骤 → 排顺序 → 执行 → 根据结果调整",
      usage: "做项目、写程序、整理资料前，让 AI 先列任务清单和执行顺序。",
      life: "像旅行前先定路线、订酒店、查交通，而不是到机场再想去哪。",
      memory: "一句话记忆：规划 = 开始做之前，先想清楚怎么做。"
    },
    {
      n: "07",
      color: "#047857",
      cn: "多智能体协作",
      en: "Multi-Agent Collaboration",
      what: "让多个 AI 扮演不同角色，分工协作完成一个任务。",
      problem: "一个 AI 很难同时做好专家、执行者、审稿人、质检员等多个角色。",
      logic: "设定角色 → 分配任务 → 各自处理 → 互相反馈 → 合并结果",
      usage: "产品经理 AI 写需求，工程师 AI 做方案，评审 AI 找风险。",
      life: "像拍电影：导演、编剧、摄影、剪辑各管一块，最后合成作品。",
      memory: "一句话记忆：多智能体协作 = 多个 AI 分工合作，比一个 AI 单打独斗更稳。"
    },
    {
      n: "08",
      color: "#b45309",
      cn: "记忆管理",
      en: "Memory Management",
      what: "让 AI 保存、读取和更新重要信息，而不是每次都从零开始。",
      problem: "AI 容易忘记用户偏好、历史任务、长期目标和之前的结论。",
      logic: "识别重要信息 → 存起来 → 需要时取出 → 用完再更新",
      usage: "让助理记住你的写作风格、常用模板、项目背景和客户偏好。",
      life: "像熟悉你的理发师，记得你上次剪多短、喜欢什么风格。",
      memory: "一句话记忆：记忆管理 = 让 AI 记住该记的事。"
    },
    {
      n: "09",
      color: "#be123c",
      cn: "学习与适应",
      en: "Learning and Adaptation",
      what: "让 AI 根据反馈和结果不断调整自己的做法。",
      problem: "固定流程不能适应不同用户、场景和变化中的任务要求。",
      logic: "执行任务 → 收集反馈 → 总结规律 → 调整策略 → 下次做得更好",
      usage: "根据用户对答案的点赞、修改意见和采用情况，优化后续回答风格。",
      life: "像新员工刚开始不熟，做几次后知道老板喜欢什么格式和节奏。",
      memory: "一句话记忆：学习与适应 = AI 从反馈里变得更合拍。"
    },
    {
      n: "10",
      color: "#6d28d9",
      cn: "模型上下文协议",
      en: "Model Context Protocol, MCP",
      what: "一种让 AI 标准化连接工具、数据和服务的协议。",
      problem: "每接一个工具都单独开发会很乱，系统难维护、难扩展。",
      logic: "工具按统一规则暴露能力 → AI 按统一方式发现和调用",
      usage: "让 AI 用统一方式连接文件、数据库、浏览器、日历、代码仓库等。",
      life: "像 USB 接口，不同设备只要遵守标准，就能插上电脑使用。",
      memory: "一句话记忆：MCP = 给 AI 接工具的一套通用插口。"
    },
    {
      n: "11",
      color: "#2563eb",
      cn: "目标设定与监控",
      en: "Goal Setting and Monitoring",
      what: "给 AI 明确目标，并持续检查它是否朝目标前进。",
      problem: "AI 执行久了可能偏离目标，或者做了很多事但没有真正完成任务。",
      logic: "设目标 → 定标准 → 执行 → 检查进度 → 偏了就调整",
      usage: "让 AI 做调研时，规定最终必须输出结论、证据、风险和下一步建议。",
      life: "像减肥：目标不是“运动一下”，而是体重、饮食、训练进度都要跟踪。",
      memory: "一句话记忆：目标设定与监控 = 不只让 AI 忙，还要让它朝正确结果忙。"
    },
    {
      n: "12",
      color: "#047857",
      cn: "异常处理与恢复",
      en: "Exception Handling and Recovery",
      what: "当 AI 或工具出错时，有备用办法继续完成任务。",
      problem: "工具失败、信息缺失、格式错误、网络异常都会让流程中断。",
      logic: "发现异常 → 判断原因 → 重试或换方案 → 记录问题 → 继续执行",
      usage: "搜索失败就换关键词，接口超时就重试，解析失败就让 AI 重新整理格式。",
      life: "像出门打车叫不到车，就改坐地铁、公交或换上车地点。",
      memory: "一句话记忆：异常处理与恢复 = 出错不可怕，要有下一招。"
    },
    {
      n: "13",
      color: "#b45309",
      cn: "人机协同",
      en: "Human-in-the-Loop",
      what: "在关键节点让人参与确认、选择、审批或纠错。",
      problem: "有些决定风险高，不能完全交给 AI 自动执行。",
      logic: "AI 处理 → 遇到关键点 → 请求人确认 → 根据反馈继续",
      usage: "发邮件、下单、删文件、改合同条款前，让用户点确认。",
      life: "像助理可以拟合同，但真正签字前必须老板看一眼。",
      memory: "一句话记忆：人机协同 = 普通事 AI 做，关键事人把关。"
    },
    {
      n: "14",
      color: "#be123c",
      cn: "知识检索",
      en: "Knowledge Retrieval, RAG",
      what: "回答前先从资料库找相关内容，再基于资料回答。",
      problem: "AI 可能不知道你的私有资料，也可能凭印象编答案。",
      logic: "问题 → 检索相关资料 → 放进上下文 → AI 基于证据回答",
      usage: "企业知识库问答、合同查询、产品手册客服、内部制度助手。",
      life: "像开卷考试：先翻书找到相关段落，再组织答案。",
      memory: "一句话记忆：RAG = 先查资料，再回答。"
    },
    {
      n: "15",
      color: "#6d28d9",
      cn: "智能体间通信",
      en: "Inter-Agent Communication, A2A",
      what: "让不同 Agent 之间用清楚的消息格式互相交流。",
      problem: "多个 Agent 如果各说各话，任务状态、意图和结果会对不上。",
      logic: "定义消息格式 → 发送请求 → 接收回应 → 同步状态 → 继续协作",
      usage: "销售 Agent 把客户需求发给报价 Agent，报价结果再交给邮件 Agent。",
      life: "像公司跨部门协作：销售、财务、法务要用统一表单沟通。",
      memory: "一句话记忆：A2A = 让多个 AI 用统一语言协作。"
    },
    {
      n: "16",
      color: "#2563eb",
      cn: "资源感知优化",
      en: "Resource-Aware Optimization",
      what: "根据成本、时间、模型能力和算力限制，选择合适的处理方式。",
      problem: "所有任务都用最贵模型、最长流程，会慢、贵、浪费。",
      logic: "评估任务难度 → 估算资源 → 选择模型/流程 → 控制成本和速度",
      usage: "简单分类用便宜模型，复杂推理用强模型，长文档先摘要再分析。",
      life: "像出行：近处走路，稍远骑车，跨城才坐高铁或飞机。",
      memory: "一句话记忆：资源感知优化 = 用刚好够的资源做事。"
    },
    {
      n: "17",
      color: "#047857",
      cn: "推理技术",
      en: "Reasoning Techniques",
      what: "用更有结构的方法引导 AI 思考复杂问题。",
      problem: "复杂判断、数学、逻辑、决策题，AI 直接回答容易想得太浅。",
      logic: "明确问题 → 分解条件 → 比较选项 → 得出结论 → 检查依据",
      usage: "让 AI 做利弊分析、因果分析、逐步求解、假设验证和方案比较。",
      life: "像破案：不能只凭感觉，要看线索、时间线、动机和证据。",
      memory: "一句话记忆：推理技术 = 给 AI 一套更清楚的思考方法。"
    },
    {
      n: "18",
      color: "#b45309",
      cn: "安全防护模式",
      en: "Guardrails / Safety Patterns",
      what: "给 AI 的输入、输出和行为设置边界和检查规则。",
      problem: "AI 可能输出不合规内容、泄露隐私、执行危险操作或被诱导越权。",
      logic: "检查输入 → 限制行为 → 审核输出 → 拦截风险 → 给出安全替代",
      usage: "在金融、医疗、法律、客服和企业数据场景中设置权限和敏感信息过滤。",
      life: "像游乐园安全带和身高限制，不是为了麻烦，而是防止出事。",
      memory: "一句话记忆：安全防护 = 给 AI 装边界，能做事但不能乱来。"
    },
    {
      n: "19",
      color: "#be123c",
      cn: "评估与监控",
      en: "Evaluation and Monitoring",
      what: "持续检查 AI 的回答质量、速度、成本、错误率和用户反馈。",
      problem: "AI 系统上线后，如果没人看指标，问题会悄悄变大。",
      logic: "设评价标准 → 收集数据 → 自动打分/人工抽检 → 发现问题 → 优化系统",
      usage: "记录客服回答是否解决问题、是否被用户追问、是否触发投诉。",
      life: "像餐厅看评分、翻台率和差评原因，才能知道服务哪里要改。",
      memory: "一句话记忆：评估与监控 = AI 上线后也要体检。"
    },
    {
      n: "20",
      color: "#6d28d9",
      cn: "优先级排序",
      en: "Prioritization",
      what: "让 AI 判断哪些任务更重要、更紧急、更值得先做。",
      problem: "任务很多时，如果不排序，AI 可能先做低价值事情。",
      logic: "列出任务 → 按价值/紧急度/风险评分 → 排顺序 → 先做重点",
      usage: "处理工单、销售线索、产品需求、告警信息时，先挑影响最大的做。",
      life: "像早上上班前，先处理马上截止的事，再做可晚点完成的事。",
      memory: "一句话记忆：优先级排序 = 先做最该做的事。"
    },
    {
      n: "21",
      color: "#2563eb",
      cn: "探索与发现",
      en: "Exploration and Discovery",
      what: "让 AI 主动探索未知信息、发现机会、提出新方向。",
      problem: "很多任务一开始目标不清楚，直接执行会限制想象空间。",
      logic: "提出问题 → 搜集线索 → 尝试多个方向 → 比较发现 → 形成新假设",
      usage: "做市场调研、选题策划、产品创新、科研假设和用户需求挖掘。",
      life: "像逛书店找灵感，本来只想买一本书，结果发现了新的兴趣方向。",
      memory: "一句话记忆：探索与发现 = 不只回答已知问题，还帮你发现新问题。"
    },
  ];

  const CAT_LABELS = {
    "code-gen": "代码生成",
    "code-review": "代码评审",
    "refactor": "重构",
    "test-gen": "单元测试",
    "debug": "调试排障",
    "explain": "代码解读",
    "doc": "文档生成",
    "data": "数据/MyBatis",
    "perf": "性能优化",
    "design": "设计模式"
  };

  const state = { filter: "", category: "all", open: null, view: "templates", designOpen: null };

  // ===== DOM refs (set in init) =====
  let catsEl, listEl, searchEl;
  let designBtnEl, templatesWrapEl, designViewEl, designListEl, designBackEl;

  // ===== Helpers =====
  function escapeHtml(s) {
    return (s || "").replace(/[&<>"]/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function catLabel(c) { return CAT_LABELS[c] || c; }
  function byName(n) { return TEMPLATES.find(function(t) { return t.name === n; }); }
  function categories() {
    const set = new Set(TEMPLATES.map(function(t) { return t.category; }));
    return ["all"].concat(Array.from(set).sort());
  }
  function filtered() {
    const kw = state.filter.trim().toLowerCase();
    return TEMPLATES.filter(function(t) {
      if (state.category !== "all" && t.category !== state.category) return false;
      if (!kw) return true;
      const hay = (t.name + " " + t.description + " " + t.tags.join(" ") + " " + t.category).toLowerCase();
      return hay.indexOf(kw) !== -1;
    });
  }

  function copy(text, btn) {
    const done = function() {
      const old = btn.textContent;
      btn.textContent = "已复制 ✓";
      btn.classList.add("copied");
      showToast("已复制到剪贴板", "success");
      setTimeout(function() { btn.textContent = old; btn.classList.remove("copied"); }, 1200);
    };
    const fail = function() {
      // 降级方案
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); }
      catch (e) { showToast("复制失败", "error"); }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fail);
    } else {
      fail();
    }
  }

  function showToast(message, type) {
    if (type === void 0) type = "info";
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = message;
    t.className = "toast show";
    if (type) t.classList.add(type);
    setTimeout(function() { t.className = "toast"; }, 1800);
  }

  // ===== Render =====
  function render() {
    if (!catsEl || !listEl) return;

    catsEl.innerHTML = categories().map(function(c) {
      return '<button class="jp-cat ' + (c === state.category ? "active" : "") + '" data-cat="' + c + '">' + catLabel(c) + "</button>";
    }).join("");

    const list = filtered();
    if (!list.length) {
      listEl.innerHTML = '<div class="jp-empty">没有匹配的模板</div>';
      return;
    }

    listEl.innerHTML = list.map(function(t) {
      const open = state.open === t.name;
      const vars = t.variables.map(function(v) { return '<span class="jp-chip">' + escapeHtml(v) + "</span>"; }).join("");
      const detail = open
        ? '<div class="jp-detail">' +
            '<div class="jp-sec">' +
              '<label>System（系统提示词）</label>' +
              '<pre>' + escapeHtml(t.system) + "</pre>" +
              '<button class="jp-copy" data-copy="system" data-name="' + t.name + '">复制 System</button>' +
            "</div>" +
            '<div class="jp-sec">' +
              '<label>User（用户提示词）</label>' +
              '<pre>' + escapeHtml(t.user) + "</pre>" +
              '<button class="jp-copy" data-copy="user" data-name="' + t.name + '">复制 User</button>' +
            "</div>" +
            '<button class="jp-copy full" data-copy="combined" data-name="' + t.name + '">复制全文（System + User）</button>' +
          "</div>"
        : "";
      return '<div class="jp-card">' +
          '<div class="jp-card-head" data-name="' + t.name + '">' +
            "<div>" +
              '<div class="jp-t-name">' + escapeHtml(t.name) + "</div>" +
              '<div class="jp-t-desc">' + escapeHtml(t.description) + "</div>" +
              '<div class="jp-t-vars">' + vars + "</div>" +
            "</div>" +
            '<div class="jp-t-cat">' + catLabel(t.category) + "</div>" +
          "</div>" +
          detail +
        "</div>";
    }).join("");
  }

  // ===== Design Patterns sub-view (small module) =====
  function renderDesign() {
    if (!designListEl) return;
    designListEl.innerHTML = DESIGN_PATTERNS.map(function(p) {
      const open = state.designOpen === p.n;
      const fields = [
        ["是什么", p.what],
        ["解决什么问题", p.problem],
        ["实现逻辑", p.logic],
        ["怎么用", p.usage],
        ["生活例子", p.life]
      ];
      const body = open
        ? '<div class="jp-dbody" style="margin:6px 0 0 38px;padding:10px 12px;background:var(--bg-secondary,#f1f5f9);border-radius:8px;font-size:12px;line-height:1.7;color:var(--text-primary,#334155);">' +
            fields.map(function(f) {
              return '<div style="margin-bottom:4px;"><b style="color:var(--accent,#4f46e5);">' + escapeHtml(f[0]) + '</b> ' + escapeHtml(f[1]) + '</div>';
            }).join("") +
            '<div style="margin-top:8px;padding:8px 10px;background:var(--accent,#4f46e5);color:#fff;border-radius:6px;font-size:11px;">💡 ' + escapeHtml(p.memory) + '</div>' +
          '</div>'
        : '';
      return '<div class="jp-dcard" style="background:var(--bg-card,#fff);border:1px solid var(--line,#e2e8f0);border-radius:8px;padding:10px 12px;margin-bottom:6px;cursor:pointer;transition:box-shadow .15s;border-left:3px solid ' + p.color + ';" data-n="' + p.n + '">' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span style="flex-shrink:0;width:28px;height:28px;border-radius:7px;background:' + p.color + ';color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;">' + p.n + '</span>' +
            '<div style="flex:1;min-width:0;">' +
              '<span style="font-weight:600;font-size:13px;color:var(--text-primary,#0f172a);">' + escapeHtml(p.cn) + '</span>' +
              '<span style="font-size:11px;color:var(--text-secondary,#94a3b8);margin-left:6px;">' + escapeHtml(p.en) + '</span>' +
            '</div>' +
            '<span style="flex-shrink:0;font-size:14px;color:var(--text-secondary,#94a3b8);transition:transform .2s;' + (open ? 'transform:rotate(180deg);' : '') + '">▾</span>' +
          '</div>' + body +
        '</div>';
    }).join("");
  }

  function showDesign() {
    state.view = "design";
    if (templatesWrapEl) templatesWrapEl.hidden = true;
    if (designViewEl) designViewEl.hidden = false;
    renderDesign();
  }
  function showTemplates() {
    state.view = "templates";
    if (templatesWrapEl) templatesWrapEl.hidden = false;
    if (designViewEl) designViewEl.hidden = true;
  }

  // ===== Events =====
  function bindEvents() {
    catsEl.addEventListener("click", function(e) {
      const cat = e.target.closest("[data-cat]");
      if (cat) {
        state.category = cat.dataset.cat;
        render();
      }
    });

    listEl.addEventListener("click", function(e) {
      const head = e.target.closest(".jp-card-head");
      if (head) {
        const n = head.dataset.name;
        state.open = state.open === n ? null : n;
        render();
        return;
      }
      const cp = e.target.closest("[data-copy]");
      if (cp) {
        const t = byName(cp.dataset.name);
        let text = "";
        if (cp.dataset.copy === "system") text = t.system;
        else if (cp.dataset.copy === "user") text = t.user;
        else text = (t.system ? t.system + "\n\n" : "") + t.user;
        copy(text, cp);
      }
    });

    searchEl.addEventListener("input", function(e) {
      state.filter = e.target.value;
      render();
    });

    if (designBtnEl) designBtnEl.addEventListener("click", showDesign);
    if (designBackEl) designBackEl.addEventListener("click", showTemplates);
    if (designListEl) {
      designListEl.addEventListener("click", function(e) {
        const card = e.target.closest(".jp-dcard");
        if (card) {
          const n = card.dataset.n;
          state.designOpen = state.designOpen === n ? null : n;
          renderDesign();
        }
      });
    }
  }

  // ===== Init =====
  function init() {
    if (initialized) return;
    initialized = true;

    catsEl = document.getElementById("jp-cats");
    listEl = document.getElementById("jp-list");
    searchEl = document.getElementById("jp-search");
    designBtnEl = document.getElementById("jp-designBtn");
    templatesWrapEl = document.getElementById("jp-templates");
    designViewEl = document.getElementById("jp-design-view");
    designListEl = document.getElementById("jp-designList");
    designBackEl = document.getElementById("jp-designBack");

    if (!catsEl || !listEl || !searchEl) return;

    bindEvents();
    render();
    showTemplates();
  }

  return { init: init };
})();
