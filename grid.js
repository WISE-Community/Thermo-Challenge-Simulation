let grids;
let temperatures = ['Hot', 'Warm', 'Cold'];
let materials = ['Aluminum', 'Wood', 'Styrofoam', 'Clay', 'Glass', 'Plastic'];

function init() {
  if (isCollectMode()) {
    initCollectionGrid();
  } else if (isInterpretMode()) {
    initInterpretGrid();
  }
  window.addEventListener('message', messageReceived);
  sendGetParametersMessage();
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
    this.createGridState();
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

    for (let temp in this.state) {
      if (temperatures.includes(temp)) {
        let row = this.state[temp];
        for (let material in row) {
          if (materials.includes(material)) {
            let cell = row[material];
            if (cell.isCompleted) {
              let grid = this.getGridDOM(cell.material, cell.bevTemp, cell.airTemp);
              grid.html(cell.order);
              grid.addClass("trialCompleted");
            }
          }
        }
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
        state: this.state
      }
    };
    try {
      window.postMessage(componentState, "*");
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
      const material = gridSelected.material;
      const bevTemp = gridSelected.bevTemp;
      const airTemp = gridSelected.airTemp;
      if (gridSelected.material === trialMaterial &&
          gridSelected.bevTemp === trialBevTemp &&
          gridSelected.airTemp === trialAirTemp) {
        gridSelected.isTrialCompleted = true;
        this.updateGridCell(material, bevTemp, airTemp, 'isCompleted', true);
        this.setOrderOnCell(material, bevTemp, airTemp);
        break;
      }
    }
    this.showGridSelectionOrder();
    this.saveSelectionToWISE();
  }

  gridSelected(selectedGridDOM) {
    let material = selectedGridDOM.attr("material");
    let bevTemp = selectedGridDOM.attr("bevTemp");
    let airTemp = selectedGridDOM.attr("airTemp");
    this.saveSelectionLocally(material, bevTemp, airTemp);
    this.highlightAllSelectedGrids();
    this.showGridSelectionOrder();
    this.saveSelectionToWISE();
  }

  saveSelectionLocally(material, bevTemp, airTemp) {
    saveSelectionLocally(material, bevTemp, airTemp, false);
  }

  saveSelectionLocally(material, bevTemp, airTemp, isTrialCompleted) {
    this.gridsSelected.push({
      timestamp: new Date().getTime(),
      material: material,
      bevTemp: bevTemp,
      airTemp: airTemp,
      isTrialCompleted: isTrialCompleted
    });

    this.unselectAllCells();
    this.updateGridCell(material, bevTemp, airTemp, 'isSelected', true);

    let cell = this.getGridCell(material, bevTemp, airTemp);
    this.state.selectedTrialIds = [this.createTrialIdFromCell(cell)];
  }

  createTrialIdFromCell(cell) {
    return cell.material + '-' + cell.bevTemp + 'Bev-' + cell.airTemp + 'Air';
  }

  createTrialId(material, bevTemp, airTemp) {
    return material + '-' + bevTemp + 'Bev-' + airTemp + 'Air';
  }

  createGridState() {
    this.state = {};

    for (let temperature of temperatures) {
      this.state[temperature] = {};
    }

    for (let key in this.state) {
      let row = this.state[key];
      for (let material of materials) {
        row[material] = {
          material: material,
          bevTemp: key,
          airTemp: 'Warm',
          isSelected: false,
          isCompleted: false,
          order: null
        };
      }
    }

    this.state.selectedTrialIds = [];
  }

  loadGridState(gridState) {
    this.state = gridState;
  }

  updateGridCell(material, bevTemp, airTemp, attribute, value) {
    let cell = this.getGridCell(material, bevTemp, airTemp);
    cell[attribute] = value;
  }

  getGridCell(material, bevTemp, airTemp) {
    return this.state[bevTemp][material];
  }

  getGridCellAttribute(material, bevTemp, airTemp, attribute) {
    let cell = getGridCell(material, bevTemp, airTemp);
    return cell[attribute];
  }

  getCellWithHighestOrder(gridState) {
    let cellWithHighestOrder = null;
    for (let bevTemp in gridState) {
      let bevTempRow = gridState[bevTemp];
      for (let material in bevTempRow) {
        let cell = bevTempRow[material];
        if (cell.order != null) {
          if (cellWithHighestOrder == null ||
              cell.order > cellWithHighestOrder.order) {
            cellWithHighestOrder = cell;
          }
        }
      }
    }
    return cellWithHighestOrder;
  }

  setOrderOnCell(material, bevTemp, airTemp) {
    let cell = this.getGridCell(material, bevTemp, airTemp);

    // only set the order if it does not already have an order value
    if (cell.order == null) {
      let cellWithHighestOrder = this.getCellWithHighestOrder(this.state);

      if (cellWithHighestOrder == null) {
        this.updateGridCell(material, bevTemp, airTemp, 'order', 1);
      } else {
        let nextOrder = cellWithHighestOrder.order + 1;
        this.updateGridCell(material, bevTemp, airTemp, 'order', nextOrder);
      }
    }
  }

  unselectAllCells() {
    for (let temp in this.state) {
      if (temperatures.includes(temp)) {
        let row = this.state[temp];
        for (let material in row) {
          if (materials.includes(material)) {
            let cell = row[material];
            cell.isSelected = false;
          }
        }
      }
    }
  }
}

