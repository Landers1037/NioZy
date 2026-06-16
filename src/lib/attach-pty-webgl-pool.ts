/** Attach-PTY 单例宿主共用的 WebGL 槽位 id（与具体 terminalId 解耦） */
export const ATTACH_PTY_WEBGL_POOL_SLOT = '__niozy_attach_pty_webgl__'

export function resolveAttachPtyWebglSlotId(
  terminalId: string,
  usePool: boolean,
): string {
  return usePool ? ATTACH_PTY_WEBGL_POOL_SLOT : terminalId
}
