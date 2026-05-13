# WoAiTest

基于 Electron + React 的 API 测试工具桌面应用，提供直观的图形界面来管理项目、配置环境和执行 API 测试。

## 功能特性

### 核心功能
- ✅ **项目管理** - 扫描目录导入项目，多项目快速切换，数据自动保存
- ✅ **环境配置** - 底部栏快速切换环境，多环境变量矩阵管理
- ✅ **API 分组** - 自定义层级分组，支持拖拽移动分组和 API
- ✅ **API 编辑** - 完整的 API 配置编辑，支持 Params/Headers/Body/断言
- ✅ **URL 构建器** - 可视化片段编辑，支持环境变量注入
- ✅ **调用链** - 自动检测 `{{ref:...}}` 依赖，按顺序执行
- ✅ **JSON/XML 可视化编辑** - JSON 和 XML 均支持代码模式和 UI 树模式双编辑
- ✅ **变量引用** - 可视化选择器配置 `{{ref:apiId.fieldPath}}`
- ✅ **断言验证** - JSONPath 表达式，支持多条断言
- ✅ **Body 类型** - none / form-data / x-www-form-urlencoded / raw
- ✅ **自动保存** - 每 5 秒自动保存，支持脏数据检测
- ✅ **通知系统** - 按项目隔离的内存通知，支持文件位置打开等操作按钮
- ✅ **执行历史** - 保存执行记录，支持查看详情和恢复请求
- ✅ **主题切换** - 暗黑/白昼两种主题，CSS 变量驱动，欢迎页和主界面均支持切换
- ✅ **面板系统** - 三栏可调宽度布局，面板可独立显隐
- ✅ **API 文档生成** - 一键生成 Markdown 文档，支持 Electron 保存和浏览器下载
- ✅ **响应展示** - 多卡片显示调用链各环节结果，请求/响应详情查看
- ✅ **Toast 提示** - 顶部居中自动消失的通知提示（保存成功/错误等瞬时消息）

### 界面布局

```
┌──────────────────┬─────────────────────┬──────────────────┐
│  左侧面板        │  中间面板            │  右侧面板         │
│  API 分组树      │  API 编辑/执行器     │  响应面板         │
│  模糊搜索        │  Params/Headers/    │  链结果卡片       │
│  拖拽排序        │  Body/断言/历史      │  请求详情         │
│  操作菜单        │  URL 构建器          │  响应详情         │
│  宽度: 200-600px │  宽度: 最小 350px    │  宽度: 300-800px  │
├──────────────────┴─────────────────────┴──────────────────┤
│  底部栏: 项目切换 / 环境选择 / 变量查看 / 通知 / 面板切换 / 主题 / DevTools │
└───────────────────────────────────────────────────────────┘
```

## 项目结构

```
api_test_ui/
├── electron/              # Electron 主进程
│   ├── main.js           # 主进程入口，IPC 通信，HTTP 请求代理
│   └── preload.js        # 预加载脚本，暴露 API 到渲染进程
├── src/                  # React 前端
│   ├── components/       # React 组件
│   │   ├── APIMain.js            # API 分组树（搜索/拖拽/操作菜单）
│   │   ├── APIDetail.js          # API 编辑器 + 执行器
│   │   ├── BottomBar.js          # 底部栏（项目/环境/通知/面板/主题）
│   │   ├── ResponsePanel.js      # 响应展示面板
│   │   ├── MonacoView.js         # Monaco 编辑器统一封装
│   │   ├── CodeEditor.js         # 代码编辑器（关联语言类型）
│   │   ├── BodyTreeEditor.js        # JSON/XML 可视化树编辑器
│   │   ├── RefVariableSelector.js # 变量引用可视化选择器
│   │   ├── EnvVarManager.js      # 环境变量矩阵管理
│   │   ├── ExecutionHistory.js   # 执行历史记录列表
│   │   ├── HistoryDetailDialog.js # 历史详情弹窗
│   │   ├── ChainSelector.js      # 依赖链选择器
│   │   ├── InputDialog.js        # 输入对话框
│   │   ├── ConfirmDialog.js      # 确认对话框
│   │   ├── EmptyState.js         # 空状态/欢迎页
│   │   ├── Toast.js              # Toast 提示组件（顶部居中，自动消失）
│   │   └── ProjectSelector.js    # 项目选择器
│   ├── utils/           # 工具类（单例模式）
│   │   ├── ProjectManager.js      # 项目数据管理器
│   │   ├── APIExecutor.js         # 单 API 执行器
│   │   ├── ChainManager.js        # 依赖链执行编排
│   │   ├── NotificationManager.js # 通知管理器（按项目隔离）
│   │   ├── APIDocGenerator.js     # API 文档生成器
│   │   └── JSONSchemaConverter.js # JSON/Schema 互转
│   │   └── XMLSchemaConverter.js  # XML/Schema 互转（基于 fast-xml-parser）
│   ├── App.js           # 主应用组件（三栏布局 + 状态管理）
│   ├── App.css          # 应用布局样式
│   ├── index.js         # 入口文件
│   └── index.css        # 全局样式 + CSS 变量主题
├── data/                # 项目数据目录
│   ├── project.json     # 项目索引
│   └── *_config.json    # 各项目配置文件
├── public/              # 静态资源
│   ├── index.html       # HTML 模板
│   └── demo/            # DEMO 项目数据（已废弃）
├── package.json
├── AGENTS.md            # 开发助手指南
└── README.md
```

