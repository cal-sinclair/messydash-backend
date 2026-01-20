import { db } from '../db/index.js';
import type { WSMessage } from '../types/messages.js';

interface QueueRow {
  id: number;
  api_key_hash: string;
  message_type: string;
  payload: string;
  created_at: string;
  status: string;
}

/**
 * Message queue service for offline message handling
 * Prepared for v2.2+ - currently just provides the infrastructure
 */
class MessageQueueService {
  /**
   * Queue a message for later delivery
   */
  enqueue(apiKeyHash: string, message: WSMessage): number {
    const stmt = db.prepare(
      `INSERT INTO message_queue (api_key_hash, message_type, payload) 
       VALUES (?, ?, ?)`
    );

    const result = stmt.run(apiKeyHash, message.type, JSON.stringify(message));
    console.log(`📥 Queued message [${message.type}] for [${apiKeyHash}]`);
    return result.lastInsertRowid as number;
  }

  /**
   * Get pending messages for an API key
   */
  getPending(apiKeyHash: string): Array<{ id: number; message: WSMessage }> {
    const stmt = db.prepare<[string], QueueRow>(
      `SELECT id, payload FROM message_queue 
       WHERE api_key_hash = ? AND status = 'pending'
       ORDER BY created_at ASC`
    );

    const rows = stmt.all(apiKeyHash);
    return rows.map((row) => ({
      id: row.id,
      message: JSON.parse(row.payload) as WSMessage,
    }));
  }

  /**
   * Mark message as sent
   */
  markSent(id: number): void {
    const stmt = db.prepare(
      "UPDATE message_queue SET status = 'sent' WHERE id = ?"
    );
    stmt.run(id);
  }

  /**
   * Mark message as failed
   */
  markFailed(id: number): void {
    const stmt = db.prepare(
      "UPDATE message_queue SET status = 'failed' WHERE id = ?"
    );
    stmt.run(id);
  }

  /**
   * Clear old messages (cleanup job)
   */
  cleanup(olderThanDays: number = 7): number {
    const stmt = db.prepare(
      `DELETE FROM message_queue 
       WHERE created_at < datetime('now', '-' || ? || ' days')
       AND status != 'pending'`
    );

    const result = stmt.run(olderThanDays);
    return result.changes;
  }

  /**
   * Get queue stats
   */
  getStats(apiKeyHash: string): { pending: number; sent: number; failed: number } {
    const stmt = db.prepare<[string], { status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM message_queue 
       WHERE api_key_hash = ? 
       GROUP BY status`
    );

    const rows = stmt.all(apiKeyHash);
    const stats = { pending: 0, sent: 0, failed: 0 };

    for (const row of rows) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats] = row.count;
      }
    }

    return stats;
  }
}

// Export singleton instance
export const messageQueueService = new MessageQueueService();
