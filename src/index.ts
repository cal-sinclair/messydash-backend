import { createServer } from './server.js';
import { config } from './config.js';

// Initialize database (side effect: creates tables)
import './db/index.js';

async function main() {
  const server = await createServer();

  try {
    await server.listen({
      port: config.PORT,
      host: config.HOST,
    });

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                   MessyDash Backend v2.1                   ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  🚀 Server running at http://${config.HOST}:${config.PORT}`.padEnd(63) + '║');
    console.log(`║  📡 WebSocket at ws://${config.HOST}:${config.PORT}/api/v1/ws`.padEnd(63) + '║');
    console.log(`║  🔒 Auth: ${config.API_KEY ? 'Enabled' : 'Disabled (dev mode)'}`.padEnd(63) + '║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
