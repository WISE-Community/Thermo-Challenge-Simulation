// world specs allow us to translate from canvas pixels to world voxels [voxels heretofore represent world units]
const worldSpecs = {
  min_x: -10,
  max_x: 10,
  min_y: -15,
  max_y: 15,
  temperature_min: 0,
  temperature_max: 100,
  flow_speed: 4,
  max_ticks:30 * 30,
  series:[],
  trialId: null
};

// world objects include thermometers and cups
// thermometers should have structure: x, y (voxel at which temp is collected), color
// if a thermometer has a 'series' field, will save data
// cups should have structure: x, y (top-left,top-right), width, height (voxels), thickness ( of wall in voxels)
const worldObjects = {
  thermometers:[
    {x:0, y:-1, color:"#00FF00", saveSeries:true},
    {x:0, y:7, color:"#FF00DD"}
  ],
  cups: [
    {x: -6, y: -8, width: 13, height: 13, thickness:3, liquid:"Water", material:"", liquid_temperature:null, material_temperature:25}
  ],
  air: {
    temperature:null,
    conductivity:100,
    color:"#FFEECC"
  },
  liquids: {
    "Water":{
      conductivity:100,
      color:"rgba(220,220,250,0.7)"
    }
  },
  materials: {
    "Aluminum":{
      conductivity: 200,
      color:"#AAAAAA",
      stroke_color:"#888888"
    },
    "Wood":{
      conductivity: 10,
      color:"#996622",
      stroke_color:"#774400"
    },
    "Styrofoam":{
      conductivity: 1,
      color:"#FFFFFF",
      stroke_color:"#DDDDDD"
    },
    "Clay":{
      conductivity: 20,
      color:"#FF8844",
      stroke_color:"#DD6622"
    },
    "Glass":{
      conductivity: 40,
      color:"rgba(150,200,180,0.5)",
      stroke_color:"rgba(100,150,130,0.8)"
    },
    "Plastic":{
      conductivity: 20,
      color:"#FF33AA",
      stroke_color:"#DD1188"
    }
  }
};

let stage = null;
let world = null;
let allTrialsWorlds = {};
let currentTrialWorlds = [];
let framerate = 120;

function init() {
  initializeValues();
  stage = new createjs.Stage($("#canvas")[0]);
  initWorld();
  initTemperatureColorLegend(stage);
}

function initTemperatureColorLegend(stage) {
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
    colorMap.shape.graphics.beginFill(col).drawRect(20, 60 + (worldSpecs.temperature_max - t) * height_px, colorMap.shape.width_px, height_px).endFill();

    if (t % 20 == 0) {
      const text = new createjs.Text(t+ " °C", "14px Arial", "#008833");
      text.x = 20 + colorMap.shape.width_px + 4;
      text.y = 60 + (worldSpecs.temperature_max - t) * height_px - 6;
      colorMap.addChild(text);
    }
  }
  colorMap.shape.cache(20, 60, colorMap.shape.width_px, colorMap.shape.height_px);
  colorMap.x = worldSpecs.width_px + 5;
  colorMap.y = 5;
  stage.addChild(colorMap);
}

function initializeValues() {
  worldSpecs.width_px = $("#canvas").width() - 100;
  worldSpecs.height_px = $("#canvas").height();
  worldSpecs.width = worldSpecs.max_x - worldSpecs.min_x + 1;
  worldSpecs.height = worldSpecs.max_y - worldSpecs.min_y + 1;
  worldSpecs.voxel_width = worldSpecs.width_px / (worldSpecs.width);
  worldSpecs.voxel_height = worldSpecs.height_px / (worldSpecs.height);
  worldSpecs.temperature_range = worldSpecs.temperature_max - worldSpecs.temperature_min;
}

