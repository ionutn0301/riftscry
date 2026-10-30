// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseReadingResume, readReturnState, rememberReading, RESUME_KEY, RETURN_STATE_EVENT, safeReadingHref } from '../../src/lib/return-briefing';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('public reading continuation', () => {
  it('retains exact public record, comparison and voyage coordinates', () => {
    const paths = [
      '/champion/ahri?mode=reader#record-26-14',
      '/patch/26.16?champions=ahri%2Cazir&type=buff#azir',
      '/compare/26.16/26.14?pool=1#items',
      '/explore?champion=Azir&older=26.15&newer=26.16&event=azir-e#change',
    ];
    for (const href of paths) {
      expect(safeReadingHref(href)).toBe(href);
      expect(rememberReading(href, 'A public record')).toBe(true);
      expect(readReturnState().resume).toMatchObject({ href, label: 'A public record' });
    }
  });

  it('does not replace a record with a directory, private task or external destination', () => {
    const href = '/champion/ahri#record-26-14';
    rememberReading(href, 'Ahri');
    for (const other of [
      '/champions', '/patches', '/pool#briefing', '/notebook#notes',
      '/players/EUN1/private-puuid?name=Player%23TEST',
      '/matches/EUN1_123?puuid=private-puuid#match-review',
      '/next-game?puuid=private-puuid#focus', '/api/player/review',
      '/champion/ahri?puuid=private-puuid',
      'https://example.com/patch/26.16', '//example.com/patch/26.16',
    ]) {
      expect(rememberReading(other, 'Other task')).toBe(false);
      expect(readReturnState().resume?.href).toBe(href);
    }
  });

  it('ignores legacy private resumes when reading persisted state', () => {
    localStorage.setItem(RESUME_KEY, JSON.stringify({
      href: '/players/EUN1/private-puuid?name=Player%23TEST', label: 'Player', updatedAt: new Date().toISOString(),
    }));
    expect(readReturnState().resume).toBeNull();
    expect(parseReadingResume('{broken')).toBeNull();
  });

  it('reports failed storage without emitting a success event', () => {
    const changed = vi.fn();
    window.addEventListener(RETURN_STATE_EVENT, changed);
    const storage = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(rememberReading('/patch/26.16#items', 'Patch 26.16')).toBe(false);
    expect(changed).not.toHaveBeenCalled();
    storage.mockRestore();
    window.removeEventListener(RETURN_STATE_EVENT, changed);
  });
});
