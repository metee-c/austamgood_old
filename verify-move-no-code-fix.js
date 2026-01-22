const fs = require('fs');

console.log('🔍 Verifying move_no code fix...\n');

// Read the fixed file
const moveFilePath = 'lib/database/move.ts';
const content = fs.readFileSync(moveFilePath, 'utf8');

// Check 1: generateMoveNo method signature
console.log('1️⃣ Checking generateMoveNo method signature:');
const hasNewSignature = content.includes('async generateMoveNo(moveType: MoveType, palletId?: string | null)');
if (hasNewSignature) {
  console.log('   ✅ Method signature updated correctly');
} else {
  console.log('   ❌ Method signature NOT updated');
}

// Check 2: RPC call to database function
console.log('\n2️⃣ Checking RPC call to generate_move_no:');
const hasRpcCall = content.includes("await this.supabase.rpc('generate_move_no'");
if (hasRpcCall) {
  console.log('   ✅ RPC call to database function found');
} else {
  console.log('   ❌ RPC call NOT found');
}

// Check 3: Parameters passed to RPC
console.log('\n3️⃣ Checking RPC parameters:');
const hasParams = content.includes('p_move_type: moveType') && content.includes('p_pallet_id: palletId');
if (hasParams) {
  console.log('   ✅ Parameters passed correctly');
} else {
  console.log('   ❌ Parameters NOT passed correctly');
}

// Check 4: createMove method calls generateMoveNo with parameters
console.log('\n4️⃣ Checking createMove method:');
const hasCreateMoveCall = content.includes('await this.generateMoveNo(payload.move_type, firstPalletId)');
if (hasCreateMoveCall) {
  console.log('   ✅ createMove calls generateMoveNo with parameters');
} else {
  console.log('   ❌ createMove does NOT call generateMoveNo with parameters');
}

// Check 5: Old code removed
console.log('\n5️⃣ Checking old code removed:');
const hasOldCode = content.includes("const prefix = 'MV-' + year + month + '-'");
if (!hasOldCode) {
  console.log('   ✅ Old code removed');
} else {
  console.log('   ❌ Old code still present');
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasNewSignature && hasRpcCall && hasParams && hasCreateMoveCall && !hasOldCode) {
  console.log('✅ ALL CHECKS PASSED - Code fix is correct!');
  console.log('\n📝 Next steps:');
  console.log('   1. Restart Next.js dev server: npm run dev');
  console.log('   2. Test creating a new move');
  console.log('   3. Verify move_no format is correct (TRF-202601-XXXX)');
} else {
  console.log('❌ SOME CHECKS FAILED - Please review the code');
}
console.log('='.repeat(50));
