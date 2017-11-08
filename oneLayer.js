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

let stage, world = null;

function init() {
  // initialize values
  worldSpecs.width_px = $("#canvas").width() - 100; // use 100 for the color map
  worldSpecs.height_px = $("#canvas").height()
  worldSpecs.width = worldSpecs.max_x - worldSpecs.min_x + 1;
  worldSpecs.height = worldSpecs.max_y - worldSpecs.min_y + 1;
  worldSpecs.voxel_width = worldSpecs.width_px / (worldSpecs.width);
  worldSpecs.voxel_height = worldSpecs.height_px / (worldSpecs.height);
  worldSpecs.temperature_range = worldSpecs.temperature_max - worldSpecs.temperature_min;
  worldSpecs.speedMult = 5;
  worldSpecs.tickArray = randomizedArrayOfTen(worldSpecs.speedMult);
  // setup ui elements
  $("#slider-speed").slider({
    orientation: "horizontal",
    range: "min",
    min: 0,
    max: 10,
    value: 5,
    step: 1,
    change: function (event, ui) {
      const key = event.target.id.replace("slider-","");
      worldSpecs.speedMult = ui.value;
      worldSpecs.tickArray = randomizedArrayOfTen(worldSpecs.speedMult);
      WISE_onchange('slide-change-'+key, event,ui);
    }
  });
  $("#button-run").button();
  $("#button-restart").button();
  for (const key in worldObjects.materials) {
    $("#select-material").append($('<option>', {id:"select-"+key, text:key}));
  }
  $("#select-material").selectmenu({
    change: function( event, ui ) {
      //console.log(event, ui)
      if (ui.item.index > 0) {
        worldObjects.cups[0].material = ui.item.label;
      } else {
        // first index is just instructions
        orldObjects.cups[0].material = "";
      }
      WISE_onchange('select-material-changed',event, ui);
      endTrial();
    },
    width:160
  });

  $("#select-bevTemp").selectmenu({
    change: function( event, ui ) {
      //console.log(event, ui)
      const regexp = /([0-9]+)/;
      if (ui.item.index > 0 && regexp.exec(ui.item.label) != null) {
        worldObjects.cups[0].liquid_temperature = parseInt(regexp.exec(ui.item.label)[1]);
      } else {
        worldObjects.cups[0].liquid_temperature = null;
      }
      WISE_onchange('select-bevTemp-changed',event, ui);
      endTrial();
    },
    width:160
  });

  $("#select-airTemp").selectmenu({
    change: function( event, ui ) {
      //console.log(event, ui)
      const regexp = /([0-9]+)/;
      if (ui.item.index > 0 && regexp.exec(ui.item.label) != null) {
        worldObjects.air.temperature = parseInt(regexp.exec(ui.item.label)[1]);
      } else {
        worldObjects.air.temperature = null;
      }
      WISE_onchange('select-airTemp-changed',event, ui);
      endTrial();
    },
    width:160
  });

  $( "#dialog" ).dialog({ autoOpen: false, position:{my:"left bottom", at:"left bottom", of: "#canvas"} });

  // setup easeljs
  const canvas = $("#canvas");
  stage = new createjs.Stage(canvas[0]);
  initWorld();
  // draw a colormap on the right of the world
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
    const col = "hsl(" + hsl.h + "," + hsl.s + "," + hsl.l + ")"
    const height_px = colorMap.shape.height_px / (worldSpecs.temperature_range+1)
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

  createjs.Ticker.framerate = 120;
  createjs.Ticker.addEventListener("tick", tick);

  initCanvasDisplay();
  initCupControlDisplay();
  initLiquidControlDisplay();
  initAirControlDisplay();
}

