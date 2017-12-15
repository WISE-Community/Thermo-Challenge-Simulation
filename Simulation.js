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
    if (this.isCompleted) {
      this.WISE_onTick(870);
    } else {
      this.WISE_onTick(tick);
    }
  }

  WISE_onTick(tick) {
    if (tick % 30 === 0) {
      let studentData = getWorldState(tick);
      if (this.isCompleted) {
        studentData = getWorldState(870);
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
