# KVTable 组件改造计划

## 概述

将 `APIDetail.js` 中的 `renderKVTable` 提取为独立组件 `KVTable`，并新增底部面板 `KVBottomPanel`，扩展类型系统支持 Json String、Xml String、Ref Variable，统一 Params、Headers、Body form-data/x-www 三处的 KV 编辑体验。

---

## 一、新增/修改文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| ✅ 新增 | `src/components/KVTable.js` | KVTable 组件 |
| ✅ 新增 | `src/components/KVTable.css` | KVTable 样式 |
| ✅ 新增 | `src/components/KVBottomPanel.js` | 底部面板组件 |
| ✅ 新增 | `src/components/KVBottomPanel.css` | 底部面板样式 |
| ✏️ 修改 | `src/components/APIDetail.js` | 移除 renderKVTable，集成新组件 |
| ✏️ 修改 | `src/components/APIDetail.css` | 移除 KVTable 相关样式（迁移到 KVTable.css） |

---

## 二、类型系统（`KVTable.js`）

### 2.1 类型枚举

```js
const KV_TYPES = [
  { value: 'string',  label: 'String' },
  { value: 'number',  label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'file',    label: 'File' },
  { value: 'json',    label: 'Json String' },
  { value: 'xml',     label: 'Xml String' },
  { value: 'ref',     label: 'Ref Variable' },
];
```

### 2.2 类型与底部面板编辑器映射

| 类型 | 数据格式 | 底部面板编辑器组件 | CodeEditor language |
|------|---------|-------------------|-------------------|
| `string` | 纯文本 | CodeEditor | `plaintext` |
| `number` | 纯文本 | CodeEditor | `plaintext` |
| `boolean` | `"true"` / `"false"` | Switch / 下拉框 | - |
| `file` | 单文件: `"a.png"` / 多文件: `["a.png","b.png"]` | 文件列表管理器 | - |
| `json` | JSON 字符串 | CodeEditor | `json` |
| `xml` | XML 字符串 | CodeEditor | `xml` |
| `ref` | `"{{ref:apiId@scnId.path}}"` | 结构化构建器（API→场景→字段路径） | - |

### 2.3 新增类型到 `prepareForExecute` 的兼容

`paramObj` 构建时保持 `type` 字段传递，下游 `APIExecutor` 不受影响（执行时只使用 `default` 值）。

---

## 三、列布局（`KVTable.js`）

### 3.1 新列顺序

| # | 列标识 | 列标题 | 内容 | 备注 |
|---|--------|--------|------|------|
| 1 | `check` | ✅ | Checkbox | 启用/禁用 |
| 2 | `key` | Key | `<input>` 输入框 | 常规文本输入 |
| 3 | `type` | 类型 | `<select>` 下拉框 | 条件显示（Header 无类型列） |
| 4 | `value` | 值 | **只读预览** + 点击触发底部面板 | 显示内容见 §3.2 |
| 5 | `desc` | 备注 | **只读预览** + 点击触发底部面板 | 显示内容见 §3.3 |
| 6 | `action` | 操作 | 🗑️ 删除按钮 | Content-Type 行隐藏 |

### 3.2 "值"列显示规则

| 类型 | 显示内容 |
|------|---------|
| `string` / `number` / `boolean` | 截取前 80 字符，过长加 `...`；空值显示灰色 `(空)` |
| `file` | `📎 文件名`；多文件 `📎 文件名 (+N)` |
| `json` | `{ JSON } 24行 · 1,230字符` |
| `xml` | `< XML > 12行 · 860字符` |
| `ref` | `🔗 API名称.字段路径`（从 `{{ref:...}}` 解析）；解析失败显示原始 ID |

### 3.3 "备注"列显示规则

- 截取前 40 字符，过长加 `...`
- 空值显示灰色 `(空)`

### 3.4 点击行为

点击"值"或"备注"列的显示区域 → 底部面板打开/切换至该行对应字段。

---

## 四、底部面板（`KVBottomPanel.js` / `KVBottomPanel.css`）

### 4.1 位置与布局

- 固定在 `APIDetail` 内容区底部、tab-content 下方、assertion-bar 上方
- 执行结果在右侧面板 `ResponsePanel` 中，与底部面板互不冲突
- 面板高度可拖拽调节（最小 100px，最大 60vh）
- 顶部标题栏显示当前编辑上下文

