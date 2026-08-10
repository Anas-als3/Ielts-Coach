import { it } from 'vitest'
import { analyzeEssay } from '../src/analysis/engine'

function pad(words: number): string {
  const letter = 'abcdefghij'
  return (
    Array.from({ length: words }, (_, i) => {
      const suffix = String(i)
        .split('')
        .map((d) => letter[Number(d)])
        .join('')
      return `pad${suffix}`
    }).join(' ') + '.'
  )
}

const FIVE = [
  'Working from home can reduce commuting costs for many employees today.',
  'Governments must act to reduce crime in the largest cities of the world.',
  'However, it is clear that the government should invest far more in education.',
  'If a country invests in education it will prosper.',
  'Governments inspect factories every 10 years to ensure that standards are met.',
]

const TRUE_POS = [
  'Working from home reduce costs for many employees today.',
  'A random women walked into the shop and asked for help.',
  'Although the government invested heavily.',
  'The plan failed, it was too expensive.',
  'He lost job last year and never recovered.',
]

it('probe: bare', () => {
  for (const t of [...FIVE, ...TRUE_POS]) {
    const a = analyzeEssay(t, null)
    const nonInfo = a.issues.filter((i) => i.severity !== 'info')
    console.log('\n=== BARE:', t)
    for (const i of nonInfo) console.log(`   [${i.severity}] ${i.category}: ${i.message}`)
  }
})

it('probe: padded 60', () => {
  for (const t of [...FIVE, ...TRUE_POS]) {
    const a = analyzeEssay(`${pad(60)} ${t}`, null)
    const nonInfo = a.issues.filter((i) => i.severity !== 'info')
    console.log('\n=== PAD60:', t)
    for (const i of nonInfo) console.log(`   [${i.severity}] ${i.category}: ${i.message}`)
  }
})

it('probe: padded 260', () => {
  const a = analyzeEssay(`${pad(260)} ${FIVE[0]}`, null)
  console.log('\n=== PAD260')
  for (const i of a.issues.filter((x) => x.severity !== 'info')) {
    console.log(`   [${i.severity}] ${i.category}: ${i.message}`)
  }
})
