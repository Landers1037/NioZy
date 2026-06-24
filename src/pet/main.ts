import {
  PET_ATLAS,
  PET_DISPLAY_SCALE_DEFAULT,
  getPetDisplayDimensions,
  normalizePetDisplayScale,
} from '../../electron/shared/pet-atlas'
import type { PetAnimationStateDto } from '../../electron/pet-store'
import { initPetReminderUi } from './pet-reminder-ui'
import './pet.css'

declare global {
  interface Window {
    petAPI: import('../../electron/preload/pet-preload').PetElectronAPI
  }
}

function mountPet(petEl: HTMLElement): void {
  let frameIndex = 0
  let animationTimer: ReturnType<typeof setTimeout> | null = null
  let randomTimer: ReturnType<typeof setInterval> | null = null
  let animationPaused = false
  let allStates: PetAnimationStateDto[] = []
  let currentState: PetAnimationStateDto | null = null
  let displayScale = PET_DISPLAY_SCALE_DEFAULT

  function applyDisplayScale(scale: number): void {
    displayScale = normalizePetDisplayScale(scale)
    const { width, height } = getPetDisplayDimensions(displayScale)
    petEl.style.width = `${width}px`
    petEl.style.height = `${height}px`
  }

  function clearAnimationTimers(): void {
    if (animationTimer !== null) {
      clearTimeout(animationTimer)
      animationTimer = null
    }
    if (randomTimer !== null) {
      clearInterval(randomTimer)
      randomTimer = null
    }
  }

  function pauseAnimation(): void {
    animationPaused = true
    if (animationTimer !== null) {
      clearTimeout(animationTimer)
      animationTimer = null
    }
  }

  function resumeAnimation(): void {
    if (!animationPaused || !currentState) return
    animationPaused = false
    scheduleNextFrame()
  }

  function setFrame(col: number, row: number): void {
    petEl.style.backgroundPosition = `-${col * PET_ATLAS.cellWidth * displayScale}px -${row * PET_ATLAS.cellHeight * displayScale}px`
  }

  function scheduleNextFrame(): void {
    if (!currentState || animationPaused) return
    const { row, frames, durationsMs } = currentState
    setFrame(frameIndex, row)
    const delay = durationsMs[frameIndex] ?? durationsMs[0] ?? 110
    frameIndex = (frameIndex + 1) % frames
    animationTimer = setTimeout(scheduleNextFrame, delay)
  }

  function playState(state: PetAnimationStateDto): void {
    currentState = state
    frameIndex = 0
    if (animationTimer !== null) clearTimeout(animationTimer)
    scheduleNextFrame()
  }

  function findStateById(id: string): PetAnimationStateDto | null {
    return allStates.find((s) => s.id === id) ?? allStates[0] ?? null
  }

  function pickRandomState(excludeId?: string): PetAnimationStateDto | null {
    if (allStates.length === 0) return null
    const pool =
      excludeId && allStates.length > 1
        ? allStates.filter((s) => s.id !== excludeId)
        : allStates
    return pool[Math.floor(Math.random() * pool.length)] ?? allStates[0] ?? null
  }

  function startRandomRotation(intervalMs: number, initialStateId: string): void {
    randomTimer = setInterval(() => {
      const next = pickRandomState(currentState?.id ?? initialStateId)
      if (next) playState(next)
    }, intervalMs)
  }

  function showPlaceholder(scale: number): void {
    applyDisplayScale(scale)
    clearAnimationTimers()
    animationPaused = false
    currentState = null
    petEl.classList.add('placeholder')
    petEl.style.backgroundImage = 'none'
    petEl.textContent = ''
  }

  function showSprite(
    config: Extract<Awaited<ReturnType<Window['petAPI']['getSpriteConfig']>>, { mode: 'sprite' }>,
  ): void {
    applyDisplayScale(config.displayScale)
    petEl.classList.remove('placeholder')
    petEl.textContent = ''
    petEl.style.backgroundImage = `url(${config.spriteUrl})`
    petEl.style.backgroundSize = `${PET_ATLAS.width * displayScale}px ${PET_ATLAS.height * displayScale}px`

    allStates = config.states
    const initial = findStateById(config.animationStateId) ?? allStates[0]
    if (!initial) return

    animationPaused = false
    playState(initial)
    if (config.randomState && allStates.length > 1) {
      startRandomRotation(config.randomIntervalMs, initial.id)
    }
  }

  async function initPetVisual(): Promise<void> {
    if (!window.petAPI) throw new Error('petAPI missing')
    const config = await window.petAPI.getSpriteConfig()
    if (config.mode === 'sprite') {
      showSprite(config)
    } else {
      showPlaceholder(config.displayScale)
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseAnimation()
    else resumeAnimation()
  })

  void initPetVisual()
    .then(() => {
      initPetReminderUi(window.petAPI)
      window.petAPI.ready()
    })
    .catch((err) => {
      console.error('[pet] init failed', err)
    })

  const body = document.body
  let activePointerId: number | null = null

  body.addEventListener('pointerdown', (event: PointerEvent) => {
    if ((event.target as Element).closest('.pet-overlay')) return
    if (event.button !== 0 || activePointerId !== null) return
    activePointerId = event.pointerId
    body.setPointerCapture(event.pointerId)
    window.petAPI.pointerDown()
  })

  body.addEventListener('pointermove', (event: PointerEvent) => {
    if (activePointerId !== event.pointerId) return
    body.classList.add('dragging')
  })

  function finishPointer(event: PointerEvent): void {
    if (activePointerId !== event.pointerId) return
    body.classList.remove('dragging')
    try {
      body.releasePointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
    window.petAPI.pointerUp()
    activePointerId = null
  }

  body.addEventListener('pointerup', finishPointer)
  body.addEventListener('pointercancel', finishPointer)

  body.addEventListener('dblclick', (event: MouseEvent) => {
    event.preventDefault()
    window.petAPI.toggleMainWindow()
  })

  body.addEventListener('contextmenu', (event: MouseEvent) => {
    event.preventDefault()
    window.petAPI.showMenu()
  })
}

const petRoot = document.getElementById('pet')
if (petRoot) {
  mountPet(petRoot)
}
