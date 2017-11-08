/**
 * Parses the GET URL parameters and returns the key/value result as an object.
 * Code from SO thread:
 * https://stackoverflow.com/questions/19491336/get-url-parameter-jquery-or-how-to-get-query-string-values-in-js
 */
function getURLParameters(key) {
  let parameters = {};
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
  let showCanvas = getURLParameters("showCanvas");
  return showCanvas == undefined || showCanvas == 'true';
}
