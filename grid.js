let grids;
let temperatures = ['Hot', 'Warm', 'Cold'];
let materials = ['Aluminum', 'Wood', 'Styrofoam', 'Clay', 'Glass', 'Plastic'];

function init() {
  if (isCollectMode()) {
    grids = new CollectionGrids();
  } else if (isInterpretMode()) {
    grids = new InterpretGrids();
  }
  initCellClickedHandlers();
  sendGetParametersMessage();
}

function initCellClickedHandlers() {
  $(".squaredotted").click(function(event, ui) {
    grids.cellClicked($(this));
  });
}

class Grids {
  constructor() {
    this.completedCells = [];
    this.selectedCells = [];
  }

  loadComponentState(componentState) {
    let studentData = componentState.studentData;
    if (studentData.completedCells != null) {
      this.completedCells = studentData.completedCells;
    }
    if (studentData.selectedCells != null) {
      this.selectedCells = studentData.selectedCells;
    }
    this.refreshCells();
  }

  highlightSelectedCells() {
    $(".squaredotted").removeClass("selectedGrid");
    let selectedCells = this.getSelectedCells();
    for (let selectedCell of selectedCells) {
      this.highlightCell(selectedCell.material, selectedCell.bevTemp, selectedCell.airTemp);
    }
  }

  refreshCells() {
    this.highlightSelectedCells();
    this.showCheckOnCells();
    this.showCellOrders();
  }

  showCheckOnCells() {
    for (let cell of this.completedCells) {
      this.showCheckOnCell(cell.material, cell.bevTemp, cell.airTemp);
    }
  }

  showCellOrders() {
    for (let c = 0; c < this.completedCells.length; c++) {
      let cell = this.completedCells[c];
      this.showOrderNumberOnCell(cell.material, cell.bevTemp, cell.airTemp, c + 1);
    }
  }

  getCellDOM(material, bevTemp, airTemp) {
    return $('div[material="' + material + '"][bevTemp="' + bevTemp + '"][airTemp="' + airTemp + '"]');
  }

  createCell(material, bevTemp, airTemp) {
    return {
      material: material,
      bevTemp: bevTemp,
      airTemp: airTemp
    }
  }

  addCompletedCell(material, bevTemp, airTemp) {
    if (!this.isCellCompleted(material, bevTemp, airTemp)) {
      this.completedCells.push(this.createCell(material, bevTemp, airTemp));
    }
  }

  isCellCompleted(material, bevTemp, airTemp) {
    for (let completedCell of this.completedCells) {
      if (this.cellAttributesMatch(completedCell, material, bevTemp, airTemp)) {
        return true;
      }
    }
    return false;
  }

  getCompletedCells() {
    return this.completedCells;
  }

  addSelectedCell(material, bevTemp, airTemp) {
    this.selectedCells.push(this.createCell(material, bevTemp, airTemp));
  }

  isCellSelected(material, bevTemp, airTemp) {
    for (let selectedCell of this.selectedCells) {
      if (this.cellAttributesMatch(selectedCell, material, bevTemp, airTemp)) {
        return true;
      }
    }
    return false;
  }

  getSelectedCells() {
    return this.selectedCells;
  }

  removeSelectedCell(material, bevTemp, airTemp) {
    for (let c = 0; c < this.selectedCells.length; c++) {
      let selectedCell = this.selectedCells[c];
      if (this.cellAttributesMatch(selectedCell, material, bevTemp, airTemp)) {
        this.selectedCells.splice(c, 1);
        c--;
      }
    }
  }

  setOneSelectedCell(material, bevTemp, airTemp) {
    this.clearSelectedCells();
    this.addSelectedCell(material, bevTemp, airTemp);
  }

  clearSelectedCells() {
    this.selectedCells = [];
  }

  cellAttributesMatch(cell, material, bevTemp, airTemp) {
    return cell.material == material && cell.bevTemp == bevTemp && cell.airTemp == airTemp;
  }

  cellClicked(cellDOMElement) {
    let material = cellDOMElement.attr("material");
    let bevTemp = cellDOMElement.attr("bevTemp");
    let airTemp = cellDOMElement.attr("airTemp");

    this.setOneSelectedCell(material, bevTemp, airTemp);
    this.highlightSelectedCells();
    this.saveToWISE();
  }

  highlightCell(material, bevTemp, airTemp) {
    this.getCellDOM(material, bevTemp, airTemp).addClass("selectedGrid");
  }

  showCheckOnCell(material, bevTemp, airTemp) {
    this.getCellDOM(material, bevTemp, airTemp).addClass("trialCompleted");
  }

  showOrderNumberOnCell(material, bevTemp, airTemp , order) {
    this.getCellDOM(material, bevTemp, airTemp).html(order);
  }

  trialCompleted(componentState) {
    const material = componentState.studentData.materialText;
    const bevTemp = componentState.studentData.bevTempText;
    const airTemp = componentState.studentData.airTempText;
    this.addCompletedCell(material, bevTemp, airTemp);
    this.showCheckOnCells();
    this.showCellOrders();
    this.saveToWISE();
  }

  saveToWISE() {
    const componentState = {
      messageType: 'studentDataChanged',
      isAutoSave: false,
      isSubmit: false,
      timestamp: new Date().getTime(),
      studentData: {
        completedCells: this.completedCells,
        selectedCells: this.selectedCells
      }
    };
    try {
      window.postMessage(componentState, "*");
    } catch(err) {
      console.log("not posted");
    }
  }
}

class CollectionGrids extends Grids {
  constructor() {
    super();
  }
}

class InterpretGrids extends Grids {
  constructor() {
    super();
  }

  cellClicked(cellDOMElement) {
    let material = cellDOMElement.attr("material");
    let bevTemp = cellDOMElement.attr("bevTemp");
    let airTemp = cellDOMElement.attr("airTemp");
    if (this.isCellSelected(material, bevTemp, airTemp)) {
      this.removeSelectedCell(material, bevTemp, airTemp);
    } else {
      this.addSelectedCell(material, bevTemp, airTemp);
    }
    this.highlightSelectedCells();
    this.saveToWISE();
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
  let studentData = componentState.studentData;
  grids.loadComponentState(componentState);
}

/**
 * Send a message to the parent
 * @param the message to send to the parent
 */
function sendMessage(message) {
  window.postMessage(message, "*");
}

/**
 * Receive a message from the parent
 * @param message the message from the parent
 */
function receiveMessage(message) {
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
        } else if (messageData.messageType == 'handleConnectedComponentStudentDataChanged') {
          let componentState = messageData.componentState;
          if (componentState.componentType == 'Embedded' &&
            componentState.studentData.isTrialCompleted) {
            grids.trialCompleted(componentState);
          }
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
