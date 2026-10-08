import { describe, expect, it } from 'vitest'
import { scrollThumbMetrics } from './scroll-thumb-metrics'

describe('scrollThumbMetrics', () => {
  it('hides the indicator when content is shorter than the viewport', () => {
    expect(scrollThumbMetrics(8, 20, 0)).toEqual({
      visible: false,
      trackRows: 20,
      thumbSize: 20,
      thumbOffset: 0,
    })
  })

  it('hides the indicator when content equals the viewport', () => {
    expect(scrollThumbMetrics(20, 20, 0)).toEqual({
      visible: false,
      trackRows: 20,
      thumbSize: 20,
      thumbOffset: 0,
    })
  })

  it('sizes the thumb to half the track when content is 2x the viewport', () => {
    expect(scrollThumbMetrics(40, 20, 0)).toEqual({
      visible: true,
      trackRows: 20,
      thumbSize: 10,
      thumbOffset: 0,
    })
  })

  it('sizes the thumb to 10% of the track when content is 10x the viewport', () => {
    expect(scrollThumbMetrics(200, 20, 0)).toEqual({
      visible: true,
      trackRows: 20,
      thumbSize: 2,
      thumbOffset: 0,
    })
  })

  it('places the thumb at the top when scroll offset is 0', () => {
    expect(scrollThumbMetrics(40, 20, 0).thumbOffset).toBe(0)
  })

  it('places the thumb in the middle when scroll is halfway', () => {
    expect(scrollThumbMetrics(40, 20, 10)).toEqual({
      visible: true,
      trackRows: 20,
      thumbSize: 10,
      thumbOffset: 5,
    })
  })

  it('places the thumb at the bottom when scroll is at max', () => {
    expect(scrollThumbMetrics(40, 20, 20)).toEqual({
      visible: true,
      trackRows: 20,
      thumbSize: 10,
      thumbOffset: 10,
    })
  })

  it('clamps overscroll past the bottom', () => {
    expect(scrollThumbMetrics(40, 20, 999).thumbOffset).toBe(10)
  })

  it('clamps negative scroll to the top', () => {
    expect(scrollThumbMetrics(40, 20, -5).thumbOffset).toBe(0)
  })

  it('keeps a 1-row track fully covered (position cannot move)', () => {
    expect(scrollThumbMetrics(50, 1, 0, 1)).toEqual({
      visible: true,
      trackRows: 1,
      thumbSize: 1,
      thumbOffset: 0,
    })
    expect(scrollThumbMetrics(50, 1, 25, 1)).toEqual({
      visible: true,
      trackRows: 1,
      thumbSize: 1,
      thumbOffset: 0,
    })
    expect(scrollThumbMetrics(50, 1, 49, 1)).toEqual({
      visible: true,
      trackRows: 1,
      thumbSize: 1,
      thumbOffset: 0,
    })
  })

  it('uses an explicit track size independent of the viewport', () => {
    expect(scrollThumbMetrics(100, 20, 0, 10)).toEqual({
      visible: true,
      trackRows: 10,
      thumbSize: 2,
      thumbOffset: 0,
    })
  })
})
