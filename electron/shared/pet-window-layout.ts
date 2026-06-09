import { getPetDisplayDimensions } from './pet-atlas'

export const PET_REMINDER_PANEL_WIDTH = 300
export const PET_REMINDER_PANEL_HEIGHT = 220
export const PET_DUE_ALERT_WIDTH = 260
export const PET_DUE_ALERT_HEIGHT = 148

export function getPetWindowCompact(scale: number): { width: number; height: number } {
  return getPetDisplayDimensions(scale)
}

export function getPetWindowWithReminderList(scale: number): { width: number; height: number } {
  const pet = getPetDisplayDimensions(scale)
  return {
    width: PET_REMINDER_PANEL_WIDTH,
    height: pet.height + PET_REMINDER_PANEL_HEIGHT,
  }
}

export function getPetWindowWithDueAlert(scale: number): { width: number; height: number } {
  const pet = getPetDisplayDimensions(scale)
  return {
    width: Math.max(pet.width, PET_DUE_ALERT_WIDTH),
    height: pet.height + PET_DUE_ALERT_HEIGHT,
  }
}

export function getPetWindowWithBoth(scale: number): { width: number; height: number } {
  const pet = getPetDisplayDimensions(scale)
  return {
    width: PET_REMINDER_PANEL_WIDTH,
    height: pet.height + PET_REMINDER_PANEL_HEIGHT + PET_DUE_ALERT_HEIGHT,
  }
}
