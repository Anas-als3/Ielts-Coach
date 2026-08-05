import type { TimerProps } from '../types'
import './Timer.css'

/** Exam countdown readout for the navy topbar: mm:ss digits over a thin progress bar. */
export default function Timer({ secondsLeft, totalSeconds, running }: TimerProps) {
  const safeLeft = Math.max(0, Math.floor(secondsLeft))
  const fraction =
    totalSeconds > 0 ? Math.min(1, Math.max(0, secondsLeft / totalSeconds)) : 0
  const minutes = Math.floor(safeLeft / 60)
  const seconds = safeLeft % 60
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  const low = safeLeft <= 300
  const pulsing = running && low && safeLeft > 0

  return (
    <div
      className={`tm-timer${low ? ' tm-low' : ''}`}
      role="timer"
      aria-live="off"
      aria-label={`${minutes} minutes ${seconds} seconds remaining`}
    >
      <span className={`tm-digits mono${pulsing ? ' tm-pulse' : ''}`}>{display}</span>
      <span className="tm-track" aria-hidden="true">
        <span className="tm-fill" style={{ width: `${fraction * 100}%` }} />
      </span>
    </div>
  )
}
