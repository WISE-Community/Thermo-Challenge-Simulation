// World specs allow us to translate from canvas pixels to world voxels
// Voxels heretofore represent world units
const worldSpecs = {
  min_x: -10,
  max_x: 10,
  min_y: -15,
  max_y: 15,
  temperature_min: 0,
  temperature_max: 100,
  flow_speed: 6.2,
  max_ticks: 30 * 30,
  series: [],
  trialId: null
};

/**
 * World objects include thermometers and cups
 * Thermometers should have structure:
 *   x, y (voxel at which temp is collected), color
 * Cups should have structure:
 *   x, y (top-left,top-right), width, height (voxels),
 *   thickness (of wall in voxels)
 */
const worldObjects = {
  thermometers:[
    { x:0, y:-3, color:"#00FF00", saveSeries:true, id:"beverage" },
    { x:0, y:8, color:"#FF00DD", id:"air" }
  ],
  cups: [
    {
      x: -8,
      y: -10,
      width: 16,
      height: 16,
      thickness: 3,
      liquid: "Water",
      material: "",
      liquid_temperature: null,
      material_temperature: 25
    }
  ],
  air: {
    temperature: null,
    conductivity: 40,
    color: "#FFEECC"
  },
  liquids: {
    "Water": {
      conductivity: 80,
      color: "rgba(220,220,250,0.7)"
    }
  },
  materials: {
    "Aluminum": {
      conductivity: 130,
      color: "#000000"
    },
    "Wood": {
      conductivity: 6,
      color: "#774400"
    },
    "Styrofoam": {
      conductivity: 1.2,
      color: "#777777"
    },
    "Clay": {
      conductivity: 12,
      color: "#00B0AF"
    },
    "Glass": {
      conductivity: 30,
      color: "#1565C0"
    },
    "Plastic": {
      conductivity: 15,
      color: "#DD1188"
    }
  }
};

let stage = null;
let world = null;
let framerate = 120;
let tempToHSLValues = {};

function init() {
  initializeValues();
  stage = new createjs.Stage($("#canvas")[0]);
  const material = getStartingMaterial();
  const bevTemp = getStartingBevTemp();
  const airTemp = getStartingAirTemp();
  if (material != null && bevTemp != null && airTemp != null) {
    showTrial(material, bevTemp, airTemp);
  }
}

function initializeValues() {
  worldSpecs.width_px = $("#canvas").width() - 100;
  worldSpecs.height_px = $("#canvas").height();
  worldSpecs.width = worldSpecs.max_x - worldSpecs.min_x + 1;
  worldSpecs.height = worldSpecs.max_y - worldSpecs.min_y + 1;
  worldSpecs.voxel_width = worldSpecs.width_px / (worldSpecs.width);
  worldSpecs.voxel_height = worldSpecs.height_px / (worldSpecs.height);
  worldSpecs.temperature_range =
      worldSpecs.temperature_max - worldSpecs.temperature_min;
}

