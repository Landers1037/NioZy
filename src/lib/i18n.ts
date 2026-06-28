import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zh from '@/locales/zh.json'
import en from '@/locales/en.json'
import ja from '@/locales/ja.json'
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  type AppLocale,
} from '../../electron/shared/locale'

void i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
    ja: { translation: ja },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
})

export function applyAppLocale(locale: AppLocale | unknown): void {
  const lng = normalizeLocale(locale)
  void i18n.changeLanguage(lng)
  document.documentElement.lang =
    lng === 'zh' ? 'zh-CN' : lng === 'ja' ? 'ja' : 'en'
}

export function getSettingsTabTitle(): string {
  return i18n.t('app.settingsTabTitle')
}

export function getFilesystemTabTitle(): string {
  return i18n.t('app.filesystemTabTitle')
}

export function getChatTabTitle(): string {
  return i18n.t('app.chatTabTitle')
}

export function getSandboxTabTitle(): string {
  return i18n.t('app.sandboxTabTitle')
}

export function getRepoTabTitle(): string {
  return i18n.t('app.repoTabTitle')
}

export function getSessionTabTitle(): string {
  return i18n.t('app.sessionTabTitle')
}

export function getWorkspaceTabTitle(): string {
  return i18n.t('app.workspaceTabTitle')
}

export function getAgentTabTitle(): string {
  return i18n.t('app.agentTabTitle')
}

export function getExcalidrawTabTitle(): string {
  return i18n.t('app.excalidrawTabTitle')
}

export function getDrawioTabTitle(): string {
  return i18n.t('app.drawioTabTitle')
}

export default i18n
