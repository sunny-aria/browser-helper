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

  const state = { filter: "", category: "all", open: null };

  // ===== DOM refs (set in init) =====
  let catsEl, listEl, searchEl;

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
  }

  // ===== Init =====
  function init() {
    if (initialized) return;
    initialized = true;

    catsEl = document.getElementById("jp-cats");
    listEl = document.getElementById("jp-list");
    searchEl = document.getElementById("jp-search");

    if (!catsEl || !listEl || !searchEl) return;

    bindEvents();
    render();
  }

  return { init: init };
})();
