// World specs allow us to translate from canvas pixels to world voxels
// Voxels heretofore represent world units
const worldSpecs = {
  min_x: -10,
  max_x: 10,
  min_y: -15,
  max_y: 15,
  temperature_min: 0,
  temperature_max: 100,
  flow_speed: 4,
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
    { x:0, y:-1, color:"#00FF00", saveSeries:true },
    { x:0, y:7, color:"#FF00DD" }
  ],
  cups: [
    {
      x: -6,
      y: -8,
      width: 13,
      height: 13,
      thickness: 3,
      liquid: "Water",
      material: "",
      liquid_temperature: null,
      material_temperature: 25
    }
  ],
  air: {
    temperature: null,
    conductivity: 100,
    color: "#FFEECC"
  },
  liquids: {
    "Water": {
      conductivity: 100,
      color: "rgba(220,220,250,0.7)"
    }
  },
  materials: {
    "Aluminum": {
      conductivity: 200,
      color: "#AAAAAA",
      stroke_color: "#888888"
    },
    "Wood": {
      conductivity: 10,
      color: "#996622",
      stroke_color: "#774400"
    },
    "Styrofoam": {
      conductivity: 1,
      color: "#FFFFFF",
      stroke_color: "#DDDDDD"
    },
    "Clay": {
      conductivity: 20,
      color: "#FF8844",
      stroke_color: "#DD6622"
    },
    "Glass": {
      conductivity: 40,
      color: "rgba(150,200,180,0.5)",
      stroke_color: "rgba(100,150,130,0.8)"
    },
    "Plastic": {
      conductivity: 20,
      color: "#FF33AA",
      stroke_color: "#DD1188"
    }
  }
};

let stage = null;
let world = null;
let framerate = 120;
let trialsPlayed = {
  trialIdToTicks: []
};
let tempToHSLValues = {};

function init() {
  initializeValues();
  stage = new createjs.Stage($("#canvas")[0]);
  initWorld();

  if (isShowSelectTrialGrid()) {
    setupSelectTrialGrid();
  }
}

function initTemperatureColorLegend(trialId) {
  const stage = new createjs.Stage($("#colorLegend_" + trialId)[0]);
  const colorMap = new createjs.Container();
  const text = new createjs.Text("Temperature \nColors", "16px Arial", "#008833");
  text.x = 0;
  text.y = 0;
  colorMap.addChild(text);
  colorMap.shape = new createjs.Shape();
  colorMap.addChild(colorMap.shape);
  colorMap.shape.height_px = 200;
  colorMap.shape.width_px = 20;
  for (let t = worldSpecs.temperature_max; t >= worldSpecs.temperature_min; t--) {
    const hsl = tempToHSL(t);
    const col = "hsl(" + hsl.h + "," + hsl.s + "," + hsl.l + ")";
    const height_px = colorMap.shape.height_px / (worldSpecs.temperature_range+1);
    colorMap.shape.graphics.beginFill(col)
        .drawRect(20, 60 + (worldSpecs.temperature_max - t) * height_px, colorMap.shape.width_px, height_px).endFill();

    if (t % 20 == 0) {
      const text = new createjs.Text(t+ " °C", "14px Arial", "#008833");
      text.x = 20 + colorMap.shape.width_px + 4;
      text.y = 60 + (worldSpecs.temperature_max - t) * height_px - 6;
      colorMap.addChild(text);
    }
  }
  colorMap.shape.cache(20, 60, colorMap.shape.width_px, colorMap.shape.height_px);
  colorMap.x = 5;
  colorMap.y = 5;
  stage.addChild(colorMap);
  stage.update();
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
  if (world == null) {
    world = new createjs.Container();
    world.shape = new createjs.Shape();
    world.addChild(world.shape);
    world.heatShape = new createjs.Shape();
    world.addChild(world.heatShape);
    initializeOutlines(world);
    initializeThermometers(world);
    stage.addChild(world);
  } else {
    world.shape.graphics.clear();
    world.heatShape.graphics.clear();
  }

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

  drawLiquidAndCupBorders();

  // update temperature on thermometers
  for (const thermometer of worldObjects.thermometers) {
    const voxel = getVoxel(thermometer.x, thermometer.y);
    thermometer.text.text =
        voxel.temperature == null ? "" : voxel.temperature + " °C";
  }
}

