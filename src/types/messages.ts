import { z } from 'zod';

// =============================================================================
// HTTP API Schemas
// =============================================================================

/** Inbound SMS from phone via HTTP POST */
export const IncomingSMSSchema = z.object({
  sender: z.string().min(1, 'Sender is required'),
  message: z.string().min(1, 'Message is required'),
});

export type IncomingSMS = z.infer<typeof IncomingSMSSchema>;

// =============================================================================
// WebSocket Message Schemas
// =============================================================================

/** Contact object */
export const ContactSchema = z.object({
  name: z.string(),
  number: z.string(),
});

export type Contact = z.infer<typeof ContactSchema>;

/** Outbound SMS (Server → Phone) */
export const OutboundSMSSchema = z.object({
  type: z.literal('sms'),
  to: z.string().min(1),
  msg: z.string().min(1),
});

/** Contact sync (Phone → Server) */
export const ContactSyncSchema = z.object({
  type: z.literal('contacts'),
  data: z.array(ContactSchema),
});

/** Contact refresh request (Server → Phone) */
export const GetContactsSchema = z.object({
  type: z.literal('get_contacts'),
});

/** Incoming call notification (Future - Phone → Server) */
export const IncomingCallSchema = z.object({
  type: z.literal('incoming_call'),
  number: z.string(),
});

/** Acknowledgment message */
export const AckSchema = z.object({
  type: z.literal('ack'),
  id: z.string().optional(),
});

/** Error message */
export const ErrorMessageSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
  code: z.string().optional(),
});

/** Incoming SMS forwarded to desktop clients */
export const IncomingSMSNotificationSchema = z.object({
  type: z.literal('incoming_sms'),
  sender: z.string(),
  message: z.string(),
  timestamp: z.string(),
});

/** Union of all WebSocket message types */
export const WSMessageSchema = z.discriminatedUnion('type', [
  OutboundSMSSchema,
  ContactSyncSchema,
  GetContactsSchema,
  IncomingCallSchema,
  AckSchema,
  ErrorMessageSchema,
  IncomingSMSNotificationSchema,
]);

export type WSMessage = z.infer<typeof WSMessageSchema>;
export type OutboundSMS = z.infer<typeof OutboundSMSSchema>;
export type ContactSync = z.infer<typeof ContactSyncSchema>;
export type GetContacts = z.infer<typeof GetContactsSchema>;
export type IncomingCall = z.infer<typeof IncomingCallSchema>;
export type AckMessage = z.infer<typeof AckSchema>;
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;
export type IncomingSMSNotification = z.infer<typeof IncomingSMSNotificationSchema>;

// =============================================================================
// Connection State Types
// =============================================================================

export interface ConnectionInfo {
  apiKeyHash: string;
  clientType: 'phone' | 'desktop';
  connectedAt: Date;
}

export interface BridgeStatus {
  phoneOnline: boolean;
  desktopClients: number;
  lastPhoneSeen: string | null;
}
