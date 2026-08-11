/**
 * The Listening section's front door: which papers exist, what sitting one
 * involves, what the audio actually is, and what the learner has scored before.
 *
 * `ReadingPicker`'s sibling with one deliberate omission and one deliberate
 * addition.
 *
 * **The omission: no exam type.** Reading's picker is scoped to one module and
 * says so at length, because the two exams' papers are built differently and
 * convert through different tables. Listening has neither problem — Academic
 * and General Training sit the identical paper and convert identically — so
 * this screen has no module prop, no filter and no scope line, and instead says
 * in one sentence that the distinction does not exist. Plan 011: "Listening
 * needs no Academic/General branching. Resist any abstraction that implies
 * otherwise."
 *
 * **The addition: the choice between exam conditions and practice.** It is made
 * HERE, before the clock starts, because it is the difference between a score
 * that means something and an exercise that does not, and offering it as a
 * mid-paper toggle would let a learner reach for a replay the moment they
 * missed an answer — which is precisely the habit the real exam punishes.
 */
import { useEffect, useMemo, useState } from 'react'
import type { ListeningPickerProps } from '../types'
import type { ListeningFormat, ListeningTest } from '../listening/types'
import { LISTENING_MINUTES, LISTENING_TRANSFER_MINUTES } from '../listening/types'
import { browserSpeechEngine, noticeFor, voiceQualityScore } from '../listening/speech'
import { loadPrefs, savePrefs } from '../profile/prefs'
import { LISTENING_FORMAT_META } from '../meta'
import './ListeningPicker.css'

/** Read out through the Preview button, through whichever voice is selected.
 *  Fixed and short — the point is to hear the voice, not to test it. */
const VOICE_PREVIEW_SENTENCE = 'Good morning. This is a preview of the voice used for your Listening test.'

/** The platform's English voices, or `[]` where there is no engine at all. */
function englishVoices(): SpeechSynthesisVoice[] {
  const engine = browserSpeechEngine()
  if (engine === null) return []
  return engine.synthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('en'))
}

/**
 * What the `<select>` should show as chosen: `selectedURI` itself when it
 * still names one of `voices`, `''` (Automatic) otherwise.
 *
 * A persisted `preferredVoiceURI` that no longer names an installed voice
 * (OS updates add and remove voices) falls back to Automatic in the DISPLAY,
 * not only in the driver's own ranking (`rankVoices`,
 * `tests/speech.test.ts`) — a blank or broken-looking selection would read as
 * a bug rather than the safe fallback it actually is. Exported as a plain
 * function, separate from the component, so this specific guarantee is
 * assertable directly rather than only through a rendered `<select>`, whose
 * OWN browser default (selecting the first `<option>` when no option matches
 * its value) would otherwise mask a broken implementation here.
 */
export function resolveSelectedVoiceURI(voices: readonly SpeechSynthesisVoice[], selectedURI: string): string {
  return voices.some((voice) => voice.voiceURI === selectedURI) ? selectedURI : ''
}

/**
 * Plan 032 Prong A: a select listing the platform's English voices, grouped
 * "Recommended" first by `voiceQualityScore` (the same heuristic
 * `pickVoice`/`rankVoices` rank by), a Preview button that speaks
 * `VOICE_PREVIEW_SENTENCE` through the chosen voice, and "Automatic
 * (recommended)" as the default — which is the SAFE choice, not a lesser one,
 * now that `rankVoices` picks well on its own.
 *
 * Reads and writes `preferredVoiceURI` directly through `src/profile/prefs.ts`
 * rather than through props: `createSpeechDriver` reads the same key itself at
 * driver construction (see `speech.ts`), so this screen needs no wiring
 * through `App.tsx` to have its effect — the choice applies the next time a
 * Listening driver is built, which is also why Preview speaks directly rather
 * than through the app's shared driver.
 *
 * A whole separate child component, not inline in `ListeningPicker`, so a
 * platform with no speech engine at all can render nothing here (no voices to
 * choose between) without an early return skipping the rest of the picker —
 * `ExamGoalCard` in `Dashboard.tsx` is the same one-file-multiple-components
 * pattern.
 */
