import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';

type Endpoint = {
  name: string;
  config: PoolConfig;
};

const CONNECTION_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EPIPE',
  'ETIMEDOUT',
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
]);

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly endpoints: Endpoint[];
  private readonly pools: Array<Pool | null>;
  private activeIndex = 0;
  private readonly preferPrimary: boolean;
  private readonly preferredIndex = 0;
  private readonly failbackCooldownMs: number;
  private readonly failbackRetryMs: number;
  private lastFailoverAt = 0;
  private lastFailbackAttemptAt = 0;

  constructor() {
    this.endpoints = this.resolveEndpoints();

    if (!this.endpoints.length) {
      throw new Error('DatabaseService requires at least one database endpoint');
    }

    this.pools = this.endpoints.map(() => null);

    this.preferPrimary = this.parseBoolean(process.env.DB_PREFER_PRIMARY, true);
    this.failbackCooldownMs = this.parseNumber(process.env.DB_FAILBACK_COOLDOWN_MS, 30000);
    this.failbackRetryMs = this.parseNumber(process.env.DB_FAILBACK_RETRY_MS, 10000);

    this.logger.log(
      `Endpoints configurados para failover: ${this.endpoints
        .map((endpoint) => `${endpoint.name} (${endpoint.config.host}:${endpoint.config.port})`)
        .join(', ')}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.pools.map((_, index) => this.disposePool(index)));
  }

  getActiveEndpoint(): string {
    const endpoint = this.endpoints[this.activeIndex];
    return endpoint ? endpoint.name : 'desconocido';
  }

  async query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    return this.runWithFailover((pool) => pool.query<T>(text, params));
  }

  async getClient(): Promise<PoolClient> {
    return this.runWithFailover((pool) => pool.connect());
  }

  async runWithClient<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      return await handler(client);
    } finally {
      client.release();
    }
  }

  private async runWithFailover<T>(operation: (pool: Pool, endpoint: Endpoint) => Promise<T>, attempt = 0): Promise<T> {
    await this.maybeFailback();

    const index = this.activeIndex;
    const endpoint = this.endpoints[index];
    const pool = await this.ensurePool(index);

    try {
      return await operation(pool, endpoint);
    } catch (error) {
      if (!this.shouldRetry(error) || this.endpoints.length === 1) {
        throw error;
      }

      if (attempt >= this.endpoints.length - 1) {
        throw error;
      }

      await this.handleOperationFailure(index, error as Error);
      return this.runWithFailover(operation, attempt + 1);
    }
  }

  private async ensurePool(index: number): Promise<Pool> {
    let pool = this.pools[index];
    if (pool) {
      return pool;
    }

    const endpoint = this.endpoints[index];
    const poolConfig = { ...endpoint.config };

    if (poolConfig.connectionTimeoutMillis === undefined) {
      poolConfig.connectionTimeoutMillis = this.parseNumber(process.env.DB_CONNECTION_TIMEOUT_MS, 5000);
    }

    if (poolConfig.idleTimeoutMillis === undefined) {
      poolConfig.idleTimeoutMillis = this.parseNumber(process.env.DB_IDLE_TIMEOUT_MS, 30000);
    }

    if (poolConfig.max === undefined && process.env.DB_POOL_MAX) {
      poolConfig.max = this.parseNumber(process.env.DB_POOL_MAX, 10);
    }

    pool = new Pool(poolConfig);
    pool.on('error', (error) => this.onPoolError(index, error));

    this.pools[index] = pool;
    this.logger.log(`Pool inicializado para ${endpoint.name} (${endpoint.config.host}:${endpoint.config.port})`);

    return pool;
  }

  private onPoolError(index: number, error: Error): void {
    const endpoint = this.endpoints[index];
    this.logger.error(
      `Error en el pool de ${endpoint.name} (${endpoint.config.host}:${endpoint.config.port}): ${error.message}`,
    );
    void this.disposePool(index);

    if (this.endpoints.length > 1 && this.activeIndex === index) {
      this.activeIndex = (index + 1) % this.endpoints.length;
      this.lastFailoverAt = Date.now();
      const nextEndpoint = this.endpoints[this.activeIndex];
      this.logger.warn(`Failover activado por evento del pool, nuevo objetivo: ${nextEndpoint.name}`);
    }
  }

  private async handleOperationFailure(index: number, error: Error): Promise<void> {
    const endpoint = this.endpoints[index];
    this.logger.warn(
      `Fallo al intentar operar contra ${endpoint.name} (${endpoint.config.host}:${endpoint.config.port}): ${error.message}. Intentando failover...`,
    );

    await this.disposePool(index);

    if (this.endpoints.length > 1) {
      this.activeIndex = (index + 1) % this.endpoints.length;
      this.lastFailoverAt = Date.now();
      const nextEndpoint = this.endpoints[this.activeIndex];
      this.logger.warn(`Failover: usando ${nextEndpoint.name} (${nextEndpoint.config.host}:${nextEndpoint.config.port})`);
    }
  }

  private async disposePool(index: number): Promise<void> {
    const pool = this.pools[index];
    if (!pool) {
      return;
    }

    this.pools[index] = null;

    try {
      await pool.end();
    } catch (error) {
      const endpoint = this.endpoints[index];
      this.logger.warn(
        `Error al cerrar pool de ${endpoint.name} (${endpoint.config.host}:${endpoint.config.port}): ${(error as Error).message}`,
      );
    }
  }

  private resolveEndpoints(): Endpoint[] {
    const user = process.env.DB_USER ?? 'app';
    const password = process.env.DB_PASSWORD ?? 'ejemplo';
    const database = process.env.DB_NAME ?? 'moviedb';
    const ssl = this.parseBoolean(process.env.DB_SSL, false);

    const primary: Endpoint = {
      name: process.env.DB_PRIMARY_NAME ?? 'master1',
      config: {
        host: process.env.DB_PRIMARY_HOST ?? 'localhost',
        port: this.parseNumber(process.env.DB_PRIMARY_PORT, 5432),
        user,
        password,
        database,
        ssl: ssl ? { rejectUnauthorized: false } : undefined,
      },
    };

    const secondary: Endpoint = {
      name: process.env.DB_SECONDARY_NAME ?? 'master2',
      config: {
        host: process.env.DB_SECONDARY_HOST ?? 'localhost',
        port: this.parseNumber(process.env.DB_SECONDARY_PORT, 5433),
        user,
        password,
        database,
        ssl: ssl ? { rejectUnauthorized: false } : undefined,
      },
    };

    const extraEndpoints = this.parseAdditionalEndpoints({ user, password, database, ssl });

    const endpoints = [primary, secondary, ...extraEndpoints].filter((endpoint, index, array) => {
      return (
        index ===
        array.findIndex((current) =>
          current.config.host === endpoint.config.host && current.config.port === endpoint.config.port
        )
      );
    });

    return endpoints;
  }

  private async maybeFailback(): Promise<void> {
    if (!this.preferPrimary || this.endpoints.length <= 1 || this.activeIndex === this.preferredIndex) {
      return;
    }

    const now = Date.now();
    if (now - this.lastFailoverAt < this.failbackCooldownMs) {
      return;
    }

    if (now - this.lastFailbackAttemptAt < this.failbackRetryMs) {
      return;
    }

    this.lastFailbackAttemptAt = now;

    try {
      const pool = await this.ensurePool(this.preferredIndex);
      await pool.query('SELECT 1');
    } catch (error) {
      this.logger.debug(`Failback: master preferido aún no disponible (${(error as Error).message})`);
      await this.disposePool(this.preferredIndex);
      return;
    }

    this.activeIndex = this.preferredIndex;
    this.logger.log(`Failback: restaurado endpoint preferido ${this.endpoints[this.preferredIndex].name}`);
  }

  private parseAdditionalEndpoints(base: { user: string; password: string; database: string; ssl: boolean }): Endpoint[] {
    const raw = process.env.DB_FAILOVER_TARGETS;
    if (!raw) {
      return [];
    }

    const endpoints: Endpoint[] = [];
    const entries = raw.split(',').map((entry) => entry.trim()).filter(Boolean);

    entries.forEach((entry, idx) => {
      const [nameOrHost, maybeHost] = entry.split('@');
      const hasName = !!maybeHost;
      const hostPort = hasName ? maybeHost : nameOrHost;
      const name = hasName ? nameOrHost : `replica_${idx + 1}`;

      const [rawHost, portRaw] = hostPort.split(':');
      const host = rawHost?.trim();
      if (!host) {
        this.logger.warn(`Formato inválido en DB_FAILOVER_TARGETS para entrada "${entry}"`);
        return;
      }

      const port = this.parseNumber(portRaw, 5432);

      endpoints.push({
        name,
        config: {
          host,
          port,
          user: base.user,
          password: base.password,
          database: base.database,
          ssl: base.ssl ? { rejectUnauthorized: false } : undefined,
        },
      });
    });

    return endpoints;
  }

  private shouldRetry(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const code = (error as { code?: string }).code;
    if (code && CONNECTION_ERROR_CODES.has(code)) {
      return true;
    }

    const message = String((error as { message?: string }).message ?? '').toLowerCase();
    if (!message) {
      return false;
    }

    return (
      message.includes('terminating connection') ||
      message.includes('connection terminated') ||
      message.includes('server closed the connection') ||
      message.includes('connection refused') ||
      message.includes('no pg_hba.conf entry')
    );
  }

  private parseNumber(value: string | number | undefined, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }

  private parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (!value) {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
    return fallback;
  }
}
