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
    this.thermometerLegendStage;
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
        currentSimulation.pauseSimulation();
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
    $("#timePlaying_" + this.trialId).html(minutesPlayed + " min");
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

    this.showThermometerReadings(worldData);
    this.currentStage.update();
    this.ticksPlayed.push(tick);
    if (tick >= 870) {
      this.isCompleted = true;
    }
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
    const cup = worldObjects.cups[0];
    const color = getCupMaterialColor(cup);
    $("#trial").empty();
    $("#trial").append(
      `<div class="controls">
        <input id="playPauseWorld_${this.trialId}" class="play" type="button" value="Play"/>
        <input id="showWorldsSlider_${this.trialId}" class="timeline" type="range" min="0" max="300" step="1" value="0"/>
        <div id="timePlaying_${this.trialId}" class="time"></div>
      </div>
      <div class="model">
        <h2 class="title" style="color: ${color};">${this.material} Cup / ${this.beverageTempText} Liquid</h2>
        <span class="model__label model__label--air">Air</span>
        <span class="model__label model__label--cup" style="color: ${color};">Cup</span>
        <span class="model__label model__label--liquid">Liquid</span>
        <canvas id="canvas_${this.trialId}" width="200" height="310" style="background-color:#eeeeef"></canvas>
        <canvas id="thermometerLegend" width="200" height="310" style="background-color:#eeeeef"></canvas>
      </div>`
    );

    this.showTime();
    this.showThermometerLegend();
    this.currentStage = new createjs.Stage($(`#canvas_${this.trialId}`)[0]);
    this.currentHeatShape = new createjs.Shape();
    this.currentHeatShape.graphics.setStrokeStyle(0.5);
    this.currentStage.addChild(this.currentHeatShape);
    this.outlineContainer = this.showCupOutline();
    this.currentStage.addChild(this.outlineContainer);

    $(`#showWorldsSlider_${this.trialId}`).attr("max", 899);
    $(`#showWorldsSlider_${this.trialId}`).on("input", function() {
      let tickLocation = $(this).val();
      currentSimulation.showTrialAtTick(tickLocation);
      currentSimulation.currentTick = tickLocation;
      currentSimulation.showTime();
      if (!currentSimulation.isSimulationPlaying()) {
        currentSimulation.WISE_onTick(getClosestTickTo30(tickLocation));
      }
    });
    $(`#playPauseWorld_${this.trialId}`).on("click", function() {
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

  showThermometerLegend() {
    this.thermometerLegendStage = new createjs.Stage($("#thermometerLegend")[0]);
    this.addLiquidTemperatureLabel();
    this.addLiquidTemperatureHeatMap();
    this.addLiquidTemperatureGaugeLine();
    this.addLiquidTemperatureGaugeLabel();
    this.addTemperatureLegendLabels();
    this.addAirTemperatureLabel();
    this.addAirTemperatureHeatMap();
    this.addAirTemperatureGaugeLine();
    this.addAirTemperatureGaugeLabel();
    this.thermometerLegendStage.update();
  }

  addLiquidTemperatureLabel() {
    const text = new createjs.Text("Liquid Temp", "13px Arial", "#000000");
    text.x = 60;
    text.y = 10;
    text.textAlign = 'center';
    this.thermometerLegendStage.addChild(text);
  }

  addLiquidTemperatureHeatMap() {
    const heatMapShape = this.createHeatMap();
    heatMapShape.x = 30;
    heatMapShape.y = 5;
    heatMapShape.name = "liquidTempHeatMap";
    this.thermometerLegendStage.addChild(heatMapShape);
  }

  addLiquidTemperatureGaugeLine() {
    const gaugeLine = new createjs.Shape();
    gaugeLine.name = "liquidTempGaugeLine";
    gaugeLine.x = 20;
    gaugeLine.y = 70;
    const col = "hsl(0, 100%, 0%)";
    const line_height_px = 5;
    const line_width_px = 40;
    gaugeLine.graphics.beginFill(col)
      .drawRect(20, line_height_px, line_width_px, line_height_px).endFill();
    this.thermometerLegendStage.addChild(gaugeLine);
  }

  addLiquidTemperatureGaugeLabel() {
    const gaugeLabel = new createjs.Text("liquid temp", "14px Arial", "#000000");
    gaugeLabel.name = "liquidTempGaugeLabel";
    gaugeLabel.x = 35;
    gaugeLabel.y = 70;
    gaugeLabel.textAlign = "right";
    this.thermometerLegendStage.addChild(gaugeLabel);
  }

  updateLiquidTemperatureGaugeLabel(temperature) {
    const gaugeLabel =
        this.thermometerLegendStage.getChildByName("liquidTempGaugeLabel");
    gaugeLabel.text = temperature.toFixed(1);
    const heatMap =
        this.thermometerLegendStage.getChildByName("liquidTempHeatMap");
    const tempLabelYOffset = 32 + heatMap.height_px - (temperature / 100) * heatMap.height_px;
    gaugeLabel.y = tempLabelYOffset;
  }

  updateLiquidTemperatureGaugeLine(temperature) {
    const gaugeLine =
        this.thermometerLegendStage.getChildByName("liquidTempGaugeLine");
    const heatMap =
        this.thermometerLegendStage.getChildByName("liquidTempHeatMap");
    const tempLineYOffset =
        32 + heatMap.height_px - (temperature / 100) * heatMap.height_px;
    gaugeLine.y = tempLineYOffset;
  }

  addAirTemperatureGaugeLine() {
    const gaugeLine = new createjs.Shape();
    gaugeLine.name = "airTempGaugeLine";
    gaugeLine.x = 100;
    gaugeLine.y = 70;
    const col = "hsl(0, 100%, 0%)";
    const line_height_px = 5;
    const line_width_px = 40;
    gaugeLine.graphics.beginFill(col)
        .drawRect(20, line_height_px, line_width_px, line_height_px).endFill();
    this.thermometerLegendStage.addChild(gaugeLine);
  }

  addAirTemperatureGaugeLabel() {
    const gaugeLabel = new createjs.Text("liquid temp", "14px Arial", "#000000");
    gaugeLabel.name = "airTempGaugeLabel";
    gaugeLabel.x = 165;
    gaugeLabel.y = 70;
    this.thermometerLegendStage.addChild(gaugeLabel);
  }

  updateAirTemperatureGaugeLabel(temperature) {
    const gaugeLabel =
        this.thermometerLegendStage.getChildByName("airTempGaugeLabel");
    gaugeLabel.text = temperature.toFixed(1);
    const heatMap =
        this.thermometerLegendStage.getChildByName("airTempHeatMap");
    const tempLabelYOffset = 32 + heatMap.height_px - (temperature / 100) * heatMap.height_px;
    gaugeLabel.y = tempLabelYOffset;
  }

  updateAirTemperatureGaugeLine(temperature) {
    const gaugeLine =
        this.thermometerLegendStage.getChildByName("airTempGaugeLine");
    const heatMap =
        this.thermometerLegendStage.getChildByName("airTempHeatMap");
    const tempLineYOffset = 32 + heatMap.height_px - (temperature / 100) * heatMap.height_px;
    gaugeLine.y = tempLineYOffset;
  }

  addAirTemperatureLabel() {
    const text = new createjs.Text("Air Temp", "13px Arial", "#000000");
    text.x = 138;
    text.y = 10;
    text.textAlign = 'center';
    this.thermometerLegendStage.addChild(text);
  }

  addTemperatureLegendLabels() {
    const container = new createjs.Container();
    container.height_px = 240;
    container.width_px = 30;
    for (let t = worldSpecs.temperature_max; t >= worldSpecs.temperature_min; t--) {
      const height_px = container.height_px / (worldSpecs.temperature_range+1);
      if (t % 20 == 0) {
        const text = new createjs.Text(t + "°C", "13px Arial", "#777777");
        text.x = container.width_px;
        text.y = 42 + (worldSpecs.temperature_max - t) * height_px - 6;
        text.textAlign = "center";
        container.addChild(text);
      }
    }
    container.x = 70;
    this.thermometerLegendStage.addChild(container);
  }

  addAirTemperatureHeatMap() {
    const heatMapShape = this.createHeatMap();
    heatMapShape.x = 110;
    heatMapShape.y = 5;
    heatMapShape.name = "airTempHeatMap";
    this.thermometerLegendStage.addChild(heatMapShape);
  }

  createHeatMap() {
    const colorMapShape = new createjs.Shape();
    colorMapShape.height_px = 240;
    colorMapShape.width_px = 20;
    for (let t = worldSpecs.temperature_max; t >= worldSpecs.temperature_min; t = t - 0.4) {
      const hsl = tempToHSL(t);
      const col = "hsl(" + hsl.h + "," + hsl.s + "," + hsl.l + ")";
      const height_px = colorMapShape.height_px / (worldSpecs.temperature_range+1);
      colorMapShape.graphics.beginFill(col)
          .drawRect(20, 40 + (worldSpecs.temperature_max - t) * height_px, colorMapShape.width_px, height_px).endFill();
    }
    colorMapShape.cache(20, 40, colorMapShape.width_px, colorMapShape.height_px);
    return colorMapShape;
  }

  showThermometerReadings(worldData) {
    for (const thermometer of worldObjects.thermometers) {
      const voxel = worldData.voxels[getVoxelIndex(thermometer.x, thermometer.y)];
      this.showThermometerReading(thermometer.id, voxel.temperature)
    }
    this.thermometerLegendStage.update();
  }

  showThermometerReading(thermometerId, temperature) {
    if (thermometerId === 'beverage') {
      this.updateLiquidTemperatureGaugeLine(temperature);
      this.updateLiquidTemperatureGaugeLabel(temperature);
    } else if (thermometerId === 'air') {
      this.updateAirTemperatureGaugeLine(temperature);
      this.updateAirTemperatureGaugeLabel(temperature);
    }
  }

  generateTrial() {
    this.setupTrial();
    this.runEntireTrial();
  }

  setupTrial() {
    worldObjects.cups[0].material = this.material;
    worldObjects.cups[0].liquid_temperature =
        convertLiquidTempTextToTempNum(this.beverageTempText);
    worldObjects.air.temperature = convertAirTempTextToTempNum(this.airTempText);
    initWorld();
    world.ticks = 0;
    this.intializeThermometers();
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
  updateTemperatures() {
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
      thermometer.text.text = voxel.temperature.toFixed(1) + "°C";
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

  showCupOutline() {
    let container = new createjs.Container();
    for (const cup of worldObjects.cups) {
      let topLeft = voxelToPixels(cup.x, cup.y+cup.height-1);

      // draw outlines to match cup color
      const outline = cup.outline = new createjs.Shape();
      outline.graphics.setStrokeStyle(1).beginStroke('#000000')
          .drawRect(topLeft.x0, topLeft.y0, cup.width*worldSpecs.voxel_width, cup.height*worldSpecs.voxel_height).endStroke();
      const iTopLeft = voxelToPixels(cup.x + cup.thickness, cup.y + cup.height - 1 - cup.thickness);
      outline.graphics.setStrokeStyle(1).beginStroke('#000000')
          .drawRect(iTopLeft.x0, iTopLeft.y0, (cup.width-2*cup.thickness)*worldSpecs.voxel_width, (cup.height-2*cup.thickness)*worldSpecs.voxel_height).endStroke();
      outline.cache(topLeft.x0 - 1, topLeft.y0 - 1, cup.width * worldSpecs.voxel_width + 2, cup.height * worldSpecs.voxel_height + 2);
      container.addChild(outline);
    }
    return container;
  }

  intializeThermometers() {
    for (const thermometer of worldObjects.thermometers) {
      const box = voxelToPixels(thermometer.x, thermometer.y);
      thermometer.text = new createjs.Text("99", "16px Arial", "black");
      thermometer.text.x = box.x0 + box.width + 9;
      thermometer.text.y = box.y0;
    }
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
