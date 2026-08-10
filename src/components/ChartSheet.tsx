/**
 * ChartSheet — the learner's one-page Academic Task 1 guide: how to describe
 * a chart. Companion to `CheatSheet` (Task 2) and `LetterSheet` (GT Task 1);
 * reuses `CheatSheet.css`'s `cs-*` classes so all three sheets share one
 * visual language. Stateless — no ticks, no nav; the content is the
 * deliverable.
 *
 * The copy agrees with what the engine itself rewards or penalises
 * (`CATEGORY_META` in `meta.ts`: `t1-overview-missing`, `t1-invented-figure`,
 * `t1-explains-causes`, `t1-opinion`, `t1-shape`) — the sheet never teaches
 * something the report would then contradict.
 */
import './CheatSheet.css'

interface Card {
  title: string
  body: string
  note?: string
}

const TREND_CARDS: Card[] = [
  {
    title: 'Going up',
    body: 'rise · grow · climb · increase — fast: jump · surge · soar — slight: edge up · creep up',
  },
  {
    title: 'Going down',
    body: 'fall · drop · decline · decrease — fast: plunge · plummet — small and brief: dip',
  },
  {
    title: 'Staying level',
    body: 'remain stable · hold steady · level off · plateau',
  },
  {
    title: 'Turning points',
    body: 'peak at · reach a high of · bottom out at · recover · fluctuate around',
  },
  {
    title: 'How fast, how big (adverbs)',
    body: 'sharply · steeply · considerably · moderately · gradually · slightly · steadily',
  },
  {
    title: 'Noun forms',
    body: 'a sharp rise in · a gradual decline in · a peak of · a low of',
    note: 'Verb + adverb (fell sharply) or adjective + noun (a sharp fall) — never “a sharply fall”.',
  },
]

export default function ChartSheet() {
  return (
    <div className="cs-sheet card">
      <header className="cs-head">
        <h2 className="cs-title">IELTS Task 1 — Charts, One Page</h2>
        <p className="cs-sub">Report what the data shows. Never why.</p>
      </header>

      {/* 1 · the shape */}
      <section className="cs-section">
        <h3 className="eyebrow cs-h">1 · The shape</h3>

        <div className="cs-fmt">
          <div className="cs-fmt-h">
            <span>Paragraph 1 — Paraphrase</span>
          </div>
          <div className="cs-fmt-b">
            The task, in your own words. Copied chart-title wording is excluded from your word
            count, so paraphrase it.
          </div>
        </div>

        <div className="cs-fmt">
          <div className="cs-fmt-h">
            <span>Paragraph 2 — Overview</span>
          </div>
          <div className="cs-fmt-b">
            The one or two biggest things in the data. No numbers here.
          </div>
        </div>

        <div className="cs-fmt">
          <div className="cs-fmt-h">
            <span>Paragraphs 3–4 — Detail</span>
          </div>
          <div className="cs-fmt-b">Grouped, compared, and backed with figures.</div>
        </div>

        <p className="cs-rule-note">
          No conclusion. No opinion. No explaining why — Task 1 reports; it never interprets or
          predicts.
        </p>
      </section>

      {/* 2 · the overview */}
      <section className="cs-section">
        <h3 className="eyebrow cs-h">2 · The overview — the biggest single lever</h3>
        <div className="cs-card">
          <h4 className="cs-card-t">Overview sentence frames</h4>
          <ul>
            <li>
              Overall, ____ rose steadily over the period, while ____ moved in the opposite
              direction.
            </li>
            <li>Overall, ____ remained the largest group throughout, although the gap narrowed.</li>
            <li>It is clear that the most dramatic change was ____.</li>
          </ul>
        </div>
        <p className="cs-rule-note">
          <strong>The overview names the trend, not the numbers.</strong> Save every figure for the
          detail paragraphs.
        </p>
      </section>

      {/* 3 · the trend lexicon */}
      <section className="cs-section">
        <h3 className="eyebrow cs-h">3 · The trend lexicon</h3>
        {TREND_CARDS.map((c) => (
          <div key={c.title} className="cs-rule">
            <span className="cs-rule-t">{c.title}</span>
            {c.body}
            {c.note && <p className="cs-rule-note">{c.note}</p>}
          </div>
        ))}
      </section>

      {/* 4 · the proportion trap */}
      <section className="cs-section">
        <h3 className="eyebrow cs-h">4 · The proportion trap</h3>
        <p className="cs-rule-note">
          35% of households is a share, not a count.{' '}
          <strong>A percentage can fall while the number behind it rises</strong> — if the
          population grows fast enough, a smaller share is still more people. Write the
          proportion / percentage / share of when the axis shows %, and the number / amount of
          when it counts things. And mind the grammar of the category: the number of unemployed
          people, never the number of unemployment.
        </p>
      </section>

      {/* 5 · tense */}
      <section className="cs-section">
        <h3 className="eyebrow cs-h">5 · Tense</h3>
        <div className="cs-rule">
          <span className="cs-rule-t">Match the tense to the timeframe</span>
          <ul>
            <li>All the years are in the past → past simple (rose, fell).</li>
            <li>The period runs up to now → present perfect (has risen since 2015).</li>
            <li>The years are in the future → is expected to reach, is projected to fall.</li>
            <li>No dates at all (a process, a map) → present simple.</li>
          </ul>
        </div>
        <p className="cs-rule-note">
          Two rules this app itself enforces: every figure you quote must appear in the chart, and
          Task 1 never explains why — describe the movement, and leave the causes and predictions
          out.
        </p>
      </section>

      {/* 6 · warning */}
      <section className="cs-section">
        <h3 className="eyebrow cs-h">6 · Warning</h3>
        <p className="cs-warn">
          Use these frames for the job each sentence does, not as lines to memorise. Examiners
          recognise rehearsed wording and discount it — the frame tells you what the sentence must
          achieve; the words inside it must be yours, about this chart.
        </p>
      </section>
    </div>
  )
}
