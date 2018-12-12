
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

function giveGuidance() {
  console.log(`getMaxNumAutoScoreAttempts: ${getMaxNumAutoScoreAttempts()}`);
  ["Aluminum", "Wood", "Styrofoam", "Clay", "Glass", "Plastic"].filter((material) => {
    console.log(`flagged cells for ${material}: ${getFlaggedCellsByMaterial(material).join(",")}`);
  });
  console.log("*****");
  ["Hot", "Cold"].filter((temp) => {
    console.log(`flagged cells for ${temp}: ${getFlaggedCellsByTemp(temp).join(",")}`);
  });
}
