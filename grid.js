let grids;

function init() {
  if (isCollectMode()) {
    initCollectionGrid();
  } else if (isInterpretMode()) {
    initInterpretGrid();
  }
  window.addEventListener('message', messageReceived);
}

function initCollectionGrid() {
  grids = new CollectionGrids();
  $(".squaredotted").click(function(event, ui) {
    grids.gridSelected($(this));
  });
}

function initInterpretGrid() {
  grids = new InterpretGrids();
  $(".squaredotted").click(function(event, ui) {
    grids.gridSelected($(this));
  });
}

function messageReceived(message) {
  if (message != null) {
    let messageData = message.data;
    if (messageData != null) {
      if (messageData.messageType == 'handleConnectedComponentStudentDataChanged') {
        let componentState = messageData.componentState;
        if (componentState.componentType == 'Embedded' &&
          componentState.studentData.isTrialCompleted) {
          grids.trialCompleted(componentState);
        }
      }
    }
  }
}

class Grids {
  constructor() {
    this.gridsSelected = [];
  }

  showGridSelectionOrder() {
    let gridsWithCompletedTrials = [];
    for (let i = 0; i < this.gridsSelected.length; i++) {
      const gridSelected = this.gridsSelected[i];
      const key = gridSelected.material + gridSelected.bevTemp + gridSelected.airTemp;
      const grid = this.getGridDOM(gridSelected.material, gridSelected.bevTemp, gridSelected.airTemp);
      if (gridSelected.isTrialCompleted && gridsWithCompletedTrials.indexOf(key) == -1) {
        gridsWithCompletedTrials.push(key);
        grid.html(gridsWithCompletedTrials.length);
        grid.addClass("trialCompleted");
      }
    }
  }

  getGridDOM(material, bevTemp, airTemp) {
    return $('div[material="' + material + '"][bevTemp="' + bevTemp + '"][airTemp="' + airTemp + '"]');
  }

  saveSelectionToWISE() {
    const componentState = {
      messageType: 'studentDataChanged',
      isAutoSave: false,
      isSubmit: false,
      timestamp: new Date().getTime(),
      studentData: {
        gridsSelected: this.gridsSelected,
      }
    };
    try {
      parent.postMessage(componentState, "*");
    } catch(err) {
      console.log("not posted");
    }
  }

  trialCompleted(componentState) {
    const trialMaterial = componentState.studentData.materialText;
    const trialBevTemp = componentState.studentData.bevTempText;
    const trialAirTemp = componentState.studentData.airTempText;
    for (let i = this.gridsSelected.length - 1; i >= 0; i--) {
      const gridSelected = this.gridsSelected[i];
      if (gridSelected.material === trialMaterial &&
          gridSelected.bevTemp === trialBevTemp &&
          gridSelected.airTemp === trialAirTemp) {
        gridSelected.isTrialCompleted = true;
        break;
      }
    }
    this.showGridSelectionOrder();
  }
}

class CollectionGrids extends Grids {
  constructor() {
    super();
  }

  gridSelected(selectedGrid) {
    this.onlyHighlightSelectedGrid(selectedGrid);

    let material = selectedGrid.attr("material");
    let beverageTemperature = selectedGrid.attr("bevTemp");
    let airTemperature = selectedGrid.attr("airTemp");
    this.saveSelectionLocally(material, beverageTemperature, airTemperature);
    this.saveSelectionToWISE();
    this.showGridSelectionOrder();
  }

  onlyHighlightSelectedGrid(selectedGrid) {
    $(".squaredotted").removeClass("selectedGrid");
    selectedGrid.addClass("selectedGrid");
  }

  saveSelectionLocally(material, bevTemp, airTemp) {
    this.gridsSelected.push({
      timestamp: new Date().getTime(),
      material: material,
      bevTemp: bevTemp,
      airTemp: airTemp
    });
  }
}

class InterpretGrids extends Grids {
  constructor() {
    super();
  }

  gridSelected(selectedGrid) {
    let material = selectedGrid.attr("material");
    let beverageTemperature = selectedGrid.attr("bevTemp");
    let airTemperature = selectedGrid.attr("airTemp");
    this.updateGridsSelected(material, beverageTemperature, airTemperature);
    this.saveSelectionToWISE();
    this.highlightAllSelectedGrids();
    this.showGridSelectionOrder();
  }

  highlightAllSelectedGrids() {
    $(".squaredotted").removeClass("selectedGrid");
    for (let selectedGrid of this.gridsSelected) {
      this.getGridDOM(selectedGrid.material, selectedGrid.bevTemp, selectedGrid.airTemp)
          .addClass("selectedGrid");
    }
  }

  updateGridsSelected(material, bevTemp, airTemp) {
    const indexOfTrial = this.gridsSelected.findIndex((trial) => {
        return trial["material"] == material &&
               trial["bevTemp"] == bevTemp &&
               trial["airTemp"] == airTemp;
    });
    if (indexOfTrial >= 0) {
      this.gridsSelected.splice(indexOfTrial, 1);
    } else {
      this.gridsSelected.push({
        timestamp: new Date().getTime(),
        material: material,
        bevTemp: bevTemp,
        airTemp: airTemp
      });
    }
  }
}

