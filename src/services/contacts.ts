import { db } from '../db/index.js';
import type { Contact } from '../types/messages.js';

interface ContactRow {
  id: number;
  api_key_hash: string;
  name: string;
  number: string;
  synced_at: string;
}

/**
 * Service for managing contacts persistence
 * Contacts are stored per API key for multi-tenant support
 */
class ContactsService {
  /**
   * Sync contacts from phone - replaces all existing contacts
   */
  sync(apiKeyHash: string, contacts: Contact[]): void {
    const deleteStmt = db.prepare('DELETE FROM contacts WHERE api_key_hash = ?');
    const insertStmt = db.prepare(
      'INSERT INTO contacts (api_key_hash, name, number) VALUES (?, ?, ?)'
    );

    const syncTransaction = db.transaction(() => {
      // Clear existing contacts
      deleteStmt.run(apiKeyHash);

      // Insert new contacts
      for (const contact of contacts) {
        insertStmt.run(apiKeyHash, contact.name, contact.number);
      }
    });

    syncTransaction();
    console.log(`📇 Synced ${contacts.length} contacts for [${apiKeyHash}]`);
  }

  /**
   * Get all contacts for an API key
   */
  getAll(apiKeyHash: string): Contact[] {
    const stmt = db.prepare<[string], ContactRow>(
      'SELECT name, number FROM contacts WHERE api_key_hash = ? ORDER BY name'
    );
    const rows = stmt.all(apiKeyHash);

    return rows.map((row) => ({
      name: row.name,
      number: row.number,
    }));
  }

  /**
   * Search contacts by name or number
   */
  search(apiKeyHash: string, query: string): Contact[] {
    const stmt = db.prepare<[string, string, string], ContactRow>(
      `SELECT name, number FROM contacts 
       WHERE api_key_hash = ? 
       AND (name LIKE ? OR number LIKE ?)
       ORDER BY name
       LIMIT 50`
    );

    const pattern = `%${query}%`;
    const rows = stmt.all(apiKeyHash, pattern, pattern);

    return rows.map((row) => ({
      name: row.name,
      number: row.number,
    }));
  }

  /**
   * Get contact count for an API key
   */
  count(apiKeyHash: string): number {
    const stmt = db.prepare<[string], { count: number }>(
      'SELECT COUNT(*) as count FROM contacts WHERE api_key_hash = ?'
    );
    const result = stmt.get(apiKeyHash);
    return result?.count ?? 0;
  }

  /**
   * Lookup contact by phone number
   */
  findByNumber(apiKeyHash: string, number: string): Contact | null {
    // Normalize number for comparison (remove non-digits except +)
    const normalized = number.replace(/[^\d+]/g, '');

    const stmt = db.prepare<[string], ContactRow>(
      'SELECT name, number FROM contacts WHERE api_key_hash = ?'
    );
    const rows = stmt.all(apiKeyHash);

    // Find matching contact with normalized comparison
    for (const row of rows) {
      const rowNormalized = row.number.replace(/[^\d+]/g, '');
      if (rowNormalized === normalized || rowNormalized.endsWith(normalized) || normalized.endsWith(rowNormalized)) {
        return { name: row.name, number: row.number };
      }
    }

    return null;
  }
}

// Export singleton instance
export const contactsService = new ContactsService();
