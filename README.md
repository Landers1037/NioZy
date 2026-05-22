# NioZy

Windows 多终端管理器 — Electron + React + TailwindCSS + shadcn/ui + xterm.js + ConPTY。

![](./ScreenShot_1.jpg)
![](./ScreenShot_2.jpg)

## 功能

- 自定义无边框标题栏（最小化 / 最大化 / 关闭）
- 可折叠左侧栏：终端 Tab、设置 Tab、新建终端、新建连接
- xterm 终端模拟器，经 node-pty 对接 Windows ConPTY
- 内置 PowerShell、CMD、pwsh；支持自定义命令与 SSH 连接配置
- 设置：外观、终端、连接、系统、高级
- 底部状态栏：时间、CPU、内存、当前 Tab

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run preview
```

## 设计规范

详见 [design.md](./design.md)。
