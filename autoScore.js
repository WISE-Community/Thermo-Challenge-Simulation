
function giveGuidance() {
  const aggregate = getFlaggedCellsAggregate();
  if (noCellSelected(aggregate)) {
    appendLog("[Condition NonSelected] Please choose experiment(s) that you want to run.");
    return;
  }

  if (allCellsSelected(aggregate)) {
    appendLog(`[Condition 6Pairs] Are all of these tests necessary? Your plan includes 12 of the 12 possible tests.`);
    return;
  }

  if (isAutoScoreTemperatureMode()) {
    if (allHot(aggregate)) {
      appendLog("Guidance: all hot");
    } else if (allCold(aggregate)) {
      appendLog("Guidance: all cold");
    } else if (onlyHotAndCold(aggregate)) {
      appendLog("Guidance: only hot & cold");
    } else if (hotOnlyEqualsColdOnly(aggregate)) {
      appendLog("Guidance: hot only = cold only");
    } else if (hotOnlyMoreThanColdOnly(aggregate)) {
      appendLog("Guidance: hot only > cold only");
    } else if (hotOnlyLessThanColdOnly(aggregate)) {
      appendLog("Guidance: hot only < cold only");
    }
  } else if (isAutoScoreMaterialMode()) {
    const allMaterialsFlagged = getAllMaterialsFlagged(aggregate);
    if (noPairs(aggregate)) {
      appendLog(`[Condition NoPairs] It looks like you’re interested in investigating ${allMaterialsFlagged.length} material(s): ${allMaterialsFlagged.join(", ")}.
          Your plan includes one temperature test for each material.<br/>
          To improve your experiment plan, consider: 
          Will testing just one temperature for a material help you decide 
          how the material compares against other materials for insulating a beverage? `);
    } else if (onlyHotAndCold(aggregate) && aggregate.hotAndCold.length === 1) {
      appendLog(`[Condition OnePair] It looks like you’re interested in investigating ${allMaterialsFlagged.length} material(s): ${allMaterialsFlagged.join(", ")}.
          Your plan includes both hot and cold tests for these materials.<br/>
          To improve your experiment plan, consider: 
          Are there any other materials you would like to compare to ${allMaterialsFlagged.join(", ")}? 
          What test(s) should you add to your plan to investigate these other materials?`);
    } else if (onlyHotAndCold(aggregate) && aggregate.hotAndCold.length >= 2 && aggregate.hotAndCold.length <= 5) {
      appendLog(`[Condition 2-5Pairs] It looks like you’re interested in investigating ${allMaterialsFlagged.length} material(s): ${allMaterialsFlagged.join(", ")}.
          Your plan includes both hot and cold tests for these materials.<br/>
          To improve your experiment plan, consider: 
          Are there any other materials you would like to compare to ${allMaterialsFlagged.join(", ")}? 
          What test(s) should you add to your plan to investigate these other materials?`);
    } else {
      appendLog(`[Condition Singles] It looks like you’re interested in investigating ${allMaterialsFlagged.length} material(s): ${allMaterialsFlagged.join(", ")}.
          Your plan includes set of hot and cold tests for ${aggregate.hotAndCold.join(", ")} 
          and only one temperature test each for materials ${aggregate.hotOnly.concat(aggregate.coldOnly).join(", ")}.<br/>
          To improve your experiment plan, consider: Will testing just one temperature for a material help you decide 
          how the material compares against other materials for insulating a beverage?`);
    }
  }
  //appendStateToLog(aggregate);
  // todo: create annotation, add to student work
}

