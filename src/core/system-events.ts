import { UISpecNode, PlannerInput } from "../schema/ui";

/**
 * System event types that represent the internal AutoUI lifecycle
 */
export enum SystemEventType {
  // Planning events
  PLAN_START = "PLAN_START", // Before AI planning begins
  PLAN_PROMPT_CREATED = "PLAN_PROMPT_CREATED", // After prompt is built
  PLAN_RESPONSE_CHUNK = "PLAN_RESPONSE_CHUNK", // For each AI response chunk
  PLAN_COMPLETE = "PLAN_COMPLETE", // After planning is complete
  PLAN_ERROR = "PLAN_ERROR", // Planning error occurred

  // Binding events
  BINDING_RESOLUTION_START = "BINDING_RESOLUTION_START", // Before bindings are resolved
  BINDING_RESOLUTION_COMPLETE = "BINDING_RESOLUTION_COMPLETE", // After bindings are resolved

  // Data events
  DATA_FETCH_START = "DATA_FETCH_START", // Before data is fetched
  DATA_FETCH_COMPLETE = "DATA_FETCH_COMPLETE", // After data is fetched

  // Rendering events
  RENDER_START = "RENDER_START", // Before layout is rendered
  RENDER_COMPLETE = "RENDER_COMPLETE", // After layout is rendered

  // Prefetch events (for future use)
  PREFETCH_START = "PREFETCH_START", // Before prefetching begins
  PREFETCH_COMPLETE = "PREFETCH_COMPLETE", // After prefetching completes
}

/**
 * Base system event interface
 */
export interface SystemEvent {
  type: SystemEventType;
  timestamp: number;
}

/**
 * Planning events
 */
export interface PlanStartEvent extends SystemEvent {
  type: SystemEventType.PLAN_START;
  plannerInput: PlannerInput;
}

export interface PlanPromptCreatedEvent extends SystemEvent {
  type: SystemEventType.PLAN_PROMPT_CREATED;
  prompt: string;
}

export interface PlanResponseChunkEvent extends SystemEvent {
  type: SystemEventType.PLAN_RESPONSE_CHUNK;
  chunk: string;
  isComplete: boolean;
}

export interface PlanCompleteEvent extends SystemEvent {
  type: SystemEventType.PLAN_COMPLETE;
  layout: UISpecNode;
  executionTimeMs: number;
}

export interface PlanErrorEvent extends SystemEvent {
  type: SystemEventType.PLAN_ERROR;
  error: Error;
}

/**
 * Binding events
 */
export interface BindingResolutionStartEvent extends SystemEvent {
  type: SystemEventType.BINDING_RESOLUTION_START;
  layout: UISpecNode;
}

export interface BindingResolutionCompleteEvent extends SystemEvent {
  type: SystemEventType.BINDING_RESOLUTION_COMPLETE;
  originalLayout: UISpecNode;
  resolvedLayout: UISpecNode;
}

/**
 * Data events
 */
export interface DataFetchStartEvent extends SystemEvent {
  type: SystemEventType.DATA_FETCH_START;
  tableName: string;
  query: unknown;
}

export interface DataFetchCompleteEvent extends SystemEvent {
  type: SystemEventType.DATA_FETCH_COMPLETE;
  tableName: string;
  results: unknown[];
  executionTimeMs: number;
}

/**
 * Rendering events
 */
export interface RenderStartEvent extends SystemEvent {
  type: SystemEventType.RENDER_START;
  layout: UISpecNode;
}

export interface RenderCompleteEvent extends SystemEvent {
  type: SystemEventType.RENDER_COMPLETE;
  layout: UISpecNode;
  renderTimeMs: number;
}

/**
 * Prefetch events
 */
export interface PrefetchStartEvent extends SystemEvent {
  type: SystemEventType.PREFETCH_START;
  depth: number;
}

export interface PrefetchCompleteEvent extends SystemEvent {
  type: SystemEventType.PREFETCH_COMPLETE;
  prefetchedLayouts: Record<string, UISpecNode>;
}

/**
 * Union type of all system events
 */
export type AnySystemEvent =
  | PlanStartEvent
  | PlanPromptCreatedEvent
  | PlanResponseChunkEvent
  | PlanCompleteEvent
  | PlanErrorEvent
  | BindingResolutionStartEvent
  | BindingResolutionCompleteEvent
  | DataFetchStartEvent
  | DataFetchCompleteEvent
  | RenderStartEvent
  | RenderCompleteEvent
  | PrefetchStartEvent
  | PrefetchCompleteEvent;

/**
 * System event hook type
 */
export type SystemEventHook<T extends SystemEvent = AnySystemEvent> = (
  event: T
) => void | Promise<void>;

/**
 * System event manager
 */
export class SystemEventManager {
  private listeners: Partial<Record<SystemEventType, SystemEventHook[]>> = {};

  /**
   * Register a listener for a specific system event type
   *
   * @param eventType - The system event type to listen for
   * @param listener - The listener function
   * @returns Function to unregister the listener
   */
  public on<T extends SystemEventType>(
    eventType: T,
    listener: SystemEventHook<Extract<AnySystemEvent, { type: T }>>
  ): () => void {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }

    this.listeners[eventType]?.push(listener as SystemEventHook);

    return () => {
      if (this.listeners[eventType]) {
        this.listeners[eventType] = this.listeners[eventType]?.filter(
          (l) => l !== listener
        );
      }
    };
  }

  /**
   * Emit a system event to all registered listeners
   *
   * @param event - The system event to emit
   */
  public async emit<T extends AnySystemEvent>(event: T): Promise<void> {
    const listeners = this.listeners[event.type] || [];

    for (const listener of listeners) {
      await listener(event);
    }
  }
}

// Create a singleton instance for global access
export const systemEvents = new SystemEventManager();

/**
 * Helper to create a typed system event
 *
 * @param type - The system event type
 * @param data - Additional event data
 * @returns A system event object
 */
export function createSystemEvent<T extends SystemEventType>(
  type: T,
  data: Omit<Extract<AnySystemEvent, { type: T }>, "type" | "timestamp">
): Extract<AnySystemEvent, { type: T }> {
  return {
    type,
    timestamp: Date.now(),
    ...data,
  } as Extract<AnySystemEvent, { type: T }>;
}
