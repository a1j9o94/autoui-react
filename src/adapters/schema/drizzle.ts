import { DataContext } from "../../core/bindings";

/**
 * Drizzle schema adapter types
 */

// Simplified representation of Drizzle schema
export interface DrizzleColumn {
  name: string;
  dataType: string;
  notNull?: boolean;
  defaultValue?: unknown;
  primaryKey?: boolean;
  unique?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface DrizzleTable {
  name: string;
  schema: string;
  columns: Record<string, DrizzleColumn>;
}

export interface DrizzleSchema {
  [tableName: string]: DrizzleTable;
}

// Database client interface
export interface DrizzleClientConfig {
  connectionString?: string | undefined;
  client?: unknown | undefined; // The actual Drizzle client instance
  queryFn?: ((tableName: string, query: any) => Promise<unknown[]>) | undefined;
}

// Main adapter interface
export interface DrizzleAdapterOptions {
  schema: DrizzleSchema;
  client?: DrizzleClientConfig | undefined;
  useMockData?: boolean | undefined;
  mockData?: Record<string, unknown[]> | undefined;
}

/**
 * Adapter for Drizzle ORM schemas
 * Handles converting Drizzle schema to AutoUI schema format
 * and optionally connects to a database
 */
export class DrizzleAdapter {
  private schema: DrizzleSchema;
  private client: DrizzleClientConfig | undefined;
  private useMockData: boolean;
  private mockData: Record<string, unknown[]>;

  constructor(options: DrizzleAdapterOptions) {
    this.schema = options.schema;
    this.client = options.client;
    this.useMockData = options.useMockData ?? !options.client;
    this.mockData = options.mockData ?? {};
  }

  /**
   * Convert Drizzle schema to AutoUI schema format
   */
  public getSchema(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    Object.entries(this.schema).forEach(([tableName, table]) => {
      result[tableName] = {
        tableName: table.name,
        schema: table.schema,
        columns: this.convertColumns(table.columns),
        // Include mock data if available and mock mode is enabled
        ...(this.useMockData && this.mockData[tableName]
          ? { sampleData: this.mockData[tableName] }
          : {}),
      };
    });

    return result;
  }

  /**
   * Convert Drizzle columns to AutoUI column format
   */
  private convertColumns(
    columns: Record<string, DrizzleColumn>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    Object.entries(columns).forEach(([columnName, column]) => {
      result[columnName] = {
        type: this.mapDataType(column.dataType),
        notNull: column.notNull,
        defaultValue: column.defaultValue,
        primaryKey: column.primaryKey,
        unique: column.unique,
        references: column.references,
      };
    });

    return result;
  }

  /**
   * Map Drizzle data types to standard types
   */
  private mapDataType(drizzleType: string): string {
    const typeMap: Record<string, string> = {
      serial: "integer",
      integer: "integer",
      int: "integer",
      bigint: "integer",
      text: "string",
      varchar: "string",
      char: "string",
      boolean: "boolean",
      bool: "boolean",
      timestamp: "datetime",
      timestamptz: "datetime",
      date: "date",
      time: "time",
      json: "object",
      jsonb: "object",
      real: "number",
      float: "number",
      double: "number",
      numeric: "number",
      decimal: "number",
    };

    return typeMap[drizzleType.toLowerCase()] || "string";
  }

  /**
   * Execute a query against the database
   */
  public async query(tableName: string, query: any): Promise<unknown[]> {
    if (this.useMockData) {
      return this.mockData[tableName] || [];
    }

    if (!this.client) {
      throw new Error("No database client provided and mock mode is disabled");
    }

    if (this.client.queryFn) {
      return this.client.queryFn(tableName, query);
    }

    throw new Error("No query function provided in client config");
  }

  /**
   * Initialize the data context with schema information and optional mock data
   */
  public async initializeDataContext(): Promise<DataContext> {
    const context: DataContext = {};

    for (const [tableName, table] of Object.entries(this.schema)) {
      context[tableName] = {
        schema: table,
        data: this.useMockData ? this.mockData[tableName] || [] : [],
        selected: null,
      };
    }

    return context;
  }
}
