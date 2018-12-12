/**
 * Parses the GET URL parameters and returns the key/value result as an object.
 * Code is taken from SO thread:
 * https://stackoverflow.com/questions/19491336/get-url-parameter-jquery-or-how-to-get-query-string-values-in-js
 */
function getURLParameters(key) {
  const parameters = {};
  window.location.search
      .replace(/[?&]+([^=&]+)=([^&]*)/gi, function(str, key, value) {
        parameters[key] = value;
      });
  return key ? parameters[key] : parameters;
}

function isHideCanvas() {
  return !isShowCanvas();
}

function isShowCanvas() {
  const showCanvas = getURLParameters("showCanvas");
  return showCanvas == undefined || showCanvas === 'true';
}

function isControlHidden(controlName) {
  const control = getURLParameters(controlName);
  return control === 'isHidden';
}

function isControlDisplayedAndNotEditable(controlName) {
  const control = getURLParameters(controlName);
  return control === 'isDisplayedAndNotEditable';
}

function isControlDisplayedAndEditable(controlName) {
  const control = getURLParameters(controlName);
  return control == undefined || control === 'isDisplayedAndEditable';
}

function isShowSelectTrialGrid() {
  const selectTrialMode = getURLParameters("selectTrialMode");
  return selectTrialMode === 'grid';
}

function isCollectMode() {
  return getURLParameters("mode") === 'collect';
}

function isFlagMode() {
  return getURLParameters("mode") === 'flag';
}

function isInterpretMode() {
  return getURLParameters("mode") === 'interpret';
}

function isAutoScoreMaterialMode() {
  return getURLParameters("autoScore") === 'material';
}

function isAutoScoreTemperatureMode() {
  return getURLParameters("autoScore") === 'temperature';
}

function getMaxNumAutoScoreAttempts() {
  return getURLParameters("maxNumAutoScoreAttempts")
}

function getStartingMaterial() {
  return getURLParameters("material");
}

function getStartingBevTemp() {
  return getURLParameters("bevTemp");
}

function getStartingAirTemp() {
  return getURLParameters("airTemp");
}

function getAllAvailableTemps() {
  const tempsParam = getURLParameters("temps");
  if (tempsParam == null) {
    return ["Hot","Warm","Cold"];
  } else {
    return tempsParam.split(",");
  }
}
