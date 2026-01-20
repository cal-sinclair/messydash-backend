import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { incomingRoutes } from './routes/incoming.js';
import { statusRoutes } from './routes/status.js';
import { websocketRoutes } from './routes/websocket.js';

/**
 * Create and configure the Fastify server
 */
export async function createServer() {
  const fastify = Fastify({
    logger: config.NODE_ENV !== 'production',
  });

  // Register WebSocket plugin
  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB max message size
    },
  });

  // Register routes
  await fastify.register(incomingRoutes);
  await fastify.register(statusRoutes);
  await fastify.register(websocketRoutes);

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    reply.status(error.statusCode || 500).send({
      error: error.name || 'Internal Server Error',
      message: error.message,
      statusCode: error.statusCode || 500,
    });
  });

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
    });
  });

  return fastify;
}
