import { create } from 'zustand'
import { getActiveReplayContext } from '@/lib/command-replay'
import {
  mergeRecordedWithCursorLine,
  readTerminalCursorCommand,
} from '@/lib/command-replay-capture'
import { normalizeRecordedCommandInput } from '@/lib/command-replay-normalize'

interface CommandReplayRecordingState {
  isRecording: boolean
  terminalId: string | null
  buffer: string
  start: (terminalId: string) => void
  stop: () => string
  cancel: () => void
  appendInput: (terminalId: string, data: string) => void
}

export const useCommandReplayStore = create<CommandReplayRecordingState>((set, get) => ({
  isRecording: false,
  terminalId: null,
  buffer: '',

  start: (terminalId) => {
    set({ isRecording: true, terminalId, buffer: '' })
  },

  stop: () => {
    const { terminalId, buffer: raw } = get()
    const normalized = normalizeRecordedCommandInput(raw)
    let cursorCommand = terminalId ? readTerminalCursorCommand(terminalId) : null
    if (!cursorCommand?.trim()) {
      const active = getActiveReplayContext()
      if (active?.terminalId && active.terminalId !== terminalId) {
        cursorCommand = readTerminalCursorCommand(active.terminalId)
      }
    }
    const buffer = mergeRecordedWithCursorLine(normalized, cursorCommand)
    set({ isRecording: false, terminalId: null, buffer: '' })
    return buffer
  },

  cancel: () => {
    set({ isRecording: false, terminalId: null, buffer: '' })
  },

  appendInput: (_terminalId, data) => {
    const state = get()
    if (!state.isRecording || !data) return
    set({ buffer: state.buffer + data })
  },
}))
