import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { logger } from '../utils/logger';

export type PersistenceMode = 'file' | 'database' | 'test';

export interface DatabaseConfig {
  connectionString?: string;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

class DatabaseManager {
  private pool: Pool | null = null;
  private config: DatabaseConfig = {};
  private isConnected = false;

  public configure(config: DatabaseConfig): void {
    this.config = config;
    if (this.pool) {
      this.pool.end().catch(() => {});
      this.pool = null;
      this.isConnected = false;
    }
  }

  public getPool(): Pool {
    if (!this.pool) {
      const connStr = this.config.connectionString || process.env.DATABASE_URL;
      if (!connStr) {
        throw new Error('DATABASE_URL is not configured. Database persistence requires a valid connection string.');
      }

      const isProd = process.env.NODE_ENV === 'production';
      const useSsl = this.config.ssl !== undefined
        ? this.config.ssl
        : (isProd && !connStr.includes('localhost') && !connStr.includes('127.0.0.1'));

      this.pool = new Pool({
        connectionString: connStr,
        max: this.config.maxConnections || 20,
        idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis || 5000,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      });

      this.pool.on('error', (err) => {
        logger.error('Unexpected error on idle database client', 'DatabaseManager', { error: err.message });
      });
    }
    return this.pool;
  }

  public async query<R extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<R>> {
    const pool = this.getPool();
    const start = Date.now();
    try {
      const res = await pool.query<R>(text, params);
      const duration = Date.now() - start;
      if (duration > 1000) {
        logger.warn('Slow database query executed', 'DatabaseManager', { text: text.substring(0, 100), duration });
      }
      return res;
    } catch (err: any) {
      logger.error('Database query execution error', 'DatabaseManager', {
        text: text.substring(0, 100),
        error: err.message,
      });
      throw err;
    }
  }

  public async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err: any) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back due to error', 'DatabaseManager', { error: err.message });
      throw err;
    } finally {
      client.release();
    }
  }

  public async checkHealth(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      const pool = this.getPool();
      await pool.query('SELECT 1');
      const latencyMs = Date.now() - start;
      this.isConnected = true;
      return { connected: true, latencyMs };
    } catch (err: any) {
      this.isConnected = false;
      return { connected: false, error: err.message };
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
    }
  }
}

export const dbManager = new DatabaseManager();

export function getPersistenceMode(): PersistenceMode {
  const mode = process.env.STRUCTURA_PERSISTENCE_MODE?.toLowerCase();
  if (mode === 'database') return 'database';
  if (mode === 'test') return 'test';
  return 'file';
}
