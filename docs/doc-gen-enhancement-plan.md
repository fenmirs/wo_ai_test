# 文档生成增强计划

## 目标
增强 API 文档生成功能，支持预览、内容选择性导出、多场景关联、Schema 友好展示。

---

## 任务列表

### 1. 执行结果绑定场景
- [ ] `executionResult` 改为按场景 ID 存储：`{ [scenarioId]: { targetResult, allResults, resultCards } }`
- [ ] 切换场景时保留/恢复该场景对应的执行结果
- [ ] 生成文档时自动取当前场景的执行结果，而不是最近一次全局结果

### 2. 右侧面板增加「文档」Tab
- [ ] `ResponsePanel` 增加 tab 切换：**响应** / **文档**
- [ ] 默认显示「响应」tab，点击文档按钮或手动切到「文档」tab
- [ ] 文档 tab 内实时渲染 Markdown 预览
- [ ] 文档 tab 顶部工具栏：导出按钮（保存/下载）、内容选择入口

### 3. 内容选择器
- [ ] 在文档 tab 顶部提供可折叠/可弹出的内容选择面板
- [ ] 可选内容项（默认全选）：

  | 内容项 | 说明 |
  |--------|------|
  | 基本信息 | 名称、方法、完整路径、分组 |
  | 请求头 | Headers |
  | 查询参数 | Query Params |
  | 请求体 - 结构表格 | 从 Schema 解析的字段表格 |
  | 请求体 - 原始内容 | 原始 JSON/XML/Text 代码块 |
  | 请求示例 | 多语言代码（cURL、JS fetch、Python） |
  | 响应示例 | 最近一次执行结果 + 状态码 + 耗时 |
  | 断言 | 断言语表达式 |
  | 依赖链 | 关联的依赖 API 列表 |
  | 场景描述 | 当前场景的描述文本 |
  | 常见错误码 | 固定表格 |

- [ ] 选择偏好保存到 `localStorage`

### 4. Schema 表格化展示
- [ ] 从 JSON Schema / XML Schema 提取字段路径、类型、是否必需、描述
- [ ] 以表格代替（或补充）原始代码块，提升可读性
- [ ] 原始内容作为「请求示例」独立展示

### 5. 多语言请求示例
- [ ] 根据当前请求配置自动生成代码片段：cURL、JavaScript fetch、Python requests
- [ ] 作为可选的文档内容项

### 6. 文档内容增强
- [ ] 当前文档内容过于单薄，补充：
  - 响应状态码、耗时
  - 响应 Headers
  - 响应体大小
  - 断言执行结果
- [ ] 依赖 API 说明（描述其在文档中的引用关系）

### 7. 导出保留
- [ ] 保留现有导出功能（下载 / Electron 保存对话框）
- [ ] 导出时遵循当前内容选择配置

---

## 技术要点
- Markdown 渲染：可用 `react-markdown` 或自行实现简单渲染
- Schema 解析：复用现有的 `JSONSchemaConverter` / `XMLSchemaConverter`
- 内容选择配置：存储在 `localStorage`，key 可按项目隔离
- 多场景执行结果：扩展 `apiData` / `ProjectManager` 的缓存结构
