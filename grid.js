const gridsSelected = [

];

function init() {
  $(".squaredotted").click(function(event, ui) {
    updateSelectedGrid($(this));
    let material = $(this).attr("material");
    let beverageTemperature = $(this).attr("bevTemp");
    let airTemperature = $(this).attr("airTemp");
    saveSelectionLocally(material, beverageTemperature, airTemperature);
    saveSelectionToWISE(material, beverageTemperature, airTemperature);
    showGridSelectionOrder();
  });
}

function showGridSelectionOrder() {
  let gridsWithCompletedTrials = 0;
  for (let i = 0; i < gridsSelected.length; i++) {
    const gridSelected = gridsSelected[i];
    if (gridSelected.isTrialCompleted) {
      gridsWithCompletedTrials++;
      const grid = $('div[airTemp="' + gridSelected.airTemp + '"][bevTemp="' + gridSelected.bevTemp + '"][material="' + gridSelected.material + '"]')
      grid.html(gridsWithCompletedTrials);
    }
  }
}

function updateSelectedGrid(selectedGrid) {
  $(".squaredotted").removeClass("selectedGrid");
  selectedGrid.addClass("selectedGrid");
}

function saveSelectionLocally(material, bevTemp, airTemp) {
  gridsSelected.push({
    timestamp: new Date().getTime(),
    material: material,
    bevTemp: bevTemp,
    airTemp: airTemp
  });
}

function saveSelectionToWISE(material, bevTemp, airTemp) {
  const componentState = {
    messageType: 'studentDataChanged',
    isAutoSave: false,
    isSubmit: false,
    timestamp: new Date().getTime(),
    studentData: {
      gridsSelected: gridsSelected,
    }
  };
  try {
    parent.postMessage(componentState, "*");
  } catch(err) {
    console.log("not posted");
  }
}
