import type { PetReminderListItemDto } from '../../electron/shared/pet-reminder-dto'
import type { ReminderDuePayload } from '../../electron/shared/reminder-data'
import type { PetUiLabels } from '../../electron/shared/pet-ui-labels'
import type { PetElectronAPI } from '../../electron/preload/pet-preload'

const LEVEL_DOT_CLASS: Record<PetReminderListItemDto['level'], string> = {
  urgent: 'pet-level-urgent',
  important: 'pet-level-important',
  normal: 'pet-level-normal',
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function initPetReminderUi(api: PetElectronAPI): void {
  const dueEl = document.getElementById('pet-due-alert')
  const listEl = document.getElementById('pet-reminder-panel')
  if (!dueEl || !listEl) return

  let labels: PetUiLabels | null = null
  let listOpen = false
  let dueOpen = false
  let duePayload: ReminderDuePayload | null = null

  const syncWindowSize = (): void => {
    if (listOpen && dueOpen) api.setWindowReminderAndDue()
    else if (listOpen) api.setWindowReminderList()
    else if (dueOpen) api.setWindowDueAlert()
    else api.setWindowCompact()
  }

  const loadLabels = async (): Promise<PetUiLabels> => {
    if (!labels) labels = await api.getLabels()
    return labels
  }

  const renderReminderList = async (): Promise<void> => {
    const l = await loadLabels()
    const items = await api.listReminders()
    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="pet-panel">
          <div class="pet-panel-header">
            <span class="pet-panel-title">${escapeHtml(l.reminderListTitle)}</span>
            <button type="button" class="pet-panel-close" data-action="close-list" aria-label="${escapeHtml(l.close)}">×</button>
          </div>
          <p class="pet-panel-empty">${escapeHtml(l.reminderListEmpty)}</p>
        </div>`
      return
    }

    const rows = items
      .map(
        (item) => `
        <li class="pet-reminder-item${item.isDue ? ' is-due' : ''}">
          <span class="pet-level-dot ${LEVEL_DOT_CLASS[item.level]}" title="${escapeHtml(l.level[item.level])}"></span>
          <div class="pet-reminder-meta">
            <span class="pet-reminder-time">${escapeHtml(formatDateTime(item.remindAt))}</span>
            <span class="pet-reminder-title">${escapeHtml(item.title || '—')}</span>
          </div>
        </li>`,
      )
      .join('')

    listEl.innerHTML = `
      <div class="pet-panel">
        <div class="pet-panel-header">
          <span class="pet-panel-title">${escapeHtml(l.reminderListTitle)}</span>
          <button type="button" class="pet-panel-close" data-action="close-list" aria-label="${escapeHtml(l.close)}">×</button>
        </div>
        <ul class="pet-reminder-list">${rows}</ul>
      </div>`
  }

  const renderDueAlert = async (): Promise<void> => {
    if (!duePayload) return
    const l = await loadLabels()
    const items = duePayload.items
    const ids = items.map((item) => item.id)

    const body =
      items.length === 1
        ? `<p class="pet-due-title">${escapeHtml(items[0].title)}</p>
           ${items[0].content.trim() ? `<p class="pet-due-content">${escapeHtml(items[0].content)}</p>` : ''}`
        : `<ul class="pet-due-multi">${items
            .slice(0, 4)
            .map((item) => `<li>${escapeHtml(item.title)}</li>`)
            .join('')}${items.length > 4 ? `<li>+${items.length - 4}</li>` : ''}</ul>`

    dueEl.innerHTML = `
      <div class="pet-due-card">
        <div class="pet-due-header">
          <span class="pet-due-heading">${escapeHtml(l.reminderDueTitle)}</span>
          <button type="button" class="pet-panel-close" data-action="close-due" aria-label="${escapeHtml(l.close)}">×</button>
        </div>
        ${body}
        <div class="pet-due-actions">
          <button type="button" class="pet-btn pet-btn-secondary" data-action="snooze" data-minutes="5" data-ids="${escapeHtml(ids.join(','))}">${escapeHtml(l.snooze5)}</button>
          <button type="button" class="pet-btn pet-btn-secondary" data-action="snooze" data-minutes="15" data-ids="${escapeHtml(ids.join(','))}">${escapeHtml(l.snooze15)}</button>
          <button type="button" class="pet-btn pet-btn-primary" data-action="dismiss" data-ids="${escapeHtml(ids.join(','))}">${escapeHtml(l.dismiss)}</button>
        </div>
      </div>`
  }

  const openList = async (): Promise<void> => {
    listOpen = true
    listEl.classList.remove('hidden')
    await renderReminderList()
    syncWindowSize()
  }

  const closeList = (): void => {
    listOpen = false
    listEl.classList.add('hidden')
    listEl.innerHTML = ''
    syncWindowSize()
  }

  const openDue = async (payload: ReminderDuePayload): Promise<void> => {
    duePayload = payload
    dueOpen = true
    dueEl.classList.remove('hidden')
    await renderDueAlert()
    syncWindowSize()
  }

  const closeDue = (): void => {
    dueOpen = false
    duePayload = null
    dueEl.classList.add('hidden')
    dueEl.innerHTML = ''
    syncWindowSize()
  }

  listEl.addEventListener('click', (event) => {
    const target = (event.target as Element).closest('[data-action]')
    if (!target) return
    event.stopPropagation()
    if (target.getAttribute('data-action') === 'close-list') closeList()
  })

  dueEl.addEventListener('click', async (event) => {
    const target = (event.target as Element).closest('[data-action]')
    if (!target) return
    event.stopPropagation()
    const action = target.getAttribute('data-action')
    const idsRaw = target.getAttribute('data-ids') ?? ''
    const ids = idsRaw.split(',').filter(Boolean)

    if (action === 'close-due') {
      closeDue()
      return
    }
    if (action === 'dismiss' && ids.length > 0) {
      await api.dismissReminders(ids)
      closeDue()
      if (listOpen) await renderReminderList()
      return
    }
    if (action === 'snooze' && ids.length > 0) {
      const minutes = Number(target.getAttribute('data-minutes') ?? '5')
      await api.snoozeReminders(ids, minutes)
      closeDue()
      if (listOpen) await renderReminderList()
    }
  })

  api.onOpenReminders(() => {
    void openList()
  })

  api.onReminderDue((payload) => {
    void openDue(payload)
  })

}
