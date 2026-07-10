# Browser Helper

浏览器工具箱 —— 标签页管理 + JSON 格式化 + Java AI Prompt 库，一个 Chrome 扩展搞定。

## 功能

### 标签页管理

- 按域名自动分组，快速定位标签页
- 搜索过滤标签页（支持标题和 URL）
- 一键关闭重复标签页、其他标签页、选中标签页
- 批量收藏标签页到书签
- 分组视图 / 列表视图切换
- 支持按域名、标题、时间排序
- 扩展图标显示当前窗口标签数

### JSON 格式化

- JSON 格式化：美化输出，支持可折叠树形视图
- JSON 压缩：最小化输出，显示压缩比例
- JSON 解压缩：展开为带缩进的格式
- 转义 / 去除转义：JSON 字符串的转义处理
- 智能修复：自动修复内嵌未转义引号等常见格式错误
- 可拖拽分隔条：自由调整输入/输出面板比例
- 自动粘贴：聚焦输入框时自动检测剪贴板 JSON

### Java AI Prompt 库

- 内置 10 个常用 Java 编码 AI 提示词（System / User 两段）
- 覆盖：代码生成、代码评审、重构、单元测试、调试排障、代码解读、文档生成、MyBatis、性能优化、设计模式
- 顶部搜索框按模板名 / 标签过滤
- 分类胶囊快速切换（全部 / 各分类）
- 点卡片展开查看 System 与 User 原文
- 一键复制 System / User / 全文（System + User 合并）

### 通用特性

- 亮色 / 暗色双主题，偏好自动保存
- 左侧侧边栏一键切换工具
- 快捷键 `Alt+T` 打开弹窗

## 安装

### Chrome 扩展商店

> 即将上架

### 开发者模式加载

1. 下载或克隆本仓库：
   ```bash
   git clone git@github.com:sunny-aria/browser-helper.git
   ```

2. 打开 Chrome，地址栏输入 `chrome://extensions/` 并回车

3. 打开右上角 **开发者模式** 开关

4. 点击 **加载已解压的扩展程序**，选择本仓库目录

5. 工具栏出现 Browser Helper 图标，安装完成

## 项目结构

```
browser-helper/
├── manifest.json              # 扩展配置
├── background.js              # Service Worker（标签计数徽章）
├── popup.html                 # 主界面
├── popup.css                  # 样式
├── popup.js                   # 主控制器（工具切换/主题）
├── icons/                     # 图标
└── tools/
    ├── tab-manager.js         # 标签页管理模块
    ├── json-formatter.js      # JSON 格式化模块
    └── java-prompts.js        # Java AI Prompt 库模块
```

## 技术栈

- 纯原生 HTML / CSS / JavaScript，零依赖
- Chrome Extension Manifest V3
- 模块化架构，工具独立封装，惰性初始化

## License

MIT
