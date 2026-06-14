/** Trigger CopilotKit's hidden file input synchronously (required for Electron user-gesture). */
export function clickCopilotFileInput(): void {
  const sidebarAside = document.querySelector('[data-copilot-sidebar]')
  const fileInput = sidebarAside?.parentElement?.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement | null
  fileInput?.click()
}
