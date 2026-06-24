import { readFile, writeFile } from 'fs/promises'
import { NtExecutable, NtExecutableResource } from 'resedit'

const DPI_AWARENESS =
  '<dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2,PerMonitor</dpiAwareness>'

/**
 * 将 Electron 可执行文件中的 dpiAware 升级为 PerMonitorV2（原生 DPI 感知 v2）。
 * 在 afterPack 阶段、签名之前调用。
 */
export async function embedWinHighDpiManifest(exePath) {
  const buffer = await readFile(exePath)
  const executable = NtExecutable.from(buffer)
  const res = NtExecutableResource.from(executable)
  const manifestEntry = res.entries.find((e) => e.type === 24 && e.id === 1)
  if (!manifestEntry) {
    console.warn(`[after-pack] ${exePath} 未找到 RT_MANIFEST，跳过高 DPI 清单嵌入`)
    return
  }

  let xml = Buffer.from(manifestEntry.bin).toString('utf8')
  if (xml.includes('PerMonitorV2')) {
    console.log(`[after-pack] ${exePath} 已包含 PerMonitorV2 DPI 清单`)
    return
  }

  if (/<dpiAware[^>]*>[\s\S]*?<\/dpiAware>/i.test(xml)) {
    xml = xml.replace(
      /(<dpiAware[^>]*>[\s\S]*?<\/dpiAware>)/i,
      `$1${DPI_AWARENESS}`,
    )
  } else if (/<asmv3:windowsSettings[^>]*>/i.test(xml)) {
    xml = xml.replace(
      /(<asmv3:windowsSettings[^>]*>)/i,
      `$1<dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>${DPI_AWARENESS}`,
    )
  } else {
    console.warn(`[after-pack] ${exePath} 清单结构未知，跳过高 DPI 嵌入`)
    return
  }

  const newBuf = Buffer.from(xml, 'utf-8')
  manifestEntry.bin = newBuf.buffer.slice(newBuf.byteOffset, newBuf.byteOffset + newBuf.byteLength)
  res.outputResource(executable)
  await writeFile(exePath, Buffer.from(executable.generate()))
  console.log(`[after-pack] 已为 ${exePath} 嵌入 PerMonitorV2 高 DPI 清单`)
}
