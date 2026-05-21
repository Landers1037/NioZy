# NioZy 设计规范

> 基于参考图 1（浅色 SaaS 管理后台）与参考图 2（柔光玻璃拟物组件）提炼，并结合 theme-factory 的 Modern Minimalist、Arctic Frost、Tech Innovation 主题合成桌面终端管理器视觉体系。

---

## 1. 参考图解析

### 1.1 图 1 — 浅色 SaaS 管理后台

| 维度 | 特征 |
|------|------|
| **整体风格** | 现代、克制、专业；Soft UI / 轻拟物，靠柔和阴影而非硬边框表达层级 |
| **布局** | 左侧固定导航 + 右侧主内容；主内容为大圆角白色卡片，浮于浅灰全局背景之上 |
| **配色** | 背景 `#F4F5F7` 级浅灰；主表面纯白；主文本深灰黑；次级文本中灰；强调色少量用于图标/状态 |
| **按钮** | 主按钮：白底圆角矩形 + 轻阴影；次要：无背景文字 + 下拉箭头；图标按钮：圆角方形容器 |
| **组件** | 高圆角（12–16px）；侧栏选中项为白色胶囊 + 阴影；搜索框胶囊形；表格极简分隔线 |
| **间距** | 宽松留白，信息密度适中，呼吸感强 |

**对 NioZy 的映射**：左侧终端 Tab 列表、设置入口；选中 Tab 为白色胶囊；主终端区嵌套于大圆角容器；顶部栏集成品牌与窗口控制。

### 1.2 图 2 — 柔光玻璃拟物组件

| 维度 | 特征 |
|------|------|
| **整体风格** | 友好、精致；玻璃拟物（半透明、模糊、柔光蓝晕） |
| **布局** | 居中卡片、底部图标导航；上传区虚线框 + 中央发光圆形按钮 |
| **配色** | 白/浅灰底；主强调 Apple 蓝 `#007AFF` / `#0A84FF`；进度条同色 |
| **按钮** | 胶囊形（全圆角）；主按钮实心蓝 + 白字；次要浅灰底；FAB 白圆 + 阴影 |
| **组件** | 超大圆角卡片（~40px）；虚线拖拽区；细线图标导航（激活实心/未激活描边） |

**对 NioZy 的映射**：新建连接弹层、进度/状态反馈、圆形图标按钮；暗色模式下可延伸为玻璃面板 + 霓虹青强调（Tech Innovation）。

---

## 2. NioZy 主题配色（theme-factory 合成）

### 2.1 应用壳层（明亮模式默认）

| Token | 值 | 用途 |
|-------|-----|------|
| `--background` | `#F4F5F7` | 全局背景 |
| `--card` | `#FFFFFF` | 面板、侧栏选中、主内容区 |
| `--muted` | `#EEF2F7` | 次要表面、输入底 |
| `--border` | `#E3E6EB` | 分隔线、输入边框 |
| `--foreground` | `#1E2329` | 主文本 |
| `--muted-foreground` | `#7A828E` | 次级文本 |
| `--primary` | `#0A84FF` | 主强调、主按钮、链接 |
| `--primary-hover` | `#0066FF` | 主强调悬浮 |
| `--ring` | `#0A84FF` | 焦点环 |

### 2.2 应用壳层（暗黑模式）

| Token | 值 | 用途 |
|-------|-----|------|
| `--background` | `#0F1419` | 全局背景 |
| `--card` | `#1A1F26` | 面板 |
| `--muted` | `#252B33` | 次要表面 |
| `--border` | `#2D3540` | 分隔线 |
| `--foreground` | `#E8ECF0` | 主文本 |
| `--muted-foreground` | `#8B949E` | 次级文本 |
| `--primary` | `#00D2FF` | 霓虹青强调（Tech Innovation） |
| `--primary-hover` | `#3A7BD5` | 渐变端点 |

### 2.3 终端配色方案（xterm）

| 方案名 | 背景 | 前景 | 备注 |
|--------|------|------|------|
| **Atom** | `#1E1E1E` | `#C5C8C6` | 默认暗色 |
| **Atom One Light** | `#FAFAFA` | `#383A42` | 浅色终端 |
| **NioZy Dark** | `#101419` | `#D8DEE9` | 品牌暗色 |
| **NioZy Light** | `#F8F9FB` | `#1E2329` | 品牌浅色 |

---

## 3. 排版与尺寸

