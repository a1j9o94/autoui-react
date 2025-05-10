// Export action router
export {
  ActionRouter,
  ActionType,
  createDefaultRouter,
  type ActionRouteConfig,
} from './core/action-router';

// Export schema adapters// Export the main AutoUI component
export { AutoUI } from './AutoUI';
export type { AutoUIProps } from './AutoUI';

// Export core types for public use
export {
  uiSpecNode,
  uiEvent,
  uiEventType,
} from './schema/ui';

export type {
  UISpecNode,
  UIEvent,
  UIEventType,
  UIState,
  PlannerInput,
} from './schema/ui';

// Export event system
export {
  createEventHook,
  type EventHook,
  type EventHookContext,
  type EventHookOptions,
} from './core/events';

// Export system events
export {
  SystemEventType,
  systemEvents,
  createSystemEvent,
  type SystemEventHook,
  type AnySystemEvent,
} from './core/system-events';

// Export schema adapters
export {
  createSchemaAdapter,
  DrizzleAdapter,
} from './adapters/schema';

export type {
  SchemaAdapter,
  SchemaAdapterOptions,
  DrizzleAdapterOptions,
} from './adapters/schema';