### 4.2 面板标题栏

```
┌────────────────────────────────────────────────────────────┐
│ ◱ 编辑值: Content-Type → String                  ↕ 收起   │
│ ───────────────────────────────────────────────────────── │
```

格式：`◱ 编辑{字段类型}: {Key名称} → {类型标签}`

- 字段类型：`值` 或 `备注`
- 右上角 ↕ 箭头折叠/展开面板

### 4.3 各类型编辑器内容

#### 4.3.1 String / Number → CodeEditor (plaintext)

```
┌────────────────────────────────────────────────────────────┐
│ ◱ 编辑值: username → String                       ↕ 收起   │
│ ───────────────────────────────────────────────────────── │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  (CodeEditor / language="plaintext")                 │ │
│  │  admin                                               │ │
│  │                                                      │ │
│  └──────────────────────────────────────────────────────┘ │
│  行:1  字符:5                                             │
└────────────────────────────────────────────────────────────┘
```

- 修改即生效，无确认按钮
- 显示行号、字符统计

#### 4.3.2 Boolean → Switch

```
┌────────────────────────────────────────────────────────────┐
│ ◱ 编辑值: isActive → Boolean                      ↕ 收起   │
│ ───────────────────────────────────────────────────────── │
│                                                            │
│  true  [●━━━━━━━━━━━━━━○]  false                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

- 点击切换 true/false
- 即时写入 `item.default`

#### 4.3.3 File → 多文件管理器

```
┌────────────────────────────────────────────────────────────┐
│ ◱ 编辑值: attachments → File                       ↕ 收起   │
│ ───────────────────────────────────────────────────────── │
│                                                            │
│  已选文件 (3):                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 📎 image1.png  4.2MB   [✕]                          │ │
│  │ 📎 report.pdf  1.1MB   [✕]                          │ │
│  │ 📎 data.xlsx   256KB   [✕]                          │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  [+ 添加文件]                                              │
│                                                            │
│  拖拽文件到此处或点击上方按钮                                │
└────────────────────────────────────────────────────────────┘
```

- `item.default` 支持 `string`（单文件）或 `string[]`（多文件）
- 添加文件：支持多选（`input[multiple]`）
- 文件名显示并附带估算大小
- ✕ 按钮移除单个文件
- Body form-data 模式下自动启用

#### 4.3.4 Json String → CodeEditor (json)

```
┌────────────────────────────────────────────────────────────┐
│ ◱ 编辑值: requestBody → Json String                ↕ 收起   │
│ ───────────────────────────────────────────────────────── │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  (CodeEditor / language="json")                      │ │
│  │  {                                                    │ │
│  │    "name": "张三",                                    │ │
│  │    "age": 25                                          │ │
│  │  }                                                    │ │
│  └──────────────────────────────────────────────────────┘ │
│  ⚠ JSON 格式错误: 期望 , 或 } 位置 3:15       (仅语法校验)  │
│  行:3  字符:42                                             │
└────────────────────────────────────────────────────────────┘
```

- CodeEditor `language="json"`，语法高亮 + 实时校验
- 校验结果：黄色警告提示（不影响编辑），错误信息显示在状态栏
- 不转换 schema（与 body raw 的 JSON 编辑器不同）

#### 4.3.5 Xml String → CodeEditor (xml)

```
┌────────────────────────────────────────────────────────────┐
│ ◱ 编辑值: payload → Xml String                      ↕ 收起   │
│ ───────────────────────────────────────────────────────── │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  (CodeEditor / language="xml")                       │ │
│  │  <root>                                               │ │
│  │    <item id="1"/>                                     │ │
│  │  </root>                                              │ │
│  └──────────────────────────────────────────────────────┘ │
│  ⚠ XML 格式错误: 标签不匹配                       (仅语法校验) │
│  行:5  字符:120                                            │
└────────────────────────────────────────────────────────────┘
```

#### 4.3.6 Ref Variable → 结构化构建器

```
┌────────────────────────────────────────────────────────────┐
│ ◱ 编辑值: authorization → Ref Variable             ↕ 收起   │
│ ───────────────────────────────────────────────────────── │
│                                                            │
│  引用值                                                     │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ {{ref:api_zzz@scn_login.  [data.token          ] }} │ │
│  │                                          [清除所有]  │ │
│  └──────────────────────────────────────────────────────┘ │
│                           ↑ 用户只输入字段路径              │
│  ───────────────────────────────────────────────────────── │
│                                                            │
│  选择 API                                                   │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 🔍 搜索 API...                                       │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 用户管理                                              │ │
│  │   ├─ 获取用户列表                    api_xxx...  ○     │ │
│  │   ├─ 创建用户                        api_yyy...  ○     │ │
│  │   └─ 删除用户                        api_zzz...  ●     │ │
│  │ 订单管理                                              │ │
│  │   ├─ 创建订单                        api_aaa...  ○     │ │
│  │   └─ 查询订单                        api_bbb...  ○     │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  场景                                                      │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ● 默认场景  ○ 登录态场景  ○ 异常参数场景             │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

