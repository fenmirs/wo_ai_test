# AGENTS.md

## 项目概述

Electron + React 的 API 测试工具桌面应用，支持项目管理、环境配置、API 编辑和执行。

## 开发命令

```bash
# 开发模式（React Dev Server + Electron，无热加载）
npm run dev

# 热加载模式（React + Electron，带热加载，文件修改自动刷新窗口）
npm run dev:hot

# Electron 单独监听模式（只监听 electron 目录变化，重启 Electron）
npm run dev:electron

# 全热加载模式（React 热加载 + Electron 热加载，文件修改自动刷新）
npm run dev:all

# 仅启动 React Dev Server（浏览器调试）
npm run react-start

# 启动 Electron 应用（生产模式，需要先构建）
npm start

# 构建 React 应用
npm run build

# 构建 Electron 应用
npm run electron-build
```

### 热加载说明
- `dev:hot`: React 代码修改会自动刷新浏览器页面，Electron 主进程修改会自动重启
- `dev:electron`: 只监听 `electron/` 目录的修改，修改后自动重启 Electron
- `dev:all`: 综合热加载，同时支持 React 和 Electron 的热更新
- **生产环境**: 使用 `npm start` 或构建后运行，热加载功能会自动禁用

## 项目结构

```
api_test_ui/
├── electron/              # Electron 主进程
│   ├── main.js           # 主进程入口，IPC 通信处理
│   └── preload.js        # 预加载脚本
├── src/                  # React 前端
│   ├── components/       # React 组件
│   │   ├── APIMain.js            # API 列表（分组），支持拖拽
│   │   ├── APIDetail.js          # API 详情展示
│   │   ├── APIEditor.js          # API 编辑器
│   │   ├── BottomBar.js          # 底部栏（环境+变量+通知）
│   │   ├── EnvVarManager.js      # 环境列表管理
│   │   ├── ExecutionHistory.js   # 执行历史记录
│   │   ├── HistoryDetailDialog.js # 历史详情对话框
│   │   ├── InputDialog.js         # 输入对话框
│   │   ├── ConfirmDialog.js       # 确认对话框
│   │   ├── EmptyState.js         # 空状态页面
│   │   └── RefVariableSelector.js # 变量引用选择器（支持动态引用配置）
│   ├── utils/           # 工具类
│   │   ├── ProjectManager.js      # 项目数据管理器（单例）
│   │   ├── APIExecutor.js         # API 执行器（单个请求）
│   │   ├── ChainManager.js        # 依赖链管理器（编排执行）
│   │   └── NotificationManager.js # 通知管理器（按项目隔离）
│   ├── App.js           # 主应用组件
│   ├── App.css          # 应用样式
│   ├── index.js         # 入口文件
│   └── index.css        # 全局样式
├── public/               # 静态资源
│   └── demo/             # DEMO 项目数据
├── package.json
├── README.md
└── AGENTS.md
```

## 核心架构

### 数据管理
- **ProjectManager**（单例）：管理项目数据，支持自动保存（5秒间隔）
- **NotificationManager**（单例）：管理通知数据，按项目隔离，内存存储
- 数据在内存中管理，通过 IPC 读写 `config.json`
- 使用 `markDirty()` 标记修改，`saveProject()` 保存到文件

### API 执行
- **APIExecutor**：执行单个 API 调用，处理请求构建和响应解析
- **ChainManager**：管理依赖链执行，职责包括：
  1. 按顺序执行依赖链中的 API
  2. 收集各 API 执行结果（以 API ID 为 key）
  3. 解析目标 API 中的动态标记（`{{ref:apiId.fieldPath}}`）
  4. 将解析后的值注入到目标 API 请求中
- 动态标记：
  - `{{ref:API_ID.字段路径}}` - 引用其他 API 的返回值（**必须使用 API ID**）
  - `{{readFile:文件名}}` - 读取文件内容
  - `{{file:文件名}}` - 文件上传
  - `{变量名}` - 环境变量替换

### 变量引用配置
- **RefVariableSelector 组件**：可视化配置动态引用
  - 支持切换"静态值"和"动态引用"模式
  - 下拉列表按分组展示所有 API，附带 ID 提示
  - 选择 API 后输入字段路径，自动生成 `{{ref:apiId.fieldPath}}`
  - 适用于 Params、Headers、Body (form-data/x-www-form-urlencoded)

