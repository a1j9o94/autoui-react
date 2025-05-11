import { z } from "zod";
// zodToJsonSchema is not used, can be removed if not planned for immediate use elsewhere
// import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Event types that can be triggered by UI elements
 */
export const uiEventType = z.enum([
  "CLICK",
  "CHANGE",
  "SUBMIT",
  "MOUSEOVER",
  "MOUSEOUT",
  "FOCUS",
  "BLUR",
]);

export type UIEventType = z.infer<typeof uiEventType>;

/**
 * Event payload schema
 */
export const uiEvent = z.object({
  type: uiEventType,
  nodeId: z.string(),
  timestamp: z.number().nullable(),
  // If uiEvent.payload should also be Record<string, string>, this should change.
  // For now, keeping as z.record(z.unknown()) as per original to limit change scope.
  // However, if this payload is used in UISpecNode.events.payload, it will be constrained by zUnknownObject there.
  payload: z.record(z.unknown()).nullable(),
});

export type UIEvent = z.infer<typeof uiEvent>;

/**
 * AI response types
 */
export const aiResponseType = z.enum(["AI_RESPONSE", "ERROR"]);

export type AIResponseType = z.infer<typeof aiResponseType>;

// This is the definition for props and event payloads inside UISpecNode
const stringRecord = z.record(z.string()).nullable();

// Forward declaration of the TypeScript type for use in the Zod schema
// This helps break circular dependencies for z.lazy() in some TS configurations.
export interface UISpecNodeInterface {
  id: string;
  node_type: string;
  props: Record<string, string> | null;
  bindings: Record<string, string> | null;
  events: Record<
    string,
    {
      action: string;
      target: string;
      payload: Record<string, string> | null;
    }
  > | null;
  children: UISpecNodeInterface[] | null;
}

export const uiSpecNode: z.ZodType<UISpecNodeInterface> = z.object({
  id: z.string(),
  node_type: z.string(),
  props: stringRecord,
  bindings: stringRecord,
  events: z
    .record(
      z.string(),
      z.object({
        action: z.string(),
        target: z.string(),
        payload: stringRecord,
      })
    )
    .nullable(),
  children: z.lazy(() => z.array(uiSpecNode)).nullable(), // Recursive reference
});

// The final exported type, inferred from the Zod schema.
export type UISpecNode = z.infer<typeof uiSpecNode>;

/**
 * Actions that can be dispatched to the reducer
 */
export const uiAction = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("UI_EVENT"),
    event: uiEvent,
  }),
  z.object({
    type: z.literal("AI_RESPONSE"),
    node: uiSpecNode, // Uses the new uiSpecNode definition
  }),
  z.object({
    type: z.literal("PARTIAL_UPDATE"),
    nodeId: z.string(),
    node: uiSpecNode, // Uses the new uiSpecNode definition
  }),
  z.object({
    type: z.literal("ADD_NODE"),
    parentId: z.string(),
    node: uiSpecNode, // Uses the new uiSpecNode definition
    index: z.number().nullable(),
  }),
  z.object({
    type: z.literal("REMOVE_NODE"),
    nodeId: z.string(),
  }),
  z.object({
    type: z.literal("ERROR"),
    message: z.string(),
  }),
  z.object({
    type: z.literal("LOADING"),
    isLoading: z.boolean(),
  }),
]);

export type UIAction = z.infer<typeof uiAction>;

/**
 * Application state for the UI engine
 */
export const uiState = z.object({
  layout: uiSpecNode.nullable(), // Uses the new uiSpecNode definition
  loading: z.boolean(),
  history: z.array(uiEvent),
  error: z.string().nullable(),
});

export type UIState = z.infer<typeof uiState>;

/**
 * Input for the AI planner
 */
export const plannerInput = z.object({
  schema: z.record(z.unknown()), // This allows any kind of schema definition from the user
  goal: z.string(),
  history: z.array(uiEvent).nullable(),
  userContext: z.record(z.unknown()).nullable().optional(), // User context can be any object, null, or undefined
});

export type PlannerInput = z.infer<typeof plannerInput>;
