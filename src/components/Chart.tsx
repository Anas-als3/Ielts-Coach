/**
 * Task 1 visual renderer — hand-written SVG, no charting library.
 *
 * The app has no runtime dependencies beyond React (README "Architecture"), and
 * a Task 1 chart is simple enough that a library would cost more than it saves.
 * Every colour comes from a design token (DESIGN.md "Tokens"); the examiner-red
 * and amber tokens are semantically reserved for errors and warnings and are
 * never used here.
 *
 * Defensive: an empty series, an empty category list, a single data point and
 * an all-equal series each render something sensible rather than throwing or
 * collapsing to zero height. `null` values are GAPS — a line breaks across
 * them and a bar is simply absent; neither is ever drawn as zero.
 */
import type { ChartProps, Task1Chart, Task1Series } from '../types'
import './Chart.css'

/* ------------------------------ layout constants ----------------------------- */

/* Fixed internal coordinate system: the SVG scales via viewBox, so all layout
   maths below is in constant units and never needs a measured pixel width. */
const W = 640
const H = 360
const PAD = { top: 20, right: 18, bottom: 54, left: 58 }
const PLOT = {
  x: PAD.left,
  y: PAD.top,
  w: W - PAD.left - PAD.right,
  h: H - PAD.top - PAD.bottom,
}
const GRID_LINES = 4

/**
 * Series colours, in order. Defined in Chart.css, scoped to `.chart`.
 *
 * SIX of them, because a pie labels one slice per CATEGORY and the bank's pies
 * have five. With only four the fifth slice wrapped back to colour 1 and sat
 * directly against the first slice, separated by nothing but the stroke.
 */
const SERIES_VARS = [
  'var(--chart-series-1)',
  'var(--chart-series-2)',
  'var(--chart-series-3)',
  'var(--chart-series-4)',
  'var(--chart-series-5)',
  'var(--chart-series-6)',
]

function seriesColor(i: number): string {
  return SERIES_VARS[i % SERIES_VARS.length]
}

/* --------------------------------- helpers ---------------------------------- */

function isNum(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Every finite value across every series, in order. */
function allValues(series: Task1Series[]): number[] {
  return series.flatMap((s) => s.values.filter(isNum))
}

/**
 * A readable axis maximum at or above `max`.
 *
 * Floors at 1 so an all-zero or empty chart still has a non-zero range — a
 * zero-height scale would divide by zero in `yOf`.
 */
function niceCeil(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(max))
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude
    if (candidate >= max) return candidate
  }
  return 10 * magnitude
}

/** Trim trailing zeros so 14.0 reads as "14" but 14.2 keeps its decimal. */
function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)
}

/**
 * A one-line spoken summary of each series, for screen readers. The visual is
 * `role="img"`, so without this the data itself would be unavailable.
 */
function textSummary(chart: Task1Chart): string {
  if (chart.kind === 'process') {
    return `A process diagram with ${chart.steps.length} stages: ${chart.steps.join('; ')}.`
  }
  if (chart.series.length === 0 || chart.categories.length === 0) {
    return `${chart.title}. No data.`
  }
  const lines = chart.series.map((s) => {
    const pairs = s.values
      .map((v, i) => (isNum(v) ? `${chart.categories[i] ?? ''} ${fmt(v)}${chart.unit}` : null))
      .filter((x): x is string => x !== null)
    return `${s.name}: ${pairs.join(', ')}`
  })
  return `${chart.title}, in ${chart.unit || 'units'}. ${lines.join('. ')}.`
}

/* ------------------------------- axis scaffold ------------------------------- */

interface Scale {
  max: number
  yOf: (v: number) => number
  /** Centre of category `i`; also the point position for line charts. */
  xOf: (i: number) => number
  /** Width of one category band, for bar layout. */
  band: number
}

function makeScale(chart: Task1Chart, mode: 'point' | 'band'): Scale {
  const values = allValues(chart.series)
  const max = niceCeil(values.length ? Math.max(...values) : 0)
  const n = Math.max(chart.categories.length, 1)
  const band = PLOT.w / n

  return {
    max,
    yOf: (v) => PLOT.y + PLOT.h - (v / max) * PLOT.h,
    xOf: (i) =>
      mode === 'band'
        ? PLOT.x + band * i + band / 2
        : // A single point has no span to spread across — centre it.
          n === 1
          ? PLOT.x + PLOT.w / 2
          : PLOT.x + (PLOT.w / (n - 1)) * i,
    band,
  }
}

