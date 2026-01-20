import { FastifyInstance } from 'fastify';
import { apiKeyAuth, hashApiKey } from '../middleware/auth.js';
import { connectionManager } from '../services/connection-manager.js';
import { contactsService } from '../services/contacts.js';
import { config } from '../config.js';

/**
 * Status routes - expose bridge status and system info
 */
export async function statusRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/status
   * Returns bridge status for the authenticated API key
   */
  fastify.get(
    '/api/v1/status',
    {
      preHandler: apiKeyAuth,
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              phoneOnline: { type: 'boolean' },
              desktopClients: { type: 'number' },
              lastPhoneSeen: { type: ['string', 'null'] },
              contactCount: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const apiKey = config.API_KEY || 'default';
      const apiKeyHash = hashApiKey(apiKey);

      const bridgeStatus = connectionManager.getStatus(apiKeyHash);
      const contactCount = contactsService.count(apiKeyHash);

      return reply.send({
        ...bridgeStatus,
        contactCount,
      });
    }
  );

  /**
   * GET /api/v1/contacts
   * Returns synced contacts for the authenticated API key
   */
  fastify.get(
    '/api/v1/contacts',
    {
      preHandler: apiKeyAuth,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const apiKey = config.API_KEY || 'default';
      const apiKeyHash = hashApiKey(apiKey);
      const query = (request.query as { q?: string }).q;

      const contacts = query
        ? contactsService.search(apiKeyHash, query)
        : contactsService.getAll(apiKeyHash);

      return reply.send({
        count: contacts.length,
        contacts,
      });
    }
  );

  /**
   * GET /api/v1/health
   * Public health check endpoint (no auth required)
   */
  fastify.get('/api/v1/health', async (request, reply) => {
    const stats = connectionManager.getGlobalStats();

    return reply.send({
      status: 'ok',
      version: '2.1.0',
      uptime: process.uptime(),
      connections: stats,
    });
  });
}
