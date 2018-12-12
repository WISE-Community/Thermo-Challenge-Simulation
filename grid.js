let grids;
let temperatures = ['Hot', 'Warm', 'Cold'];
let materials = ['Aluminum', 'Wood', 'Styrofoam', 'Clay', 'Glass', 'Plastic'];

function init() {
  if (isCollectMode()) {
    grids = new CollectionGrids();
  } else if (isFlagMode()) {
    grids = new FlagGrids();
    if (isAutoScoreMaterialMode() || isAutoScoreTemperatureMode()) {
      initFeedbackButton()
    }
  } else if (isInterpretMode()) {
    grids = new InterpretGrids();
  } else {
    alert("Error: unrecognized mode. Exiting.");
    return;
  }
  showOnlyAvailableTemps();
  initCellClickedHandlers();
  sendGetParametersMessage();
}

function showOnlyAvailableTemps() {
  const allAvailableTemps = getAllAvailableTemps();
  ["Hot","Warm","Cold"].map((temp) => {
    if (!allAvailableTemps.includes(temp)) {
      $(`.Temp.${temp}`).hide();
    }
  });
}

function initCellClickedHandlers() {
  $(".choice").click(function(event, ui) {
    grids.cellClicked($(this));
  });

  if (isInterpretMode()) {
    $(".choice").addClass("disabled");
  }
}

class Grids {
  constructor() {
    this.completedCells = [];
    this.flaggedCells = [];
    this.selectedCells = [];
  }

  loadComponentState(componentState) {
    let studentData = componentState.studentData;
    if (studentData.completedCells != null) {
      this.completedCells = studentData.completedCells;
    }
    if (studentData.flaggedCells != null) {
      this.flaggedCells = studentData.flaggedCells;
    }
    if (studentData.selectedCells != null) {
      this.selectedCells = studentData.selectedCells;
    }
    this.refreshCells();
  }

  highlightSelectedCells() {
    $(".choice").removeClass("selected");
    for (const selectedCell of this.selectedCells) {
      this.highlightCell(selectedCell);
    }
  }

  refreshCells() {
    this.highlightSelectedCells();
    this.showCheckOnCells();
    this.showFlaggedCells();
    this.showCellOrders();
  }

  showCheckOnCells() {
    for (const cell of this.completedCells) {
      this.showCheckOnCell(cell.material, cell.bevTemp, cell.airTemp);
    }
  }

  showFlaggedCells() {
    $(".choice").removeClass("flagged");
    for (const flaggedCell of this.flaggedCells) {
      this.flagCell(flaggedCell);
    }
  }

  showCellOrders() {
    for (let c = 0; c < this.completedCells.length; c++) {
      let cell = this.completedCells[c];
      this.showOrderNumberOnCell(cell.material, cell.bevTemp, cell.airTemp, c + 1);
    }
  }

  getCellDOM(material, bevTemp, airTemp) {
    return $('td[material="' + material + '"][bevTemp="' + bevTemp + '"][airTemp="' + airTemp + '"]');
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

  removeSelectedCell(material, bevTemp, airTemp) {
    for (let c = 0; c < this.selectedCells.length; c++) {
      let selectedCell = this.selectedCells[c];
      if (this.cellAttributesMatch(selectedCell, material, bevTemp, airTemp)) {
        this.selectedCells.splice(c, 1);
        c--;
      }
    }
  }

  clearSelectedCells() {
    this.selectedCells = [];
  }

  cellAttributesMatch(cell, material, bevTemp, airTemp) {
    return cell.material == material && cell.bevTemp == bevTemp && cell.airTemp == airTemp;
  }

  cellClicked(cellDOMElement) {
    // overridden by children
  }

  highlightCell(cell) {
    this.getCellDOM(cell.material, cell.bevTemp, cell.airTemp)
        .addClass("selected");
  }

  flagCell(cell) {
    this.getCellDOM(cell.material, cell.bevTemp, cell.airTemp)
        .addClass("flagged");
  }

  showCheckOnCell(material, bevTemp, airTemp) {
    this.getCellDOM(material, bevTemp, airTemp)
        .addClass("completed")
        .removeClass("unexplored")
        .removeClass("disabled");
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
        flaggedCells: this.flaggedCells,
        selectedCells: this.selectedCells
      }
    };
    try {
      sendMessageToParent(componentState);
    } catch(err) {
      console.log("not posted");
    }
  }
}

class FlagGrids extends Grids {
  constructor() {
    super();
  }

  cellClicked(cellDOMElement) {
    let material = cellDOMElement.attr("material");
    let bevTemp = cellDOMElement.attr("bevTemp");
    let airTemp = cellDOMElement.attr("airTemp");
    if (this.isCellFlagged(material, bevTemp, airTemp)) {
      this.removeFlaggedCell(material, bevTemp, airTemp);
    } else {
      this.addFlaggedCell(material, bevTemp, airTemp);
    }
    this.showFlaggedCells();
    this.saveToWISE();
  }

  addFlaggedCell(material, bevTemp, airTemp) {
    if (!this.isCellFlagged(material, bevTemp, airTemp)) {
      this.flaggedCells.push(this.createCell(material, bevTemp, airTemp));
    }
  }

  removeFlaggedCell(material, bevTemp, airTemp) {
    for (let c = 0; c < this.flaggedCells.length; c++) {
      let flaggedCell = this.flaggedCells[c];
      if (this.cellAttributesMatch(flaggedCell, material, bevTemp, airTemp)) {
        this.flaggedCells.splice(c, 1);
        c--;
      }
    }
  }

  isCellFlagged(material, bevTemp, airTemp) {
    for (let flaggedCells of this.flaggedCells) {
      if (this.cellAttributesMatch(flaggedCells, material, bevTemp, airTemp)) {
        return true;
      }
    }
    return false;
  }
}

class CollectionGrids extends Grids {
  constructor() {
    super();
    $(".choice").addClass("unexplored");
  }

  cellClicked(cellDOMElement) {
    let material = cellDOMElement.attr("material");
    let bevTemp = cellDOMElement.attr("bevTemp");
    let airTemp = cellDOMElement.attr("airTemp");

    this.setOneSelectedCell(material, bevTemp, airTemp);
    this.highlightSelectedCells();
    this.saveToWISE();
  }

  setOneSelectedCell(material, bevTemp, airTemp) {
    this.clearSelectedCells();
    this.addSelectedCell(material, bevTemp, airTemp);
  }
}

class InterpretGrids extends Grids {
  constructor() {
    super();
    $(".choice").addClass("unexplored");
  }

  cellClicked(cellDOMElement) {
    if (cellDOMElement.hasClass("disabled")) {
      alert("You haven't collected data for this trial!");
    } else {
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
}

function initFeedbackButton() {
  $("#feedbackButton").show();
  $("#feedbackButton").click(() => {
    giveGuidance();
  });
}

function sendGetParametersMessage() {
  sendMessageToParent({ messageType: 'getParameters' });
}

function receivedGetParametersMessage(parameters) {
  grids.nodeId = parameters.nodeId;
  grids.componentId = parameters.componentId;
}

function sendApplicationInitializedMessage() {
  sendMessageToParent({ messageType: 'applicationInitialized' });
}

function loadComponentState(componentState) {
  grids.loadComponentState(componentState);
}

/**
 * Send a message to the parent
 * @param the message to send to the parent
 */
function sendMessageToParent(message) {
  window.postMessage(message, "*");
}

/**
 * Receive a message from the parent
 * @param message the message from the parent
 */
function receiveMessageFromParent(message) {
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

// listen for messages from the parent frame
window.addEventListener('message', receiveMessageFromParent);
