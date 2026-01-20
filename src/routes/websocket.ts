import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { validateWebSocketAuth, hashApiKey, extractApiKey } from '../middleware/auth.js';
import { connectionManager } from '../services/connection-manager.js';
import { contactsService } from '../services/contacts.js';
import { config } from '../config.js';
import {
  WSMessageSchema,
  type WSMessage,
  type ErrorMessage,
  type AckMessage,
} from '../types/messages.js';

/**
 * WebSocket route handler
 * Handles bidirectional communication between phone and desktop clients
 */
export async function websocketRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/v1/ws',
    { websocket: true },
    (socket: WebSocket, request) => {
      // Authenticate the connection
      const headers = request.headers as Record<string, string | string[] | undefined>;
      
      if (!validateWebSocketAuth(headers)) {
        console.log('🚫 WebSocket connection rejected: invalid API key');
        socket.close(4001, 'Unauthorized');
        return;
      }

      // Get API key hash and client type
      const apiKey = extractApiKey(headers) || config.API_KEY || 'default';
      const apiKeyHash = hashApiKey(apiKey);
      
      // Determine client type from query parameter or header
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const clientType = url.searchParams.get('client') as 'phone' | 'desktop' || 'desktop';

      // Register connection based on client type
      if (clientType === 'phone') {
        connectionManager.registerPhone(apiKeyHash, socket);
      } else {
        connectionManager.registerDesktop(apiKeyHash, socket);
      }

      // Handle incoming messages
      socket.on('message', async (raw: Buffer) => {
        try {
          const data = JSON.parse(raw.toString());
          const parseResult = WSMessageSchema.safeParse(data);

          if (!parseResult.success) {
            const error: ErrorMessage = {
              type: 'error',
              message: 'Invalid message format',
              code: 'INVALID_FORMAT',
            };
            socket.send(JSON.stringify(error));
            return;
          }

          const message = parseResult.data;
          await handleMessage(apiKeyHash, clientType, message, socket);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
          const error: ErrorMessage = {
            type: 'error',
            message: 'Failed to parse message',
            code: 'PARSE_ERROR',
          };
          socket.send(JSON.stringify(error));
        }
      });

      // Handle connection errors
      socket.on('error', (err) => {
        console.error(`WebSocket error [${apiKeyHash}]:`, err);
      });

      // Send welcome message
      socket.send(
        JSON.stringify({
          type: 'ack',
          id: 'connected',
        })
      );
    }
  );
}

/**
 * Route messages based on type and handle accordingly
 */
async function handleMessage(
  apiKeyHash: string,
  clientType: 'phone' | 'desktop',
  message: WSMessage,
  socket: WebSocket
): Promise<void> {
  console.log(`📩 [${clientType}] Received: ${message.type}`);

  switch (message.type) {
    case 'sms':
      await handleOutboundSMS(apiKeyHash, message, socket);
      break;

    case 'contacts':
      await handleContactSync(apiKeyHash, message, socket);
      break;

    case 'get_contacts':
      await handleGetContacts(apiKeyHash, socket);
      break;

    case 'incoming_call':
      // Future: Forward to desktop clients
      console.log(`📞 Incoming call from: ${message.number}`);
      connectionManager.broadcastToDesktops(apiKeyHash, message);
      sendAck(socket);
      break;

    case 'ack':
      // Acknowledgment received, nothing to do
      break;

    case 'error':
      // Error from client, log it
      console.error(`Client error: ${message.message}`);
      break;

    default:
      // Handle incoming_sms notifications (forwarded from HTTP endpoint)
      if ('sender' in message) {
        connectionManager.broadcastToDesktops(apiKeyHash, message);
      }
      break;
  }
}

/**
 * Handle outbound SMS request from desktop
 * Forwards to phone if online, returns error if offline
 */
async function handleOutboundSMS(
  apiKeyHash: string,
  message: Extract<WSMessage, { type: 'sms' }>,
  socket: WebSocket
): Promise<void> {
  console.log(`📤 Outbound SMS to: ${message.to}`);

  // Check if phone is online
  if (!connectionManager.isPhoneOnline(apiKeyHash)) {
    const error: ErrorMessage = {
      type: 'error',
      message: 'Phone is offline. Cannot send SMS.',
      code: 'PHONE_OFFLINE',
    };
    socket.send(JSON.stringify(error));
    return;
  }

  // Forward to phone
  const sent = connectionManager.sendToPhone(apiKeyHash, message);

  if (sent) {
    sendAck(socket);
  } else {
    const error: ErrorMessage = {
      type: 'error',
      message: 'Failed to send to phone',
      code: 'SEND_FAILED',
    };
    socket.send(JSON.stringify(error));
  }
}

/**
 * Handle contact sync from phone
 */
async function handleContactSync(
  apiKeyHash: string,
  message: Extract<WSMessage, { type: 'contacts' }>,
  socket: WebSocket
): Promise<void> {
  contactsService.sync(apiKeyHash, message.data);
  sendAck(socket);

  // Notify desktop clients that contacts were updated
  connectionManager.broadcastToDesktops(apiKeyHash, {
    type: 'ack',
    id: 'contacts_updated',
  });
}

/**
 * Handle get_contacts request - return cached contacts
 */
async function handleGetContacts(
  apiKeyHash: string,
  socket: WebSocket
): Promise<void> {
  const contacts = contactsService.getAll(apiKeyHash);

  socket.send(
    JSON.stringify({
      type: 'contacts',
      data: contacts,
    })
  );
}

/**
 * Send acknowledgment message
 */
function sendAck(socket: WebSocket, id?: string): void {
  const ack: AckMessage = {
    type: 'ack',
    id,
  };
  socket.send(JSON.stringify(ack));
}