function initWorld() {
  world = new createjs.Container();
  world.shape = new createjs.Shape();
  world.addChild(world.shape);
  world.heatShape = new createjs.Shape();
  world.addChild(world.heatShape);
  stage.addChild(world);

  world.voxels = [];
  // first assume everything is air
  for (let x = worldSpecs.min_x; x <= worldSpecs.max_x; x++) {
    for (let y = worldSpecs.min_y; y <= worldSpecs.max_y; y++) {
      world.voxels.push(
          {
            x: x,
            y: y,
            temperature: worldObjects.air.temperature,
            conductivity: worldObjects.air.conductivity,
            type: "air",
            color: worldObjects.air.color
          }
      );
      const box = voxelToPixels(x, y);
      if (worldObjects.air.temperature != null) {
        world.shape.graphics.beginFill(worldObjects.air.color)
            .drawRect(box.x0, box.y0, box.width, box.height).endFill();
      }
    }
  }

  for (let i = 0; i < worldObjects.cups.length; i++) {
    const cup = worldObjects.cups[i];
    // only draw if the material is selected
    if (cup.material != null && cup.material.length > 0) {
      // now update for cup materials (this will be a bit redundant
      // because we are updating the liquid area twice, but not too bad)
      for (let x = cup.x; x < (cup.x + cup.width); x++) {
        for (let y = cup.y; y < (cup.y + cup.height); y++) {
          const voxel = getVoxel(x, y);
          voxel.temperature = worldObjects.air.temperature;
          voxel.conductivity = worldObjects.materials[cup.material].conductivity;
          voxel.color = worldObjects.materials[cup.material].color;
          voxel.type = "material-" + i;
          const box = voxelToPixels(x, y);
          world.shape.graphics.beginFill(voxel.color)
              .drawRect(box.x0, box.y0, box.width, box.height).endFill();
        }
      }
      if (cup.liquid_temperature != null) {
        // now update for liquid
        for (let x = cup.x + cup.thickness; x < (cup.x + cup.width - cup.thickness); x++) {
          for (let y = cup.y + cup.thickness; y < (cup.y + cup.height - cup.thickness); y++) {
            const voxel = getVoxel(x, y);
            voxel.temperature = cup.liquid_temperature;
            voxel.conductivity = worldObjects.liquids[cup.liquid].conductivity;
            voxel.color = worldObjects.liquids[cup.liquid].color;
            voxel.type = "liquid-"+i;
            const box = voxelToPixels(x, y);
            world.shape.graphics.beginFill(voxel.color)
                .drawRect(box.x0, box.y0, box.width, box.height).endFill();
          }
        }
      }
    }
  }
  world.shape.cache(0, 0, worldSpecs.width_px, worldSpecs.height_px);
}

function getCupMaterialColor(cup) {
  return cup.material != null && cup.material.length > 0 ? (worldObjects.materials[cup.material].color != null ? worldObjects.materials[cup.material].color: worldObjects.materials[cup.material].color) : "#444444";
}

/**
 * Entry point to application
 * @param material values are in worldObjects.material:
 *   "Aluminum", "Wood", "Clay", "Plastic", "Styrofoam"
 * @param beverageTempText starting beverage temperature:
 *   "Hot", "Warm", "Cold"
 * @param airTempText starting air temperature: "Hot", "Warm", "Cold"
 */
function showTrial(material, beverageTempText, airTempText, isCompleted) {
  currentSimulation = new Simulation(material, beverageTempText, airTempText,
      isCompleted);
  $('.intro').hide();
  currentSimulation.generateTrial();
  currentSimulation.showTrialRenderingBox();
  currentSimulation.showTrialIntialState();
}

function shuffledIndexArray(n) {
  const a = Array.apply(null, {length:n}).map(Number.call, Number);
  let j, x, i;
  for (i = a.length; i; i--) {
    j = Math.floor(Math.random() * i);
    x = a[i - 1];
    a[i - 1] = a[j];
    a[j] = x;
  }
  return a;
}

let currentSimulation;

function getClosestTickTo30(tick) {
  return Math.floor(tick / 30) * 30;
}

function getTrialId(material, bevTemperatureText, airTemperatureText) {
  return material + "-" + bevTemperatureText + "Liquid";
}

function getTrialMaterial(trialId) {
  return trialId.substring(0, trialId.indexOf("-"));
}

function getTrialLiquidTemperature(trialId) {
  // "HotBev", "WarmBev", "ColdBev"
  let liquidTempStr =
    trialId.substring(trialId.indexOf("-") + 1, trialId.lastIndexOf("-"));
  return liquidTempStr.substring(0, liquidTempStr.length - 3);
}

function getTrialAirTemperature(trialId) {
  // "HotAir", "WarmAir", "ColdAir"
  let airTempStr = trialId.substring(trialId.lastIndexOf("-") + 1);
  return airTempStr.substring(0, airTempStr.length - 3);
}

function convertLiquidTempTextToTempNum(temperatureText) {
  if (temperatureText == "Hot") {
    return 90;
  } else if (temperatureText == "Warm") {
    return 50;
  } else {
    return 4;
  }
}

function convertAirTempTextToTempNum(temperatureText) {
  if (temperatureText == "Hot") {
    return 40;
  } else if (temperatureText == "Warm") {
    return 30;
  } else {
    return 0;
  }
}

function resetThermometers() {
  for (const thermometer of worldObjects.thermometers) {
    thermometer.text.text = "";
  }
}

