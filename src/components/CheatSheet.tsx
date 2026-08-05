/**
 * CheatSheet — the learner's own one-page Task 2 guide, restyled in the app's
 * exam-stationery language. Content is kept faithful to the source sheet.
 *
 * Coach Mode only: this component knows nothing about modes — the app decides
 * when to render it. Checklist ticks are component-local and reset on remount.
 */
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import './CheatSheet.css'

type SectionId = 'format' | 'words' | 'commas' | 'conclusion' | 'complex' | 'check'

const NAV: Array<{ id: SectionId; label: string }> = [
  { id: 'format', label: 'Format' },
  { id: 'words', label: 'Words' },
  { id: 'commas', label: 'Commas' },
  { id: 'conclusion', label: 'Conclusion' },
  { id: 'complex', label: 'Complex' },
  { id: 'check', label: 'Checklist' },
]

/* ------------------------------ static content ------------------------------ */

interface WordCard {
  title: string
  items: Array<{ text: string; note?: string }>
}

const WORD_CARDS: WordCard[] = [
  {
    title: 'Start the essay',
    items: [
      { text: 'Whether ____ is a subject that divides opinion.' },
      { text: 'The question of whether ____ has been widely debated.' },
      { text: 'Opinions differ as to whether ____.' },
      { text: '____ is an issue people feel strongly about.' },
    ],
  },
  {
    title: 'Name the two views',
    items: [
      { text: 'Some argue that ____, while others believe that ____.' },
      { text: 'Some people maintain that ____, whereas others disagree.' },
      { text: 'Those in favour say ____. Those against say ____.' },
      { text: 'One group believes ____. Another sees it differently.' },
    ],
  },
  {
    title: 'Your opinion',
    items: [
      { text: 'In my opinion, ____' },
      { text: 'In my view, ____' },
      { text: 'To my mind, ____' },
      { text: 'I would argue that ____', note: 'no comma' },
    ],
  },
  {
    title: 'Start a body paragraph',
    items: [
      { text: 'There are strong arguments in favour of ____.' },
      { text: 'Those who support ____ point out that ____.' },
      { text: 'The main argument for ____ is that ____.' },
      { text: 'On the other hand, ____', note: 'paragraph 3' },
    ],
  },
  {
    title: 'Give the reason',
    items: [
      { text: 'This is because ____', note: 'no comma' },
      { text: 'The reason is that ____', note: 'no comma' },
      { text: 'This is largely because ____', note: 'no comma' },
      { text: 'This is mainly due to ____', note: 'no comma' },
    ],
  },
  {
    title: 'Give an example',
    items: [
      { text: 'For example, ____' },
      { text: 'For instance, ____' },
      { text: 'A clear example of this is ____', note: 'no comma' },
      { text: 'Consider the case of ____', note: 'no comma' },
    ],
  },
  {
    title: 'Close a paragraph',
    items: [
      { text: 'In this sense, ____' },
      { text: 'Therefore, ____' },
      { text: 'As a result, ____' },
      { text: 'This suggests that ____', note: 'no comma' },
    ],
  },
  {
    title: 'Conclude',
    items: [
      { text: 'In conclusion, ____' },
      { text: 'To conclude, ____' },
      { text: 'On balance, ____' },
      { text: 'Ultimately, ____' },
    ],
  },
]

interface ChecklistGroup {
  id: string
  title: string
  items: Array<{ id: string; text: ReactNode }>
}

