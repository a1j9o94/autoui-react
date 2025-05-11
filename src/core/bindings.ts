import { UISpecNode } from "../schema/ui";
import {
  createSystemEvent,
  systemEvents,
  SystemEventType,
} from "./system-events";

/**
 * Interface for the runtime data context
 */
export interface DataContext {
  [key: string]: unknown;
}

// Create a cache to prevent redundant resolving of the same node with same context
// This helps prevent infinite loops
// interface CacheKey { // Commented out as CacheKey is unused
//   nodeId: string;
//   contextHash: string;
// }
const bindingsCache = new Map<string, UISpecNode>();
const MAX_CACHE_SIZE = 50;
const CACHE_TTL = 2000; // 2 seconds
const nodeCacheTimestamps = new Map<string, number>();

// Simple hash function for data context objects to create cache keys
function hashDataContext(context: DataContext): string {
  return JSON.stringify(context);
}

// Create a cache key from node id and context
function createCacheKey(nodeId: string, context: DataContext): string {
  return `${nodeId}:${hashDataContext(context)}`;
}

/**
 * Get a value from the data context by path
 * Supports dot notation for nested properties
 *
 * @param context - The data context object
 * @param path - The path to the value (e.g., "emails.data")
 * @returns The value at the path, or undefined if not found
 */
export function getValueByPath(context: DataContext, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a value in the data context by path
 * Creates intermediate objects if they don't exist
 *
 * @param context - The data context object
 * @param path - The path to set (e.g., "emails.selected")
 * @param value - The value to set
 * @returns Updated data context
 */
export function setValueByPath(
  context: DataContext,
  path: string,
  value: unknown
): DataContext {
  // Create a shallow copy to avoid mutating the original
  const result = { ...context };
  const parts = path.split(".");

  if (parts.length === 0) return result; // No path, return original context

  let current: unknown = result;

  // Navigate to the parent object of the property we want to set
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];

    // Ensure current is an object and not null before trying to access/create properties
    if (typeof current !== "object" || current === null) {
      // This state should ideally not be reached if path creation is consistent.
      // If it is, it means we are trying to set a nested property on a primitive.
      console.error("setValueByPath: Cannot create path in a non-object.");
      return context; // Return original context to avoid undefined behavior
    }

    const currentAsObject = current as Record<string, unknown>; // Type assertion after check

    // Create the object if it doesn't exist or is not an object
    if (
      !(part in currentAsObject) ||
      typeof currentAsObject[part] !== "object" ||
      currentAsObject[part] === null
    ) {
      currentAsObject[part] = {};
    }

    // Move to the next level
    current = currentAsObject[part];
  }

  // Set the value at the final property
  const lastPart = parts[parts.length - 1];
  if (typeof current === "object" && current !== null) {
    (current as Record<string, unknown>)[lastPart] = value;
  } else if (
    parts.length === 1 &&
    typeof result === "object" &&
    result !== null
  ) {
    // Handle setting a property on the root if the path had only one part
    // and current became non-object (should not happen with loop logic but as safeguard)
    (result as Record<string, unknown>)[lastPart] = value;
  } else {
    console.warn(
      `setValueByPath: Could not set value for path "${path}". Final segment location is not an object.`
    );
    // Optionally return original context or throw error
    return context;
  }

  return result;
}

/**
 * Process a binding value from a UI node
 *
 * @param binding - The binding value (string path or direct value)
 * @param context - The data context object
 * @returns The resolved value
 */
export function processBinding(
  binding: unknown,
  context: DataContext
): unknown {
  // If binding is a string, treat it as a path to a value in the context
  if (typeof binding === "string") {
    return getValueByPath(context, binding);
  }

  // If binding is an array, process each item recursively
  if (Array.isArray(binding)) {
    return binding.map((item) => processBinding(item, context));
  }

  // If binding is an object, process each property recursively
  if (binding !== null && typeof binding === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(binding)) {
      result[key] = processBinding(value, context);
    }
    return result;
  }

  // Otherwise, return the binding as-is
  return binding;
}

/**
 * Create a deep clone of a node with all bindings resolved
 *
 * @param node - The UI specification node
 * @param context - The data context object
 * @returns A new node with bindings resolved to concrete values
 */