### 通知管理
- **NotificationManager**（单例）：管理所有项目的通知
- 按项目 ID 隔离存储，切换项目不删除缓存
- 通知存储在内存中，程序关闭后清空
- 支持添加、标记已读、全部已读、删除通知
- 监听器模式，通知变化时自动更新 UI
- 通知类型：系统通知、API 通知等（可扩展）

### IPC 通信
- `read-file` / `write-file` - 文件读写
- `read-config` / `save-config` - 项目配置读写
- `read-project-file` - 读取项目文件
- `list-directories` - 列出项目目录
- `select-directory` / `select-file` - 文件对话框

## 开发规范

### 命名约定
- 组件名：大驼峰（PascalCase）
- 函数名：小写下划线（snake_case）
- 常量名：大写下划线（UPPER_CASE）

### 代码风格
- 使用 UTF-8 编码
- 使用中文注释和用户界面
- 组件化设计，职责单一

### 项目配置格式
每个项目目录需要包含 `config.json`：

```json
{
  "profile": [
    {
      "activate": true,
      "name": "dev",
      "domain": "192.168.17.128",
      "api-prj": ":25710/api-prj"
    }
  ],
  "groups": [
    {"id": "grp_001", "name": "认证模块", "parentId": null},
    {"id": "grp_002", "name": "订单模块", "parentId": null}
  ],
  "apis": [
    {
      "id": "api_token_001",
      "chain": [],
      "name": "获取token",
      "group": "grp_001",
      "api_path": "{domain}{api-prj}/openapi/security/token",
      "method": "POST",
      "header": {},
      "param": {
        "page": {
          "default": "1",
          "description": "页码",
          "type": "string",
          "enabled": true
        }
      },
      "body": {
        "type": "form-data",
        "formData": {
          "username": {
            "default": "",
            "description": "用户名",
            "type": "string",
            "enabled": true
          },
          "avatar": {
            "default": "",
            "description": "头像文件",
            "type": "file",
            "enabled": true
          }
        }
      },
      "successAssert": "$.code == 200"
    },
    {
      "id": "api_order_001",
      "chain": ["api_token_001"],
      "name": "接收订单",
      "group": "grp_002",
      "api_path": "{domain}{api-prj}/openapi/order/receive",
      "method": "POST",
      "header": {
        "Content-Type": "application/json",
        "Authorization": "{{ref:api_token_001.data.token}}"
      },
      "param": {},
      "body": {
        "type": "json",
        "content": "{\"orderId\": \"12345\"}"
      },
      "successAssert": "$.code == 200"
    }
  ]
}
```

### 参数类型
支持以下类型：`string`、`number`、`boolean`、`file`

### Body 类型
- **none** - 无 body
- **form-data** - 表单数据（支持文件上传）
- **x-www-form-urlencoded** - URL 编码表单
- **raw** - 原始文本
- **json** - JSON 格式

## 重要注意事项

1. **环境检测**：通过 `window.electron` 检测是否在 Electron 环境中
2. **开发模式**：浏览器模式下使用模拟数据，不进行文件操作
3. **自动保存**：项目加载后自动启用 5 秒间隔的自动保存
4. **API ID**：API ID 是唯一标识，用于调用链引用和动态参数引用（非 API 名称）
5. **变量管理**：变量名在所有环境中必须保持一致
6. **断言表达式**：使用 JSONPath 表达式，支持 `==`、`!=`、`>`、`<`、`>=`、`<=`
7. **参数格式**：Params/Body 支持 `default`、`description`、`type`、`enabled` 字段
8. **Body 类型**：支持 none、form-data（含文件上传）、x-www-form-urlencoded、raw、JSON
9. **测试页面**：可编辑参数进行临时测试，不影响默认值；Content-Type 不可修改
10. **通知管理**：通知按项目隔离存储在内存中，切换项目不删除缓存
11. **API 拖拽**：支持拖动 API 项目到其他分组来改变分组
12. **引用配置**：Params/Headers/Body 推荐使用 `RefVariableSelector` 可视化配置引用，Raw Body 需手动输入 `{{ref:apiId.fieldPath}}`

## 技术栈

- Electron 28
- React 18
- Axios
- Tailwind CSS
- Lucide React
- React Syntax Highlighter
