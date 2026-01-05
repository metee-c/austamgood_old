/**
 * Script to import BOM data from Excel file (v2)
 * รูปแบบ Excel: กรองทีละคอลัมน์จากซ้ายไปขวา
 * - คอลัมน์ A: สินค้าสำเร็จรูป
 * - คอลัมน์ B: วัตถุดิบ (ผลจากการกรอง - ไม่ใช้)
 * - คอลัมน์ C: อาหาร
 * - คอลัมน์ D: ถุง
 * - คอลัมน์ E-G: สติ๊กเกอร์_1, 2, 3
 */

const xlsx = require('xlsx');
const fs = require('fs');

// Read Excel file
const wb = xlsx.readFile('bom.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(ws, { header: 1 });

console.log('=== BOM Import from Excel (v2) ===\n');
console.log('Total rows in Excel:', data.length);
console.log('Headers:', data[0]);

// Skip header row
const rows = data.slice(1);

// Collect all BOM records
const bomRecords = [];
const uniqueMaterials = new Set();

rows.forEach((row, rowIndex) => {
  const finishedProduct = row[0];
  if (!finishedProduct) return;

  // คอลัมน์ C: อาหาร (index 2)
  const food = row[2];
  if (food && food.trim() && food !== finishedProduct) {
    const key = `${finishedProduct}|${food}|food`;
    if (!uniqueMaterials.has(key)) {
      uniqueMaterials.add(key);
      bomRecords.push({
        finished_product: finishedProduct.trim(),
        material: food.trim(),
        material_type: 'food'
      });
    }
  }

  // คอลัมน์ D: ถุง (index 3)
  const bag = row[3];
  if (bag && bag.trim() && bag !== finishedProduct) {
    const key = `${finishedProduct}|${bag}|bag`;
    if (!uniqueMaterials.has(key)) {
      uniqueMaterials.add(key);
      bomRecords.push({
        finished_product: finishedProduct.trim(),
        material: bag.trim(),
        material_type: 'bag'
      });
    }
  }

  // คอลัมน์ E-G: สติ๊กเกอร์ (index 4, 5, 6)
  for (let i = 4; i <= 6; i++) {
    const sticker = row[i];
    if (sticker && sticker.trim() && sticker !== finishedProduct) {
      const key = `${finishedProduct}|${sticker}|sticker`;
      if (!uniqueMaterials.has(key)) {
        uniqueMaterials.add(key);
        bomRecords.push({
          finished_product: finishedProduct.trim(),
          material: sticker.trim(),
          material_type: 'sticker'
        });
      }
    }
  }
});

// Count by type
const stats = { food: 0, bag: 0, sticker: 0 };
bomRecords.forEach(r => stats[r.material_type]++);

console.log('\n=== BOM Records Summary ===');
console.log('Food materials:', stats.food);
console.log('Bag materials:', stats.bag);
console.log('Sticker materials:', stats.sticker);
console.log('Total BOM records:', bomRecords.length);

// Get unique finished products
const finishedProducts = new Set(bomRecords.map(r => r.finished_product));
console.log('Unique finished products:', finishedProducts.size);

// Get unique materials
const allMaterials = {
  food: new Set(bomRecords.filter(r => r.material_type === 'food').map(r => r.material)),
  bag: new Set(bomRecords.filter(r => r.material_type === 'bag').map(r => r.material)),
  sticker: new Set(bomRecords.filter(r => r.material_type === 'sticker').map(r => r.material))
};

console.log('\n=== Unique Materials ===');
console.log('Unique food materials:', allMaterials.food.size);
console.log('Unique bag materials:', allMaterials.bag.size);
console.log('Unique sticker materials:', allMaterials.sticker.size);

// Save to JSON file
fs.writeFileSync('bom-data-v2.json', JSON.stringify(bomRecords, null, 2));
console.log('\nBOM data saved to bom-data-v2.json');

// Print sample records
console.log('\n=== Sample Records (first 10) ===');
bomRecords.slice(0, 10).forEach((r, i) => {
  console.log(`${i + 1}. [${r.material_type}] ${r.finished_product} -> ${r.material}`);
});
