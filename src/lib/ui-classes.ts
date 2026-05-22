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