function Axes({ chart, scale }: { chart: Task1Chart; scale: Scale }) {
  const ticks = Array.from({ length: GRID_LINES + 1 }, (_, i) => (scale.max / GRID_LINES) * i)
  return (
    <g aria-hidden="true">
      {ticks.map((t) => (
        <g key={t}>
          <line
            className="chart-grid"
            x1={PLOT.x}
            x2={PLOT.x + PLOT.w}
            y1={scale.yOf(t)}
            y2={scale.yOf(t)}
          />
          <text className="chart-tick" x={PLOT.x - 8} y={scale.yOf(t)} textAnchor="end" dy="0.32em">
            {fmt(t)}
          </text>
        </g>
      ))}
      <line
        className="chart-axis"
        x1={PLOT.x}
        x2={PLOT.x}
        y1={PLOT.y}
        y2={PLOT.y + PLOT.h}
      />
      {chart.categories.map((c, i) => (
        <text
          key={`${c}-${i}`}
          className="chart-tick"
          x={scale.xOf(i)}
          y={PLOT.y + PLOT.h + 20}
          textAnchor="middle"
        >
          {c}
        </text>
      ))}
      {chart.yLabel && (
        <text className="chart-axis-label" transform={`translate(14 ${PLOT.y + PLOT.h / 2}) rotate(-90)`} textAnchor="middle">
          {chart.yLabel}
        </text>
      )}
      {chart.xLabel && (
        <text className="chart-axis-label" x={PLOT.x + PLOT.w / 2} y={H - 8} textAnchor="middle">
          {chart.xLabel}
        </text>
      )}
    </g>
  )
}

function Legend({ series }: { series: Task1Series[] }) {
  if (series.length < 2) return null
  return (
    <ul className="chart-legend">
      {series.map((s, i) => (
        <li key={s.name}>
          <span className="chart-swatch" style={{ background: seriesColor(i) }} aria-hidden="true" />
          {s.name}
        </li>
      ))}
    </ul>
  )
}

/* ---------------------------------- line ------------------------------------ */

/**
 * Split a series into runs of consecutive non-null points. Each run becomes its
 * own polyline, so a gap in the data is drawn as a gap and never interpolated
 * through.
 */
function runsOf(series: Task1Series, scale: Scale, categoryCount: number): Array<Array<[number, number]>> {
  const runs: Array<Array<[number, number]>> = []
  let current: Array<[number, number]> = []
  const limit = Math.min(series.values.length, categoryCount)

  for (let i = 0; i < limit; i++) {
    const v = series.values[i]
    if (isNum(v)) {
      current.push([scale.xOf(i), scale.yOf(v)])
    } else if (current.length) {
      runs.push(current)
      current = []
    }
  }
  if (current.length) runs.push(current)
  return runs
}

function LineChart({ chart }: { chart: Task1Chart }) {
  const scale = makeScale(chart, 'point')
  return (
    <>
      <Axes chart={chart} scale={scale} />
      {chart.series.map((s, si) => {
        const runs = runsOf(s, scale, chart.categories.length)
        return (
          <g key={s.name}>
            {runs.map((run, ri) => (
              <polyline
                key={ri}
                className="chart-line"
                stroke={seriesColor(si)}
                points={run.map(([x, y]) => `${x},${y}`).join(' ')}
              />
            ))}
            {/* Markers also cover the single-point case, where no polyline is drawn. */}
            {runs.flat().map(([x, y], pi) => (
              <circle key={pi} className="chart-dot" cx={x} cy={y} r={3.5} fill={seriesColor(si)} />
            ))}
          </g>
        )
      })}
    </>
  )
}

/* ----------------------------------- bar ------------------------------------ */

function BarChart({ chart }: { chart: Task1Chart }) {
  const scale = makeScale(chart, 'band')
  const groupCount = Math.max(chart.series.length, 1)
  const inner = scale.band * 0.7
  const barW = inner / groupCount

  return (
    <>
      <Axes chart={chart} scale={scale} />
      {chart.series.map((s, si) => (
        <g key={s.name}>
          {s.values.slice(0, chart.categories.length).map((v, i) => {
            if (!isNum(v)) return null // a gap is an absent bar, never a zero bar
            const y = scale.yOf(v)
            const x = scale.xOf(i) - inner / 2 + barW * si
            return (
              <rect
                key={i}
                className="chart-bar"
                x={x}
                y={y}
                width={barW}
                height={Math.max(0, PLOT.y + PLOT.h - y)}
                fill={seriesColor(si)}
              />
            )
          })}
        </g>
      ))}
    </>
  )
}

/* ----------------------------------- pie ------------------------------------ */

const PIE = { cx: W / 2, cy: 168, r: 132 }

function polar(angle: number, r: number): [number, number] {
  return [PIE.cx + r * Math.cos(angle), PIE.cy + r * Math.sin(angle)]
}