/**
 * Given the x and y coordinate of a voxel, returns the bounding box
 * information for the canvas {x0, y0, x1, y1, width, height}
 */
function voxelToPixels(x, y) {
  return {
    x0: worldSpecs.width_px/2 + worldSpecs.voxel_width*x - worldSpecs.voxel_width/2,
    y0: worldSpecs.height_px/2 - worldSpecs.voxel_height*y - worldSpecs.voxel_height/2,
    x1: worldSpecs.width_px/2 + worldSpecs.voxel_width*x + worldSpecs.voxel_width/2,
    y1: worldSpecs.height_px/2 - worldSpecs.voxel_height*y + worldSpecs.voxel_height/2,
    width: worldSpecs.voxel_width,
    height: worldSpecs.voxel_height
  };
}

/**
 * Given the x, y coordinates of the voxel, retrieve the appropriate voxel
 * from the array
 */
function getVoxelIndex(vx, vy) {
  const xdiff = vx - worldSpecs.min_x;
  const ydiff = vy - worldSpecs.min_y;
  return worldSpecs.height * xdiff + ydiff;
}

function getVoxel(vx, vy) {
  return world.voxels[getVoxelIndex(vx, vy)];
}

/**
 * Returns HSL given integer temperature.
 * Using a rainbow-like, weather map type color spcetrum
 */
function tempToHSL(temperature) {
  let temp2Decimals = temperature.toFixed(2);
  if (tempToHSLValues[temp2Decimals] != null) {
    return tempToHSLValues[temp2Decimals];
  } else {
    const temp_frac = (temperature - worldSpecs.temperature_min)
      / worldSpecs.temperature_range;
    const hslValue = {
      h: 260 - (temp_frac * 280),
      s: "100%",
      l: "50%"
    };
    tempToHSLValues[temp2Decimals] = hslValue;
    return hslValue;
  }
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
      } else if (messageData.messageType == 'siblingComponentStudentDataChanged') {
        let componentState = messageData.componentState;
      } else if (messageData.messageType == 'handleConnectedComponentStudentDataChanged') {
        let componentState = messageData.componentState;
        if (componentState.componentType == 'Graph') {
          showModelStateFromGraphStudentWork(componentState);
        } else if (componentState.componentType == 'Embedded') {
            showModelStateFromEmbeddedGrid(componentState)
        }
      }
    }
  }
}

function showModelStateFromEmbeddedGrid(componentState) {
  let selectedCells = componentState.studentData.selectedCells;
  let completedCells = componentState.studentData.completedCells;
  if (currentSimulation != null) {
    if (!currentSimulation.isCompleted) {
      let trialIdsToDelete = [];
      trialIdsToDelete.push(
        getTrialId(currentSimulation.material,
          currentSimulation.beverageTempText, currentSimulation.airTempText));
      sendTrialIdsToDelete(trialIdsToDelete);
    }
  }
  if (selectedCells.length > 0) {
    let selectedCell = selectedCells[selectedCells.length - 1];
    let material = selectedCell.material;
    let bevTemp = selectedCell.bevTemp;
    let airTemp = selectedCell.airTemp;
    if (currentSimulation == null ||
        !currentSimulation.isCurrentSimulation(material, bevTemp, airTemp)) {
      if (currentSimulation != null && currentSimulation.isSimulationPlaying()) {
        currentSimulation.pauseSimulation();
      }
      let isCompleted = isCellCompleted(completedCells, material, bevTemp, airTemp);
      showTrial(material, bevTemp, airTemp, isCompleted);
    }
  }
}

function sendTrialIdsToDelete(trialIdsToDelete) {
  let studentData = {};
  studentData.trialIdsToDelete = trialIdsToDelete;

  const componentState = {
    messageType: 'studentDataChanged',
    isAutoSave: false,
    isSubmit: false,
    studentData: studentData
  };

  componentState.timestamp = new Date().getTime();
  try {
    window.postMessage(componentState, "*");
  } catch(err) {
    console.log("not posted");
  }
}

function getSelectedCell() {

}

function isCellCompleted(completedCells, material, bevTemp, airTemp) {
  for (let completedCell of completedCells) {
    if (cellAttributesMatch(completedCell, material, bevTemp, airTemp)) {
      return true;
    }
  }
  return false;
}

