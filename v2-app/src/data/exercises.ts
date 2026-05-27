export interface ExerciseEntry {
  name: string;
  aliases: string[];
}

export const EXERCISE_LIBRARY: ExerciseEntry[] = [
  // ── Conditioning / Recovery ─────────────────────────────────
  { name: 'Active Recovery',       aliases: ['active recovery', 'recovery day'] },
  { name: 'Conditioning',          aliases: ['conditioning', 'cardio'] },
  { name: 'Stretching',            aliases: ['stretching', 'stretch', 'mobility'] },
  { name: 'Walk',                  aliases: ['walk', 'walking'] },
  { name: 'Run',                   aliases: ['run', 'running', 'jog', 'jogging'] },
  { name: 'Bike',                  aliases: ['bike', 'cycling', 'cycle'] },
  { name: 'Row',                   aliases: ['row', 'rowing', 'erg'] },
  { name: 'Ski Erg',               aliases: ['ski erg', 'skierg', 'ski'] },
  { name: 'Sprint',                aliases: ['sprint', 'sprints'] },
  { name: 'Treadmill Walk',        aliases: ['treadmill walk', 'incline walk', 'treadmill'] },
  { name: 'Metcon',                aliases: ['metcon'] },
  { name: 'Jump Rope',             aliases: ['jump rope', 'skipping', 'skip rope'] },
  { name: 'Box Jump',              aliases: ['box jump', 'box jumps'] },
  { name: 'Burpee',                aliases: ['burpee', 'burpees'] },
  { name: 'Battle Ropes',          aliases: ['battle ropes', 'battle rope'] },
  { name: 'Sled Push',             aliases: ['sled push'] },
  { name: 'Sled Pull',             aliases: ['sled pull'] },
  { name: 'Farmer Carry',          aliases: ['farmer carry', 'farmers carry', 'farmers walk'] },
  { name: 'Assault Bike',          aliases: ['assault bike', 'air bike', 'echo bike'] },

  // ── Chest ───────────────────────────────────────────────────
  { name: 'Bench Press',                aliases: ['bench', 'bp', 'bench press', 'barbell bench'] },
  { name: 'Incline Bench Press',        aliases: ['incline bench', 'incline bench press', 'incline barbell'] },
  { name: 'Decline Bench Press',        aliases: ['decline bench', 'decline bench press'] },
  { name: 'Flat DB Bench Press',        aliases: ['flat db bench', 'dumbbell bench press', 'db bench press', 'db bench'] },
  { name: 'Incline DB Bench Press',     aliases: ['incline db bench', 'incline dumbbell bench press', 'incline db'] },
  { name: 'Low Incline DB Bench Press', aliases: ['low incline db bench', 'low incline dumbbell bench press', 'low incline'] },
  { name: 'Push-Up',                    aliases: ['pushup', 'push-up', 'push up', 'pushups'] },
  { name: 'Weighted Push-Up',           aliases: ['weighted pushup', 'weighted push-up', 'weighted push up'] },
  { name: 'Machine Chest Press',        aliases: ['machine chest press', 'chest press machine', 'machine press'] },
  { name: 'Cable Chest Press',          aliases: ['cable chest press', 'cable press'] },
  { name: 'Chest Fly',                  aliases: ['chest fly', 'dumbbell fly', 'db fly', 'flat fly'] },
  { name: 'Incline Chest Fly',          aliases: ['incline chest fly', 'incline dumbbell fly', 'incline fly'] },
  { name: 'Cable Fly',                  aliases: ['cable fly', 'cable crossover', 'crossover'] },
  { name: 'Pec Deck',                   aliases: ['pec deck', 'pec-deck', 'machine fly'] },
  { name: 'Dips',                       aliases: ['dip', 'dips', 'chest dips'] },

  // ── Shoulders ───────────────────────────────────────────────
  { name: 'Strict Press',               aliases: ['ohp', 'press', 'strict press', 'overhead press', 'military press', 'barbell press'] },
  { name: 'Seated DB Shoulder Press',   aliases: ['seated db shoulder press', 'seated dumbbell shoulder press', 'seated dumbbell press', 'seated press', 'db shoulder press'] },
  { name: 'Arnold Press',               aliases: ['arnold press', 'arnold'] },
  { name: 'Machine Shoulder Press',     aliases: ['machine shoulder press', 'shoulder press machine'] },
  { name: 'DB Lateral Raise',           aliases: ['db lateral raise', 'lateral raise', 'dumbbell lateral raise', 'side raise'] },
  { name: 'Cable Lateral Raise',        aliases: ['cable lateral raise', 'cable side raise'] },
  { name: 'Machine Lateral Raise',      aliases: ['machine lateral raise', 'machine side raise'] },
  { name: 'Bent-Over Rear Delt Raise',  aliases: ['bent-over rear delt raise', 'rear delt raise', 'rear delt fly', 'reverse fly', 'rear delt'] },
  { name: 'Face Pull',                  aliases: ['face pull', 'face pulls'] },
  { name: 'Band Pull-Aparts',           aliases: ['band pull-aparts', 'band pull aparts', 'pull-aparts', 'pull aparts'] },
  { name: 'Upright Row',                aliases: ['upright row', 'upright rows'] },
  { name: 'DB Front Raise',             aliases: ['db front raise', 'front raise', 'dumbbell front raise'] },

  // ── Back ────────────────────────────────────────────────────
  { name: 'Pull-Up',                    aliases: ['pullup', 'pull-up', 'pull up', 'pullups'] },
  { name: 'Wide Grip Strict Pull-Up',   aliases: ['wide grip strict pull-up', 'wide grip pull-up', 'wide grip pull up', 'wide pull-up'] },
  { name: 'Chin-Up',                    aliases: ['chinup', 'chin-up', 'chin up', 'chinups', 'chin ups'] },
  { name: 'Chin-Over-Bar Hold',         aliases: ['chin over bar hold', 'chin-over-bar hold', 'chin hold'] },
  { name: 'False Grip Ring Pull-Up',    aliases: ['false grip ring pull-up', 'ring pull-up', 'ring pull up'] },
  { name: 'Lat Pulldown',               aliases: ['lat pulldown', 'pulldown', 'lat pull down'] },
  { name: 'Wide Grip Pulldown',         aliases: ['wide grip pulldown', 'wide pulldown'] },
  { name: 'Neutral Grip Pulldown',      aliases: ['neutral grip pulldown', 'neutral pulldown', 'close grip pulldown'] },
  { name: 'Barbell Row',                aliases: ['bb row', 'barbell row', 'bent over row', 'bent-over row'] },
  { name: 'Pendlay Row',                aliases: ['pendlay row'] },
  { name: 'Single-Arm DB Row',          aliases: ['single-arm db row', 'single arm db row', 'one-arm db row', 'db row', 'dumbbell row'] },
  { name: 'Seated Cable Row',           aliases: ['seated cable row', 'cable row', 'close grip cable row'] },
  { name: 'Chest Supported Row',        aliases: ['chest supported row', 'incline row'] },
  { name: 'Barbell Seal Row',           aliases: ['seal row', 'barbell seal row'] },
  { name: 'Machine Row',                aliases: ['machine row', 'row machine'] },
  { name: 'T-Bar Row',                  aliases: ['t-bar row', 't bar row', 'tbar row'] },
  { name: 'Straight-Arm Pulldown',      aliases: ['straight-arm pulldown', 'straight arm pulldown', 'cable pullover'] },
  { name: 'Barbell Shrug',              aliases: ['barbell shrug', 'shrug', 'shrugs'] },
  { name: 'Trap Bar Shrug',             aliases: ['trap bar shrug'] },
  { name: 'DB Shrug',                   aliases: ['db shrug', 'dumbbell shrug'] },

  // ── Biceps ──────────────────────────────────────────────────
  { name: 'EZ Bar Curl',                aliases: ['ez bar curl', 'ez-bar curl', 'ez curl'] },
  { name: 'Barbell Curl',               aliases: ['barbell curl', 'bb curl'] },
  { name: 'DB Curl',                    aliases: ['db curl', 'dumbbell curl', 'alternating curl'] },
  { name: 'DB Hammer Curl',             aliases: ['db hammer curl', 'hammer curl', 'dumbbell hammer curl', 'hammer'] },
  { name: 'Seated DB Hammer Curls',     aliases: ['seated db hammer curls', 'seated hammer curls', 'seated hammer'] },
  { name: 'Incline DB Curl',            aliases: ['incline db curl', 'incline dumbbell curl', 'incline curl'] },
  { name: 'Cable Curl',                 aliases: ['cable curl', 'cable bicep curl'] },
  { name: 'Preacher Curl',              aliases: ['preacher curl', 'scott curl'] },
  { name: 'Concentration Curl',         aliases: ['concentration curl'] },
  { name: 'Machine Curl',               aliases: ['machine curl', 'bicep machine'] },
  { name: 'KB Towel Curl',              aliases: ['kb towel curl', 'kettlebell towel curl'] },
  { name: 'Spider Curl',                aliases: ['spider curl'] },

  // ── Triceps ─────────────────────────────────────────────────
  { name: 'Triceps Pushdown',           aliases: ['triceps pushdown', 'pushdown', 'cable pushdown', 'rope pushdown'] },
  { name: 'Overhead Triceps Extension', aliases: ['overhead triceps extension', 'overhead extension', 'french press'] },
  { name: 'Skullcrusher',               aliases: ['skullcrusher', 'skullcrushers', 'lying triceps extension'] },
  { name: 'Close Grip Bench Press',     aliases: ['close grip bench press', 'close-grip bench press', 'cgbp'] },
  { name: 'Triceps Kickback',           aliases: ['triceps kickback', 'kickback'] },
  { name: 'Diamond Push-Up',            aliases: ['diamond push-up', 'diamond pushup'] },

  // ── Legs ────────────────────────────────────────────────────
  { name: 'Back Squat',                 aliases: ['squat', 'back squat', 'sq', 'barbell squat'] },
  { name: 'Pause Back Squat',           aliases: ['pause squat', 'pause back squat', 'pause sq'] },
  { name: 'Front Squat',                aliases: ['front squat'] },
  { name: 'Goblet Squat',               aliases: ['goblet squat', 'kb squat'] },
  { name: 'Hack Squat',                 aliases: ['hack squat', 'machine squat'] },
  { name: 'Leg Press',                  aliases: ['leg press'] },
  { name: 'Deadlift',                   aliases: ['dead', 'deadlift', 'dl', 'barbell deadlift'] },
  { name: 'Romanian Deadlift',          aliases: ['rdl', 'romanian deadlift', 'romanian dl'] },
  { name: 'Stiff-Leg Deadlift',         aliases: ['stiff leg deadlift', 'stiff-leg deadlift', 'sldl'] },
  { name: 'Trap Bar Deadlift',          aliases: ['trap bar deadlift', 'hex bar deadlift'] },
  { name: 'Sumo Deadlift',              aliases: ['sumo deadlift', 'sumo dl'] },
  { name: 'Good Morning',               aliases: ['good morning', 'good mornings'] },
  { name: 'Hip Thrust',                 aliases: ['hip thrust', 'hip thrusts', 'barbell hip thrust'] },
  { name: 'Glute Bridge',               aliases: ['glute bridge', 'hip bridge'] },
  { name: 'DB Reverse Lunge',           aliases: ['db reverse lunge', 'reverse lunge', 'dumbbell reverse lunge', 'reverse lunge db'] },
  { name: 'Walking Lunges',             aliases: ['walking lunges', 'walking lunge', 'lunges'] },
  { name: 'Bulgarian Split Squat',      aliases: ['bulgarian split squat', 'bss', 'bulgarian'] },
  { name: 'Rear-Foot Elevated Split Squat', aliases: ['rear-foot elevated split squat', 'rear foot elevated split squat', 'rear foot', 'rfess'] },
  { name: 'Step-Up',                    aliases: ['step-up', 'step up', 'step ups'] },
  { name: 'Nordic Hamstring Curl',      aliases: ['nordic hamstring curl', 'nordic curl', 'nordic', 'ghd'] },
  { name: 'Leg Extension',              aliases: ['leg extension', 'quad extension'] },
  { name: 'Leg Curl',                   aliases: ['leg curl', 'hamstring curl'] },
  { name: 'Seated Leg Curl',            aliases: ['seated leg curl', 'seated hamstring curl'] },
  { name: 'Lying Leg Curl',             aliases: ['lying leg curl', 'prone leg curl'] },
  { name: 'Back Extension',             aliases: ['back extension', 'hyperextension', 'hyper extension'] },
  { name: 'Standing Calf Raise',        aliases: ['standing calf raise', 'calf raise', 'calf raises'] },
  { name: 'Seated Calf Raise',          aliases: ['seated calf raise'] },
  { name: 'Single-Leg Press',           aliases: ['single-leg press', 'single leg press', 'unilateral leg press'] },
  { name: 'Adductor Machine',           aliases: ['adductor machine', 'inner thigh machine', 'adductor'] },
  { name: 'Abductor Machine',           aliases: ['abductor machine', 'outer thigh machine', 'abductor'] },

  // ── Core ────────────────────────────────────────────────────
  { name: 'Ab Wheel Rollout',           aliases: ['ab wheel rollout', 'ab wheel', 'ab roller'] },
  { name: 'Plank',                      aliases: ['plank'] },
  { name: 'Side Plank',                 aliases: ['side plank'] },
  { name: 'Crunch',                     aliases: ['crunch', 'crunches'] },
  { name: 'Hanging Leg Raise',          aliases: ['hanging leg raise', 'hlr'] },
  { name: 'Leg Raise',                  aliases: ['leg raise', 'lying leg raise'] },
  { name: 'Cable Crunch',               aliases: ['cable crunch', 'kneeling cable crunch'] },
  { name: 'Russian Twist',              aliases: ['russian twist', 'russian twists'] },
  { name: 'Toes to Bar',                aliases: ['toes to bar', 'toes-to-bar', 'ttb'] },
  { name: 'Dragon Flag',                aliases: ['dragon flag'] },
  { name: 'Hollow Body Hold',           aliases: ['hollow body hold', 'hollow hold', 'hollow body'] },
  { name: 'L-Sit',                      aliases: ['l-sit', 'l sit'] },
  { name: 'Pallof Press',               aliases: ['pallof press', 'anti-rotation press'] },
  { name: 'Dead Bug',                   aliases: ['dead bug'] },
  { name: 'Bird Dog',                   aliases: ['bird dog', 'bird-dog'] },

  // ── Compound / Strength Specialty ──────────────────────────
  { name: 'Thruster',                   aliases: ['thruster', 'thrusters'] },
  { name: 'KB Swing',                   aliases: ['kb swing', 'kettlebell swing', 'swing'] },
  { name: 'Clean',                      aliases: ['clean', 'power clean', 'barbell clean'] },
  { name: 'Snatch',                     aliases: ['snatch', 'power snatch'] },
  { name: 'Clean and Jerk',             aliases: ['clean and jerk'] },
  { name: 'Pike Push-Up',               aliases: ['pike push-up', 'pike push up', 'pike pushup'] },
  { name: 'Handstand Push-Up',          aliases: ['handstand push-up', 'hspu', 'handstand pushup'] },
  { name: 'Ring Dip',                   aliases: ['ring dip', 'ring dips'] },
  { name: 'Muscle-Up',                  aliases: ['muscle-up', 'muscle up', 'mup'] },
];

/** Match: starts-with name → starts-with alias → contains name → contains alias */
export function searchExercises(query: string): ExerciseEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const startsName: ExerciseEntry[] = [];
  const startsAlias: ExerciseEntry[] = [];
  const containsName: ExerciseEntry[] = [];
  const containsAlias: ExerciseEntry[] = [];

  for (const e of EXERCISE_LIBRARY) {
    const n = e.name.toLowerCase();
    if (n.startsWith(q)) { startsName.push(e); continue; }
    if (e.aliases.some(a => a.startsWith(q))) { startsAlias.push(e); continue; }
    if (n.includes(q)) { containsName.push(e); continue; }
    if (e.aliases.some(a => a.includes(q))) { containsAlias.push(e); }
  }

  return [...startsName, ...startsAlias, ...containsName, ...containsAlias];
}
