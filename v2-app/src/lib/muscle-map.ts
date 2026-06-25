/**
 * Maps normalized exercise names → muscle groups.
 * Used by recovery.ts to compute per-muscle recovery status.
 */

export type MuscleGroup = 'back' | 'legs' | 'chest' | 'shoulders' | 'core' | 'biceps';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  back:      'Selg',
  legs:      'Jalad',
  chest:     'Rind',
  shoulders: 'Õlad',
  core:      'Core',
  biceps:    'Biitseps',
};

/** Displayed order in the rings grid */
export const MUSCLE_ORDER: MuscleGroup[] = ['back', 'legs', 'chest', 'shoulders', 'core', 'biceps'];

const MAP: Record<string, MuscleGroup[]> = {
  // ── Pull / Back ──
  'deadlift':                          ['back', 'legs'],
  'trap bar deadlift':                 ['back', 'legs'],
  'stiff leg deadlift':                ['legs', 'back'],
  'pull-up':                           ['back', 'biceps'],
  'wide grip strict pull-up':          ['back', 'biceps'],
  'neutral grip pull-up':              ['back', 'biceps'],
  'chin-up':                           ['back', 'biceps'],
  'chin hold':                         ['back', 'biceps'],
  'single-arm db row':                 ['back'],
  'barbell row':                       ['back'],
  'barbell seal row':                  ['back'],
  'db seal row':                       ['back'],
  'chest supported row':               ['back'],
  'barbell shrug':                     ['back'],
  'band pull-aparts':                  ['shoulders', 'back'],
  'bent over lateral db raise':        ['shoulders'],
  'bent-over rear delt raise':         ['shoulders'],

  // ── Legs ──
  'back squat':                        ['legs'],
  'pause back squat':                  ['legs'],
  'front squat':                       ['legs'],
  'rear foot elevated split squat':    ['legs'],
  'back rack rear elevated split squat': ['legs'],
  'pistol squat':                      ['legs'],
  'db reverse lunge':                  ['legs'],
  'barbell reverse lunge':             ['legs'],
  'walking lunge':                     ['legs'],
  'leg press':                         ['legs'],
  'one leg romanian deadlift':         ['legs'],
  'bike':                              ['legs'],

  // ── Chest ──
  'bench press':                       ['chest', 'shoulders'],
  'incline bench press':               ['chest', 'shoulders'],
  'incline db bench press':            ['chest', 'shoulders'],
  'low incline db bench press':        ['chest', 'shoulders'],
  'push-up':                           ['chest'],
  'strict push-up':                    ['chest', 'core'],
  'dip':                               ['chest', 'shoulders'],

  // ── Shoulders ──
  'pike push-up':                      ['shoulders'],
  'strict press':                      ['shoulders'],
  'arnold press':                      ['shoulders'],
  'db strict press':                   ['shoulders'],
  'seated db strict press':            ['shoulders'],
  'seated sliding strict press':       ['shoulders'],
  'seated db shoulder press':          ['shoulders'],
  'db lateral raise':                  ['shoulders'],

  // ── Core ──
  'ab wheel rollout':                  ['core'],
  'dragon fly':                        ['core'],
  'weighted sit-up':                   ['core'],
  'pike pulse':                        ['core'],

  // ── Biceps ──
  'ez bar curl':                       ['biceps'],
  'db hammer curl':                    ['biceps'],
  'seated db hammer curl':             ['biceps'],
  'kb towel curl':                     ['biceps'],
};

export function getMusclesForExercise(name: string): MuscleGroup[] {
  return MAP[name.toLowerCase()] ?? [];
}
