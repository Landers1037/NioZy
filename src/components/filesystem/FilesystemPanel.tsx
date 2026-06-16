import { useAppStore } from '@/stores/app-store'
import { ClassicFilesystemPanel } from '@/components/filesystem/ClassicFilesystemPanel'
import { ModernFilesystemPanel } from '@/components/filesystem/ModernFilesystemPanel'

export function FilesystemPanel() {
  const modernUi = useAppStore((s) => s.settings?.filesystem.modernFilesystemUiEnabled === true)

  if (modernUi) {
    return <ModernFilesystemPanel />
  }

  return <ClassicFilesystemPanel />
}