export async function resolveBindings(
  node: UISpecNode,
  context: DataContext
): Promise<UISpecNode> {
  // Check if we have a cached result first
  const currentTime = Date.now();
  const cacheKey = createCacheKey(node.id, context);
  const cachedNode = bindingsCache.get(cacheKey);
  const cachedTimestamp = nodeCacheTimestamps.get(cacheKey);

  // If we have a cached result and it's not too old, use it
  if (
    cachedNode &&
    cachedTimestamp &&
    currentTime - cachedTimestamp < CACHE_TTL
  ) {
    return cachedNode;
  }

  // Emit binding resolution start event
  await systemEvents.emit(
    createSystemEvent(SystemEventType.BINDING_RESOLUTION_START, {
      layout: node,
    })
  );

  // Clone the node to avoid mutating the original
  const result: UISpecNode = {
    ...node,
    props: node.props ? { ...node.props } : null,
    events: node.events ? { ...node.events } : null,
  };

  // Resolve bindings to concrete values
  if (node.bindings) {
    // Process each binding in the node
    for (const [key, binding] of Object.entries(node.bindings)) {
      const value = processBinding(binding, context);

      // Add the resolved value to props if not undefined and is a string
      if (value !== undefined && typeof value === "string") {
        if (!result.props) {
          result.props = {};
        }
        result.props[key] = value;
      } else if (value !== undefined && typeof value !== "string") {
        // Handle non-string values from bindings if necessary, or log a warning
        // For now, we will not assign non-string values to props to maintain type safety
        // console.warn(`Binding for '${key}' resolved to a non-string value:`, value);
      }
    }
  }

  // Process children recursively
  if (node.children) {
    result.children = await Promise.all(
      node.children.map((child) => resolveBindings(child, context))
    );
  }

  // Emit binding resolution complete event
  await systemEvents.emit(
    createSystemEvent(SystemEventType.BINDING_RESOLUTION_COMPLETE, {
      originalLayout: node,
      resolvedLayout: result,
    })
  );

  // Cache the result
  bindingsCache.set(cacheKey, result);
  nodeCacheTimestamps.set(cacheKey, currentTime);

  // Clean up cache if it gets too big
  if (bindingsCache.size > MAX_CACHE_SIZE) {
    // Find the oldest entry
    const entries = [...nodeCacheTimestamps.entries()];
    if (entries.length > 0) {
      entries.sort((a, b) => a[1] - b[1]);
      const oldestKey = entries[0][0];
      bindingsCache.delete(oldestKey);
      nodeCacheTimestamps.delete(oldestKey);
    }
  }

  return result;
}

/**
 * Execute an action based on event configuration
 *
 * @param action - The action type (e.g., "VIEW_DETAIL")
 * @param targetId - The target node ID
 * @param payload - Optional payload for the action
 * @param context - The data context
 * @param layoutTree - The current UI layout tree
 * @returns Updated data context
 */
export function executeAction(
  action: string,
  targetId?: string,
  payload?: Record<string, unknown>,
  context: DataContext = {},
  layoutTree?: UISpecNode
): DataContext {
  // Clone the context to avoid mutations
  let newContext = { ...context };

  switch (action) {
    case "VIEW_DETAIL": {
      // Set the selected item in the context
      if (payload?.item) {
        newContext = setValueByPath(newContext, "selected", payload.item);
      }

      // Update visibility of the target node if provided
      if (targetId && layoutTree) {
        // For now, we don't modify the layout tree directly
        // This would be handled by the reducer in a real implementation
      }
      break;
    }

    case "HIDE_DETAIL": {
      // Clear the selected item
      newContext = setValueByPath(newContext, "selected", null);

      // Update visibility of the target node if provided
      if (targetId && layoutTree) {
        // For now, we don't modify the layout tree directly
        // This would be handled by the reducer in a real implementation
      }
      break;
    }

    case "SET_VALUE": {
      // Set a value in the context
      if (payload?.path && "value" in payload) {
        const path = String(payload.path);
        newContext = setValueByPath(newContext, path, payload.value);
      }
      break;
    }

    // Add more actions as needed

    default:
      console.warn(`Unknown action: ${action}`);
  }

  return newContext;
}