const CHECKLISTS: ChecklistGroup[] = [
  {
    id: 'shape',
    title: 'Shape — just look at it',
    items: [
      { id: 'shape-1', text: 'Four blocks, blank line between each' },
      { id: 'shape-2', text: 'Opinion is in paragraph 1' },
      {
        id: 'shape-3',
        text: (
          <>
            An example in <strong>each</strong> body paragraph
          </>
        ),
      },
      { id: 'shape-4', text: 'Conclusion is 2 sentences, no new example' },
      { id: 'shape-5', text: 'No connector used twice' },
      {
        id: 'shape-6',
        text: (
          <>
            <strong>At least 4 complex sentences</strong> — one per paragraph (
            <em>who / although / unless / , only to</em>)
          </>
        ),
      },
      {
        id: 'shape-7',
        text: (
          <>
            Your opinion in ¶1 and ¶4 <strong>say the same thing</strong>
          </>
        ),
      },
    ],
  },
  {
    id: 'punct',
    title: 'Punctuation — search these words',
    items: [
      {
        id: 'punct-1',
        text: (
          <>
            Search <strong>because</strong> — no comma before, no comma after
          </>
        ),
      },
      {
        id: 'punct-2',
        text: (
          <>
            Every <strong>However / Therefore / For example / In my opinion / As a result</strong>{' '}
            has its comma
          </>
        ),
      },
      { id: 'punct-3', text: 'No space before any comma' },
      { id: 'punct-4', text: 'Read each sentence alone — can you point at a verb?' },
      { id: 'punct-5', text: 'Capital letter after every full stop' },
    ],
  },
  {
    id: 'gram',
    title: 'Grammar — read twice',
    items: [
      {
        id: 'gram-1',
        text: (
          <>
            <strong>Nouns:</strong> every single countable noun has <em>a / the / this / my</em>
          </>
        ),
      },
      {
        id: 'gram-2',
        text: (
          <>
            <strong>Verbs:</strong> one thing → verb + <strong>s</strong> · many things → no{' '}
            <strong>s</strong>
          </>
        ),
      },
      {
        id: 'gram-3',
        text: (
          <>
            Every <strong>its / it's</strong> — say "it is"; if it fits, use the apostrophe
          </>
        ),
      },
      {
        id: 'gram-4',
        text: (
          <>
            Every <strong>i</strong> is a capital <strong>I</strong>
          </>
        ),
      },
      { id: 'gram-5', text: 'Capitals on countries, cities, people, companies' },
      { id: 'gram-6', text: 'No invented numbers' },
    ],
  },
]

/* --------------------------------- helpers ---------------------------------- */

/** ✓ / ✗ marker: mono glyph plus visually-hidden text for screen readers. */
function Mark({ ok }: { ok: boolean }) {
  return (
    <>
      <span className="cs-mark" aria-hidden="true">
        {ok ? '✓' : '✗'}
      </span>
      <span className="cs-vh">{ok ? 'Correct:' : 'Wrong:'}</span>
    </>
  )
}

/** One ✓ (green) or ✗ (red) example line. */
function Ex({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div className={`cs-ex ${ok ? 'cs-ok' : 'cs-no'}`}>
      <Mark ok={ok} />
      <span className="cs-ex-text">{children}</span>
    </div>
  )
}

/* -------------------------------- component --------------------------------- */

