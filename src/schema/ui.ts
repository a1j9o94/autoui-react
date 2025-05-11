import { z } from "zod";

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
  payload: z.record(z.unknown()).nullable(),
});

export type UIEvent = z.infer<typeof uiEvent>;

/**
 * AI response types
 */
export const aiResponseType = z.enum(["AI_RESPONSE", "ERROR"]);

export type AIResponseType = z.infer<typeof aiResponseType>;

// --- Runtime Specific Types ---
const runtimeRecord = z.record(z.any()).nullable();

// --- OpenAI Specific Types (Simplified values, records can be null) ---
const openAISimplifiedValue = z.string().nullable(); // Values can only be string or null

// For OpenAI: props/bindings are records of these simplified values, or null.
const openAIRecordSimplifiedNullable = z.record(openAISimplifiedValue).nullable();

// For OpenAI: event payloads can be null, or a record of these simplified values.
const openAIEventPayloadSimplifiedNullable = z.record(openAISimplifiedValue).nullable(); // Already was nullable, name changed for clarity

// --- Interface for Runtime UISpecNode ---
export interface UISpecNodeInterface {
  id: string;
  node_type: string;
  props: Record<string, any> | null;
  bindings: Record<string, any> | null;
  events: Record<
    string,
    {
      action: string;
      target: string;
      payload: Record<string, any> | null;
    }
  > | null;
  children: UISpecNodeInterface[] | null;
}

// --- OpenAI Schema Definition (All fields required by Zod default, complex fields are nullable) ---
const openAIBaseNode = z.object({
  id: z.string(), 
  node_type: z.string(), 
  props: openAIRecordSimplifiedNullable,        // Nullable record
  bindings: openAIRecordSimplifiedNullable,     // Nullable record
  events: z
    .record(
      z.string(),
      z.object({
        action: z.string(),
        target: z.string(),
        payload: openAIEventPayloadSimplifiedNullable, 
      })
    )
    .nullable(), // Entire events object is nullable
  children: z.null(), // Base children are null. When extended, it will be an array or null.
});

const openAINodeL4 = openAIBaseNode;

const openAINodeL3 = openAIBaseNode.extend({
  children: z.array(openAINodeL4).nullable(), 
});

const openAINodeL2 = openAIBaseNode.extend({
  children: z.array(openAINodeL3).nullable(),
});

export const openAIUISpec = openAIBaseNode.extend({
  children: z.array(openAINodeL2).nullable(),
});

// --- Runtime Schema Definition ---
export const uiSpecNode: z.ZodType<UISpecNodeInterface> = z.object({
  id: z.string(),
  node_type: z.string(),
  props: runtimeRecord,      
  bindings: runtimeRecord,   
  events: z
    .record(
      z.string(),
      z.object({
        action: z.string(),
        target: z.string(),
        payload: runtimeRecord, 
      })
    )
    .nullable(),
  children: z.lazy(() => z.array(uiSpecNode)).nullable(),
});

// --- Exported Types ---
export type UISpecNode = z.infer<typeof uiSpecNode>;
export type OpenAIUISpec = z.infer<typeof openAIUISpec>;

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
    node: uiSpecNode, 
  }),
  z.object({
    type: z.literal("PARTIAL_UPDATE"),
    nodeId: z.string(),
    node: uiSpecNode, 
  }),
  z.object({
    type: z.literal("ADD_NODE"),
    parentId: z.string(),
    node: uiSpecNode, 
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
  layout: uiSpecNode.nullable(), 
  loading: z.boolean(),
  history: z.array(uiEvent),
  error: z.string().nullable(),
});

export type UIState = z.infer<typeof uiState>;

/**
 * Input for the AI planner
 */
export const plannerInput = z.object({
  schema: z.record(z.unknown()), 
  goal: z.string(),
  history: z.array(uiEvent).nullable(),
  userContext: z.record(z.unknown()).nullable().optional(), 
});

export type PlannerInput = z.infer<typeof plannerInput>;

// Define a more specific type for data items
export type DataItem = Record<string, unknown>;
