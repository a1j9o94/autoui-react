import { DataContext } from "../../core/bindings";
import { DrizzleAdapter, DrizzleAdapterOptions } from "./drizzle";

/**
 * Generic schema adapter interface
 */
export interface SchemaAdapter {
  getSchema(): Record<string, unknown>;
  query(tableName: string, query: any): Promise<unknown[]>;
  initializeDataContext(): Promise<DataContext>;
}

/**
 * Schema adapter options union type
 */
export type SchemaAdapterOptions =
  | { type: "drizzle"; options: DrizzleAdapterOptions }
  | { type: "custom"; adapter: SchemaAdapter };

/**
 * Factory function to create the appropriate schema adapter
 */
export function createSchemaAdapter(
  options: SchemaAdapterOptions
): SchemaAdapter {
  switch (options.type) {
    case "drizzle":
      return new DrizzleAdapter(options.options);
    case "custom":
      return options.adapter;
    default:
      throw new Error(
        `Unsupported schema adapter type: ${(options as any).type}`
      );
  }
}

export { DrizzleAdapter, type DrizzleAdapterOptions };