function PieChart({ chart }: { chart: Task1Chart }) {
  const series = chart.series[0]
  const values = series ? series.values.slice(0, chart.categories.length) : []
  const total = values.filter(isNum).reduce((a, b) => a + b, 0)
  if (total <= 0) return null

  // One slice covering the whole circle cannot be expressed as an arc — the
  // start and end points coincide and the path collapses. Draw a disc instead.
  const filled = values.filter(isNum)
  if (filled.length === 1) {
    return <circle cx={PIE.cx} cy={PIE.cy} r={PIE.r} fill={seriesColor(0)} />
  }

  let angle = -Math.PI / 2 // start at 12 o'clock
  return (
    <>
      {values.map((v, i) => {
        if (!isNum(v)) return null
        const sweep = (v / total) * Math.PI * 2
        const [x0, y0] = polar(angle, PIE.r)
        const [x1, y1] = polar(angle + sweep, PIE.r)
        const [lx, ly] = polar(angle + sweep / 2, PIE.r * 0.66)
        const largeArc = sweep > Math.PI ? 1 : 0
        const path = `M ${PIE.cx} ${PIE.cy} L ${x0} ${y0} A ${PIE.r} ${PIE.r} 0 ${largeArc} 1 ${x1} ${y1} Z`
        angle += sweep
        return (
          <g key={i}>
            <path className="chart-slice" d={path} fill={seriesColor(i)} />
            {/* Hide the label on slivers too small to hold it. */}
            {sweep > 0.35 && (
              <text className="chart-slice-label" x={lx} y={ly} textAnchor="middle" dy="0.32em">
                {fmt(v)}
                {chart.unit}
              </text>
            )}
          </g>
        )
      })}
    </>
  )
}

/** Pie charts label their slices in a legend, since categories are the slices. */
function PieLegend({ chart }: { chart: Task1Chart }) {
  return (
    <ul className="chart-legend">
      {chart.categories.map((c, i) => (
        <li key={c}>
          <span className="chart-swatch" style={{ background: seriesColor(i) }} aria-hidden="true" />
          {c}
        </li>
      ))}
    </ul>
  )
}

/* ---------------------------------- table ----------------------------------- */

function TableChart({ chart, caption }: { chart: Task1Chart; caption: string }) {
  return (
    <div className="chart-table-scroll">
      <table className="chart-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" />
            {chart.categories.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.series.map((s) => (
            <tr key={s.name}>
              <th scope="row">{s.name}</th>
              {chart.categories.map((c, i) => {
                const v = s.values[i]
                return (
                  <td key={c} className="mono">
                    {isNum(v) ? `${fmt(v)}${chart.unit}` : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* --------------------------------- process ---------------------------------- */

function ProcessChart({ chart }: { chart: Task1Chart }) {
  return (
    <ol className="chart-process">
      {chart.steps.map((step, i) => (
        <li key={i}>
          <span className="chart-step-n mono" aria-hidden="true">
            {i + 1}
          </span>
          <span className="chart-step-text">{step}</span>
        </li>
      ))}
    </ol>
  )
}

/* --------------------------------- exported --------------------------------- */

/**
 * Render a Task 1 visual from its data.
 *
 * Tables and process diagrams render as real HTML (a `<table>` and an `<ol>`)
 * rather than SVG, because their content is genuinely tabular or sequential and
 * the native elements carry the semantics screen readers need for free.
 */
export default function Chart({ chart, caption }: ChartProps) {
  const label = caption ?? chart.title
  const summary = textSummary(chart)

  if (chart.kind === 'table') {
    return (
      <figure className="chart chart-html">
        <TableChart chart={chart} caption={label} />
      </figure>
    )
  }

  if (chart.kind === 'process') {
    return (
      <figure className="chart chart-html">
        <figcaption className="chart-title">{label}</figcaption>
        <ProcessChart chart={chart} />
      </figure>
    )
  }

  const hasData = chart.series.length > 0 && chart.categories.length > 0
  if (!hasData) {
    return (
      <figure className="chart">
        <figcaption className="chart-title">{label}</figcaption>
        <p className="chart-empty">No data to display.</p>
      </figure>
    )
  }

  return (
    <figure className="chart">
      <figcaption className="chart-title">{label}</figcaption>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        role="img"
        aria-label={summary}
      >
        {chart.kind === 'line' && <LineChart chart={chart} />}
        {chart.kind === 'bar' && <BarChart chart={chart} />}
        {chart.kind === 'pie' && <PieChart chart={chart} />}
      </svg>
      {chart.kind === 'pie' ? <PieLegend chart={chart} /> : <Legend series={chart.series} />}
    </figure>
  )
}
