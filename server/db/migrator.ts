import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dbManager } from './database';
import { logger } from '../utils/logger';

export interface MigrationFile {
  version: number;
  name: string;
  filename: string;
  filePath: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigration {
  id: number;
  version: number;
  name: string;
  checksum: string;
  applied_at: Date;
}

export interface MigrationStatus {
  totalMigrations: number;
  appliedCount: number;
  pendingCount: number;
  migrations: Array<{
    version: number;
    name: string;
    applied: boolean;
    appliedAt?: string;
    checksumMatch: boolean;
  }>;
}

export class SchemaMigrator {
  private migrationsDir: string;

  constructor(migrationsDir?: string) {
    this.migrationsDir = migrationsDir || path.join(process.cwd(), 'server', 'db', 'migrations');
  }

  public getAvailableMigrations(): MigrationFile[] {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    return files.map(filename => {
      const match = filename.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        throw new Error(`Invalid migration filename format: ${filename}. Expected format: 001_name.sql`);
      }

      const version = parseInt(match[1], 10);
      const name = match[2];
      const filePath = path.join(this.migrationsDir, filename);
      const sql = fs.readFileSync(filePath, 'utf-8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');

      return {
        version,
        name,
        filename,
        filePath,
        sql,
        checksum,
      };
    });
  }

  public async ensureMigrationsTable(): Promise<void> {
    const ddl = `
      CREATE TABLE IF NOT EXISTS _structura_schema_migrations (
        id SERIAL PRIMARY KEY,
        version INT NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    await dbManager.query(ddl);
  }

  public async getAppliedMigrations(): Promise<AppliedMigration[]> {
    await this.ensureMigrationsTable();
    const res = await dbManager.query<AppliedMigration>(
      'SELECT id, version, name, checksum, applied_at FROM _structura_schema_migrations ORDER BY version ASC'
    );
    return res.rows;
  }

  public async getStatus(): Promise<MigrationStatus> {
    const available = this.getAvailableMigrations();
    const applied = await this.getAppliedMigrations();
    const appliedMap = new Map<number, AppliedMigration>();
    applied.forEach(a => appliedMap.set(a.version, a));

    let appliedCount = 0;
    let pendingCount = 0;

    const migrations = available.map(m => {
      const app = appliedMap.get(m.version);
      if (app) {
        appliedCount++;
        return {
          version: m.version,
          name: m.name,
          applied: true,
          appliedAt: app.applied_at.toISOString(),
          checksumMatch: app.checksum === m.checksum,
        };
      } else {
        pendingCount++;
        return {
          version: m.version,
          name: m.name,
          applied: false,
          checksumMatch: true,
        };
      }
    });

    return {
      totalMigrations: available.length,
      appliedCount,
      pendingCount,
      migrations,
    };
  }

  public async runMigrations(targetVersion?: number): Promise<{
    applied: number;
    details: Array<{ version: number; name: string; durationMs: number }>;
  }> {
    await this.ensureMigrationsTable();
    const available = this.getAvailableMigrations();
    const applied = await this.getAppliedMigrations();
    const appliedMap = new Map<number, AppliedMigration>();
    applied.forEach(a => appliedMap.set(a.version, a));

    // Verify existing checksums
    for (const m of available) {
      const app = appliedMap.get(m.version);
      if (app && app.checksum !== m.checksum) {
        throw new Error(
          `Migration checksum mismatch for version ${m.version} (${m.name}). Recorded: ${app.checksum}, Current: ${m.checksum}. Never modify already applied migration files.`
        );
      }
    }

    const toApply = available.filter(m => {
      if (appliedMap.has(m.version)) return false;
      if (targetVersion !== undefined && m.version > targetVersion) return false;
      return true;
    });

    const details: Array<{ version: number; name: string; durationMs: number }> = [];

    for (const m of toApply) {
      logger.info(`Applying migration ${m.version}: ${m.name}...`, 'SchemaMigrator');
      const start = Date.now();

      await dbManager.withTransaction(async (client) => {
        // Execute the migration SQL
        await client.query(m.sql);

        // Record the migration in the tracking table
        await client.query(
          'INSERT INTO _structura_schema_migrations (version, name, checksum, applied_at) VALUES ($1, $2, $3, NOW())',
          [m.version, m.name, m.checksum]
        );
      });

      const durationMs = Date.now() - start;
      logger.info(`Applied migration ${m.version} successfully in ${durationMs}ms`, 'SchemaMigrator');
      details.push({ version: m.version, name: m.name, durationMs });
    }

    return {
      applied: details.length,
      details,
    };
  }
}

export const schemaMigrator = new SchemaMigrator();
