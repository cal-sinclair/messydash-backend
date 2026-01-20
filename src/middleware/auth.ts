import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';
import { createHash } from 'crypto';

/**
 * Hash an API key for storage/comparison
 * We use SHA-256 to avoid storing raw keys in connection maps
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
}

/**
 * Extract and validate API key from request headers
 * Returns the API key if valid, null otherwise
 */
export function extractApiKey(headers: Record<string, string | string[] | undefined>): string | null {
  const apiKey = headers['x-api-key'];
  
  if (!apiKey || Array.isArray(apiKey)) {
    return null;
  }
  
  return apiKey;
}

/**
 * Fastify preHandler hook for API key authentication
 * Skips auth if no API_KEY is configured (development mode)
 */
export async function apiKeyAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const configuredKey = config.API_KEY;
  
  // If no key configured, skip auth (development mode)
  if (!configuredKey) {
    return;
  }
  
  const providedKey = extractApiKey(request.headers as Record<string, string | string[] | undefined>);
  
  if (!providedKey) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing X-API-KEY header',
    });
    return;
  }
  
  if (providedKey !== configuredKey) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }
}

/**
 * Validate API key for WebSocket upgrade
 * Returns true if valid or auth is disabled
 */
export function validateWebSocketAuth(headers: Record<string, string | string[] | undefined>): boolean {
  const configuredKey = config.API_KEY;
  
  // If no key configured, allow connection
  if (!configuredKey) {
    return true;
  }
  
  const providedKey = extractApiKey(headers);
  return providedKey === configuredKey;
}
