/**
 * Shared setup for the component suite.
 *
 * Only files under tests/ui/ run in jsdom (see vite.config.ts). The engine
 * tests stay in Node, so nothing there can quietly start depending on a DOM.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

beforeEach(() => {
  // App reads saved sessions on mount; every test starts from a clean slate.
  localStorage.clear()
  // jsdom implements neither, and the exam-mode transition asks for both.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  }
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => {}
  }
})
