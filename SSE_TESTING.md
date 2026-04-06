# SSE Testing Guide

You can test the Server-Sent Events (SSE) implementation using the following methods.

## 1. Browser (Recommended)

Open your browser console and paste the following:

```javascript
const eventSource = new EventSource('/api/events?channel=global');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received Event:', data);
};

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
};

// To test a specific channel
const mcChannel = new EventSource('/api/events?channel=mc');
mcChannel.onmessage = (event) => {
  console.log('MC Channel Event:', JSON.parse(event.data));
};
```

## 2. Triggering Events (cURL)

Use cURL to trigger a test event through the test endpoint:

```bash
# Trigger a global system event
curl -X POST http://localhost:3000/api/events/test \
  -H "Content-Type: application/json" \
  -d '{"channel": "global", "type": "system", "data": {"message": "Hello World!"}}'

# Trigger a donation event on the 'mc' channel
curl -X POST http://localhost:3000/api/events/test \
  -H "Content-Type: application/json" \
  -d '{"channel": "mc", "type": "donation", "data": {"amount": 5.00, "userName": "Player1"}}'
```

## 3. Node.js Client Script

You can also use a simple Node.js script (using a library like `eventsource` or native `fetch` with streaming if supported).

```javascript
// Install EventSource if not using a browser: npm install eventsource
const EventSource = require('eventsource');

const url = 'http://localhost:3000/api/events?channel=global';
const es = new EventSource(url);

es.onmessage = (e) => {
  console.log('Event received:', JSON.parse(e.data));
};

es.onerror = (err) => {
  console.error('Connection failed:', err);
};
```

## Architecture Summary
- **Source**: `src/lib/events.ts` (EventEmitter based singleton)
- **Route**: `src/app/api/events/route.ts` (Next.js App Router GET handler)
- **Trigger**: `src/lib/events.ts` -> `triggerEvent(channel, type, data)`
