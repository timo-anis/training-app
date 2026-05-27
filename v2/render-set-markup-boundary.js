(function attachSetMarkupBoundary(global) {
  "use strict";

  function buildSetMarkup(input) {
    const exerciseId = String(input?.exerciseId || "");
    const setIndex = Number(input?.setIndex) || 0;
    const displayIndex = String(input?.displayIndex || "");
    const weightValue = String(input?.weightValue || "");
    const repsValue = String(input?.repsValue || "");
    const volumeValue = String(input?.volumeValue || "");
    const doneState = String(input?.doneState || "");
    return `<div class="setrow" data-setrow="${exerciseId}_${setIndex}">
            <div class="setn">${displayIndex}</div>
            <div class="setcol"><div class="k">kg</div><input class="setinput" type="text" step="0.01" min="0" inputmode="decimal" data-role="kg" data-ex="${exerciseId}" data-idx="${setIndex}" value="${weightValue}" /></div>
            <div class="setcol"><div class="k">reps</div><input class="setinput" type="text" step="1" min="0" inputmode="decimal" data-role="reps" data-ex="${exerciseId}" data-idx="${setIndex}" value="${repsValue}" /></div>
            <div class="setcol"><div class="k">volume</div><input class="setinput" data-role="volume" value="${volumeValue}" disabled /></div>
            <button class="setdeletebtn" type="button" data-role="delete-set" data-ex="${exerciseId}" data-idx="${setIndex}" aria-label="Delete set">✕</button>
	            <button class="donebtn ${doneState==='1'?'on':''}" data-role="toggle-set" data-ex="${exerciseId}" data-idx="${setIndex}">${doneState==='1'?'✓':'·'}</button>
	          </div>`;
  }

  global.TimoTrainingV2RenderSet = {
    buildSetMarkup
  };
})(window);
