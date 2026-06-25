# ADR: Mux Core TCP JSON-RPC 传输

## 状态

已采纳（2026-06）

## 背景

Mux 终端最初通过 **stdio NDJSON** 与 Electron 主进程通信。为规避 Windows 上 Electron 进程树内 **node-pty 与 portable-pty 并发导致 ConPTY 卡死**，曾引入 `mux-core-launcher.mjs` 桥接。该方案将传输层与进程归属绑死，难以独立调试。

## 决策

1. **弃用 stdio**：删除 NDJSON stdio 协议与 launcher 桥接。
2. **独立守护进程**：全局唯一 `niozy-mux-core serve --bind 127.0.0.1 --port 19527`。
3. **JSON-RPC 2.0**：newline-delimited JSON over TCP；请求/响应 + server notification（`mux.output` 等）。
4. **Electron 职责**：`ensureMuxDaemon()` 检测端口 → 必要时 detached spawn → `MuxRpcClient` 连接；会话缓冲与 `mux:data` IPC 不变。

## 后果

### 正面

- Core 与 Electron/node-pty **进程隔离**，ConPTY 稳定性提升。
- 可用 `node scripts/mux-interactive-shell.mjs` 在真实终端直接调试。
- `mux.spawnSession` 同步返回，错误可经 JSON-RPC error 传递。

### 负面

- 需管理 daemon 生命周期与端口占用（默认 19527）。
- localhost 无认证（MVP 可接受）。

## 协议摘要

| 方向 | 类型 | 示例 |
|------|------|------|
| Server → Client | notification | `mux.ready`, `mux.output` |
| Client → Server | request | `mux.spawnSession`, `mux.writeInput` |

详见 [功能Mux终端.md](../功能Mux终端.md)。
