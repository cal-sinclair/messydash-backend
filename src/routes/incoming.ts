import { FastifyInstance } from 'fastify';
import { apiKeyAuth, hashApiKey } from '../middleware/auth.js';
import { IncomingSMSSchema, type IncomingSMSNotification } from '../types/messages.js';
import { connectionManager } from '../services/connection-manager.js';
import { config } from '../config.js';

/**
 * Incoming SMS route - receives SMS from phone via HTTP POST
 * POST /api/v1/incoming
 */
export async function incomingRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/api/v1/incoming',
    {
      preHandler: apiKeyAuth,
      schema: {
        body: {
          type: 'object',
          required: ['sender', 'message'],
          properties: {
            sender: { type: 'string' },
            message: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Validate body with Zod for type safety
      const parseResult = IncomingSMSSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parseResult.error.errors[0]?.message || 'Invalid payload',
        });
      }

      const { sender, message } = parseResult.data;

      // Get API key hash for routing
      const apiKey = config.API_KEY || 'default';
      const apiKeyHash = hashApiKey(apiKey);

      // Log the incoming SMS
      console.log(`📨 Incoming SMS from ${sender}: ${message.slice(0, 50)}${message.length > 50 ? '...' : ''}`);

      // Forward to all connected desktop clients
      const notification: IncomingSMSNotification = {
        type: 'incoming_sms',
        sender,
        message,
        timestamp: new Date().toISOString(),
      };

      const sentCount = connectionManager.broadcastToDesktops(apiKeyHash, notification);
      console.log(`📤 Forwarded to ${sentCount} desktop client(s)`);

      return reply.status(200).send({
        success: true,
        message: `Delivered to ${sentCount} client(s)`,
      });
    }
  );

  // Future: MMS endpoint stub
  fastify.post(
    '/api/v1/incoming/mms',
    {
      preHandler: apiKeyAuth,
    },
    async (request, reply) => {
      // Placeholder for multipart/form-data MMS support
      return reply.status(501).send({
        error: 'Not Implemented',
        message: 'MMS support coming in a future version',
      });
    }
  );
}
