# MessyDash Backend v2.1

A secure relay server bridging desktop UI and Android phone via HTTPS webhooks and persistent WebSocket.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your API key
# API_KEY=your-secure-key-here

# Run development server
npm run dev
```

## API Overview

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/health` | GET | No | Health check |
| `/api/v1/status` | GET | Yes | Bridge status |
| `/api/v1/contacts` | GET | Yes | Synced contacts |
| `/api/v1/incoming` | POST | Yes | Receive SMS from phone |
| `/api/v1/ws` | WS | Yes | Bidirectional WebSocket |

## Authentication

All authenticated endpoints require header: `X-API-KEY: your-key`

## WebSocket Usage

```javascript
// Connect as desktop client
const ws = new WebSocket('ws://localhost:3000/api/v1/ws?client=desktop', {
  headers: { 'X-API-KEY': 'your-key' }
});

// Send SMS
ws.send(JSON.stringify({ type: 'sms', to: '+1555123456', msg: 'Hello!' }));

// Listen for incoming SMS
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'incoming_sms') {
    console.log(`From ${msg.sender}: ${msg.message}`);
  }
});
```

## Tech Stack

- **Fastify** - Fast Node.js web framework
- **TypeScript** - Type safety
- **SQLite** - Contact persistence
- **Zod** - Runtime validation

## License

MIT