function initializeOutlines(world) {
  for (const cup of worldObjects.cups) {
    let topLeft = voxelToPixels(cup.x, cup.y+cup.height-1);
    const outline = cup.outline = new createjs.Shape();
    world.addChild(outline);
    let text = new createjs.Text("Cup", "12px Arial", "black");
    text.x = topLeft.x0 + cup.width*worldSpecs.voxel_width/2-10;
    text.y = topLeft.y0 + 5;
    world.addChild(text);

    topLeft = voxelToPixels(cup.x+cup.thickness, cup.y+cup.height-1-cup.thickness);
    text = new createjs.Text("Liquid", "12px Arial", "black");
    text.x = topLeft.x0 + (cup.width-2*cup.thickness)*worldSpecs.voxel_width/2-12;
    text.y = topLeft.y0 + (cup.height-cup.thickness)*worldSpecs.voxel_height/2-2;
    world.addChild(text);
  }
}

function drawLiquidAndCupBorders() {
  // draw outlines to match cup color
  for (let i = 0; i < worldObjects.cups.length; i++) {
    const cup = worldObjects.cups[i];
    const topLeft = voxelToPixels(cup.x, cup.y + cup.height-1);
    const outline = cup.outline;
    const color = getCupMaterialColor(cup);
    outline.graphics.clear().setStrokeStyle(1).beginStroke(color)
        .drawRect(topLeft.x0, topLeft.y0, cup.width*worldSpecs.voxel_width, cup.height*worldSpecs.voxel_height).endStroke();

    const iTopLeft = voxelToPixels(cup.x + cup.thickness, cup.y + cup.height - 1 - cup.thickness);
    outline.graphics.setStrokeStyle(1).beginStroke(color)
        .drawRect(iTopLeft.x0, iTopLeft.y0, (cup.width-2*cup.thickness)*worldSpecs.voxel_width, (cup.height-2*cup.thickness)*worldSpecs.voxel_height).endStroke();
    outline.cache(topLeft.x0 - 1, topLeft.y0 - 1, cup.width * worldSpecs.voxel_width + 2, cup.height * worldSpecs.voxel_height + 2);
  }
}

function getCupMaterialColor(cup) {
  return cup.material != null && cup.material.length > 0 ? (worldObjects.materials[cup.material].stroke_color != null ? worldObjects.materials[cup.material].stroke_color: worldObjects.materials[cup.material].color) : "#444444";
}

function initializeThermometers(world) {
  for (const thermometer of worldObjects.thermometers) {
    const shape = new createjs.Shape();
    const box = voxelToPixels(thermometer.x, thermometer.y);
    shape.graphics.setStrokeStyle(2).beginStroke(thermometer.color)
        .beginFill("white")
        .drawRoundRect(-box.width/4, -box.height/4, box.width/2, 50, 4)
        .endFill().endStroke();
    shape.graphics.setStrokeStyle(2).beginStroke(thermometer.color)
        .beginFill("white").drawCircle(0, 0, box.width/2).endFill().endStroke();
    shape.x = box.x0 + box.width/2;
    shape.y = box.y0 + box.height/2;
    shape.cache(-box.width/2 - 2, -box.height/2 - 2, box.width + 4, 56);
    shape.rotation = -135;
    world.addChild(shape);
    // setup textbox for temperature recording
    thermometer.text = new createjs.Text("99", "16px Arial", "black");
    thermometer.text.x = box.x0 + box.width + 9;
    thermometer.text.y = box.y0;
    world.addChild(thermometer.text);
  }
}

