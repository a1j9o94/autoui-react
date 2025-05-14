import { z } from "zod";
import { DataContext } from "../core/bindings";

/**
 * Event types that can be triggered by UI elements
 */
export const uiEventType = z.enum([
  "INIT",
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
const runtimeRecord = z.record(z.unknown()).nullable();

// --- Interface for Runtime UISpecNode ---
export interface UISpecNodeInterface {
  id: string;
  node_type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bindings: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  events: Record<
    string,
    {
      action: string;
      target: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: Record<string, any> | null;
    }
  > | null;
  children: UISpecNodeInterface[] | null;
}

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
  z.object({
    type: z.literal("SET_DATA_CONTEXT"),
    payload: z.record(z.string(), z.unknown()),
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
  dataContext: z.record(z.string(), z.unknown()),
});

export type UIState = z.infer<typeof uiState> & { dataContext: DataContext };

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