class CollectionGrids extends Grids {
  constructor() {
    super();
  }

  highlightAllSelectedGrids() {
    $(".squaredotted").removeClass("selectedGrid");
    for (let temp in this.state) {
      if (temperatures.includes(temp)) {
        let row = this.state[temp];
        for (let material in row) {
          if (materials.includes(material)) {
            let cell = row[material];
            if (cell.isSelected) {
              this.getGridDOM(cell.material, cell.bevTemp, cell.airTemp)
                  .addClass("selectedGrid");
            }
          }
        }
      }
    }
  }
}

class InterpretGrids extends Grids {
  constructor() {
    super();
  }

  highlightAllSelectedGrids() {
    $(".squaredotted").removeClass("selectedGrid");
    for (let selectedGrid of this.gridsSelected) {
      this.getGridDOM(selectedGrid.material, selectedGrid.bevTemp, selectedGrid.airTemp)
          .addClass("selectedGrid");
    }
  }

  saveSelectionLocally(material, bevTemp, airTemp) {
    const indexOfTrial = this.gridsSelected.findIndex((trial) => {
        return trial["material"] == material &&
               trial["bevTemp"] == bevTemp &&
               trial["airTemp"] == airTemp;
    });
    if (indexOfTrial >= 0) {
      this.gridsSelected.splice(indexOfTrial, 1);
    } else {
      super.saveSelectionLocally(material, bevTemp, airTemp);
    }
  }
}

function sendGetParametersMessage() {
  let message = {};
  message.messageType = 'getParameters';
  sendMessage(message);
}

function receivedGetParametersMessage(parameters) {
  grids.nodeId = parameters.nodeId;
  grids.componentId = parameters.componentId;
}

function sendApplicationInitializedMessage() {
  let message = {};
  message.messageType = 'applicationInitialized';
  sendMessage(message);
}

function loadComponentState(componentState) {
  let state = componentState.studentData.state;
  grids.loadGridState(state);
  grids.highlightAllSelectedGrids();
  grids.showGridSelectionOrder();
  grids.saveSelectionToWISE();
}

/**
 * Send a message to the parent
 * @param the message to send to the parent
 */
function sendMessage(message) {
  //parent.postMessage(message, "*");
  window.postMessage(message, "*");
}

/**
 * Receive a message from the parent
 * @param message the message from the parent
 */
function receiveMessage(message) {
  //console.log('receiveMessage=' + message.data.messageType);
  if (message != null) {
    let messageData = message.data;

    if (messageData != null) {
      if (messageData.messageType == 'studentWork') {
        /*
         * we have received a message that contains student work from
         * other components
         */
        this.studentWorkFromThisNode = messageData.studentWorkFromThisNode;
        this.studentWorkFromOtherComponents = messageData.studentWorkFromOtherComponents;

      } else if (messageData.messageType == 'nodeSubmitClicked') {
        /*
         * the student has clicked the submit button and the student
         * work has been included in the message data
         */
        this.studentWorkFromThisNode = messageData.studentWorkFromThisNode;
        this.studentWorkFromOtherComponents = messageData.studentWorkFromOtherComponents;
      } else if (messageData.messageType == 'componentStateSaved') {
        let componentState = messageData.componentState;
      } else if (messageData.messageType == 'parameters') {
        // WISE has sent the parameters to us
        //console.log(messageData.parameters);
        receivedGetParametersMessage(messageData.parameters);
        sendApplicationInitializedMessage();
      } else if (messageData.messageType == 'siblingComponentStudentDataChanged') {
        let componentState = messageData.componentState;
      } else if (messageData.messageType == 'handleConnectedComponentStudentDataChanged') {
        let componentState = messageData.componentState;
        if (componentState.componentType == 'Graph') {
          showModelStateFromGraphStudentWork(componentState);
        }
      } else if (messageData.messageType == 'componentState') {
        let componentState = messageData.componentState;
        if (componentState != null) {
          loadComponentState(componentState);
        }
      }
    }
  }
}

// listen for messages from the parent
window.addEventListener('message', receiveMessage);
