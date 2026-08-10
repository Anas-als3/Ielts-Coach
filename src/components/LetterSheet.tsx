/**
 * LetterSheet — the learner's one-page General Training Task 1 guide: how to
 * write the letter. Companion to `CheatSheet` (Task 2) and `ChartSheet`
 * (Academic Task 1); reuses `CheatSheet.css`'s `cs-*` classes so all three
 * sheets share one visual language. Stateless — no ticks, no nav; the
 * content is the deliverable.
 *
 * The copy agrees with what the engine itself rewards or penalises
 * (`letterAchievement.ts`'s `SIGNOFF_FORMS`/`PAIRING_FIX`/
 * `BULLET_KEYWORDS_REQUIRED`/`PURPOSE_MARKERS`, `letterBandEstimate.ts`'s 5.5
 * cap, and `gt-tone-mismatch` in `meta.ts`) — the sheet never teaches
 * something the report would then contradict.
 */
import './CheatSheet.css'

interface Card {
  title: string
  items: string[]
}

const PURPOSE_CARDS: Card[] = [
  {
    title: 'Formal',
    items: ['I am writing to complain about ____', 'to enquire about ____', 'to request ____'],
  },
  {
    title: 'Semi-formal',
    items: ['I am writing to let you know ____', 'I would like to ask ____'],
  },
  {
    title: 'Informal',
    items: ['I just wanted to tell you ____', 'You will never guess ____'],
  },
]

export default function LetterSheet() {
  return (
    <div className="cs-sheet card">
      <header className="cs-head">
        <h2 className="cs-title">IELTS Letters — One Page</h2>
        <p className="cs-sub">
          Match the tone to the reader, cover every bullet, pair the sign-off with the greeting.
        </p>
      </header>

      {/* 1 · pick the tone */}
      <section className="cs-section">
        <h3 className="eyebrow cs-h">1 · Pick the tone</h3>
        <div className="cs-card">
          <h4 className="cs-card-t">Formal</h4>
          <ul>
            <li>
              A company, a council, a manager you have never met. No contractions, no chat:
              cannot, not can't.
            </li>
          </ul>
        </div>
        <div className="cs-card">
          <h4 className="cs-card-t">Semi-formal</h4>
          <ul>
            <li>
              Someone you know in a role: a landlord, a neighbour, a colleague, a teacher. Polite
              and warm; their name is fine.
            </li>
          </ul>
        </div>
        <div className="cs-card">
          <h4 className="cs-card-t">Informal</h4>
          <ul>
            <li>
              A friend or family member. Contractions are correct English here; the mistake at
              this tone is stiff business phrasing, not relaxed phrasing.
            </li>
          </ul>
        </div>
      </section>

      {/* 2 · greeting <-> sign-off pairing */}
      <section className="cs-section">
        <h3 className="eyebrow cs-h">2 · Greeting ↔ sign-off pairing — the rule this app itself checks</h3>
        <div className="cs-rule">
          <span className="cs-rule-t">Dear Sir or Madam, → Yours faithfully,</span>
          <strong>'Yours faithfully' goes only to a reader you did not name.</strong>
        </div>
        <div className="cs-rule">
          <span className="cs-rule-t">Dear Mr Hughes, / Dear Ms Chen, → Yours sincerely,</span>
          You know the name — or Kind regards, in a semi-formal letter.
        </div>
        <div className="cs-rule">
          <span className="cs-rule-t">Dear Anna, / Hi Anna, → Best wishes,</span>
          A friend — or All the best, · Take care,
        </div>
        <p className="cs-rule-note">
          Crossing these pairs costs half a band on Task Achievement — this app marks it, and so
          does the exam. Whatever you close with, write your name on the next line: a sign-off
          with no name under it is not a closed letter.
        </p>
      </section>

      {/* 3 · the first paragraph states the purpose */}
      <section className="cs-section">
        <h3 className="eyebrow cs-h">3 · The first paragraph states the purpose</h3>
        {PURPOSE_CARDS.map((c) => (
          <div key={c.title} className="cs-card">
            <h4 className="cs-card-t">{c.title}</h4>
            <ul>
              {c.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
        <p className="cs-rule-note">
          A friendly letter announces its news instead of declaring an intention. A note line: a
          friendly letter states its business by telling it; I am writing to inform you to a
          friend is a tone fault, not a virtue.
        </p>
      </section>

      {/* 4 · the three bullets */}
      <section className="cs-section">
        <h3 className="eyebrow cs-h">4 · The three bullets are your three middle paragraphs</h3>
        <p className="cs-rule-note">
          One paragraph per bullet, in the printed order — the reader was promised three things
          and should meet them in sequence. Answer each bullet with its own content words: say the
          thing itself (the washing machine stopped mid-cycle), not a gesture at it (the problem I
          mentioned). This app only counts a bullet as covered once two of its content words
          appear in your answer — and a bullet left uncovered caps Task Achievement at 5.5, in
          this app and in the real exam room.
        </p>
      </section>

      {/* 5 · the line before the sign-off */}
      <section className="cs-section">
        <h3 className="eyebrow cs-h">5 · The line before the sign-off</h3>
        <div className="cs-card">
          <ul>
            <li>Formal: I look forward to your reply. · I would appreciate a response at your earliest convenience.</li>
            <li>Semi-formal: Thank you for your time — do let me know if you need anything further.</li>
            <li>Informal: Write back soon and tell me your news.</li>
          </ul>
        </div>
      </section>

      {/* 6 · hold one register */}
      <section className="cs-section">
        <h3 className="eyebrow cs-h">6 · Hold one register</h3>
        <p className="cs-rule-note">
          Choose the tone in the greeting and keep it to the name at the bottom. A formal letter
          never contracts; an informal one naturally does. The letter that opens Dear Sir or
          Madam and later says can't wait has broken its own promise — and the one that tells a
          friend I remain at your disposal has done the same thing in the other direction.
        </p>
      </section>

      {/* 7 · warning */}
      <section className="cs-section">
        <h3 className="eyebrow cs-h">7 · Warning</h3>
        <p className="cs-warn">
          Use the frames for their jobs — the greeting, the purpose, the closing — and write the
          middle in your own words about your own facts. Examiners recognise rehearsed letters and
          discount them; the fastest tell is a paragraph that would fit any prompt.
        </p>
      </section>
    </div>
  )
}
