/**
 * Script to import BOM data from Excel file
 * This script reads bom.xlsx and generates SQL migration for BOM data
 */

const xlsx = require('xlsx');
const fs = require('fs');

// Read Excel file
const wb = xlsx.readFile('bom.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(ws, { header: 1 });

// Skip header row and SET products
const rows = data.slice(1).filter(row => row[0] && !row[0].startsWith('[SET]'));

// Group by finished product and collect unique materials
const bomMap = new Map();

rows.forEach(row => {
  const finished = row[0];
  const material = row[1];

  if (!finished || !material) return;
  if (material === finished) return; // Skip self-reference

  if (!bomMap.has(finished)) {
    bomMap.set(finished, new Set());
  }
  bomMap.get(finished).add(material);
});

// Categorize materials
function categorize(material) {
  if (material.startsWith('อาหาร |')) return 'food';
  if (material.startsWith('ถุง |') || material.startsWith('ถุง Tester') || material.includes('ถุงฟอยด์')) return 'bag';
  if (material.includes('สติ๊กเกอร์') || material.includes('สติกเกอร์')) return 'sticker';
  return 'product'; // Finished product used as material
}

// Collect all unique materials by category
const allMaterials = {
  food: new Set(),
  bag: new Set(),
  sticker: new Set(),
  product: new Set()
};

for (const [finished, materials] of bomMap) {
  materials.forEach(m => {
    const cat = categorize(m);
    allMaterials[cat].add(m);
  });
}

console.log('Material Summary:');
console.log('- Food materials:', allMaterials.food.size);
console.log('- Bag materials:', allMaterials.bag.size);
console.log('- Sticker materials:', allMaterials.sticker.size);
console.log('- Product materials:', allMaterials.product.size);

// Export food materials list
console.log('\n=== Food Materials ===');
Array.from(allMaterials.food).sort().forEach(m => console.log(m));

// Export BOM data as JSON for further processing
const bomData = [];
for (const [finished, materials] of bomMap) {
  materials.forEach(m => {
    bomData.push({
      finished_product: finished,
      material: m,
      material_type: categorize(m)
    });
  });
}

// Save to JSON file
fs.writeFileSync('bom-data.json', JSON.stringify(bomData, null, 2));
console.log('\nBOM data saved to bom-data.json');
console.log('Total BOM records:', bomData.length);