- 引用值区域：灰色前缀 `{{ref:apiId@scenarioId.` + 白色输入框（字段路径）+ 灰色 `}}` 自动拼接
- 用户只输入字段路径后半段
- 选择 API → 场景自动刷新 → 字段路径可手动输入
- 切换 API 时，如果字段路径在新 API 的场景中仍有效则保留，否则清空
- "清除所有"按钮：重置全部选择，`item.default` 置空

### 4.4 备注编辑

点击"备注"列 → 底部面板始终渲染 CodeEditor (plaintext)，无论该行类型是什么。

```
┌────────────────────────────────────────────────────────────┐
│ ◱ 编辑备注: username → String                      ↕ 收起   │
│ ───────────────────────────────────────────────────────── │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  (CodeEditor / language="plaintext")                 │ │
│  │  用户的登录账号，必填                                  │ │
│  └──────────────────────────────────────────────────────┘ │
│  行:1  字符:9                                              │
└────────────────────────────────────────────────────────────┘
```

### 4.5 Key 为空时禁用编辑

当 `item.key` 为空（`!item.key.trim()`），底部面板内容区显示：

```
       ⚠ 请先填写 Key 名称
```

编辑器不渲染，或渲染为只读。

### 4.6 面板状态管理

```js
// KVBottomPanel 内部状态
const [panelState, setPanelState] = useState({
  visible: false,       // 面板是否展开
  section: null,        // 'param' | 'header' | 'formData' | 'xwww'
  rowIndex: null,       // 行号
  field: 'value',       // 'value' | 'description'
  height: 250,          // 面板高度（px）
});
```

切换逻辑：
- 点击同一行的同一列：无变化
- 点击不同行/列：切换行/字段，面板保持展开
- 切换 tab（Params ↔ Headers ↔ Body）：面板保持展开，内容切换为新 tab 的当前行
- 折叠后显示一条细标签栏，点击展开

---

## 五、KVTable 组件接口

### Props

```js
function KVTable({
  items,             // Item[]
  onItemsChange,     // (newItems: Item[]) => void
  section,           // 'param' | 'header' | 'formData' | 'xwww'
  showType,          // boolean (Header 不显示类型列)
  showFileType,      // boolean (form-data 启用文件类型)
  onValueClick,      // (index: number) => void  触发底部面板编辑值
  onDescClick,       // (index: number) => void  触发底部面板编辑备注
  onActiveRowChange, // (index: number) => void  高亮当前编辑行
  activeRowIndex,    // number | null            当前高亮行
  excludeApiId,      // string                   用于 RefVariableSelector
  theme,             // string
})
```

### Item 数据结构

```js
{
  key: string,
  default: string | string[],    // 值（多文件时为 string[]）
  type: 'string' | 'number' | 'boolean' | 'file' | 'json' | 'xml' | 'ref',
  description: string,
  enabled: boolean
}
```

### 新增行默认值

```js
{
  key: '',
  default: '',
  type: 'string',
  description: '',
  enabled: true
}
```

---

## 六、APIDetail.js 修改点

### 6.1 移除内容

- 移除 `renderKVTable` 函数（line ~1235-1351）
- 移除 `paramTypes` 常量
- 替换三处 `renderKVTable(...)` 调用为 `<KVTable ... />`

