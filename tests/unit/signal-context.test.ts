// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  comparisonWithSignal,
  parseSignalContext,
  readSignalContext,
  rememberSignal,
  SIGNAL_CONTEXT_EVENT,
  SIGNAL_CONTEXT_KEY,
  type SignalContext,
} from '../../src/lib/signal-context';
import { FINDINGS_KEY } from '../../src/lib/kept-findings';
import { RESUME_KEY, REVIEWED_PATCH_KEY } from '../../src/lib/return-briefing';

const subject: SignalContext = {
  championId: 'Azir',
  name: 'Azir',
  href: '/explore?champion=Azir&older=26.14&newer=26.16&event=azir-e#change',
  patch: '26.16',
  event: 'azir-e',
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('public signal continuity', () => {
  it('retains the exact public record and interval while normalizing the display name', () => {
    expect(parseSignalContext({ ...subject, name: '  Azir  ' })).toEqual(subject);
    expect(parseSignalContext({ ...subject, href: '/champion/azir#record-26-16' })?.href)
      .toBe('/champion/azir#record-26-16');
    expect(parseSignalContext({ ...subject, href: '/patch/26.16#azir' })?.href)
      .toBe('/patch/26.16#azir');
  });

  it('rejects external, private, and non-reading destinations without losing the prior context', () => {
    expect(rememberSignal(subject)).toBe(true);
    for (const href of [
      'https://example.com/explore', '//example.com/explore', 'javascript:alert(1)',
      '/\\example.com/explore', '/players/EUW1/private-id', '/matches/EUW1_123',
      '/next-game?puuid=private-id', '/notebook', '/pool', '/api/player/lookup',
      '/explore?puuid=private-id', '/champion/azir?platform=euw1',
      '/patch/26.16?PlayerId=private-id', '/compare/26.16/26.14?review=private',
    ]) {
      expect(parseSignalContext({ ...subject, href }), href).toBeNull();
      expect(rememberSignal({ ...subject, href }), href).toBe(false);
      expect(readSignalContext()).toEqual(subject);
    }
  });

  it('rejects corrupt objects and unsafe identities', () => {
    for (const value of [null, false, [], 'Azir', {},
      { ...subject, championId: '../Azir' }, { ...subject, championId: '__proto__' },
      { ...subject, championId: 'a'.repeat(41) }, { ...subject, name: '   ' },
      { ...subject, name: 'Azir\nOther' }, { ...subject, name: 'a'.repeat(81) },
    ]) expect(parseSignalContext(value)).toBeNull();
  });

  it('drops invalid optional metadata without inventing a patch or event', () => {
    expect(parseSignalContext({ ...subject, patch: 'current', event: 'x'.repeat(181) }))
      .toEqual({ championId: subject.championId, name: subject.name, href: subject.href });
  });

  it('remembering a subject never saves a finding, changes reviewed progress, or writes reading history', () => {
    localStorage.setItem(FINDINGS_KEY, '[]');
    localStorage.setItem(REVIEWED_PATCH_KEY, '26.14');
    localStorage.setItem(RESUME_KEY, 'existing-reading-history');
    const changed = vi.fn();
    window.addEventListener(SIGNAL_CONTEXT_EVENT, changed);
    try {
      expect(rememberSignal(subject)).toBe(true);
      expect(readSignalContext()).toEqual(subject);
      expect(changed).toHaveBeenCalledOnce();
      expect((changed.mock.calls[0]![0] as CustomEvent).detail).toEqual(subject);
      expect(localStorage.getItem(FINDINGS_KEY)).toBe('[]');
      expect(localStorage.getItem(REVIEWED_PATCH_KEY)).toBe('26.14');
      expect(localStorage.getItem(RESUME_KEY)).toBe('existing-reading-history');
    } finally {
      window.removeEventListener(SIGNAL_CONTEXT_EVENT, changed);
    }
  });

  it('treats missing, malformed, or stale private storage as no public context', () => {
    expect(readSignalContext()).toBeNull();
    localStorage.setItem(SIGNAL_CONTEXT_KEY, '{broken');
    expect(readSignalContext()).toBeNull();
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify({ ...subject, href: '/players/euw1/private-id' }));
    expect(readSignalContext()).toBeNull();
  });

  it('reports persistence failure and preserves the previous stored subject', () => {
    rememberSignal(subject);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(rememberSignal({ ...subject, championId: 'Ahri', name: 'Ahri', href: '/champion/ahri' })).toBe(false);
    expect(readSignalContext()).toEqual(subject);
  });
});

describe('comparison scope continuity', () => {
  it('adds the selected champion while preserving the explicit interval, filters, and fragment', () => {
    const result = new URL(comparisonWithSignal('/compare/26.16/26.14?role=mid&pool=1#items', subject), 'https://riftscry.invalid');
    expect(result.pathname).toBe('/compare/26.16/26.14');
    expect(result.searchParams.get('champions')).toBe('Azir');
    expect(result.searchParams.get('role')).toBe('mid');
    expect(result.searchParams.get('pool')).toBe('1');
    expect(result.hash).toBe('#items');
  });

  it('never replaces an explicitly selected comparison scope, including an intentionally empty scope', () => {
    for (const href of [
      '/compare/26.16/26.14?champions=Ahri%2CLux#champions',
      '/compare/26.16/26.14?champions=',
    ]) expect(comparisonWithSignal(href, subject)).toBe(href);
  });

  it('leaves unrelated, external, private, and unscoped-without-context links alone', () => {
    for (const href of [
      '/champion/azir', '/patch/26.16', '/next-game',
      'https://example.com/compare/26.16/26.14', '//example.com/compare/26.16/26.14',
      '/compare/26.16/26.14?puuid=private-id',
    ]) expect(comparisonWithSignal(href, subject)).toBe(href);
    expect(comparisonWithSignal('/compare/26.16/26.14', null)).toBe('/compare/26.16/26.14');
  });
});