| 项 | 值 |
|----|-----|
| 全局 UI 字号 | `13px`（默认） |
| 终端字体 | `Consolas`, `Cascadia Mono`, monospace |
| 终端字号 | `13px`（默认，设置可调） |
| 标题栏高度 | `40px` |
| 侧栏展开宽度 | `240px` |
| 侧栏收缩宽度 | `56px` |
| 状态栏高度 | `28px` |
| 圆角 — 卡片/面板 | `12px` |
| 圆角 — 按钮/输入 | `8px` |
| 圆角 — Tab 胶囊 | `10px` |
| 圆角 — 搜索/胶囊按钮 | `9999px`（全圆角） |

---

## 4. 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│ TitleBar: Logo + NioZy | drag | min max close               │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │ Main: Terminal (xterm) or Settings (modules)     │
│ - Tabs   │                                                  │
│ - New +  │                                                  │
│ - Connect│                                                  │
│ - Settings                                                  │
├──────────┴──────────────────────────────────────────────────┤
│ StatusBar: time | CPU | RAM | active tab                    │
└─────────────────────────────────────────────────────────────┘
```

- **顶部栏**：`frame: false`，Electron 自绘最小化/最大化/关闭；`-webkit-app-region: drag` 于中间区域。
- **左侧栏**：可折叠；终端 Tab + 设置 Tab；底部「新建终端」「新建连接」。
- **主区域**：终端模拟器或设置页（外观 / 终端 / 连接 / 系统 / 高级）。
- **底部状态栏**：系统时间、CPU、内存、当前激活 Tab 名称。

---

## 5. 组件样式规范

### 5.1 按钮

| 变体 | 样式 |
|------|------|
| **primary** | `bg-primary text-primary-foreground`，圆角 `8px`，hover 加深 |
| **secondary** | `bg-muted text-foreground`，无边框或细边框 |
| **ghost** | 透明底，hover `bg-muted` |
| **icon** | `size-8`，圆角 `8px`，用于侧栏/标题栏 |
| **FAB** | 白圆 `size-10`，`shadow-md`（图 2 风格，用于突出操作） |

高度：默认 `32px`；紧凑 `28px`。

### 5.2 侧栏 Tab

- 默认：透明底，图标 + 文本（收缩时仅图标）。
- 选中：白底（亮）/ `card`  elevated（暗），圆角 `10px`，轻阴影 `shadow-sm`。
- 关闭按钮：hover 显示，`size-4` 图标。

### 5.3 输入 / 选择

- 背景 `muted`，边框 `border`，圆角 `8px`。
- 焦点：`ring-2 ring-primary/30`。

### 5.4 设置页

- 左侧模块导航（垂直 Tabs 或按钮组）。
- 右侧 `Card` 分区：标题 + 描述 + 表单项（`Field` / `Label` + 控件）。
- 分组间距 `gap-6`。

### 5.5 终端面板

- 填满主区域，内边距 `0`；xterm 容器 `h-full w-full`。
- 外框可选 `rounded-lg` + `border` 与壳层区分。

### 5.6 滚动条（现代化覆写）

```css
* {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--scrollbar-track); border-radius: 4px; }
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }
```

亮：`thumb #C4C8CC`，`track transparent`；暗：`thumb #3D4550`，`track #1A1F26`。

---

## 6. 窗口与交互

- 不使用原生标题栏按钮；关闭行为可配置为最小化到 Tray。
- 侧栏折叠动画：`width` 过渡 `200ms ease`。
- Tab 切换：无刷新的显示/隐藏终端实例（保持会话）。
- 新建终端默认：`powershell.exe`。
- 新建连接：下拉选择 `cmd` / `powershell` / `pwsh` / 自定义 / SSH。

---

## 7. shadcn/ui 映射

| 场景 | 组件 |
|------|------|
| 窗口控制、侧栏操作 | `Button` variant ghost/icon |
| 新建连接 | `DropdownMenu` + `DropdownMenuItem` |
| 设置模块 | `Tabs` / 垂直按钮 + `Card` |
| 表单 | `Input`, `Select`, `Switch`, `Slider`, `Label` |
| 确认 | `AlertDialog` |
| 提示 | `sonner` toast |

语义色：使用 `bg-background`、`text-muted-foreground`、`bg-primary` 等，避免硬编码 `bg-blue-500`。

---

## 8. 技术约束摘要

- **终端**：xterm.js + node-pty（Windows ConPTY）。
- **渲染**：`dom`（默认）/ `webgl`（`@xterm/addon-webgl`）；WebGPU 为实验项，无稳定 addon 时 UI 标注「实验」。
- **安全**：`contextIsolation: true`，`nodeIntegration: false`，API 经 preload `contextBridge` 暴露。

---

*文档版本：MVP 1.0 — 与实现代码同步维护。*