## 环境要求

- Node.js 16+
- npm 或 yarn

## 安装依赖

```bash
cd api_test_ui
npm install
```

## 运行方式

### 开发模式（React Dev Server + Electron）

```bash
# 开发模式（React + Electron，无热加载）
npm run dev

# 热加载模式（React + Electron 热加载，文件修改自动刷新窗口）
npm run dev:hot

# 仅 Electron 热加载（监听 electron/ 目录）
npm run dev:electron

# 全热加载模式（React + Electron 均热加载）
npm run dev:all
```

### 仅启动前端（浏览器调试）

```bash
npm run react-start
```

访问 http://localhost:3000。浏览器模式下使用模拟数据，不进行文件操作。

### 生产模式

```bash
# 构建 React 应用
npm run build

# 启动 Electron 应用（生产模式，需先构建）
npm start
```

### 构建桌面安装包

```bash
# windows打包：管理员身份进入powershell运行
npm run electron-build
```
#### 由于github某些包下载缓慢或无法下载，现提供解决办法
我先下载好了放到了项目下的[github下载包](github下载包)目录
1. [winCodeSign](github下载包/winCodeSign-2.6.0.7z) 包解压后放到`C:\Users\用户名\AppData\Local\electron-builder\Cache\winCodeSign`
2. [nsis](github下载包/nsis-3.0.4.1.7z) 包解压后放到`C:\Users\用户名\AppData\Local\electron-builder\Cache\nsis`
3. [nsis-resources](github下载包/nsis-resources-3.4.1.7z) 包解压后放到`C:\Users\用户名\AppData\Local\electron-builder\Cache\nsis`

类似于如下图，版本可能不同
![alt text](github下载包/微信图片_20260512152744_63_4.png)

支持 Windows（NSIS）、macOS（DMG）、Linux（AppImage）。

## 使用说明

### 1. 创建/导入项目

启动应用后，在欢迎页可以：
- **新建项目** - 输入项目名称，选择保存目录
- **导入项目** - 选择包含项目配置文件的目录（自动扫描）

项目数据以 `{projectId}_config.json` + `{projectId}_history.json` 格式存储。

### 2. 管理环境

- **切换环境** - 底部栏点击环境名称选择
- **编辑环境** - 底部栏点击齿轮图标进入环境变量矩阵
- **环境变量** - 支持多环境独立配置，变量名在所有环境保持一致

### 3. 管理 API

- **新增 API** - 分组标题右侧 + 按钮，或操作菜单选择
- **搜索 API** - 顶部搜索框支持按名称、路径、ID 模糊匹配
- **分组管理** - 支持嵌套层级、拖拽重排、复制、重命名
- **API 操作** - 右键菜单支持复制、复制 ID、删除

### 4. 编辑 API

每个 API 包含以下配置项：

| 配置项 | 说明 |
|--------|------|
| **名称** | API 标识名称 |
| **方法** | GET / POST / PUT / DELETE / PATCH / HEAD / OPTIONS |
| **URL** | 可视化片段编辑器，支持 `{变量名}` 引用环境变量 |
| **Params** | URL 查询参数（Key-Value 表格） |
| **Headers** | 请求头（Content-Type 自动管理） |
| **Body** | none / form-data / x-www-form-urlencoded / raw |
| **Raw 内容** | 支持 Text / JSON / XML / HTML，JSON 和 XML 均有代码和 UI 树双模式 |
| **断言** | JSONPath 断言表达式，支持多条 |

### 5. JSON/XML 可视化编辑器

JSON 和 XML 均支持代码模式与 UI 树模式双向编辑：

- **代码模式** - Monaco 编辑器语法高亮，实时校验
- **UI 树模式** - 树形结构展示，支持添加/删除/修改节点
- **类型切换** - JSON 支持 string/number/boolean/null/object/array
- **XML 特性** - 支持属性管理、混合内容检测（可开关）
- **格式校验** - JSON 和 XML 均实时校验，格式错误时 UI 按钮自动禁用并显示错误角标
- **数据同步** - 代码与 UI 模式之间双向同步，自动转换
- **值引用** - 单元格可使用 `{{ref:apiId.fieldPath}}` 引用其他 API 返回值

使用 `{{ref:apiId.字段路径}}` 格式引用其他 API 的响应结果：

- **Params/Headers/Body (form-data/x-www-form-urlencoded)** - 使用 `RefVariableSelector` 可视化选择器配置
- **Raw Body** - 手动输入 `{{ref:apiId.fieldPath}}` 格式
- **JSON UI 模式** - 在字符串值中可直接引用

### 6. 发送请求

点击"发送"按钮执行 API（自动执行依赖链中的前置 API）。

