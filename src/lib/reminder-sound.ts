let audioContext: AudioContext | null = null

export function playReminderSound(): void {
  try {
    if (!audioContext) {
      audioContext = new AudioContext()
    }
    const ctx = audioContext
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, ctx.currentTime)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.36)
    void ctx.resume()
  } catch {
    // 忽略音频不可用场景
  }
}
