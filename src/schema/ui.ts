import { z } from 'zod';

/**
 * Event types that can be triggered by UI elements
 */
export const uiEventType = z.enum([
  'CLICK',
  'CHANGE',
  'SUBMIT',
  'MOUSEOVER',
  'MOUSEOUT',
  'FOCUS',
  'BLUR',
]);

export type UIEventType = z.infer<typeof uiEventType>;

/**
 * Event payload schema
 */
export const uiEvent = z.object({
  type: uiEventType,
  nodeId: z.string(),
  timestamp: z.number().optional(),
  payload: z.record(z.any()).optional(),
});

export type UIEvent = z.infer<typeof uiEvent>;

/**
 * AI response types
 */
export const aiResponseType = z.enum([
  'AI_RESPONSE',
  'ERROR',
]);

export type AIResponseType = z.infer<typeof aiResponseType>;

/**
 * Core UI specification node
 * Represents a single element in the UI tree
 */
export const uiSpecNode = z.lazy(() => z.object({
  id: z.string(),
  type: z.string(),  // e.g., "ListView", "Button", "TextField"
  props: z.record(z.any()).optional(),
  bindings: z.record(z.any()).optional(), // Data bindings
  events: z.record(z.string(), z.object({
    action: z.string(),
    target: z.string().optional(),
    payload: z.record(z.any()).optional(),
  })).optional(),
  children: z.array(uiSpecNode).optional(),
})) as z.ZodType<UISpecNode>;

export type UISpecNode = {
  id: string;
  type: string;
  props?: Record<string, any> | undefined;
  bindings?: Record<string, any> | undefined;
  events?: Record<string, {
    action: string;
    target?: string | undefined;
    payload?: Record<string, any> | undefined;
  }> | undefined;
  children?: UISpecNode[] | undefined;
};

/**
 * Actions that can be dispatched to the reducer
 */
export const uiAction = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('UI_EVENT'),
    event: uiEvent,
  }),
  z.object({
    type: z.literal('AI_RESPONSE'),
    node: uiSpecNode,
  }),
  z.object({
    type: z.literal('PARTIAL_UPDATE'),
    nodeId: z.string(),
    node: uiSpecNode,
  }),
  z.object({
    type: z.literal('ADD_NODE'),
    parentId: z.string(),
    node: uiSpecNode,
    index: z.number().optional(),
  }),
  z.object({
    type: z.literal('REMOVE_NODE'),
    nodeId: z.string(),
  }),
  z.object({
    type: z.literal('ERROR'),
    message: z.string(),
  }),
  z.object({
    type: z.literal('LOADING'),
    isLoading: z.boolean(),
  }),
]);

export type UIAction = z.infer<typeof uiAction>;

/**
 * Application state for the UI engine
 */
export const uiState = z.object({
  layout: uiSpecNode.optional(),
  loading: z.boolean(),
  history: z.array(uiEvent),
  error: z.string().optional(),
});

export type UIState = z.infer<typeof uiState>;

/**
 * Input for the AI planner
 */
export const plannerInput = z.object({
  schema: z.record(z.unknown()),
  goal: z.string(),
  history: z.array(uiEvent).optional(),
  userContext: z.record(z.unknown()).optional(),
});

export type PlannerInput = z.infer<typeof plannerInput>;