function ListeningVoicePicker() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => englishVoices())
  const [selectedURI, setSelectedURI] = useState<string>(() => loadPrefs().preferredVoiceURI ?? '')

  // `getVoices()` is empty until `voiceschanged` fires on some platforms
  // (documented already at speech.ts's browser-engine seam) — listen and
  // re-render rather than showing a permanently empty list on those.
  useEffect(() => {
    const scope = globalThis as {
      speechSynthesis?: {
        addEventListener?: (type: string, listener: () => void) => void
        removeEventListener?: (type: string, listener: () => void) => void
      }
    }
    const synthesis = scope.speechSynthesis
    if (synthesis?.addEventListener === undefined) return
    const onVoicesChanged = (): void => setVoices(englishVoices())
    synthesis.addEventListener('voiceschanged', onVoicesChanged)
    return () => synthesis.removeEventListener?.('voiceschanged', onVoicesChanged)
  }, [])

  // No engine, no voices, nothing to pick between — not even Automatic means
  // anything on a machine that falls back to the paced transcript.
  if (browserSpeechEngine() === null) return null

  const recommended = voices
    .filter((voice) => voiceQualityScore(voice) > 0)
    .sort((a, b) => voiceQualityScore(b) - voiceQualityScore(a))
  const other = voices
    .filter((voice) => voiceQualityScore(voice) <= 0)
    .sort((a, b) => voiceQualityScore(b) - voiceQualityScore(a))

  const validSelectedURI = resolveSelectedVoiceURI(voices, selectedURI)

  function choose(uri: string): void {
    setSelectedURI(uri)
    savePrefs({ preferredVoiceURI: uri === '' ? undefined : uri })
  }

  function preview(): void {
    const engine = browserSpeechEngine()
    if (engine === null) return
    const utterance = engine.createUtterance(VOICE_PREVIEW_SENTENCE)
    const voice = voices.find((v) => v.voiceURI === validSelectedURI)
    if (voice !== undefined) utterance.voice = voice
    engine.synthesis.speak(utterance)
  }

  return (
    <section className="lsp-voice card" aria-label="Listening voice">
      <h2 className="eyebrow">Voice</h2>
      <p className="lsp-voice-lead">
        Automatic picks the best-sounding voice your browser offers, and gives each speaker in a
        conversation a different one where it can. Pick a specific voice instead if you have a
        favourite — the choice applies the next time a Listening paper opens.
      </p>
      <div className="lsp-voice-row">
        <label className="lsp-voice-field" htmlFor="lsp-voice-select">
          <span className="lsp-voice-label">Voice</span>
          <select
            id="lsp-voice-select"
            value={validSelectedURI}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">Automatic (recommended)</option>
            {recommended.length > 0 && (
              <optgroup label="Recommended">
                {recommended.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </optgroup>
            )}
            {other.length > 0 && (
              <optgroup label="Other voices">
                {other.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <button className="btn" onClick={preview}>
          Preview voice
        </button>
      </div>
    </section>
  )
}

/** Formats present in a paper, in first-appearance order, with counts. */
function formatBreakdown(test: ListeningTest): Array<{ format: ListeningFormat; count: number }> {
  const order: ListeningFormat[] = []
  const counts = new Map<ListeningFormat, number>()
  for (const question of test.questions) {
    if (!counts.has(question.format)) order.push(question.format)
    counts.set(question.format, (counts.get(question.format) ?? 0) + 1)
  }
  return order.map((format) => ({ format, count: counts.get(format) ?? 0 }))
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ListeningPicker({
  tests,
  history,
  driverKind,
  onStart,
  onOpen,
}: ListeningPickerProps) {
  const breakdowns = useMemo(() => new Map(tests.map((t) => [t.id, formatBreakdown(t)])), [tests])

  return (
    <div className="lsp">
      <header className="lsp-head">
        <h1 className="lsp-title">Listening</h1>
        <p className="lsp-lead">
          {LISTENING_MINUTES} minutes, 40 questions, four sections that get harder as they go, plus
          a {LISTENING_TRANSFER_MINUTES}-minute checking window at the end. The clock starts the
          moment the paper opens and submits for you when it runs out.
        </p>
        <p className="lsp-same">
          One paper for both exams. Listening is <strong>identical</strong> in Academic and General
          Training — same sections, same timing, same conversion table — so there is no exam type to
          choose here and the score means the same thing whichever you are sitting.
        </p>
        <p className="lsp-exact">
          Like Reading, Listening is scored <strong>exactly</strong>. It is an answer key and a
          published conversion table — there is no estimate and no hedging, unlike the form-only
          band the writing engine reports.
        </p>
      </header>

      {/*
        The audio, stated before the learner commits 40 minutes to it. This is
        the honesty half of plan 011's audio decision and it is not optional
        copy: a synthetic voice presented as though it were the exam's recorded
        actors would misrepresent how much of the real difficulty this practice
        reproduces.
      */}
      <section className="lsp-audio card" aria-label="About the audio">
        <h2 className="eyebrow">About the audio</h2>
        <p className="lsp-audio-notice">{noticeFor(driverKind)}</p>
        <p className="lsp-audio-why">
          This app has no server and no runtime dependency beyond React, and a set of real
          recordings would add roughly 25–30 MB per test to a 371 kB app. Your browser's own speech
          engine costs nothing to ship and works offline, which is the trade that was made —
          knowingly, and with this notice as the other half of it. Accents are part of what the real
          test examines, and this practice cannot examine them.
        </p>
      </section>

      <ListeningVoicePicker />

      <section className="lsp-list" aria-label="Listening papers">
        {tests.length === 0 ? (
          <p className="lsp-empty card">No Listening paper has been authored yet.</p>
        ) : (
          <ul className="lsp-tests">
            {tests.map((test) => (
              <li key={test.id} className="lsp-test card">
                <div className="lsp-test-body">
                  <h2 className="lsp-test-title">{test.title}</h2>
                  <p className="lsp-test-meta mono">
                    {test.sections.length} sections · {test.questions.length} questions ·{' '}
                    {LISTENING_MINUTES} + {LISTENING_TRANSFER_MINUTES} minutes
                  </p>
                  <ul className="lsp-formats">
                    {(breakdowns.get(test.id) ?? []).map(({ format, count }) => (
                      <li key={format}>
                        {LISTENING_FORMAT_META[format].report}
                        <span className="lsp-format-count mono"> {count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="lsp-test-actions">
                  <button className="btn btn-primary" onClick={() => onStart(test.id, false)}>
                    Sit under exam conditions
                  </button>
                  <button className="btn" onClick={() => onStart(test.id, true)}>
                    Practice mode
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The two modes, told apart in as many words. A learner who does not know
          which one they are in cannot know what their band is worth. */}
      <section className="lsp-modes card" aria-label="Exam conditions and practice mode">
        <h2 className="eyebrow">The two ways to sit it</h2>
        <dl className="lsp-mode-list">
          <dt>Exam conditions</dt>
          <dd>
            Each section plays <strong>once</strong>, in order, and never again. That is what the
            real test does — there is no replay, no pause and no going back — so this is the only
            setting that produces a band you can plan around.
          </dd>
          <dt>Practice mode</dt>
          <dd>
            Sections can be replayed and played in any order. Useful for learning what a format
            sounds like or for checking what you missed, and useless as a score: the paper is
            marked and saved, but it is labelled a practice run in your history and in the report,
            because a band earned with replays is not the band you would get on the day.
          </dd>
        </dl>
      </section>

      {history.length > 0 && (
        <section className="lsp-history card" aria-label="Your Listening results">
          <h2 className="eyebrow">Your Listening results</h2>
          <ul className="lsp-history-list">
            {history.map((session) => (
              <li key={session.id} className="lsp-history-row">
                <span className="lsp-history-band mono">{session.result.band.toFixed(1)}</span>
                <span className="lsp-history-raw mono">
                  {session.result.raw}/{session.result.total}
                </span>
                <span className="lsp-history-title">
                  {session.testTitle}
                  {session.practice && <span className="lsp-history-practice"> · practice</span>}
                </span>
                <span className="lsp-history-date">{formatDate(session.dateISO)}</span>
                <button className="btn" onClick={() => onOpen(session)}>
                  Review
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
