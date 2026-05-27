/** 仅 electron-vite dev（command=serve）为 true；release 构建期替换为 false 并剔除相关代码 */
export function isElectronDev(): boolean {
  return __ELECTRON_DEV__
}
