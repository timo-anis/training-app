(function attachDataIntegrityValidator(global) {
  "use strict";

  var DAY_TOKENS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  var JS_DAY_INDEX_BY_TOKEN = {
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
    sun: 0
  };

  function createReport() {
    return { ok: true, errors: [], warnings: [] };
  }

  function addError(report, message) {
    report.ok = false;
    report.errors.push(message);
  }

  function addWarning(report, message) {
    report.warnings.push(message);
  }

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function toNonEmptyString(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function safeTitleFromExerciseId(exerciseId) {
    return toNonEmptyString(exerciseId).replace(/_/g, " ").trim();
  }

  function safeDayDate(week, dayToken) {
    try {
      if (typeof dayDate === "function") {
        var date = dayDate(week, dayToken);
        if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
      }
    } catch (err) {}
    return null;
  }

  function getOrCreateDay(dayMap, week, dayToken) {
    var dayKey = "w" + week + "_" + dayToken;
    if (!dayMap[dayKey]) {
      dayMap[dayKey] = {
        key: dayKey,
        week: week,
        weekday: dayToken,
        date: safeDayDate(week, dayToken),
        exercisesById: Object.create(null)
      };
    }
    return dayMap[dayKey];
  }

  function getOrCreateExercise(dayEntry, exerciseId) {
    if (!dayEntry.exercisesById[exerciseId]) {
      dayEntry.exercisesById[exerciseId] = {
        id: exerciseId,
        name: "",
        code: "",
        supersetCode: "",
        doneRaw: undefined,
        declaredSetCount: null,
        setsByIndex: Object.create(null)
      };
    }
    return dayEntry.exercisesById[exerciseId];
  }

  function inferExerciseType(exerciseEntry) {
    var code = toNonEmptyString(exerciseEntry.code).toUpperCase();
    var supersetCode = toNonEmptyString(exerciseEntry.supersetCode).toUpperCase();
    var looksLikeSuperset = /^[A-Z]\d+$/.test(code) || /^[A-Z]\d+$/.test(supersetCode);
    return looksLikeSuperset ? "superset" : "single";
  }

  function collectWorkoutDays(data) {
    var dayMap = Object.create(null);
    var metaPattern = /^(sc|note|interval|rest|exname|exlabel|exss|excode|hidden|blockdone)_w(\d+)_([a-z]{3})_(.+)$/;
    var setPattern = /^w(\d+)_([a-z]{3})_(.+)_s(\d+)$/;

    Object.keys(data).forEach(function(key) {
      var metaMatch = key.match(metaPattern);
      if (metaMatch) {
        var metaType = metaMatch[1];
        var metaWeek = Number(metaMatch[2]);
        var metaDay = metaMatch[3];
        var metaExerciseId = metaMatch[4];
        var metaDayEntry = getOrCreateDay(dayMap, metaWeek, metaDay);
        var metaExercise = getOrCreateExercise(metaDayEntry, metaExerciseId);
        var metaValue = data[key];

        if (metaType === "sc") metaExercise.declaredSetCount = Number(metaValue);
        if (metaType === "exname") metaExercise.name = toNonEmptyString(metaValue);
        if (metaType === "excode") metaExercise.code = toNonEmptyString(metaValue);
        if (metaType === "exss") metaExercise.supersetCode = toNonEmptyString(metaValue);
        if (metaType === "blockdone") metaExercise.doneRaw = metaValue;
        return;
      }

      var setMatch = key.match(setPattern);
      if (!setMatch) return;

      var setWeek = Number(setMatch[1]);
      var setDay = setMatch[2];
      var setExerciseId = setMatch[3];
      var setIndex = Number(setMatch[4]);
      var dayEntry = getOrCreateDay(dayMap, setWeek, setDay);
      var exerciseEntry = getOrCreateExercise(dayEntry, setExerciseId);
      exerciseEntry.setsByIndex[setIndex] = data[key];
    });

    return dayMap;
  }

  function validateWorkoutDay(report, dayEntry) {
    if (!isPlainObject(dayEntry)) {
      addError(report, "Workout day entry is not a valid object.");
      return;
    }

    if (!Number.isFinite(dayEntry.week) || dayEntry.week < 1) {
      addError(report, dayEntry.key + " has an invalid week number.");
    }

    if (DAY_TOKENS.indexOf(dayEntry.weekday) === -1) {
      addError(report, dayEntry.key + " has an invalid weekday token.");
    }

    if (dayEntry.date) {
      if (!(dayEntry.date instanceof Date) || Number.isNaN(dayEntry.date.getTime())) {
        addError(report, dayEntry.key + " has an invalid date value.");
      } else if (dayEntry.weekday && JS_DAY_INDEX_BY_TOKEN[dayEntry.weekday] !== dayEntry.date.getDay()) {
        addError(report, dayEntry.key + " weekday does not align with its date.");
      }
    } else {
      addWarning(report, dayEntry.key + " date could not be resolved for validation.");
    }

    var exercises = Object.keys(dayEntry.exercisesById || {}).map(function(exerciseId) {
      return dayEntry.exercisesById[exerciseId];
    });

    if (!Array.isArray(exercises)) {
      addError(report, dayEntry.key + " exercises collection is not an array.");
      return;
    }

    if (!exercises.length) {
      addWarning(report, dayEntry.key + " has no exercises.");
      return;
    }

    validateSupersetStructure(report, dayEntry, exercises);

    exercises.forEach(function(exerciseEntry) {
      validateExercise(report, dayEntry, exerciseEntry);
    });
  }

  function validateSupersetStructure(report, dayEntry, exercises) {
    var numberedByLetter = Object.create(null);

    exercises.forEach(function(exerciseEntry) {
      var code = toNonEmptyString(exerciseEntry.code || exerciseEntry.supersetCode).toUpperCase();
      var match = code.match(/^([A-Z])(\d+)$/);
      if (!match) return;

      var letter = match[1];
      if (!numberedByLetter[letter]) numberedByLetter[letter] = [];
      numberedByLetter[letter].push({
        id: exerciseEntry.id,
        code: code,
        slot: Number(match[2])
      });
    });

    Object.keys(numberedByLetter).forEach(function(letter) {
      var items = numberedByLetter[letter];
      if (items.length !== 2) {
        addError(report, dayEntry.key + " superset block " + letter + " has " + items.length + " exercises; expected 2.");
        return;
      }

      var slots = items.map(function(item) { return item.slot; }).sort(function(a, b) { return a - b; });
      if (slots[0] !== 1 || slots[1] !== 2) {
        addError(report, dayEntry.key + " superset block " + letter + " does not preserve A1/A2-style numbering.");
      }
    });
  }

  function validateExercise(report, dayEntry, exerciseEntry) {
    if (!isPlainObject(exerciseEntry)) {
      addError(report, dayEntry.key + " contains an invalid exercise entry.");
      return;
    }

    var derivedName = toNonEmptyString(exerciseEntry.name) || safeTitleFromExerciseId(exerciseEntry.id);
    if (!derivedName) {
      addError(report, dayEntry.key + " exercise " + exerciseEntry.id + " is missing a name.");
    } else if (!toNonEmptyString(exerciseEntry.name)) {
      addWarning(report, dayEntry.key + " exercise " + exerciseEntry.id + " uses fallback naming instead of stored exname.");
    }

    var exerciseType = inferExerciseType(exerciseEntry);
    if (exerciseType !== "single" && exerciseType !== "superset") {
      addError(report, dayEntry.key + " exercise " + exerciseEntry.id + " has an invalid exercise type.");
    }

    if (exerciseEntry.doneRaw !== undefined) {
      if (typeof exerciseEntry.doneRaw === "boolean") {
        // valid
      } else if (exerciseEntry.doneRaw === "1" || exerciseEntry.doneRaw === "") {
        report.__legacyExerciseDoneCount = (report.__legacyExerciseDoneCount || 0) + 1;
      } else {
        addError(report, dayEntry.key + " exercise " + exerciseEntry.id + " has an invalid done value.");
      }
    }

    var declaredSetCount = Number(exerciseEntry.declaredSetCount);
    var setIndexes = Object.keys(exerciseEntry.setsByIndex || {})
      .map(function(index) { return Number(index); })
      .filter(function(index) { return Number.isFinite(index) && index >= 0; })
      .sort(function(a, b) { return a - b; });

    var expectedLength = 0;
    if (Number.isFinite(declaredSetCount) && declaredSetCount > 0) {
      expectedLength = Math.floor(declaredSetCount);
    } else if (setIndexes.length) {
      expectedLength = setIndexes[setIndexes.length - 1] + 1;
    }

    var sets = [];
    for (var i = 0; i < expectedLength; i++) {
      sets.push(exerciseEntry.setsByIndex[i]);
    }

    if (!Array.isArray(sets)) {
      addError(report, dayEntry.key + " exercise " + exerciseEntry.id + " sets collection is not an array.");
      return;
    }

    if (!sets.length) {
      addError(report, dayEntry.key + " exercise " + exerciseEntry.id + " has no sets.");
      return;
    }

    sets.forEach(function(setEntry, setIndex) {
      validateSet(report, dayEntry, exerciseEntry, setEntry, setIndex);
    });
  }

  function validateSet(report, dayEntry, exerciseEntry, setEntry, setIndex) {
    var label = dayEntry.key + " exercise " + exerciseEntry.id + " set " + (setIndex + 1);

    if (!isPlainObject(setEntry)) {
      addError(report, label + " is missing or is not a valid object.");
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(setEntry, "reps")) {
      addError(report, label + " is missing reps.");
    }

    if (Object.prototype.hasOwnProperty.call(setEntry, "done")) {
      if (typeof setEntry.done === "boolean") {
        // valid
      } else if (setEntry.done === "1" || setEntry.done === "") {
        report.__legacySetDoneCount = (report.__legacySetDoneCount || 0) + 1;
      } else {
        addError(report, label + " has an invalid done value.");
      }
    }
  }

  function validateTrainingData(data) {
    var report = createReport();

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      addError(report, "Training data root must exist and be an object.");
      return report;
    }

    var dayMap = collectWorkoutDays(data);
    var dayKeys = Object.keys(dayMap);

    if (!dayKeys.length) {
      addWarning(report, "No workout day entries were found in the current training data.");
      return report;
    }

    dayKeys
      .sort(function(a, b) { return a.localeCompare(b); })
      .forEach(function(dayKey) {
        validateWorkoutDay(report, dayMap[dayKey]);
      });

    if (report.__legacyExerciseDoneCount) {
      addWarning(
        report,
        "Detected " + report.__legacyExerciseDoneCount + " exercise-level done values using legacy string encoding (\"1\"/\"\") instead of boolean."
      );
    }

    if (report.__legacySetDoneCount) {
      addWarning(
        report,
        "Detected " + report.__legacySetDoneCount + " set-level done values using legacy string encoding (\"1\"/\"\") instead of boolean."
      );
    }

    delete report.__legacyExerciseDoneCount;
    delete report.__legacySetDoneCount;

    return report;
  }

  global.TimoTrainingV2DataIntegrityValidator = {
    validateTrainingData: validateTrainingData
  };

  global.validateTrainingData = function(data) {
    return validateTrainingData(data);
  };

  global.runTrainingDataIntegrityCheck = function() {
    var source = typeof state !== "undefined"
      ? state
      : (global.state || global.appState || null);
    var report = global.validateTrainingData(source);
    global.console.log("[TrainingDataIntegrity]", report);
    return report;
  };
})(window);
