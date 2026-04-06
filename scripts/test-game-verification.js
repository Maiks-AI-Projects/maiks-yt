/**
 * Test script for the Game Verification API route.
 * 
 * Usage: node scripts/test-game-verification.js
 * 
 * NOTE: This will fail with 401 Unauthorized unless you have a valid WorkOS session cookie.
 * To test this effectively, call this from a client-side component in the browser or use 
 * a tool like Postman with your session cookies.
 */

const API_URL = 'http://localhost:3000/api/games/verify';

const payload = JSON.stringify({
  platform: 'minecraft',
  externalId: '550e8400-e29b-41d4-a716-446655440000', // Example UUID
  characterName: 'MaikYT',
});

console.log('Testing Game Verification API at:', API_URL);
console.log('Payload:', payload);

fetch(API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // WorkOS session cookie would normally be sent automatically by the browser
  },
  body: payload,
})
  .then(async (res) => {
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (res.status === 401) {
      console.log('\n[!] Received 401 Unauthorized. This is expected if you are not logged in.');
      console.log('To test this, run this script from your browser console while logged in to the app,');
      console.log('or use a tool that includes your session cookies.');
    }
  })
  .catch((err) => {
    console.error('Error sending request:', err.message);
    console.log('\nMake sure your Next.js server is running at http://localhost:3000');
  });
