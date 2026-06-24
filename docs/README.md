# NioZy 功能模块文档

本目录按**完整功能模块**拆分说明，与 [README.md](../README.md) 及**设置中心**菜单项对应。各文档均包含 **「架构与数据流」** 小节（Mermaid `flowchart` / `sequenceDiagram`），可在支持 Mermaid 的 Markdown 预览中直接查看。

## 设置中心索引

与 `src/components/settings/SettingsPanel.tsx` 侧栏顺序一致：

| 设置项 | 文档 |
|--------|------|
| 外观设置 | [功能外观与布局.md](./功能外观与布局.md) |
| 终端设置 | [功能终端与会话.md](./功能终端与会话.md) |
| SSH | [功能SSH连接.md](./功能SSH连接.md) |
| SHELL | [功能增强SHELL.md](./功能增强SHELL.md)、[SHELL.md](./SHELL.md) |
| 预览 | [功能预览与WebView.md](./功能预览与WebView.md) |
| 性能 | [功能性能.md](./功能性能.md) |
| 文件系统 | [功能文件系统.md](./功能文件系统.md)、[功能仓库管理.md](./功能仓库管理.md) |
| 绘图功能 | [功能绘图.md](./功能绘图.md) |
| Markdown 编辑 | [功能Markdown.md](./功能Markdown.md) |
| 连接设置 | [功能连接管理.md](./功能连接管理.md) |
| 存储库 | [功能保险箱.md](./功能保险箱.md) |
| 快捷键 | [功能快捷键.md](./功能快捷键.md) |
| 使用统计 | [功能使用统计.md](./功能使用统计.md) |
| 提醒设置 | [功能提醒事项.md](./功能提醒事项.md)、[功能宠物.md](./功能宠物.md) |
| 辅助功能 | [辅助功能.md](./辅助功能.md) |
| 系统设置 | [功能系统与托盘.md](./功能系统与托盘.md) |
| 加密通信 | [功能P2P聊天.md](./功能P2P聊天.md) |
| **AI 特性** | [功能AI助手边栏.md](./功能AI助手边栏.md) |
| **管理会话** | [功能会话管理.md](./功能会话管理.md) |
| 日志设置 | [功能日志.md](./功能日志.md) |
| 高级设置 | [common公共功能.md](./common公共功能.md)（部分高级项） |
| 实验特性 | [功能实验特性.md](./功能实验特性.md) |

## 按场景查阅

| 文档 | 入口 / 说明 |
|------|-------------|
| [common公共功能.md](./common公共功能.md) | 应用骨架、配置、IPC、布局、标题栏、状态栏 |
| [功能终端与会话.md](./功能终端与会话.md) | 多 Tab 终端、分屏、xterm / Wterm、Attach-PTY |
| [功能SSH连接.md](./功能SSH连接.md) | SSH 连接与认证 |
| [功能SCP传输.md](./功能SCP传输.md) | SSH Tab 内 SCP 上传 / 下载 |
| [功能连接管理.md](./功能连接管理.md) | RDP / PuTTY / VNC / 自定义连接 |
| [功能保险箱.md](./功能保险箱.md) | 密文变量、`${VAR}` 引用 |
| [功能文件系统.md](./功能文件系统.md) | 本地文件浏览与外部编辑器打开 |
| [功能仓库管理.md](./功能仓库管理.md) | Git 仓库、分支、提交图 |
| [功能绘图.md](./功能绘图.md) | Excalidraw / Draw.io Tab |
| [功能Markdown.md](./功能Markdown.md) | Markdown 编辑与预览 Tab，拖拽 `.md` 打开 |
| [功能预览与WebView.md](./功能预览与WebView.md) | 链接预览、WebView、Office/PDF 预览 |
| [功能外观与布局.md](./功能外观与布局.md) | 主题、UI 风格（含 Claude 等）、布局、Tab 分组 |
| [功能增强SHELL.md](./功能增强SHELL.md) | 链接检测、emoji、快捷换行、Oh My Posh、日志着色、命令回放 |
| [SHELL.md](./SHELL.md) | 重启恢复终端会话 |
| [功能快捷键.md](./功能快捷键.md) | 全局快捷键 |
| [功能使用统计.md](./功能使用统计.md) | 本地使用时长与 Tab 统计 |
| [功能番茄钟.md](./功能番茄钟.md) | 顶部栏番茄钟 |
| [功能提醒事项.md](./功能提醒事项.md) | 定时提醒与通知 |
| [功能宠物.md](./功能宠物.md) | 桌面宠物精灵图 |
| [辅助功能.md](./辅助功能.md) | 番茄钟 / 命令重放 / 搜索 / 连通检测 / 截图 / 备忘录入口 |
| [功能P2P聊天.md](./功能P2P聊天.md) | 局域网加密聊天与文件 |
| [功能AI助手边栏.md](./功能AI助手边栏.md) | CopilotKit 边栏、多模型、附件、**规则与技能上下文** |
| [功能会话管理.md](./功能会话管理.md) | AI 编程工具会话（Claude Code 等）列表、搜索、恢复 |
| [功能系统与托盘.md](./功能系统与托盘.md) | 托盘、代理、启动项、更新 |
| [功能截图.md](./功能截图.md) | 区域截图与标注 |
| [功能连通检测.md](./功能连通检测.md) | 顶部栏网络连通检测 |
| [功能性能.md](./功能性能.md) | 渲染与资源相关选项 |
| [功能日志.md](./功能日志.md) | 应用日志级别与目录 |
| [功能实验特性.md](./功能实验特性.md) | Wterm、Ghostty、VNC Web、Attach-PTY、JS 沙箱等 |

> **AI 特性** 在设置中心为独立分区；开关与模型配置存于 `settings.experimental`，上下文规则 / 技能文件存于配置目录 `ai/`（详见 [功能AI助手边栏.md](./功能AI助手边栏.md)）。

## 配置目录

根目录（Windows）：`%USERPROFILE%\.config\NioZy\`（见 `electron/config-paths.ts`）。

| 路径 | 内容 |
|------|------|
| `settings.json` | 全局设置（含 `experimental.ai*`） |
| `vault.json` / `niozy.key` | 存储库变量与加密密钥 |
| `term.json` | 自定义连接 |
| `chat/` | P2P 聊天与设备身份 |
| `reminder/` | 提醒事项与提醒图 |
| `pets/` | 桌面宠物精灵图 |
| `background/` | 终端自定义背景图 |
| **`ai/rules/`** | AI 规则（`*.md`） |
| **`ai/skills/`** | AI 技能（`{id}/SKILL.md`） |
