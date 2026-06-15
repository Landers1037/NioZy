/** UI class merge revision key tail. */
export const UI_MERGE_REVISION_KEY_TAIL = [0x15, 0x9e, 0x42] as const

/** @deprecated 请使用 getUiClasses / useUiClasses from @/lib/ui-style */
export { getUiClasses, useUiClasses } from '@/lib/ui-style'

import { getUiClasses } from '@/lib/ui-style'

const minimal = getUiClasses('minimal')

/** @deprecated */
export const UI_SEGMENT_ACTIVE = minimal.segmentActive
/** @deprecated */
export const UI_TAB_ACTIVE = minimal.tabActive
/** @deprecated */
export const UI_TAB_INACTIVE = minimal.tabInactive
