const crypto = require('crypto');

// Set the webhook secret to match your local .env (e.g., 'placeholder')
const WORKOS_WEBHOOK_SECRET = process.argv[2] || 'placeholder';
const API_URL = 'http://localhost:3000/api/webhooks/workos';

const payload = JSON.stringify({
  id: 'wh_01H4...',
  event: 'user.created',
  data: {
    id: 'user_01H4...',
    email: 'test-user@example.com',
    profilePictureUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&h=128',
  },
});

const timestamp = Date.now();
const unhashedString = `${timestamp}.${payload}`;
const signature = crypto
  .createHmac('sha256', WORKOS_WEBHOOK_SECRET)
  .update(unhashedString)
  .digest('hex');

const fullSignature = `t=${timestamp}, v1=${signature}`;

console.log('Sending mock WorkOS webhook to:', API_URL);
console.log('Payload:', payload);

fetch(API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-workos-signature': fullSignature,
  },
  body: payload,
})
  .then(async (res) => {
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text}`);
  })
  .catch((err) => {
    console.error('Error sending request:', err.message);
    console.log('\nMake sure your Next.js server is running at http://localhost:3000');
  });
