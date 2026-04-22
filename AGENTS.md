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
│   │   ├── APIMain.js            # API 列表（分组）
│   │   ├── APIDetail.js          # API 详情展示
│   │   ├── APIEditor.js          # API 编辑器
│   │   ├── BottomBar.js          # 底部栏（环境+变量）
│   │   ├── EnvironmentList.js     # 环境列表管理
│   │   ├── VariableList.js        # 变量列表管理
│   │   ├── ChainSelector.js       # 调用链选择器
│   │   ├── InputDialog.js         # 输入对话框
│   │   └── ConfirmDialog.js       # 确认对话框
│   ├── utils/           # 工具类
│   │   ├── ProjectManager.js      # 项目数据管理器（单例）
│   │   └── APIExecutor.js         # API 执行器
│   ├── App.js           # 主应用组件
│   └── index.js         # 入口文件
├── public/               # 静态资源
│   └── demo/             # DEMO 项目数据
└── package.json
```

## 核心架构

### 数据管理
- **ProjectManager**（单例）：管理项目数据，支持自动保存（5秒间隔）
- 数据在内存中管理，通过 IPC 读写 `config.json`
- 使用 `markDirty()` 标记修改，`saveProject()` 保存到文件

### API 执行
- **APIExecutor**：执行 API 调用，支持调用链和动态标记
- 动态标记：
  - `{{ref:API名称.字段路径}}` - 引用其他 API 的返回值
  - `{{readFile:文件名}}` - 读取文件内容
  - `{{file:文件名}}` - 文件上传
  - `{变量名}` - 环境变量替换

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
  "groups": ["分组1", "分组2"],
  "apis": [
    {
      "chain": [],
      "name": "获取token",
      "group": "默认",
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
4. **API 名称**：API 名称必须唯一，用于调用链引用
5. **变量管理**：变量名在所有环境中必须保持一致
6. **断言表达式**：使用 JSONPath 表达式，支持 `==`、`!=`、`>`、`<`、`>=`、`<=`
7. **参数格式**：Params/Body 支持 `default`、`description`、`type`、`enabled` 字段
8. **Body 类型**：支持 none、form-data（含文件上传）、x-www-form-urlencoded、raw、JSON
9. **测试页面**：可编辑参数进行临时测试，不影响默认值；Content-Type 不可修改

## 技术栈

- Electron 28
- React 18
- Axios
- Tailwind CSS
- Lucide React