function setupSelectTrialGrid() {
  $("#selectTrialGrid").show();
  $("#selectTrialGrid").css("display", "flex");
  $(".token").draggable({
    snap: ".snappable",
    snapMode: "inner",
    revert: "invalid"
  });
  $(".snappable").droppable({
    drop: function(event, ui) {
      let material = $(this).attr("material");
      let beverageTemperature = $(this).attr("bevTemp");
      let airTemperature = $(this).attr("airTemp");
      showTrial(material, beverageTemperature, airTemperature);
    }
  });
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

class Simulation {
  constructor(material, beverageTempText, airTempText, isCompleted) {
    this.material = material;
    this.beverageTempText = beverageTempText;
    this.airTempText = airTempText;
    this.trialId = getTrialId(material, beverageTempText, airTempText);
    this.currentTick = 0;
    this.intervalId;
    this.timeout_sleep_duration_ms = 10;
    this.maxTicks = worldSpecs.max_ticks;
    this.maxDurationMinutes = 60;
    this.data = [];
    this.allWorldData = [];
    this.currentStage;
    this.outlineContainer;
    this.thermometers;
    this.currentHeatShape;
    this.ticksPlayed = [];
    if (isCompleted == null) {
      this.isCompleted = false;
    } else {
      this.isCompleted = isCompleted;
    }
  }

  getMaterial() {
    return this.material;
  }

  getBeverageTemp() {
    return this.beverageTempText;
  }

  getAirTemp() {
    return this.airTempText;
  }

  isCurrentSimulation(material, beverageTempText, airTempText) {
    if (material == this.getMaterial() &&
        beverageTempText == this.getBeverageTemp() &&
        airTempText == this.getAirTemp()) {
      return true;
    }

    return false;
  }

  isSimulationPlaying() {
    return this.intervalId != null;
  }

  playSimulation() {
    this.intervalId = setInterval(() => {
      if (this.currentTick >= worldSpecs.max_ticks) {
        this.showResetState();
      } else {
        this.showPlayState();
        $("#showWorldsSlider_" + this.trialId).val(this.currentTick);
        this.showTrialAtTick(this.currentTick);
        this.showTime();
        this.currentTick++;
      }
    }, this.timeout_sleep_duration_ms);
  }

  showResetState() {
    $("#playPauseWorld_" + this.trialId).val("Replay");
  }

  showPlayState() {
    $("#playPauseWorld_" + this.trialId).val("Pause");
  }

  pauseSimulation() {
    clearInterval(this.intervalId);
    this.intervalId = null;
    $("#playPauseWorld_" + this.trialId).val("Play");
  }

  replaySimulation() {
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.currentTick = 0;
    this.playSimulation();
  }

  showTime() {
    let currentTickPositionRatio = this.currentTick / this.maxTicks;
    let minutesPlayed = Math.ceil(currentTickPositionRatio * this.maxDurationMinutes);
    $("#timePlaying_" + this.trialId).html(minutesPlayed + " / " + this.maxDurationMinutes);
  }

  showTrialAtTick(tick) {
    this.currentHeatShape.graphics.clear();
    let worldData = this.allWorldData[tick];
    for (const voxel of worldData.voxels) {
      const hsl = tempToHSL(voxel.temperature);
      const heat_color = "hsla(" + hsl.h + ", " + hsl.s + ", " + hsl.l + ", 1.0)";
      const stroke_color = "hsla(" + hsl.h + ", 50%, " + hsl.l + ", 1.0)";
      const rectXInitial = worldSpecs.width_px/2 + worldSpecs.voxel_width*voxel.x - worldSpecs.voxel_width/2;
      const rectYInitial = worldSpecs.height_px/2 - worldSpecs.voxel_height*voxel.y - worldSpecs.voxel_height/2;
      this.currentHeatShape.graphics
          .beginStroke(stroke_color).beginFill(heat_color)
          .drawRect(rectXInitial, rectYInitial, worldSpecs.voxel_width, worldSpecs.voxel_height)
          .endFill().endStroke();
    }

    for (const thermometer of worldObjects.thermometers) {
      const voxel = worldData.voxels[getVoxelIndex(thermometer.x, thermometer.y)];
      thermometer.temperature = voxel.temperature;
      thermometer.text.text = voxel.temperature.toFixed(1) + " °C";
    }
    this.currentStage.update();
    this.ticksPlayed.push(tick);
    // if (this.isCompleted) {
    //   this.WISE_onTick(870, tick);
    // } else {
    //   this.WISE_onTick(tick);
    // }
    this.WISE_onTick(tick);
  }

  WISE_onTick(tick) {
    if (tick % 30 === 0) {
      let studentData = null;
      if (this.isCompleted) {
        studentData = getWorldState(870, tick);
      } else {
        studentData = getWorldState(tick);
      }
      const componentState = {
        messageType: 'studentDataChanged',
        isAutoSave: false,
        isSubmit: false,
        studentData: studentData
      };

      if (tick >= worldSpecs.max_ticks - 30) {
        componentState.studentData.isTrialCompleted = true;
      }

      componentState.timestamp = new Date().getTime();
      try {
        window.postMessage(componentState, "*");
      } catch(err) {
        console.log("not posted");
      }
    }
  }

  showTrialRenderingBox() {
    $("#trial").empty();
    $("#trial").append('<input id="playPauseWorld_' + this.trialId + '" type="button" value="Play" style="display:none"/>');
    $("#trial").append('<input id="showWorldsSlider_' + this.trialId + '" style="width:400px" type="range" min="0" max="300" step="1" value="0"/>');
    $("#trial").append('<span style="margin-left:10px" id="timePlaying_' + this.trialId + '"></span>');
    $("#trial").append('<br/>');
    $("#trial").append('<h2>' + this.trialId + '</h2>');
    $("#trial").append('<div><canvas id="canvas_' + this.trialId + '" width="210" height="310" style="background-color:#eeeeef"></canvas><canvas id="colorLegend_' + this.trialId + '" width="100" height="310" style="background-color:#eeeeef"></canvas></div>');

    initTemperatureColorLegend(this.trialId);
    this.currentStage = new createjs.Stage($("#canvas_" + this.trialId)[0]);
    this.currentHeatShape = new createjs.Shape();
    this.currentHeatShape.graphics.setStrokeStyle(0.5);
    this.currentStage.addChild(this.currentHeatShape);
    this.outlineContainer = this.createOutlineContainer();
    this.thermometers = this.createThermometerContainer();
    this.currentStage.addChild(this.outlineContainer);
    this.currentStage.addChild(this.thermometers);

    $("#showWorldsSlider_" + this.trialId).attr("max", 899);
    $("#showWorldsSlider_" + this.trialId).on("input", function() {
      let tickLocation = $(this).val();
      currentSimulation.showTrialAtTick(tickLocation);
      currentSimulation.currentTick = tickLocation;
      currentSimulation.showTime();
      if (!currentSimulation.isSimulationPlaying()) {
        currentSimulation.WISE_onTick(getClosestTickTo30(tickLocation));
      }
    });
    $("#playPauseWorld_" + this.trialId).on("click", function() {
      let playPauseState = $(this).val();
      if (playPauseState === "Play") {
        currentSimulation.playSimulation();
      } else if (playPauseState === "Replay") {
        currentSimulation.replaySimulation();
      } else {
        currentSimulation.pauseSimulation();
      }
    });
  }

  generateTrial() {
    this.setupTrial();
    this.runEntireTrial();
  }

  setupTrial() {
    worldObjects.cups[0].material = this.material;
    worldObjects.cups[0].liquid_temperature =
      convertTempTextToTempNum(this.beverageTempText);
    worldObjects.air.temperature = convertTempTextToTempNum(this.airTempText);
    world.ticks = 0;
    resetThermometers();
    initWorld();
  }


  runEntireTrial() {
    while (true) {
      this.updateTemperatures();
      this.recordTemperatures();
      world.ticks++;
      let worldCopy = {
        heatShape: world.heatShape,
        voxels: $.extend(true, [], world.voxels)
      };
      worldCopy.heatShape.parent = null;
      this.allWorldData.push(worldCopy);

      if (world.ticks >= worldSpecs.max_ticks) {
        return;
      }
    }
  }

  /**
   * Updates temperatures based on neighbors (above, below, left, right)
   * To make it function like NetLogo we need to shuffle the voxels
   */
  updateTemperatures () {
    const indexArray = shuffledIndexArray(world.voxels.length);
    for (let i = 0; i < world.voxels.length; i++) {
      const index = indexArray[i];
      const voxel = world.voxels[index];
      const x = voxel.x;
      const y = voxel.y;
      const my_temp = voxel.temperature;
      const my_con = voxel.conductivity;
      let netFlowOfEnergy = 0;
      const neighborIndices = [[x, y-1], [x+1, y],[x, y+1],[x-1, y]];
      for (let j = 0; j < neighborIndices.length; j++) {
        const neighbor = getVoxel(neighborIndices[j][0], neighborIndices[j][1]);
        if (neighbor != null) {
          const con = Math.min(neighbor.conductivity, my_con);
          netFlowOfEnergy += worldSpecs.flow_speed * con / framerate
            * (neighbor.temperature - my_temp) / worldSpecs.temperature_range;
        }
      }

      voxel.temperature += worldSpecs.flow_speed * netFlowOfEnergy;
      if (voxel.temperature < worldSpecs.temperature_min) {
        voxel.temperature = worldSpecs.temperature_min;
      } else if (voxel.temperature > worldSpecs.temperature_max) {
        voxel.temperature = worldSpecs.temperature_max;
      }
    }
  }

  recordTemperatures() {
    let seriesCount = 0;
    for (const thermometer of worldObjects.thermometers) {
      const voxel = getVoxel(thermometer.x, thermometer.y);
      thermometer.temperature = voxel.temperature;
      thermometer.text.text = voxel.temperature.toFixed(1) + " °C";
      if (thermometer.saveSeries != null && thermometer.saveSeries &&
        (world.ticks % 30 == 0)) {
        currentSimulation.data.push({x:world.ticks / worldSpecs.max_ticks * 60, y:voxel.temperature});
        seriesCount++;
      }
    }
  }

  showTrialIntialState() {
    this.showTrialAtTick(0);
  }

  createOutlineContainer() {
    let container = new createjs.Container();
    for (const cup of worldObjects.cups) {
      let topLeft = voxelToPixels(cup.x, cup.y+cup.height-1);

      // draw outlines to match cup color
      const outline = cup.outline = new createjs.Shape();
      const color = getCupMaterialColor(cup);
      outline.graphics.setStrokeStyle(1).beginStroke(color)
        .drawRect(topLeft.x0, topLeft.y0, cup.width*worldSpecs.voxel_width, cup.height*worldSpecs.voxel_height).endStroke();
      const iTopLeft = voxelToPixels(cup.x + cup.thickness, cup.y + cup.height - 1 - cup.thickness);
      outline.graphics.setStrokeStyle(1).beginStroke(color)
        .drawRect(iTopLeft.x0, iTopLeft.y0, (cup.width-2*cup.thickness)*worldSpecs.voxel_width, (cup.height-2*cup.thickness)*worldSpecs.voxel_height).endStroke();
      outline.cache(topLeft.x0 - 1, topLeft.y0 - 1, cup.width * worldSpecs.voxel_width + 2, cup.height * worldSpecs.voxel_height + 2);

      container.addChild(outline);
      let text = new createjs.Text("Cup", "12px Arial", "black");
      text.x = topLeft.x0 + cup.width*worldSpecs.voxel_width/2-10;
      text.y = topLeft.y0 + 5;
      container.addChild(text);

      topLeft = voxelToPixels(cup.x+cup.thickness, cup.y+cup.height-1-cup.thickness);
      text = new createjs.Text("Liquid", "12px Arial", "black");
      text.x = topLeft.x0 + (cup.width-2*cup.thickness)*worldSpecs.voxel_width/2-12;
      text.y = topLeft.y0 + (cup.height-cup.thickness)*worldSpecs.voxel_height/2-2;
      container.addChild(text);
    }
    return container;
  }

  createThermometerContainer() {
    let container = new createjs.Container();
    for (const thermometer of worldObjects.thermometers) {
      const shape = new createjs.Shape();
      const box = voxelToPixels(thermometer.x, thermometer.y);
      shape.graphics.setStrokeStyle(2).beginStroke(thermometer.color)
        .beginFill("white")
        .drawRoundRect(-box.width/4, -box.height/4, box.width/2, 50, 4)
        .endFill().endStroke();
      shape.graphics.setStrokeStyle(2).beginStroke(thermometer.color)
        .beginFill("white").drawCircle(0, 0, box.width/2).endFill().endStroke();
      shape.x = box.x0 + box.width/2;
      shape.y = box.y0 + box.height/2;
      shape.cache(-box.width/2 - 2, -box.height/2 - 2, box.width + 4, 56);
      shape.rotation = -135;
      container.addChild(shape);
      // setup textbox for temperature recording
      thermometer.text = new createjs.Text("99", "16px Arial", "black");
      thermometer.text.x = box.x0 + box.width + 9;
      thermometer.text.y = box.y0;
      container.addChild(thermometer.text);
    }
    return container;
  }
}


function getTrialId(material, bevTemperatureText, airTemperatureText) {
  return material + "-" + bevTemperatureText + "Bev" + "-" +
      airTemperatureText + "Air";
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

function convertTempTextToTempNum(temperatureText) {
  if (temperatureText == "Hot") {
    return 90;
  } else if (temperatureText == "Warm") {
    return 40;
  } else {
    return 5;
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
 * 0 degrees = white
 * 100 degrees = red
 * We use an exponential function so there can be a wider range for lower
 * temperatures (0->40) and ~50 will be pinkish.
 */
function tempToHSL(temperature) {
  let temp2Decimals = temperature.toFixed(2);
  if (tempToHSLValues[temp2Decimals] != null) {
    return tempToHSLValues[temp2Decimals];
  } else {
    const temp_frac = (temperature - worldSpecs.temperature_min)
      / worldSpecs.temperature_range;
    const hslValue = {
      h: 0,
      s: "100%",
      l: 100 - (65 * (temp_frac * temp_frac)) + "%"
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

function showModelStateFromEmbeddedGrid0(componentState) {
  const lastTrial = componentState.studentData
      .gridsSelected[componentState.studentData.gridsSelected.length - 1];

  if (currentSimulation == null || !currentSimulation.isCurrentSimulation(
      lastTrial.material, lastTrial.bevTemp, lastTrial.airTemp)) {
    showTrial(lastTrial.material, lastTrial.bevTemp, lastTrial.airTemp);
  }
}

function showModelStateFromEmbeddedGrid1(componentState) {
  let state = componentState.studentData.state;
  if (state.selectedTrialIds.length > 0) {
    let selectedTrialId = state.selectedTrialIds[state.selectedTrialIds.length - 1];
    let parameters = getParametersFromTrialId(selectedTrialId);
    let material = parameters.material;
    let bevTemp = parameters.bevTemp;
    let airTemp = parameters.airTemp;
    if (currentSimulation == null ||
        !currentSimulation.isCurrentSimulation(material, bevTemp, airTemp)) {
      let isCompleted = state[bevTemp][material].isCompleted;
      showTrial(material, bevTemp, airTemp, isCompleted);
    }
  }
}

function showModelStateFromEmbeddedGrid(componentState) {
  let selectedCells = componentState.studentData.selectedCells;
  let completedCells = componentState.studentData.completedCells;
  if (selectedCells.length > 0) {
    let selectedCell = selectedCells[selectedCells.length - 1];
    let material = selectedCell.material;
    let bevTemp = selectedCell.bevTemp;
    let airTemp = selectedCell.airTemp;
    if (currentSimulation == null ||
        !currentSimulation.isCurrentSimulation(material, bevTemp, airTemp)) {
      let isCompleted = isCellCompleted(completedCells, material, bevTemp, airTemp);
      showTrial(material, bevTemp, airTemp, isCompleted);
    }
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
  return worldObjects.materials[worldObjects.cups[0].material].stroke_color;
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
    //xPlotLine: tick * 2 / 30,
    //showTooltipOnX: tick * 2 / 30,
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
    studentData.showTooltipOnX = tickToHighlight * 2 / 30;
  } else {
    studentData.showTooltipOnX = tick * 2 / 30;
  }

  return studentData;
}


// listen for messages from the parent
window.addEventListener('message', receiveMessage);