export default function CheatSheet() {
  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
    format: null,
    words: null,
    commas: null,
    conclusion: null,
    complex: null,
    check: null,
  })
  const [ticked, setTicked] = useState<Record<string, boolean>>({})

  const setRef = (id: SectionId) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el
  }

  const jumpTo = (id: SectionId) => {
    const el = sectionRefs.current[id]
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' })
  }

  const toggle = (id: string) => {
    setTicked((t) => ({ ...t, [id]: !t[id] }))
  }

  return (
    <div className="cs-sheet card">
      {/* sticky mini-nav */}
      <nav className="cs-nav" aria-label="Cheat sheet sections">
        {NAV.map(({ id, label }) => (
          <button key={id} type="button" className="cs-chip" onClick={() => jumpTo(id)}>
            {label}
          </button>
        ))}
      </nav>

      <header className="cs-head">
        <h2 className="cs-title">IELTS Task 2 — One Page</h2>
        <p className="cs-sub">Keep this open while you write. Everything you need, nothing you don't.</p>
      </header>

      {/* 1 · the format */}
      <section ref={setRef('format')} className="cs-section">
        <h3 className="eyebrow cs-h">1 · The format</h3>

        <div className="cs-fmt">
          <div className="cs-fmt-h">
            <span>Paragraph 1 — Introduction</span>
            <span className="cs-fmt-count">3 sentences</span>
          </div>
          <div className="cs-fmt-b">
            <ol>
              <li>Say the topic in your own words</li>
              <li>Name the two views</li>
              <li>
                <strong>Your opinion — here, not at the end</strong>
              </li>
            </ol>
          </div>
        </div>

        <div className="cs-fmt">
          <div className="cs-fmt-h">
            <span>Paragraph 2 — First view</span>
            <span className="cs-fmt-count">4 sentences</span>
          </div>
          <div className="cs-fmt-b">
            <ol>
              <li>The point</li>
              <li>Why it's true</li>
              <li>An example</li>
              <li>What it proves</li>
            </ol>
          </div>
        </div>

        <div className="cs-fmt">
          <div className="cs-fmt-h">
            <span>Paragraph 3 — Second view</span>
            <span className="cs-fmt-count">4 sentences</span>
          </div>
          <div className="cs-fmt-b">
            Same four jobs. Start with <strong>On the other hand,</strong>
          </div>
        </div>

        <div className="cs-fmt">
          <div className="cs-fmt-h">
            <span>Paragraph 4 — Conclusion</span>
            <span className="cs-fmt-count">2 sentences</span>
          </div>
          <div className="cs-fmt-b">
            Repeat your opinion. <strong>No new example.</strong>
          </div>
        </div>
      </section>

      {/* 2 · words to use */}
      <section ref={setRef('words')} className="cs-section">
        <h3 className="eyebrow cs-h">2 · Words to use — 4 of each</h3>
        {WORD_CARDS.map((card) => (
          <div key={card.title} className="cs-card">
            <h4 className="cs-card-t">{card.title}</h4>
            <ul>
              {card.items.map((item) => (
                <li key={item.text}>
                  {item.text}
                  {item.note && <span className="cs-note">{item.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* 3 · commas */}
      <section ref={setRef('commas')} className="cs-section">
        <h3 className="eyebrow cs-h">3 · Commas — 4 rules</h3>

        <div className="cs-rule">
          <span className="cs-rule-t">1. Finished phrase → comma</span>
          These complete an idea, so they take a comma glued on:
          <Ex ok>
            However, · Therefore, · For example, · For instance, · In my opinion, · In this sense,
            · As a result, · On the other hand, · In conclusion,
          </Ex>
        </div>

        <div className="cs-rule">
          <span className="cs-rule-t">2. Waiting connector → NO comma</span>
          These are still mid-sentence, so nothing follows them:
          <Ex ok={false}>
            because · that · and · but · This is because · The reason is that · That is why
          </Ex>
          <p className="cs-rule-note">
            Also never put a comma <em>before</em> <strong>because</strong>.
          </p>
        </div>

        <div className="cs-rule">
          <span className="cs-rule-t">3. Two complete ideas → full stop, or comma + and/but/so</span>
          Cover each side. If both make sense alone, a comma is not enough.
          <Ex ok={false}>He was weak, he was not selected.</Ex>
          <Ex ok>He was weak. He was not selected.</Ex>
          <Ex ok>He was weak, so he was not selected.</Ex>
        </div>

        <div className="cs-rule">
          <span className="cs-rule-t">4. The comma sticks to the word before it</span>
          <Ex ok={false}>In conclusion , although</Ex>
          <Ex ok>In conclusion, although</Ex>
        </div>
      </section>

      {/* 4 · the conclusion */}
      <section ref={setRef('conclusion')} className="cs-section">
        <h3 className="eyebrow cs-h">4 · The conclusion</h3>

        <div className="cs-concl">
          <span className="cs-lbl">Two sentences. Never a new example.</span>
          <div className="cs-tmpl">
            <strong>Sentence 1 —</strong> In conclusion, although <em>[the other side]</em>, I
            believe that <em>[your opinion]</em>.
            <br />
            <strong>Sentence 2 —</strong> <em>[One sentence saying why it matters.]</em>
          </div>
          <span className="cs-lbl">Finished example</span>
          <div className="cs-tmpl">
            In conclusion, although uniforms limit self-expression, I believe schools should
            require them. They remove a daily source of comparison between students, and that
            matters more at school than personal style does.
          </div>
          <p className="cs-concl-note">
            Note the comma after <strong>although uniforms limit self-expression</strong> — because
            that part comes <em>first</em>. If it came second there would be no comma.
          </p>
        </div>
      </section>

      {/* 5 · complex sentences */}
      <section ref={setRef('complex')} className="cs-section">
        <h3 className="eyebrow cs-h">5 · Complex sentences — the Band 7 gate</h3>

        <div className="cs-ladder">
          <div className="cs-step">
            <span className="cs-step-t">Simple — one idea</span>
            Prisoners lose their future.
          </div>
          <div className="cs-step">
            <span className="cs-step-t">Compound — two ideas glued with and / but / so / then</span>
            Prisoners lose their future, <strong>and</strong> society gains nothing.{' '}
            <em className="cs-ladder-note">— still counts as simple</em>
          </div>
          <div className="cs-step cs-step-hit">
            <span className="cs-step-t">Complex — one idea depends on the other ✓</span>
            <strong>Although</strong> prisoners lose years of their life, society gains nothing in
            return.
          </div>
        </div>

        <p className="cs-target">
          <strong>Target: 4 complex sentences per essay — one in every paragraph.</strong> Without
          them, Grammatical Range is capped near Band 6 no matter how clean your punctuation is.
        </p>

        <div className="cs-pat">
          <span className="cs-pat-t">1 · Relative clause — who / which / that</span>
          <div className="cs-pat-ex">
            A man <u className="cs-clause">who had already served ten years for murder</u> was
            released early.
            <br />
            Uniforms remove daily comparison
            <u className="cs-clause">, which matters more than personal style</u>.
          </div>
        </div>

        <div className="cs-pat">
          <span className="cs-pat-t">2 · Concession — although / while / even though</span>
          <div className="cs-pat-ex">
            <u className="cs-clause">Although rehabilitation clearly works for minor offences</u>,
            it is less convincing for violent crime.
            <br />
            <u className="cs-clause">While working from home saves time</u>, it demands real
            self-discipline.
          </div>
        </div>

        <div className="cs-pat">
          <span className="cs-pat-t">3 · Condition — if / unless</span>
          <div className="cs-pat-ex">
            <u className="cs-clause">Unless a prisoner is given a way to earn a living</u>, release
            simply returns him to the situation that caused the crime.
            <br />
            <u className="cs-clause">If children are taught to cook at school</u>, they carry the
            skill for life.
          </div>
        </div>

        <div className="cs-pat">
          <span className="cs-pat-t">4 · Participle result — , only to / , leaving / , making</span>
          <div className="cs-pat-ex">
            He was released after ten years for good behaviour
            <u className="cs-clause">, only to kill again</u>.
            <br />
            Online stores stay open all night
            <u className="cs-clause">, leaving physical shops at a disadvantage</u>.
          </div>
        </div>

        <div className="cs-ba">
          <div className="cs-ba-row cs-no">
            <span className="cs-ba-t">
              <Mark ok={false} /> Before — 4 events glued with then / after that / and
            </span>
            <p className="cs-ba-text">
              For instance, a killer killed a random women in the street, then he got sentenced for
              10 years with good work, after that he got out and killed another women.
            </p>
          </div>
          <div className="cs-ba-row cs-ok">
            <span className="cs-ba-t">
              <Mark ok /> After — 3 complex structures, half the length
            </span>
            <p className="cs-ba-text">
              For instance, a man <strong>who murdered a stranger in the street</strong> was
              released after only ten years for good behaviour, <strong>only to kill again</strong>{' '}
              — a second death <strong>that a longer sentence would have prevented</strong>.
            </p>
          </div>
        </div>

        <p className="cs-warn">
          <strong>Warning sign:</strong> if a sentence runs <em>… and … then … after that … and …</em>,
          it is a chain, not a complex sentence. Break it and rebuild one half as a{' '}
          <em>who / although / unless</em> clause.
        </p>
      </section>

      {/* 6 · before you send */}
      <section ref={setRef('check')} className="cs-section">
        <h3 className="eyebrow cs-h">6 · Before you send</h3>
        {CHECKLISTS.map((group) => (
          <div key={group.id} className="cs-check-group">
            <h4 className="cs-check-t">{group.title}</h4>
            {group.items.map((item) => {
              const done = ticked[item.id] === true
              return (
                <label key={item.id} className={`cs-check-row${done ? ' cs-done' : ''}`}>
                  <input type="checkbox" checked={done} onChange={() => toggle(item.id)} />
                  <span className="cs-check-text">{item.text}</span>
                </label>
              )
            })}
          </div>
        ))}
      </section>
    </div>
  )
}
