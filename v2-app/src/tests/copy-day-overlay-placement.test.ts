/**
 * Regression guard for the "Copy from another day" iOS bug.
 *
 * Root cause: CopyDaySheet is a `position: fixed` bottom sheet. When it was
 * rendered INSIDE MainView it lived inside `.scroll-content`, which uses
 * `-webkit-overflow-scrolling: touch`. On iOS/iPadOS Safari a fixed element
 * trapped in such a momentum-scroll container renders in a detached layer and
 * stops receiving touch events — the option list won't scroll and rows won't
 * tap, so the confirm button never activates.
 *
 * Fix + invariant: CopyDaySheet must be rendered at the App top level (a sibling
 * of `.scroll-content`), exactly like every other overlay (Records, Recovery,
 * Stats, Account, Search, Hints, WorkoutMode, BiometricLock). It must NOT be
 * rendered inside MainView. These source-level assertions lock that in.
 */
import { describe, it, expect } from 'vitest';
import appSrc from '../App.svelte?raw';
import mainSrc from '../components/MainView.svelte?raw';

describe('CopyDaySheet overlay placement (iOS touch regression guard)', () => {
  it('App.svelte renders CopyDaySheet at the top level', () => {
    expect(appSrc).toMatch(/import\s+CopyDaySheet\s+from/);
    expect(appSrc).toContain('<CopyDaySheet');
    expect(appSrc).toMatch(/\$copyDayOpen/);
  });

  it('MainView.svelte does NOT render CopyDaySheet (would trap it in .scroll-content)', () => {
    expect(mainSrc).not.toContain('CopyDaySheet');
  });

  it('the copy trigger drives the shared copyDayOpen store, not local state', () => {
    expect(mainSrc).toContain('copyDayOpen.set(true)');
    expect(mainSrc).not.toMatch(/\bcopySheetOpen\b/);
  });
});