function getFlaggedCellsAggregate() {
  const flaggedCellsByMaterial = {};
  const flaggedCellsHotAndCold = [];
  const flaggedCellsHotOnly = [];
  const flaggedCellsColdOnly = [];
  ["Aluminum", "Wood", "Styrofoam", "Clay", "Glass", "Plastic"].map((material) => {
    flaggedCellsByMaterial[material] = getFlaggedCellsByMaterial(material);
    const hotMaterial = getFlaggedCellsByMaterialAndTemp(material, "Hot");
    const coldMaterial = getFlaggedCellsByMaterialAndTemp(material, "Cold");
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
    flaggedCellsByTemp[temp] = getFlaggedCellsByTemp(temp);
  });
  return {
    byMaterial: flaggedCellsByMaterial,
    byTemp: flaggedCellsByTemp,
    hotAndCold: flaggedCellsHotAndCold,
    hotOnly: flaggedCellsHotOnly,
    coldOnly: flaggedCellsColdOnly
  };
}

function appendStateToLog(aggregate) {
  //appendLog(`Number of tests: ${aggregate.hotAndCold.length * 2 + aggregate.hotOnly.length + aggregate.coldOnly.length} / 12`);
  appendLog(`Hot and Cold (${aggregate.hotAndCold.length}): [${aggregate.hotAndCold.join(",")}]`);
  appendLog(`Hot only (${aggregate.hotOnly.length}): [${aggregate.hotOnly.join(",")}]`);
  appendLog(`Cold only (${aggregate.coldOnly.length}): [${aggregate.coldOnly.join(",")}]`);
}

function noCellSelected(aggregate) {
  return aggregate.hotOnly.length === 0 &&
      aggregate.coldOnly.length === 0 &&
      aggregate.hotAndCold.length === 0;
}

function allCellsSelected(aggregate) {
  return aggregate.hotAndCold.length === ["Aluminum", "Wood", "Styrofoam", "Clay", "Glass", "Plastic"].length;
}

function noPairs(aggregate) {
  return aggregate.hotAndCold.length === 0 &&
    (aggregate.hotOnly.length > 0 ||
    aggregate.coldOnly.length > 0);
}

function getAllMaterialsFlagged(aggregate) {
  return aggregate.hotAndCold.concat(aggregate.hotOnly).concat(aggregate.coldOnly);
}

function allHot(aggregate) {
  return aggregate.hotAndCold.length + aggregate.hotOnly.length === ["Aluminum", "Wood", "Styrofoam", "Clay", "Glass", "Plastic"].length;
}

function allCold(aggregate) {
  return aggregate.hotAndCold.length + aggregate.coldOnly.length === ["Aluminum", "Wood", "Styrofoam", "Clay", "Glass", "Plastic"].length;
}

function onlyHotAndCold(aggregate) {
  return aggregate.hotAndCold.length > 0 &&
      aggregate.hotOnly.length === 0 &&
      aggregate.coldOnly.length === 0;
}

function hotOnlyEqualsColdOnly(aggregate) {
  return aggregate.hotOnly.length > 0 &&
      aggregate.hotOnly.length === aggregate.coldOnly.length;
}

function hotOnlyMoreThanColdOnly(aggregate) {
  return aggregate.hotOnly.length > 0 &&
      aggregate.hotOnly.length > aggregate.coldOnly.length;
}

function hotOnlyLessThanColdOnly(aggregate) {
  return aggregate.coldOnly.length > 0 &&
      aggregate.hotOnly.length < aggregate.coldOnly.length;
}

function getFlaggedCellsByMaterial(material) {
  return grids.flaggedCells.filter((flaggedCell) => {
    return flaggedCell.material === material;
  });
}

function getFlaggedCellsByTemp(temp) {
  return grids.flaggedCells.filter((flaggedCell) => {
    return flaggedCell.bevTemp === temp;
  });
}

function getFlaggedCellsByMaterialAndTemp(material, temp) {
  return grids.flaggedCells.filter((flaggedCell) => {
    return flaggedCell.material === material && flaggedCell.bevTemp === temp;
  });
}

function clearLog() {
  $("#log").html("");
}

function appendLog(message) {
  $("#log").append(message);
  $("#log").append("<br/>");
  $("#log").append("<br/>");
}