/** Function returns a blank world where each voxel is set to initial conditions */
function initWorld() {
  if (world == null) {
    world = new createjs.Container();
    world.shape = new createjs.Shape();
    world.addChild(world.shape);
    world.heatShape = new createjs.Shape();
    world.addChild(world.heatShape);

    //setup outlines
    for (let i = 0; i < worldObjects.cups.length; i++) {
      const cup = worldObjects.cups[i];
      let topleft = voxelToPixels(cup.x, cup.y+cup.height-1);
      const outline = cup.outline = new createjs.Shape();
      world.addChild(outline);
      let text = new createjs.Text("Cup", "12px Arial", "black");
      text.x = topleft.x0 + cup.width*worldSpecs.voxel_width/2-10;
      text.y = topleft.y0 + 5;// + box.height/2;
      world.addChild(text);

      topleft = voxelToPixels(cup.x+cup.thickness, cup.y+cup.height-1-1*cup.thickness);
      text = new createjs.Text("Liquid", "12px Arial", "black");
      text.x = topleft.x0 + (cup.width-2*cup.thickness)*worldSpecs.voxel_width/2-12;
      text.y = topleft.y0 + (cup.height-1*cup.thickness)*worldSpecs.voxel_height/2-2;// + box.height/2;
      world.addChild(text);
    }

    // draw thermometers
    for (let i = 0; i < worldObjects.thermometers.length; i++) {
      const thermometer = worldObjects.thermometers[i];
      const shape = new createjs.Shape();
      const box = voxelToPixels(thermometer.x, thermometer.y);
      shape.graphics.setStrokeStyle(2).beginStroke(thermometer.color).beginFill("white").drawRoundRect(-box.width/4,-box.height/4,box.width/2,50,4).endFill().endStroke();
      shape.graphics.setStrokeStyle(2).beginStroke(thermometer.color).beginFill("white").drawCircle(0,0,box.width/2).endFill().endStroke();
      shape.x = box.x0 + box.width/2;
      shape.y = box.y0 + box.height/2;
      shape.cache(-box.width/2-2,-box.height/2-2,box.width+4,56);
      shape.rotation = -135;
      world.addChild(shape);
      // setup textbox for temperature recording
      thermometer.text = new createjs.Text("99", "16px Arial", "black");
      thermometer.text.x = box.x0 + box.width + 9;
      thermometer.text.y = box.y0;// + box.height/2;
      world.addChild(thermometer.text);
    }

    stage.addChild(world);
  } else {
    world.shape.graphics.clear();
    world.heatShape.graphics.clear();
  }

  world.voxels = [];
  // first assume everything is air
  for (let x = worldSpecs.min_x; x <= worldSpecs.max_x; x++) {
    for (let y = worldSpecs.min_y; y <= worldSpecs.max_y; y++) {
      world.voxels.push({x:x, y:y, temperature:worldObjects.air.temperature, conductivity:worldObjects.air.conductivity, type:"air", update:true, color:worldObjects.air.color});
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
      for (x = cup.x; x < cup.x+cup.width; x++) {
        for (y = cup.y; y < cup.y+cup.height; y++) {
          const voxel = getVoxel(x, y);
          voxel.temperature = worldObjects.air.temperature; //cup.material_temperature;
          voxel.conductivity = worldObjects.materials[cup.material].conductivity;
          voxel.color = worldObjects.materials[cup.material].color;
          voxel.type = "material-" + i;
          const box = voxelToPixels(x, y);
          world.shape.graphics.beginFill(voxel.color).drawRect(box.x0, box.y0, box.width, box.height).endFill();
        }
      }
      if (cup.liquid_temperature != null) {
        // now update for liquid
        for (x = cup.x+cup.thickness; x < cup.x+cup.width-cup.thickness; x++) {
          for (y = cup.y+cup.thickness; y < cup.y+cup.height-cup.thickness; y++) {
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

  // draw outlines to match cup color
  for (let i = 0; i < worldObjects.cups.length; i++) {
    const cup = worldObjects.cups[i];
    const topleft = voxelToPixels(cup.x, cup.y+cup.height-1);
    const outline = cup.outline;
    const color = cup.material != null && cup.material.length > 0 ? (worldObjects.materials[cup.material].stroke_color != null ? worldObjects.materials[cup.material].stroke_color: worldObjects.materials[cup.material].color) : "#444444";
    outline.graphics.clear().setStrokeStyle(1).beginStroke(color).drawRect(topleft.x0, topleft.y0, cup.width*worldSpecs.voxel_width, cup.height*worldSpecs.voxel_height).endStroke();

    const itopleft = voxelToPixels(cup.x+cup.thickness, cup.y+cup.height-1-1*cup.thickness);
    //outline = new createjs.Shape();
    outline.graphics.setStrokeStyle(1).beginStroke(color).drawRect(itopleft.x0, itopleft.y0, (cup.width-2*cup.thickness)*worldSpecs.voxel_width,  (cup.height-2*cup.thickness)*worldSpecs.voxel_height).endStroke();
    outline.cache(topleft.x0-1, topleft.y0-1, cup.width*worldSpecs.voxel_width+2, cup.height*worldSpecs.voxel_height+2);
    //outline.cache(topleft.x0-1, topleft.y0-1, (cup.width-2*cup.thickness)*worldSpecs.voxel_width+2,  (cup.height-2*cup.thickness)*worldSpecs.voxel_height+2);
    //world.addChild(outline);
  }

  // update temperature on thermometers
  for (let i = 0; i < worldObjects.thermometers.length; i++) {
    const thermometer = worldObjects.thermometers[i];
    const voxel = getVoxel(thermometer.x, thermometer.y);
    thermometer.text.text = voxel.temperature == null ? "" : voxel.temperature + " °C";
  }

  world.isRunning = false;
  world.isPaused = false;
  // set default button values
  $("#button-run").button('option', 'label', 'Run');
  $("#button-restart").button('option', 'label', 'Restart');
  stage.needs_to_update = true;
  return world;
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
    //if (x == worldObjects.thermometers[1].x && y == worldObjects.thermometers[1].y) {
    //  debugger;
    //}
    const my_temp = voxel.temperature;
    const my_con = voxel.conductivity;
    let q = 0 // this will be the net flow of energy
    const neighborIndices = [[x, y-1], [x+1,y],[x, y+1],[x-1, y]];
    for (let j = 0; j < neighborIndices.length; j++) {
      const neighbor = getVoxel(neighborIndices[j][0], neighborIndices[j][1]);
      if (neighbor != null) {
        const con = Math.min(neighbor.conductivity, my_con);
        q += worldSpecs.flow_speed * con / createjs.Ticker.framerate * (neighbor.temperature - my_temp) / worldSpecs.temperature_range;
        //q += con / 30 * (neighbor.temperature - my_temp) / worldSpecs.temperature_range;
      }
    }

    voxel.temperature += worldSpecs.flow_speed * q;
    if (voxel.temperature < worldSpecs.temperature_min) {
      voxel.temperature = worldSpecs.temperature_min;
    } else if (voxel.temperature > worldSpecs.temperature_max) {
      voxel.temperature = worldSpecs.temperature_max;
    }
    if (my_temp != voxel.temperature) {
      voxel.update = true;
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
  let seriesCount = 0;
  for (let i = 0; i < worldObjects.thermometers.length; i++) {
    const thermometer = worldObjects.thermometers[i];
    const voxel = getVoxel(thermometer.x, thermometer.y);
    thermometer.temperature = voxel.temperature;
    thermometer.text.text = voxel.temperature.toFixed(1) + " °C";
    if (thermometer.saveSeries != null && thermometer.saveSeries &&
      (world.ticks % 30 == 0)) {
      worldSpecs.series[seriesCount].data.push({x:world.ticks / worldSpecs.max_ticks * 60, y:voxel.temperature});
      //worldSpecs.series[seriesCount].data.push([world.ticks, voxel.temperature]);
      seriesCount++;
    }
    //console.log("Thermometer at", thermometer.x, thermometer.y, ":",voxel.temperature, "(",voxel.type,")");
  }
}

function startTrial() {
  // reset thermometers
  let seriesCount = 0;
  worldSpecs.series = [];
  worldSpecs.timestamp = new Date();
  for (let i = 0; i < worldObjects.thermometers.length; i++) {
    const thermometer = worldObjects.thermometers[i];
    const voxel = getVoxel(thermometer.x, thermometer.y);
    thermometer.text.text = "";
    // if a 'series' field exists set up to save data
    if (thermometer.saveSeries != null && thermometer.saveSeries) {
      const series = {data:[]};
      // label should be material-TempBev-TempAir
      const mat = $("#select-material option:selected").text();
      const bev = /^([a-zA-Z]+)/.exec($("#select-bevTemp option:selected").text())[1];
      const air = /^([a-zA-Z]+)/.exec($("#select-airTemp option:selected").text())[1];
      const name = mat +"-"+bev+"Bev"+"-"+air+"Air";
      if (seriesCount > 0) {
        name = name + "-" + seriesCount;
      }
      series.name = name;
      series.color = worldObjects.materials[mat].stroke_color != null ? worldObjects.materials[mat].stroke_color : worldObjects.materials[mat].color ;
      series.id = new Date().getTime();
      worldSpecs.series.push(series);
      seriesCount++;
      worldSpecs.trialId = new Date().getTime()
    }
  }
  world.isRunning = true;
  world.ticks = 0;
}

/** Will initialize (reset) world. If in a trial will save state to Wise5*/
function endTrial() {
  if (world.isRunning) {
    const endtime = new Date();
    console.log("Time Running", Math.abs(endtime.getTime() - worldSpecs.timestamp.getTime()));
    //console.log(worldObjects.thermometers);
    const state = {};
    state.messageType = "studentWork";
    state.isAutoSave = false;
    state.isSubmit = false;
    state.studentData = getWorldState();
    WISE_saveState(state);
  }
  initWorld();
}

function redraw() {
  if (world != null && world.isRunning && !world.isPaused) {
    world.heatShape.graphics.clear();
    // redraw all empty voxels (that need an update) according to temperature
    for (let i = 0; i < world.voxels.length; i++) {
      const voxel = world.voxels[i];
      const hsl = tempToHSL(voxel.temperature);
      voxel.heat_color = "hsla("+hsl.h+", "+hsl.s+", "+hsl.l+", 1.0)";
      voxel.stroke_color = "hsla("+hsl.h+", 50%, "+hsl.l+", 1.0)";
      const box = voxelToPixels(voxel.x, voxel.y);
      world.heatShape.graphics.setStrokeStyle(0.5).beginStroke(voxel.stroke_color).beginFill(voxel.heat_color).drawRect(box.x0, box.y0, box.width, box.height).endFill().endStroke();
      voxel.update = false;
    }
  }
}

/** We normally progress on each call of tick, but with the speed multiplier we will only do so
 on some ticks
 Basically, for example, if we set the speed multiplier 0.4, than on 4 out of 10 ticks we should advance
 and the rest of the time we should not do anything.
 */
function tick() {
  if (world != null && world.isRunning && !world.isPaused) {
    if (worldSpecs.tickArray.length == 0) {
      worldSpecs.tickArray = randomizedArrayOfTen(worldSpecs.speedMult);
    }
    const canTick = worldSpecs.tickArray.splice(0, 1)[0];
    if (canTick == 1) {
      updateTemperatures();
      recordTemperatures();
      world.ticks ++;
      stage.needs_to_update = world.ticks % 2 == 0;
      if (world.ticks >= worldSpecs.max_ticks) {
        endTrial();
      } else {
        const state = {};
        state.messageType = "studentDataChanged";
        state.isAutoSave = false;
        state.isSubmit = false;
        state.studentData = getWorldState();
        WISE_ontick(state);
      }
    }
  }
  if (stage != null && stage.needs_to_update) {
    redraw();
    stage.update();
    stage.needs_to_update = false;
  }
}

////////////////// UTILITY FUNCTIONS
/* When given the x and y coordinate of a voxel, returns the bounding box information for the canvas
   {x0, y0, x1, y1, width, height}
  */
function voxelToPixels(x, y) {
  if (x >= worldSpecs.min_x && x <= worldSpecs.max_x && y >= worldSpecs.min_y && y <= worldSpecs.max_y) {
    const box = {
      x0: worldSpecs.width_px / 2 + x * worldSpecs.voxel_width - worldSpecs.voxel_width/2,
      y0: worldSpecs.height_px / 2 - y * worldSpecs.voxel_height - worldSpecs.voxel_height/2,
      x1: worldSpecs.width_px / 2 + x * worldSpecs.voxel_width + worldSpecs.voxel_width/2,
      y1: worldSpecs.height_px / 2 - y * worldSpecs.voxel_height + worldSpecs.voxel_height/2,
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
  return world != null ? world.voxels[getVoxelIndex(vx, vy)] : null;
}

function tempToHSL(temperature) {
  const temp_frac = (temperature - worldSpecs.temperature_min) / worldSpecs.temperature_range;
  //const h = 120 - temp_frac * 120;
  //if (h > 90) h = (h-90)+180;
  const hsl = {};
  if (temp_frac < 0.5) {
    hsl.h = 225;
    hsl.s = "100%";
    hsl.l = (0.5 + temp_frac) * 100 + "%";
  } else {
    hsl.h = 0;
    hsl.s = "100%";
    hsl.l = (0.5 + (1 - temp_frac)) * 100 + "%";
  }
  return hsl;
}

function randomizedArrayOfTen(numOnes) {
  const arr1 = Array(numOnes).fill(1);
  const arr0 = Array(10-numOnes).fill(0);
  const arr = arr1.concat(arr0);
  return fisherYates(arr);
}

function fisherYates( array ) {
  let count = array.length, randomnumber, temp;
  while( count ) {
    randomnumber = Math.random() * count-- | 0;
    temp = array[count];
    array[count] = array[randomnumber];
    array[randomnumber] = temp
  }
  return array;
}

/////////////////////////////////////////////// BUTTON INTERACTIONS ///////////////////////////////////////////////
function run() {
  if (world != null) {
    if (!world.isRunning) {
      // make sure everything is set
      if (worldObjects.cups[0].material != null && worldObjects.cups[0].material.length > 0 && worldObjects.cups[0].liquid_temperature != null && worldObjects.cups[0].material_temperature != null && worldObjects.air.temperature != null) {
        $("#button-run").button('option', 'label', 'Pause');
        startTrial();
      } else {
        $("#dialog").dialog("open");
      }
    } else {
      if (world.isPaused) {
        world.isPaused = false;
        $("#button-run").button('option', 'label', 'Pause');
      } else {
        world.isPaused = true;
        $("#button-run").button('option', 'label', 'Run');
      }
    }
  }
}

function restart() {
  if (world != null && world.isRunning) {
    endTrial();
  }
}

function getWorldState() {
  const state = {
    "ticks": world.ticks,
    "material0": worldObjects.cups[0].material,
    "material0_initial_temperature": worldObjects.cups[0].material_temperature,
    "liquid_initial_temperature": worldObjects.cups[0].liquid_initial_temperature,
    "air_initial_temperature":worldObjects.air.temperature,
    "trial": {
      "id": worldSpecs.trialId,
      "name": worldSpecs.series[0].name,
      "series": worldSpecs.series
    }
  };

  for (let i = 0; i < worldObjects.thermometers.length; i++) {
    const thermometer = worldObjects.thermometers[i];
    state['thermometer'+i+"-temperature"] = thermometer.temperature.toFixed(1);
  }
  //console.log(state['trial'].series[0].data.length);
  //state.trials = worldSpecs.series;

  return state;
}

function WISE_onclick(fun, event) {
  if (typeof window[fun] !== "undefined") window[fun](event);

  if (parent != null && parent.postMessage != null) {
    event.timestamp = new Date().getTime();
    try {
      parent.postMessage(event, "*");
    } catch(err) {
      console.log("not posted");
    }
  }
}

/** Item should have a field called "label" to get name of change */
function WISE_onchange(fun, event, ui) {
  if (parent != null && parent.postMessage != null) {
    event.timestamp = new Date().getTime();
    try {
      parent.postMessage(event, "*");
    } catch(err) {
      console.log("not posted");
    }
  }
}

function WISE_saveState(componentState) {
  if (parent != null && parent.postMessage != null) {
    componentState.timestamp = new Date().getTime();
    try {
      parent.postMessage(componentState, "*");
    } catch(err) {
      console.log("not posted");
    }
  }
}

function WISE_ontick(componentState) {
  if (parent != null && parent.postMessage != null) {
    componentState.timestamp = new Date().getTime();
    try {
      parent.postMessage(componentState, "*");
    } catch(err) {
      console.log("not posted");
    }
  }
}

function initCanvasDisplay() {
  if (isHideCanvas()) {
    $("#canvas").hide();
  }
}

function initCupControlDisplay() {
  if (isControlDisplayedAndEditable("cupControl")) {
    $("#select-material").selectmenu("enable");
  } else if (isControlDisplayedAndNotEditable("cupControl")) {
    $("#select-material").selectmenu("disable");
  } else if (isControlHidden("cupControl")) {
    $("#cupMaterial").hide();
  }
}

function initLiquidControlDisplay() {
  if (isControlDisplayedAndEditable("liquidControl")) {
    $("#select-bevTemp").selectmenu("enable");
  } else if (isControlDisplayedAndNotEditable("liquidControl")) {
    $("#select-bevTemp").selectmenu("disable");
  } else if (isControlHidden("liquidControl")) {
    $("#liquidTemperature").hide();
  }
}

function initAirControlDisplay() {
  if (isControlDisplayedAndEditable("airControl")) {
    $("#select-airTemp").selectmenu("enable");
  } else if (isControlDisplayedAndNotEditable("airControl")) {
    $("#select-airTemp").selectmenu("disable");
  } else if (isControlHidden("airControl")) {
    $("#airTemperature").hide();
  }
}
