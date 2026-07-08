// Web Audio beeps for the exercise timer — no audio assets needed.
// iOS requires the AudioContext to be created/resumed inside a user gesture,
// so call initTimerAudio() from the click handler that opens the timer.

let ctx: AudioContext | null = null

export function initTimerAudio() {
  if (typeof window === 'undefined') return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

/** Single tone at a given frequency. Silently no-ops if audio is unavailable. */
export function playTone(freq = 880, durationMs = 150, volume = 0.35, startDelayMs = 0) {
  if (!ctx || ctx.state !== 'running') return
  try {
    const t0 = ctx.currentTime + startDelayMs / 1000
    const dur = durationMs / 1000
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    // Quick attack/release envelope to avoid clicks
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01)
    gain.gain.setValueAtTime(volume, t0 + dur - 0.03)
    gain.gain.linearRampToValueAtTime(0, t0 + dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + dur)
  } catch {
    // ignore — sound is best-effort
  }
}

/** Short low blip — get-ready countdown ticks. */
export function playCountdownTick() {
  playTone(660, 120)
}

/** Higher "go" tone at the start of the work interval. */
export function playGo() {
  playTone(990, 250, 0.4)
}

/** Single warning chirp (e.g. 10 seconds remaining). */
export function playWarning() {
  playTone(880, 130)
  playTone(880, 130, 0.35, 220)
}

/** Rising triple-beep celebration when the target is reached. */
export function playAlarm() {
  playTone(784, 180, 0.45, 0)    // G5
  playTone(988, 180, 0.45, 240)  // B5
  playTone(1319, 420, 0.45, 480) // E6
}
