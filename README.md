# API Test UI

基于 Electron + React 的 API 测试工具 UI 版本，提供直观的图形界面来管理项目、配置环境和执行 API 测试。

## 功能特性

### 核心功能
- ✅ **项目管理** - 支持导入项目，数据在内存中管理
- ✅ **环境配置** - 底部栏快速切换环境，支持多环境管理
- ✅ **变量管理** - 独立变量管理，支持各环境单独编辑
- ✅ **API 分组** - 支持自定义分组，方便组织 API
- ✅ **API 列表** - 模糊搜索，快速定位目标接口
- ✅ **API 编辑** - 完整的 API 配置编辑功能
- ✅ **调用链** - 自动按顺序执行依赖的 API
- ✅ **动态参数** - 支持 `{{ref:...}}`、`{{readFile:...}}` 等动态标记
- ✅ **断言验证** - 使用 JSONPath 表达式进行响应断言
- ✅ **自动保存** - 每 5 秒自动保存，支持手动保存
- ✅ **主题切换** - 支持暗黑/白昼两种主题

### 界面设计
- 📱 **左侧面板** - API 列表（分组显示）
- 📄 **右侧面板** - API 详情/编辑、环境列表、变量列表
- 🔧 **底部栏** - 环境切换、变量管理
- 🎨 **现代化 UI** - 流畅的动画和过渡效果

## 项目结构

```
api_test_ui/
├── electron/              # Electron 主进程
│   ├── main.js           # 主进程入口
│   └── preload.js        # 预加载脚本（IPC 通信）
├── public/               # 静态资源
│   ├── index.html
│   └── demo/             # DEMO 项目
├── src/                  # React 前端
│   ├── components/       # React 组件
│   │   ├── APIMain.js            # API 列表（分组）
│   │   ├── APIDetail.js          # API 详情展示
│   │   ├── APIEditor.js          # API 编辑器
│   │   ├── BottomBar.js          # 底部栏（环境+变量）
│   │   ├── EnvironmentList.js    # 环境列表管理
│   │   ├── VariableList.js       # 变量列表管理
│   │   └── EmptyState.js         # 空状态页面
│   ├── utils/           # 工具类
│   │   ├── ProjectManager.js     # 项目数据管理器
│   │   └── APIExecutor.js        # API 执行器
│   ├── App.js           # 主应用组件
│   ├── App.css          # 应用样式
│   ├── index.js         # 入口文件
│   └── index.css        # 全局样式
├── package.json         # 项目配置
├── start.sh            # 启动脚本
└── README.md           # 项目说明
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

### 开发模式（浏览器）

```bash
npm run react-start
```

访问 http://localhost:3000，使用 DEMO 数据进行开发和调试。

### Electron 模式

```bash
npm start
```

启动完整的桌面应用，支持文件操作功能。

### 生产构建

```bash
npm run build
```

## 使用说明

### 1. 导入项目

启动应用后，点击"使用 DEMO"快速体验，或点击"导入项目"选择包含 `config.json` 的目录。

### 2. 切换环境

底部栏左侧显示当前环境，点击可切换，右侧显示当前环境变量。

### 3. 管理变量

- 点击底部栏的"变量"图标查看当前环境变量
- 点击"编辑"按钮进入变量管理页面
- 支持新增变量（应用到所有环境）
- 支持单独编辑每个环境的变量值
- 支持删除变量（显示 API 使用情况）

### 4. 管理 API

- 点击左侧"新增"按钮，选择"新增 API"或"新增分组"
- 点击 API 查看详情
- 点击编辑按钮修改 API 配置
- 点击删除按钮删除 API

### 5. 编辑 API 配置

API 编辑器支持编辑以下配置：

- **基本信息** - API 名称、分组、方法、路径
- **调用链** - 依赖的 API 列表
- **HEADER** - 请求头（JSON 格式）
- **URL 参数** - 查询参数（JSON 格式）
- **BODY** - 请求体（JSON 格式）
- **成功断言** - JSONPath 断言表达式

### 6. 保存配置

- 自动保存：每 5 秒自动保存未保存的修改
- 手动保存：点击顶部保存按钮立即保存
- 关闭项目前会提示保存未保存的修改

## 动态标记

支持以下动态标记：

- `{{ref:API名称.字段路径}}` - 引用其他 API 的返回值
  - 示例：`{{ref:获取token.data.obj.token}}`
  
- `{{readFile:文件名}}` - 读取文件内容作为字符串
  - 示例：`{{readFile:NC2Lims.xml}}`
  
- `{{file:文件名}}` - 文件上传
  - 示例：`{{file:upload.txt}}`

- `{变量名}` - 引用环境配置中的变量
  - 示例：`{domain}{api-prj}/openapi/...`

## 断言表达式

支持使用 JSONPath 表达式进行响应断言：

- `$.code == 200` - 检查 code 字段是否等于 200
- `$.success == true` - 检查 success 字段是否为 true
- `$.data.count > 0` - 检查 count 字段是否大于 0

支持的操作符：`==`、`!=`、`>`、`<`、`>=`、`<=`

## 配置文件格式

每个项目需要包含 `config.json` 配置文件：

```json
{
  "profile": [
    {
      "activate": true,
      "name": "dev",
      "domain": "192.168.17.128",
      "api-prj": ":25710/api-prj"
    },
    {
      "activate": false,
      "name": "pre",
      "domain": "10.17.2.1",
      "api-prj": ":24110/api-prj"
    }
  ],
  "apis": [
    {
      "chain": [],
      "name": "获取token",
      "api_path": "{domain}{api-prj}/openapi/security/token",
      "method": "POST",
      "header": {
        "Content-Type": "application/json"
      },
      "param": {},
      "body": {
        "appId": "NC6bNAttXRh4",
        "appSecret": "67ZwYAzTpzVUHJBME2WSXmV6qvZT4ZWS"
      },
      "successAssert": "$.code == 200"
    },
    {
      "chain": ["获取token"],
      "name": "接收NC订单",
      "api_path": "{domain}{api-prj}/openapi/order/nc/receive",
      "method": "POST",
      "header": {
        "Content-Type": "text/xml",
        "appId": "{{ref:获取token.data.obj.appId}}",
        "token": "{{ref:获取token.data.obj.token}}"
      },
      "body": "{{readFile:NC2Lims.xml}}",
      "successAssert": "$.success == true"
    }
  ]
}
```

## 技术栈

- **Electron 28** - 桌面应用框架
- **React 18** - UI 框架
- **Axios** - HTTP 请求库
- **Monaco Editor** - 代码编辑器
- **Lucide React** - 图标库
- **React Syntax Highlighter** - 代码高亮

## 开发规范

### 代码风格
- 使用 UTF-8 编码
- 遵循 ESLint 规则
- 使用中文注释和用户界面
- 组件化设计，职责单一

### 命名约定
- 组件名：大驼峰（PascalCase）
- 函数名：小写下划线（snake_case）
- 常量名：大写下划线（UPPER_CASE）

### Git 提交规范
- feat: 新功能
- fix: 修复 bug
- refactor: 重构
- style: 样式调整
- docs: 文档更新
- chore: 构建/工具配置

## 注意事项

1. 项目数据在内存中管理，关闭应用前记得保存
2. 变量名在所有环境中必须保持一致
3. 删除变量前会检查 API 引用情况
4. API 名称不能重复
5. 敏感信息（如 appSecret）请妥善保管

## 开发计划

- [ ] 支持 API 执行功能
- [ ] 支持批量执行多个 API
- [ ] 支持测试用例导入/导出
- [ ] 支持测试报告生成
- [ ] 支持插件扩展

## 许可证

MIT