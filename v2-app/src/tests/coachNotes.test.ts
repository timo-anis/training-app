import { describe, it, expect } from 'vitest';
import { anchorKey, indexNotes } from '../lib/coachNotes';
import type { CoachNote } from '../services/coach';

const note = (over: Partial<CoachNote>): CoachNote => ({
  id: 'id', week: 1, day: 'Monday', exerciseId: null, body: 'x', updatedAt: null, ...over,
});

describe('anchorKey — stable annotation anchor', () => {
  it('day-level (null exerciseId) is distinct from exercise-level', () => {
    expect(anchorKey(3, 'Friday', null)).toBe('3|Friday|__day__');
    expect(anchorKey(3, 'Friday', 'ex-1')).toBe('3|Friday|ex-1');
    expect(anchorKey(3, 'Friday', null)).not.toBe(anchorKey(3, 'Friday', 'ex-1'));
  });

  it('separates by week, day and exercise id', () => {
    expect(anchorKey(1, 'Monday', 'a')).not.toBe(anchorKey(2, 'Monday', 'a'));
    expect(anchorKey(1, 'Monday', 'a')).not.toBe(anchorKey(1, 'Tuesday', 'a'));
  });
});

describe('indexNotes — list to anchor-keyed map', () => {
  it('keys day-level and exercise-level notes independently', () => {
    const m = indexNotes([
      note({ id: 'd', exerciseId: null, body: 'day' }),
      note({ id: 'e', exerciseId: 'ex-9', body: 'ex' }),
    ]);
    expect(m[anchorKey(1, 'Monday', null)].body).toBe('day');
    expect(m[anchorKey(1, 'Monday', 'ex-9')].body).toBe('ex');
  });

  it('last write wins for a duplicate anchor', () => {
    const m = indexNotes([
      note({ id: 'a', exerciseId: 'ex-1', body: 'first' }),
      note({ id: 'b', exerciseId: 'ex-1', body: 'second' }),
    ]);
    expect(m[anchorKey(1, 'Monday', 'ex-1')].body).toBe('second');
  });

  it('empty list yields empty map', () => {
    expect(Object.keys(indexNotes([])).length).toBe(0);
  });
});