### 7. 生成文档

点击"生成文档"按钮生成 Markdown 格式的 API 文档：
- **Electron 环境** - 弹出文件保存对话框，保存至本地文件
- **浏览器环境** - 直接下载

## 动态标记

| 标记格式 | 说明 | 示例 |
|----------|------|------|
| `{{ref:API_ID.字段路径}}` | 引用其他 API 返回值 | `{{ref:api_token_001.data.token}}` |
| `{{readFile:文件名}}` | 读取文件内容为字符串 | `{{readFile:NC2Lims.xml}}` |
| `{{file:文件名}}` | 文件上传 | `{{file:upload.txt}}` |
| `{变量名}` | 引用环境配置变量 | `{domain}{api-prj}/openapi/...` |

## 断言表达式

使用 JSONPath 表达式验证响应结果，支持操作符：`==`、`!=`、`>`、`<`、`>=`、`<=`

```
$.code == 200
$.data.list.length > 0
$.success == true
```

## 项目配置格式

每个项目包含一个 `{projectId}_config.json` 文件：

```json
{
  "projectName": "项目名称",
  "profile": [
    { "activate": true, "name": "dev", "domain": "192.168.1.1", "api-prj": ":8080/api" }
  ],
  "groups": [
    { "id": "grp_001", "name": "认证模块", "parentId": null }
  ],
  "apis": [
    {
      "id": "api_001",
      "name": "获取 token",
      "group": "grp_001",
      "api_path": "{domain}{api-prj}/token",
      "method": "POST",
      "header": { "Content-Type": "application/json" },
      "param": {},
      "body": { "type": "json", "content": "{}" },
      "successAssert": "$.code == 200"
    }
  ]
}
```

### Body 类型

| 类型 | 说明 | 支持文件上传 |
|------|------|------------|
| none | 无请求体 | - |
| form-data | 表单数据 | ✅ |
| x-www-form-urlencoded | URL 编码表单 | ❌ |
| raw | 原始内容（text/json/xml/html） | ❌ |

### 参数类型

`string`、`number`、`boolean`、`file`（仅 form-data）

## 技术栈

- **Electron 28** - 桌面应用框架
- **React 18** - UI 框架
- **Monaco Editor** - 代码编辑器（@monaco-editor/react）
- **Axios** - HTTP 请求库（Electron 主进程执行）
- **Lucide React** - 图标库
- **fast-xml-parser** - XML 解析与校验
- **react-syntax-highlighter** - 代码高亮
- **CSS Custom Properties** - 主题变量驱动样式

## 开发规范

- **UTF-8 编码**，中文界面和注释
- **组件名**: 大驼峰命名（PascalCase）
- **函数名**: 小写下划线（snake_case）
- **常量名**: 大写下划线（UPPER_CASE）
- 组件化设计，职责单一

## 重要注意事项

1. **API ID 是唯一标识** - 用于调用链引用和动态参数引用（非 API 名称）
2. **环境检测** - 通过 `window.electron` 检测 Electron 环境
3. **数据存储** - 每项目独立 `{id}_config.json` + `{id}_history.json`
4. **自动保存** - 项目加载后自动 5 秒间隔保存
5. **通知** - 按项目隔离存储在内存中，切换项目不删除缓存
6. **Content-Type** - 由 Body 类型自动管理，不可手动修改
7. **SSL** - Electron 全局忽略自签名证书错误（`rejectUnauthorized: false`）
8. **CORS** - HTTP 请求通过 Electron 主进程发出，不受浏览器 CORS 限制
9. **面板** - 至少保持一栏可见，宽度可拖拽调整（左 200-600px，右 300-800px）

## 变更记录

### 2026-05-13

#### XML 解析引擎替换
- 用 `fast-xml-parser` 替换 `DOMParser`，不再依赖浏览器原生 DOM API
- 新增 `validateXml()` 基于 `XMLValidator.validate()` 做 well-formedness 校验
- 新增 `hasMixedContent()` 基于 `preserveOrder` 模式检测混合内容（文本与标签混写）

#### XML 编辑器流程对齐 JSON
- 新增 `xmlParseError` 状态，代码模式实时校验 XML 格式
- 格式错误时 UI 按钮自动禁用 + 红色 `!` 角标
- 保存时校验 XML 格式，不合法弹 Toast 阻止保存

#### 混合内容开关
- 模式切换栏新增 `FileText` 图标按钮，控制混合内容是否允许
- 默认关闭：检测到混合内容 → UI 按钮禁用 + 保存拦截
- 开启后：混合内容不报错，数据直接透传

#### 树编辑器重命名 + 增强
- `JSONTreeEditor` → `BodyTreeEditor`，同时处理 JSON 和 XML
- XML 新建子元素自动附带 `#text` 节点，UI↔Code 切换数据不丢失
- 新增 `data-node-id` + `scrollToId`，添加子元素后自动滚动到新节点
- 模式切换遮罩：UI→Code 切换时显示进度蒙层，防止待处理变更未同步

## 许可证

MIT