/** Function returns a blank world where each voxel is set to initial conditions */
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
      world.voxels.push({x:x, y:y, temperature:worldObjects.air.temperature, conductivity:worldObjects.air.conductivity, type:"air", color:worldObjects.air.color});
      const box = voxelToPixels(x, y);
      if (worldObjects.air.temperature != null) {
        world.shape.graphics.beginFill(worldObjects.air.color).drawRect(box.x0, box.y0, box.width, box.height).endFill();
      }
    }
  }

  for (let i = 0; i < worldObjects.cups.length; i++) {
    const cup = worldObjects.cups[i];
    // only draw if the material is selected
    if (cup.material != null && cup.material.length > 0) {
      // now update for cup materials (this will be a bit redundant because we are updating the liquid area twice, but not too bad)
      for (let x = cup.x; x < (cup.x + cup.width); x++) {
        for (let y = cup.y; y < (cup.y + cup.height); y++) {
          const voxel = getVoxel(x, y);
          voxel.temperature = worldObjects.air.temperature;
          voxel.conductivity = worldObjects.materials[cup.material].conductivity;
          voxel.color = worldObjects.materials[cup.material].color;
          voxel.type = "material-" + i;
          const box = voxelToPixels(x, y);
          world.shape.graphics.beginFill(voxel.color).drawRect(box.x0, box.y0, box.width, box.height).endFill();
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
            world.shape.graphics.beginFill(voxel.color).drawRect(box.x0, box.y0, box.width, box.height).endFill();
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
    thermometer.text.text = voxel.temperature == null ? "" : voxel.temperature + " °C";
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
    const color = cup.material != null && cup.material.length > 0 ? (worldObjects.materials[cup.material].stroke_color != null ? worldObjects.materials[cup.material].stroke_color: worldObjects.materials[cup.material].color) : "#444444";
    outline.graphics.clear().setStrokeStyle(1).beginStroke(color).drawRect(topLeft.x0, topLeft.y0, cup.width*worldSpecs.voxel_width, cup.height*worldSpecs.voxel_height).endStroke();

    const iTopLeft = voxelToPixels(cup.x + cup.thickness, cup.y + cup.height - 1 - cup.thickness);
    outline.graphics.setStrokeStyle(1).beginStroke(color).drawRect(iTopLeft.x0, iTopLeft.y0, (cup.width-2*cup.thickness)*worldSpecs.voxel_width,  (cup.height-2*cup.thickness)*worldSpecs.voxel_height).endStroke();
    outline.cache(topLeft.x0 - 1, topLeft.y0 - 1, cup.width * worldSpecs.voxel_width + 2, cup.height * worldSpecs.voxel_height + 2);
  }
}

function initializeThermometers(world) {
  for (const thermometer of worldObjects.thermometers) {
    const shape = new createjs.Shape();
    const box = voxelToPixels(thermometer.x, thermometer.y);
    shape.graphics.setStrokeStyle(2).beginStroke(thermometer.color)
        .beginFill("white").drawRoundRect(-box.width/4, -box.height/4, box.width/2, 50, 4).endFill().endStroke();
    shape.graphics.setStrokeStyle(2).beginStroke(thermometer.color).beginFill("white")
        .drawCircle(0, 0, box.width/2).endFill().endStroke();
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


/**
 * Entry point to application
 * @param material values are in worldObjects.material:  "Aluminum", "Wood", "Clay", "Plastic", "Styrofoam"
 * @param beverageTemperatureText starting beverage temperature: "Hot", "Warm", "Cold"
 * @param airTemperatureText starting air temperature: "Hot", "Warm", "Cold"
 */
function showTrial(material, beverageTemperatureText, airTemperatureText) {
  let trialId = getTrialId(material, beverageTemperatureText, airTemperatureText);
  if (!trialAlreadyExists(trialId)) {
    generateTrial(material, beverageTemperatureText, airTemperatureText);
  }
  showTrialRenderingBox(trialId);
  showTrialIntialState(trialId);
}

function generateTrial(material, beverageTemperatureText, airTemperatureText) {
  setupTrial(material, beverageTemperatureText, airTemperatureText);
  runEntireTrial(material, beverageTemperatureText, airTemperatureText);
}

function setupTrial(material, bevTemperature, airTemperature) {
  worldObjects.cups[0].material = material;
  worldObjects.cups[0].liquid_temperature = convertTempTextToTempNum(bevTemperature);
  worldObjects.air.temperature = convertTempTextToTempNum(airTemperature);
  world.ticks = 0;
  currentTrialWorlds = [];
  resetThermometers();
  initWorld();
}

function runEntireTrial(material, beverageTemperatureText, airTemperatureText) {
  let trialId = getTrialId(material, beverageTemperatureText, airTemperatureText);
  while (true) {
    updateTemperatures();
    recordTemperatures();
    world.ticks++;
    let worldCopy = {
      heatShape: world.heatShape,
      voxels: $.extend(true, [], world.voxels)
    };
    worldCopy.heatShape.parent = null;
    currentTrialWorlds.push(worldCopy);

    if (world.ticks >= worldSpecs.max_ticks) {
      allTrialsWorlds[trialId] = currentTrialWorlds;
      return;
    }
  }
}

/** This function applies updates temperatures based on neighbors (above, below, left, right)
 **  To make it function like NetLogo we need to shuffle the voxels
 */
function updateTemperatures () {
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
        netFlowOfEnergy += worldSpecs.flow_speed * con / framerate * (neighbor.temperature - my_temp) / worldSpecs.temperature_range;
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

function recordTemperatures() {
  for (const thermometer of worldObjects.thermometers) {
    const voxel = getVoxel(thermometer.x, thermometer.y);
    thermometer.temperature = voxel.temperature;
    thermometer.text.text = voxel.temperature.toFixed(1) + " °C";
  }
}

function showTrialRenderingBox(trialId) {
  $("#trial").empty();
  $("#trial").append('<h2>' + trialId + '</h2>');
  $("#trial").append('<div><canvas id="canvas_' + trialId + '" width="310" height="310" style="background-color:#eeeeef"></canvas></div>');
  $("#trial").append('<input id="showWorldsSlider_' + trialId + '" style="width:400px" type="range" min="0" max="300" step="1" value="0"/>');

  $("#showWorldsSlider_" + trialId).attr("max", allTrialsWorlds[trialId].length - 1);
  $("#showWorldsSlider_" + trialId).on("input change", function() {
    let tickLocation = $(this).val();
    showTrialAtTick(trialId, tickLocation);
  });
}

function showTrialIntialState(trialId) {
  showTrialAtTick(trialId, 0);
}

function showTrialAtTick(trialId, tick) {
  let worldData = allTrialsWorlds[trialId][tick];
  let stage = new createjs.Stage($("#canvas_" + trialId)[0]);
  let world = new createjs.Container();
  world.heatShape = worldData.heatShape;
  world.addChild(worldData.heatShape);
  initializeOutlines(world);
  initializeThermometers(world);
  initTemperatureColorLegend(stage);
  drawLiquidAndCupBorders();
  stage.addChild(world);

  worldData.heatShape.graphics.clear();
  for (const voxel of worldData.voxels) {
    const hsl = tempToHSL(voxel.temperature);
    voxel.heat_color = "hsla(" + hsl.h + ", " + hsl.s + ", " + hsl.l + ", 1.0)";
    voxel.stroke_color = "hsla(" + hsl.h + ", 50%, " + hsl.l + ", 1.0)";
    const box = voxelToPixels(voxel.x, voxel.y);
    worldData.heatShape.graphics.setStrokeStyle(0.5).beginStroke(voxel.stroke_color).beginFill(voxel.heat_color).drawRect(box.x0, box.y0, box.width, box.height).endFill().endStroke();
  }

  for (const thermometer of worldObjects.thermometers) {
    const voxel = worldData.voxels[getVoxelIndex(thermometer.x, thermometer.y)];
    thermometer.temperature = voxel.temperature;
    thermometer.text.text = voxel.temperature.toFixed(1) + " °C";
  }
  stage.update();
}

function getTrialId(material, bevTemperatureText, airTemperatureText) {
  return material + "-" + bevTemperatureText + "Bev" + "-" + airTemperatureText + "Air";
}

function trialAlreadyExists(trialId) {
  return allTrialsWorlds[trialId] != null;
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

////////////////// UTILITY FUNCTIONS
/* When given the x and y coordinate of a voxel, returns the bounding box information for the canvas
   {x0, y0, x1, y1, width, height}
  */
function voxelToPixels(x, y) {
  if (x >= worldSpecs.min_x && x <= worldSpecs.max_x && y >= worldSpecs.min_y && y <= worldSpecs.max_y) {
    const box = {
      x0: worldSpecs.width_px/2 + worldSpecs.voxel_width*x - worldSpecs.voxel_width/2,
      y0: worldSpecs.height_px/2 - worldSpecs.voxel_height*y - worldSpecs.voxel_height/2,
      x1: worldSpecs.width_px/2 + worldSpecs.voxel_width*x + worldSpecs.voxel_width/2,
      y1: worldSpecs.height_px/2 - worldSpecs.voxel_height*y + worldSpecs.voxel_height/2,
      width: worldSpecs.voxel_width,
      height: worldSpecs.voxel_height
    };
    return box;
  } else {
    return null;
  }
}

/** Given the x, y coordinates of the voxel, retrieve the appropriate voxel from the array */
function getVoxelIndex (vx, vy) {
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
 */
function tempToHSL(temperature) {
  const temp_frac = (temperature - worldSpecs.temperature_min) / worldSpecs.temperature_range;
  return {
    h: 0,
    s: "100%",
    l: 100 - (50 * temp_frac) + "%"
  };
}
