let grids;
let temperatures = ['Hot', 'Warm', 'Cold'];
let materials = ['Aluminum', 'Wood', 'Styrofoam', 'Clay', 'Glass', 'Plastic'];

function init() {
  if (isCollectMode()) {
    grids = new CollectionGrids();
  } else if (isFlagMode()) {
    grids = new FlagGrids();
    if (isAutoScoreMaterialMode() || isAutoScoreTemperatureMode()) {
      displayAutoScoreMode();
    }
  } else if (isInterpretMode()) {
    grids = new InterpretGrids();
  } else {
    alert("Error: unrecognized mode. Exiting.");
    return;
  }
  showOnlyAvailableTemps();
  initCellClickedHandlers();
  grids.sendGetParametersMessage();
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

class Grids extends WISEAPI {
  constructor() {
    super();
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

  receivedGetParametersMessage(parameters) {
    this.nodeId = parameters.nodeId;
    this.componentId = parameters.componentId;
  }

  handleComponentStateMessage(messageData) {
    const componentState = messageData.componentState;
    if (componentState != null) {
      this.loadComponentState(componentState);
    }
  }

  handleConnectedComponentStudentDataChangedMessage(messageData) {
    const componentState = messageData.componentState;
    if (componentState.componentType == 'Graph') {
      showModelStateFromGraphStudentWork(componentState);
    } else if (componentState.componentType == 'Embedded' &&
        componentState.studentData.isTrialCompleted) {
      this.trialCompleted(componentState);
    }
  }

  getStudentDataToSave() {
    return {
      completedCells: this.completedCells,
      flaggedCells: this.flaggedCells,
      selectedCells: this.selectedCells
    };
  }

  saveFeedbackToWISE(feedback = '') {
    const studentData = this.getStudentDataToSave();
    const componentState = this.createComponentState(studentData, 'studentWork');
    const annotation = this.createAnnotation('autoComment', feedback);
    this.addAnnotationToComponentState(componentState, annotation);
    try {
      this.sendMessageToParent(componentState);
    } catch(err) {
      console.log("not posted");
    }
  }

  saveToWISE() {
    const studentData = this.getStudentDataToSave();
    const componentState = this.createComponentState(studentData, 'studentDataChanged');
    try {
      this.sendMessageToParent(componentState);
    } catch(err) {
      console.log("not posted");
    }
  }

  feedback(feedback) {
    this.saveFeedbackToWISE(feedback);
    $("#log").append(feedback);
    $("#log").append("<br/>");
    $("#log").append("<br/>");
  }

  giveFeedback() {
    const aggregate = this.getFlaggedCellsAggregate();
    if (this.noCellSelected(aggregate)) {
      this.feedback("[Condition NoneSelected] Please choose experiment(s) that you want to run.");
      return;
    }

    if (this.allCellsSelected(aggregate)) {
      this.feedback(`[Condition 6Pairs] Are all of these tests necessary? Your plan includes 12 of the 12 possible tests.`);
      return;
    }

    if (isAutoScoreTemperatureMode()) {
      if (this.allHot(aggregate)) {
        this.feedback("Guidance: all hot");
      } else if (allCold(aggregate)) {
        this.feedback("Guidance: all cold");
      } else if (this.onlyHotAndCold(aggregate)) {
        this.feedback("Guidance: only hot & cold");
      } else if (this.hotOnlyEqualsColdOnly(aggregate)) {
        this.feedback("Guidance: hot only = cold only");
      } else if (this.hotOnlyMoreThanColdOnly(aggregate)) {
        this.feedback("Guidance: hot only > cold only");
      } else if (this.hotOnlyLessThanColdOnly(aggregate)) {
        this.feedback("Guidance: hot only < cold only");
      }
    } else if (isAutoScoreMaterialMode()) {
      const allMaterialsFlagged = this.getAllMaterialsFlagged(aggregate);
      if (this.noPairs(aggregate)) {
        this.feedback(`[Condition NoPairs] It looks like you’re interested in investigating ${allMaterialsFlagged.length} material(s): ${allMaterialsFlagged.join(", ")}.
          Your plan includes one temperature test for each material.<br/>
          To improve your experiment plan, consider: 
          Will testing just one temperature for a material help you decide 
          how the material compares against other materials for insulating a beverage? `);
      } else if (this.onlyHotAndCold(aggregate) && this.numPairs(aggregate) === 1) {
        this.feedback(`[Condition OnePair] It looks like you’re interested in investigating ${allMaterialsFlagged.length} material(s): ${allMaterialsFlagged.join(", ")}.
          Your plan includes both hot and cold tests for these materials.<br/>
          To improve your experiment plan, consider: 
          Are there any other materials you would like to compare to ${allMaterialsFlagged.join(", ")}? 
          What test(s) should you add to your plan to investigate these other materials?`);
      } else if (this.onlyHotAndCold(aggregate) && this.numPairs(aggregate) >= 2 && this.numPairs(aggregate) <= 5) {
        this.feedback(`[Condition 2-5Pairs] It looks like you’re interested in investigating ${allMaterialsFlagged.length} material(s): ${allMaterialsFlagged.join(", ")}.
          Your plan includes both hot and cold tests for these materials.<br/>
          To improve your experiment plan, consider: 
          Are there any other materials you would like to compare to ${allMaterialsFlagged.join(", ")}? 
          What test(s) should you add to your plan to investigate these other materials?`);
      } else {
        this.feedback(`[Condition Singles] It looks like you’re interested in investigating ${allMaterialsFlagged.length} material(s): ${allMaterialsFlagged.join(", ")}.
          Your plan includes set of hot and cold tests for ${aggregate.hotAndCold.join(", ")} 
          and only one temperature test each for materials ${aggregate.hotOnly.concat(aggregate.coldOnly).join(", ")}.<br/>
          To improve your experiment plan, consider: Will testing just one temperature for a material help you decide 
          how the material compares against other materials for insulating a beverage?`);
      }
    }
  }

  getFlaggedCellsAggregate() {
    const flaggedCellsByMaterial = {};
    const flaggedCellsHotAndCold = [];
    const flaggedCellsHotOnly = [];
    const flaggedCellsColdOnly = [];
    ["Aluminum", "Wood", "Styrofoam", "Clay", "Glass", "Plastic"].map((material) => {
      flaggedCellsByMaterial[material] = this.getFlaggedCellsByMaterial(material);
      const hotMaterial = this.getFlaggedCellsByMaterialAndTemp(material, "Hot");
      const coldMaterial = this.getFlaggedCellsByMaterialAndTemp(material, "Cold");
      if (hotMaterial.length === 1 && coldMaterial.length === 1) {
        flaggedCellsHotAndCold.push(material);
      } else if (hotMaterial.length === 1) {
        flaggedCellsHotOnly.push(material);
      } else if (coldMaterial.length === 1) {
        flaggedCellsColdOnly.push(material);
      }
    });
    const flaggedCellsByTemp = {};
    ["Hot", "Cold"].map((temp) => {
      flaggedCellsByTemp[temp] = this.getFlaggedCellsByTemp(temp);
    });
    return {
      byMaterial: flaggedCellsByMaterial,
      byTemp: flaggedCellsByTemp,
      hotAndCold: flaggedCellsHotAndCold,
      hotOnly: flaggedCellsHotOnly,
      coldOnly: flaggedCellsColdOnly
    };
  }

  noCellSelected(aggregate) {
    return aggregate.hotOnly.length === 0 &&
      aggregate.coldOnly.length === 0 &&
      aggregate.hotAndCold.length === 0;
  }

  allCellsSelected(aggregate) {
    return aggregate.hotAndCold.length === materials.length;
  }

  noPairs(aggregate) {
    return aggregate.hotAndCold.length === 0 &&
      (aggregate.hotOnly.length > 0 || aggregate.coldOnly.length > 0);
  }

  getAllMaterialsFlagged(aggregate) {
    return aggregate.hotAndCold.concat(aggregate.hotOnly).concat(aggregate.coldOnly);
  }

  numPairs(aggregate) {
    return aggregate.hotAndCold.length;
  }

  allHot(aggregate) {
    return aggregate.hotAndCold.length + aggregate.hotOnly.length === materials.length;
  }

  allCold(aggregate) {
    return aggregate.hotAndCold.length + aggregate.coldOnly.length === materials.length;
  }

  onlyHotAndCold(aggregate) {
    return aggregate.hotAndCold.length > 0 &&
      aggregate.hotOnly.length === 0 && aggregate.coldOnly.length === 0;
  }

  hotOnlyEqualsColdOnly(aggregate) {
    return aggregate.hotOnly.length > 0 &&
      aggregate.hotOnly.length === aggregate.coldOnly.length;
  }

  hotOnlyMoreThanColdOnly(aggregate) {
    return aggregate.hotOnly.length > 0 &&
      aggregate.hotOnly.length > aggregate.coldOnly.length;
  }

  hotOnlyLessThanColdOnly(aggregate) {
    return aggregate.coldOnly.length > 0 &&
      aggregate.hotOnly.length < aggregate.coldOnly.length;
  }

  getFlaggedCellsByMaterial(material) {
    return this.flaggedCells.filter((flaggedCell) => {
      return flaggedCell.material === material;
    });
  }

  getFlaggedCellsByTemp(temp) {
    return this.flaggedCells.filter((flaggedCell) => {
      return flaggedCell.bevTemp === temp;
    });
  }

  getFlaggedCellsByMaterialAndTemp(material, temp) {
    return this.flaggedCells.filter((flaggedCell) => {
      return flaggedCell.material === material && flaggedCell.bevTemp === temp;
    });
  }

  clearLog() {
    $("#log").html("");
  }

  appendStateToLog(aggregate) {
    $("#log").append(`Number of tests: ${aggregate.hotAndCold.length * 2 + aggregate.hotOnly.length + aggregate.coldOnly.length} / 12`);
    $("#log").append(`Hot and Cold (${aggregate.hotAndCold.length}): [${aggregate.hotAndCold.join(",")}]`);
    $("#log").append(`Hot only (${aggregate.hotOnly.length}): [${aggregate.hotOnly.join(",")}]`);
    $("#log").append(`Cold only (${aggregate.coldOnly.length}): [${aggregate.coldOnly.join(",")}]`);
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

function displayAutoScoreMode() {
  $("#autoScoreDiv").show();
  $("#autoScoreGuidanceHeading").append(` (${getAutoScoreMode()})`);
}