function cellAttributesMatch(cell, material, bevTemp, airTemp) {
  return cell.material == material && cell.bevTemp == bevTemp && cell.airTemp == airTemp;
}

function getParametersFromTrialId(trialId) {
  let regEx = /(.*)-(.*)Bev-(.*)Air/;
  let results = trialId.match(regEx);
  let material = results[1];
  let bevTemp = results[2];
  let airTemp = results[3];
  return { material: material, bevTemp: bevTemp, airTemp: airTemp };
}

/**
 * Get the data from a Graph component state and use the data to display the model at a
 * specific tick.
 * @param componentState A component state from a Graph component.
 */
function showModelStateFromGraphStudentWork(componentState) {
  // TODO: this line should be two separate calls: one to show, and one to get the trial id
  const trialIdInComponentState = showTrialFromComponentState(componentState);
  const xPercentage = getXPercentage(componentState);
  const tick = Math.floor(
      xPercentage * (currentSimulation.allWorldData.length - 1));

  currentSimulation.showTrialAtTick(tick);
}

/**
 * Show the trial that is active in the Graph component state.
 * @param componentState A component state from a Graph component.
 * @return the trial id
 */
function showTrialFromComponentState(componentState) {
  const activeTrial = getShownTrial(componentState);
  const series = activeTrial.series[0];

  /*
   * the series name should be in the format (Material)-(Temp)Bev-(Temp)Air
   * e.g. Clay-HotBev-ColdAir
   */
  let seriesName = series.name;

  let regEx = /(.*)-(.*)Bev-(.*)Air/;
  let match = regEx.exec(seriesName);
  let material = match[1];
  let beverageTemp = match[2];
  let airTemp = match[3];

  showTrial(material, beverageTemp, airTemp);
  return getTrialId(material, beverageTemp, airTemp);
}

/**
 * Get the trial that is shown in the graph.
 * @param componentState The student work.
 * @return The first trial that is shown.
 */
function getShownTrial(componentState) {
  for (let trial of componentState.studentData.trials) {
    if (trial.show) {
      return trial;
    }
  }
}

/**
 * Get the x value of the latest mouse location in the units of the graph.
 * For example, if the graph has time on the x axis and the x axis spans from
 * t=0 to t=10. The x value will be between 0 and 10.
 * @param componentState The student work.
 * @return A location of the mouse in the units of the graph.
 */
function getMouseX(componentState) {
  const mouseOverPoint = componentState.studentData.mouseOverPoints[componentState.studentData.mouseOverPoints.length - 1];
  return mouseOverPoint[0];
}

/**
 * Get the x value as a percentage of the max x axis limit.
 * @param componentState The student work.
 * @return A number between 0 and 1.
 */
function getXPercentage(componentState) {
  const x = getMouseX(componentState);
  const maxX = getMaxX(componentState);
  return x / maxX;
}

/**
 * Get the x axis max limit.
 * @param componentState The student work.
 * @return A number which is the x axis max limit.
 */
function getMaxX(componentState) {
  return componentState.studentData.xAxis.max;
}

function getCurrentCupMaterialColor() {
  return worldObjects.materials[worldObjects.cups[0].material].color;
}

function getWorldState(tick, tickToHighlight) {

  const studentData = {
    ticks: world.ticks,
    materialText: currentSimulation.material,
    bevTempText: currentSimulation.beverageTempText,
    airTempText: currentSimulation.airTempText,
    material0: worldObjects.cups[0].material,
    material0_initial_temperature: worldObjects.cups[0].material_temperature,
    liquid_initial_temperature: worldObjects.cups[0].liquid_initial_temperature,
    air_initial_temperature:worldObjects.air.temperature,
    trial: {
      id: currentSimulation.trialId,
      name:  currentSimulation.trialId,
      series: [{
        id: currentSimulation.trialId,
        name:  currentSimulation.trialId,
        color: getCurrentCupMaterialColor(),
        data: currentSimulation.data.slice(0, tick / 30 + 1),
      }]
    }
  };

  if (tickToHighlight != null) {
    studentData.xPointToHighlight = tickToHighlight * 2 / 30;
  } else {
    studentData.xPointToHighlight = tick * 2 / 30;
  }

  return studentData;
}

window.addEventListener('message', receiveMessage);
