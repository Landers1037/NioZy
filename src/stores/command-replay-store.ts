import { create } from 'zustand'
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
    const cursorCommand = terminalId ? readTerminalCursorCommand(terminalId) : null
    const buffer = mergeRecordedWithCursorLine(normalized, cursorCommand)
    set({ isRecording: false, terminalId: null, buffer: '' })
    return buffer
  },

  cancel: () => {
    set({ isRecording: false, terminalId: null, buffer: '' })
  },

  appendInput: (terminalId, data) => {
    const state = get()
    if (!state.isRecording || state.terminalId !== terminalId) return
    set({ buffer: state.buffer + data })
  },
}))
