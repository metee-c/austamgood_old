// Check what's in the current JWT token
const jwt = require('jsonwebtoken');

// This is the JWT_SECRET from .env.local
const JWT_SECRET = 'austamgood-wms-jwt-secret-key-change-in-production-2025';

// Example token - you need to get this from browser cookies
// For now, let's just show how to decode
console.log('JWT_SECRET:', JWT_SECRET);
console.log('\nTo check your current token:');
console.log('1. Open browser DevTools');
console.log('2. Go to Application > Cookies');
console.log('3. Find "auth_token" cookie');
console.log('4. Copy the value');
console.log('5. Run: node check-current-jwt.js <token>');

if (process.argv[2]) {
  const token = process.argv[2];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('\n✅ Token decoded successfully:');
    console.log(JSON.stringify(decoded, null, 2));
  } catch (error) {
    console.error('\n❌ Token verification failed:', error.message);
  }
}
