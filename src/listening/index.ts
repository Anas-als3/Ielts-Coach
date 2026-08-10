/**
 * The Listening module. Implements plan 011 core (types, band table, audio,
 * content, marking).
 *
 * ## What this module is
 *
 * Listening is Reading's sibling and is built as one: a fixed answer key, a raw
 * score out of 40, and a published conversion table. It therefore has **no
 * marking code of its own**. `./mark.ts` is an adapter over
 * `src/marking/markAnswerKey.ts` — the same function Reading marks with — and
 * supplies only the Listening conversion table. Duplicating the marker would
 * have meant two definitions of what "over the word limit" means, and the two
 * would eventually have disagreed.
 *
 * Two structural facts drop out of the exam and are enforced here rather than
 * documented and hoped for:
 *
 *  - **No Academic/General branching.** Both exams sit the identical paper and
 *    are converted by the identical table. `ListeningTest` has no `module`,
 *    `ListeningResult` reports none, and there is no per-module test lookup.
 *  - **The recording plays once, in order.** `ListeningPlayer` owns that rule,
 *    headlessly, so it survives any future rewrite of the UI. `practice: true`
 *    lifts it explicitly and the attempt records that it was lifted.
 *
 * ## The audio decision
 *
 * Plan 011 refused to let code be written before the audio question was
 * settled. It is settled: **browser speech synthesis (`window.speechSynthesis`),
 * with a fixed-pace transcript reveal as the fallback.** In short —
 *
 *  - `speechSynthesis` is a built-in browser API, so it adds no runtime
 *    dependency and no bundled bytes; the app's "nothing beyond React" property
 *    survives, which no other option manages.
 *  - It works offline, like everything else here.
 *  - Bundling real recordings would add roughly 25–30 MB per test to a 371 kB
 *    app. That is not a trade-off, it is a different product.
 *  - It is honestly **not** the real exam, and the UI must say so in plain
 *    words: the voice is synthetic, and the real test uses recorded speakers
 *    with varied accents. `SYNTHETIC_VOICE_NOTICE` is that sentence, exported
 *    as a constant so it cannot quietly go missing.
 *  - Where no usable voice exists, `TranscriptPaceDriver` reveals the
 *    transcript at speaking pace and `TRANSCRIPT_FALLBACK_NOTICE` says that the
 *    exercise has changed.
 *
 * The full reasoning, and the reason speech sits behind a `SpeechDriver`
 * interface at all, is in `./speech.ts`.
 *
 * ## Content and copyright
 *
 * Every transcript and question under `src/listening/tests/` is original work
 * of this project. Nothing is reproduced from Cambridge/UCLES, from any IELTS
 * publisher, or from any online test bank; the exam's FORMAT is followed, its
 * material is not borrowed.
 *
 * ## Not built here
 *
 * The React runner, the 30-minute clock, the `LISTENING_TRANSFER_MINUTES`
 * review window and the `SessionRecord` wiring are a later plan's work. This
 * module is the engine they will code against, and it is complete and tested
 * without them.
 */

export * from './types'
export * from './bandTable'
export * from './speech'
export * from './player'
export * from './mark'
export * from './tests'