### 6.2 新增导入

```js
import KVTable from './KVTable';
import KVBottomPanel from './KVBottomPanel';
```

### 6.3 底部面板状态

新增状态：

```js
const [bottomPanel, setBottomPanel] = useState({
  visible: false,
  section: null,     // 'param' | 'header' | 'formData' | 'xwww'
  rowIndex: null,
  field: 'value',    // 'value' | 'description'
});
```

### 6.4 替换 renderKVTable 调用

三处调用统一替换为：

```jsx
<KvTable
  items={formData.param}
  onItemsChange={(items) => setFormData(prev => ({ ...prev, param: items }))}
  section="param"
  showType={true}
  showFileType={false}
  onValueClick={(idx) => handleBottomPanelOpen('param', idx, 'value')}
  onDescClick={(idx) => handleBottomPanelOpen('param', idx, 'description')}
  onActiveRowChange={handleActiveRowChange}
  activeRowIndex={bottomPanel.section === 'param' ? bottomPanel.rowIndex : null}
  excludeApiId={formData.id}
  theme={theme}
/>
```

### 6.5 插入底部面板

在 tab-content 下方、assertion-bar 上方插入（执行结果在右侧面板 `ResponsePanel`，不受影响）：

```jsx
<KVBottomPanel
  visible={bottomPanel.visible}
  section={bottomPanel.section}
  rowIndex={bottomPanel.rowIndex}
  field={bottomPanel.field}
  items={getSectionItems(bottomPanel.section)}
  onItemsChange={handleSectionItemsChange}
  onClose={() => setBottomPanel(prev => ({ ...prev, visible: false }))}
  sectionsMeta={[
    { id: 'param', label: 'Params' },
    { id: 'header', label: 'Headers' },
    { id: 'formData', label: 'form-data' },
    { id: 'xwww', label: 'x-www-form-urlencoded' },
  ]}
  theme={theme}
/>
```

### 6.6 辅助函数

```js
const getSectionItems = (section) => {
  switch (section) {
    case 'param': return formData.param;
    case 'header': return formData.header;
    case 'formData': return formData.body.formData;
    case 'xwww': return formData.body.xwwwFormUrlencoded;
    default: return [];
  }
};

const handleSectionItemsChange = (section, newItems) => {
  switch (section) {
    case 'param': setFormData(prev => ({ ...prev, param: newItems })); break;
    case 'header': setFormData(prev => ({ ...prev, header: newItems })); break;
    case 'formData': updateFormBody({ formData: newItems }); break;
    case 'xwww': updateFormBody({ xwwwFormUrlencoded: newItems }); break;
  }
};
```

---

## 七、现有接口影响

| 功能 | 影响 |
|------|------|
| `prepareForExecute` | 无变化（`paramObj` 构建逻辑不变，`type` 字段会传递新类型值，但不影响执行） |
| `parseToArray` | 需要确认新类型（json/xml/ref）在解析时是否被正确保留 |
| `APIExecutor` | 无影响（只消费 `default` 值） |
| `ProjectManager.saveAPI` | 无影响（保存的是完整 `item` 对象） |
| Body raw 编辑器 | **完全不受影响**，继续使用现有 CodeEditor |
| 断言编辑器 | **完全不受影响** |
| Chain/Ref 扫描 | **无影响**（`extractRefApis` 继续扫描所有 section 的 `item.default`） |

---

## 八、实施步骤

1. 创建 `src/components/KVTable.css` — 迁移现有 kv-editor 样式 + 新增值列/备注列预览样式
2. 创建 `src/components/KVTable.js` — 提取 `renderKVTable`，改造列布局与类型系统
3. 创建 `src/components/KVBottomPanel.css` — 底部面板样式
4. 创建 `src/components/KVBottomPanel.js` — 底部面板组件
5. 修改 `APIDetail.js` — 移除旧函数，集成新组件
6. 修改 `APIDetail.css` — 移除迁移走的样式

---

## 九、不在此次范围内的待办

- Random / Script / JWT 等未来类型的编辑器（预留接口，暂不实现）
- Ref Variable 的 "常用字段建议"（从 response schema 解析，需独立实现）
