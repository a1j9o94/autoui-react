// Export action router
export { ActionRouter, type ActionRouteConfig } from "./core/action-router";

// Export the main AutoUI component
export { AutoUI } from "./AutoUI";
export type { AutoUIProps } from "./AutoUI";

// Export core types for public use
export { uiSpecNode, uiEvent, uiEventType } from "./schema/ui";
export { ActionType } from "./schema/action-types";
export { componentType } from "./schema/components";
export { openAIUISpec } from "./schema/openai-ui-spec";

export type {
  UISpecNode,
  UIEvent,
  UIEventType,
  UIState,
  PlannerInput,
} from "./schema/ui";

// Export event system
export {
  createEventHook,
  type EventHook,
  type EventHookContext,
  type EventHookOptions,
} from "./core/events";

// Export system events
export {
  SystemEventType,
  systemEvents,
  createSystemEvent,
  type SystemEventHook,
  type AnySystemEvent,
} from "./core/system-events";

// Export schema adapters
export { createSchemaAdapter, DrizzleAdapter } from "./adapters/schema";

export type {
  SchemaAdapter,
  SchemaAdapterOptions,
  DrizzleAdapterOptions,
} from "./adapters/schema";

// Export AI utilities
export {
  generateComponent,
  generateUIDescription,
  generateUIComponent,
} from "./ai-utils";