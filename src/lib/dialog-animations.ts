import { useAppStore } from '@/stores/app-store'

export function useDialogAnimationEnabled(): boolean {
  return useAppStore((s) => s.settings?.enableDialogAnimations ?? true)
}

export function dialogOverlayClass(enabled: boolean): string | undefined {
  return enabled ? 'dialog-overlay-animate' : undefined
}

export function dialogContentClass(enabled: boolean): string | undefined {
  return enabled ? 'dialog-content-animate' : undefined
}

/** 弹框遮罩层；默认 50% 黑底，glass 风格见 index.css */
export const UI_DIALOG_OVERLAY = 'ui-dialog-overlay'
