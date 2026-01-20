import { WebSocket } from 'ws';
import type { BridgeStatus, WSMessage, ConnectionInfo } from '../types/messages.js';

interface ClientConnection {
  socket: WebSocket;
  clientType: 'phone' | 'desktop';
  connectedAt: Date;
}

/**
 * Manages WebSocket connections for phone and desktop clients
 * Tracks online/offline state and routes messages between clients
 */
class ConnectionManager {
  // Map of apiKeyHash -> phone connection
  private phoneConnections = new Map<string, ClientConnection>();
  
  // Map of apiKeyHash -> array of desktop connections
  private desktopConnections = new Map<string, ClientConnection[]>();
  
  // Track last seen time for phones
  private lastPhoneSeen = new Map<string, Date>();

  /**
   * Register a phone connection
   */
  registerPhone(apiKeyHash: string, socket: WebSocket): void {
    // Close existing phone connection if any
    const existing = this.phoneConnections.get(apiKeyHash);
    if (existing) {
      existing.socket.close(1000, 'Replaced by new connection');
    }

    const connection: ClientConnection = {
      socket,
      clientType: 'phone',
      connectedAt: new Date(),
    };

    this.phoneConnections.set(apiKeyHash, connection);
    this.lastPhoneSeen.set(apiKeyHash, new Date());

    socket.on('close', () => {
      this.phoneConnections.delete(apiKeyHash);
      this.lastPhoneSeen.set(apiKeyHash, new Date());
      console.log(`📱 Phone disconnected [${apiKeyHash}]`);
    });

    console.log(`📱 Phone connected [${apiKeyHash}]`);
  }

  /**
   * Register a desktop connection
   */
  registerDesktop(apiKeyHash: string, socket: WebSocket): void {
    const connection: ClientConnection = {
      socket,
      clientType: 'desktop',
      connectedAt: new Date(),
    };

    const existing = this.desktopConnections.get(apiKeyHash) || [];
    existing.push(connection);
    this.desktopConnections.set(apiKeyHash, existing);

    socket.on('close', () => {
      const connections = this.desktopConnections.get(apiKeyHash) || [];
      const filtered = connections.filter((c) => c.socket !== socket);
      if (filtered.length > 0) {
        this.desktopConnections.set(apiKeyHash, filtered);
      } else {
        this.desktopConnections.delete(apiKeyHash);
      }
      console.log(`💻 Desktop disconnected [${apiKeyHash}]`);
    });

    console.log(`💻 Desktop connected [${apiKeyHash}] (${existing.length} total)`);
  }

  /**
   * Check if phone is online for given API key
   */
  isPhoneOnline(apiKeyHash: string): boolean {
    const conn = this.phoneConnections.get(apiKeyHash);
    return conn !== undefined && conn.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Send message to phone
   * Returns true if sent successfully, false if phone is offline
   */
  sendToPhone(apiKeyHash: string, message: WSMessage): boolean {
    const conn = this.phoneConnections.get(apiKeyHash);
    if (!conn || conn.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      conn.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send to phone:', error);
      return false;
    }
  }

  /**
   * Broadcast message to all desktop clients for an API key
   */
  broadcastToDesktops(apiKeyHash: string, message: WSMessage): number {
    const connections = this.desktopConnections.get(apiKeyHash) || [];
    let sent = 0;

    for (const conn of connections) {
      if (conn.socket.readyState === WebSocket.OPEN) {
        try {
          conn.socket.send(JSON.stringify(message));
          sent++;
        } catch (error) {
          console.error('Failed to send to desktop:', error);
        }
      }
    }

    return sent;
  }

  /**
   * Get bridge status for an API key
   */
  getStatus(apiKeyHash: string): BridgeStatus {
    const desktops = this.desktopConnections.get(apiKeyHash) || [];
    const activeDesktops = desktops.filter(
      (c) => c.socket.readyState === WebSocket.OPEN
    ).length;

    const lastSeen = this.lastPhoneSeen.get(apiKeyHash);

    return {
      phoneOnline: this.isPhoneOnline(apiKeyHash),
      desktopClients: activeDesktops,
      lastPhoneSeen: lastSeen ? lastSeen.toISOString() : null,
    };
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): { phones: number; desktops: number; apiKeys: number } {
    const apiKeys = new Set([
      ...this.phoneConnections.keys(),
      ...this.desktopConnections.keys(),
    ]);

    let totalDesktops = 0;
    for (const connections of this.desktopConnections.values()) {
      totalDesktops += connections.filter(
        (c) => c.socket.readyState === WebSocket.OPEN
      ).length;
    }

    return {
      phones: this.phoneConnections.size,
      desktops: totalDesktops,
      apiKeys: apiKeys.size,
    };
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager();
