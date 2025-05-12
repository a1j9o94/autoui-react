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
  if (!path) {
    return context;
  }

  const result = { ...context };
  const parts = path.split(".");
  let current: unknown = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];

    // Ensure the current level is an object before trying to access/modify properties
    if (typeof current !== "object" || current === null) {
      console.warn(
        `setValueByPath: Cannot traverse path "${path}". Parent segment "${
          parts[i - 1] || "(root)"
        }" is not an object.`
      );
      return context;
    }
    const currentAsObject = current as Record<string, unknown>;
    const nextPartValue = currentAsObject[part];

    if (nextPartValue === undefined || nextPartValue === null) {
      // If the next part doesn't exist or is null, create an empty object
      currentAsObject[part] = {};
    } else if (typeof nextPartValue !== "object") {
      // If the next part exists but isn't an object, we cannot traverse further.
      console.warn(
        `setValueByPath: Cannot create nested path "${path}". Segment "${part}" is not an object.`
      );
      return context; // Prevent overwriting primitives during traversal
    } else {
      // It exists and is an object, make a copy for immutability
      currentAsObject[part] = { ...(nextPartValue as Record<string, unknown>) };
    }
    // Move to the next level (which is now guaranteed to be an object)
    current = currentAsObject[part];
  }

  // Set the value at the final property
  const lastPart = parts[parts.length - 1];
  if (typeof current === "object" && current !== null) {
    // Now we are at the direct parent, safe to assign the value
    (current as Record<string, unknown>)[lastPart] = value;
  } else {
    // This case implies the path was invalid (e.g., single segment, root not object)
    console.warn(
      `setValueByPath: Could not set value for path "${path}". Final segment parent is not an object.`
    );
    return context;
  }

  return result;
}

/**
 * Process a binding value from a UI node
 *
 * @param binding - The binding value (string path, template string, or direct value)
 * @param context - The main data context object
 * @param itemData - Optional data context for the current list item
 * @returns The resolved value
 */
export function processBinding(
  binding: unknown,
  context: DataContext,
  itemData?: Record<string, unknown> // Added item context
): unknown {
  // If binding is a string, check if it's a template or a direct value
  if (typeof binding === "string") {
    // Handle Template Strings like {{item.name}} or {{user.role}}
    if (binding.startsWith("{{") && binding.endsWith("}}")) {
      const path = binding.slice(2, -2).trim();
      let value: unknown;

      // Check if path starts with 'item.' or 'row.' and we have itemData
      if (path.startsWith("item.") && itemData) {
        const itemPath = path.substring(5); // Get path within item
        value = getValueByPath(itemData, itemPath);
      } else if (path.startsWith("row.") && itemData) {
        const rowPath = path.substring(4); // Get path within item
        value = getValueByPath(itemData, rowPath);
      } else if (itemData && path in itemData) {
        // Allow direct access like {{title}} if resolving for an item
        value = getValueByPath(itemData, path);
      }

      // If not found in item or not an item path, try main context
      if (value === undefined) {
        value = getValueByPath(context, path);
      }
      return value;
    } else {
      // It's a literal string, return it directly.
      // Path resolution for the top-level binding happens in resolveBindings.
      return binding;
    }
  }

  // If binding is an array, process each item recursively (pass itemData down)
  if (Array.isArray(binding)) {
    return binding.map((item) => processBinding(item, context, itemData));
  }

  // If binding is an object, process each property recursively (pass itemData down)
  if (binding !== null && typeof binding === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(binding)) {
      result[key] = processBinding(value, context, itemData);
    }
    return result;
  }

  // Otherwise, return the binding as-is
  return binding;
}

/**
 * Create a deep clone of a node with all bindings resolved
 * Handles standard bindings and list expansion based on 'data' binding.
 *
 * @param node - The UI specification node
 * @param context - The main data context object
 * @param itemData - Optional data context for the current list item being resolved
 * @returns A new node with bindings resolved to concrete values
 */
export async function resolveBindings(
  node: UISpecNode,
  context: DataContext,
  itemData?: Record<string, unknown> // Added item context for list items
): Promise<UISpecNode> {
  // Determine the effective context for resolving this node's bindings
  const effectiveContext = itemData ? { ...context, item: itemData } : context;

  // --- Cache Logic (using effective context) ---
  const currentTime = Date.now();
  const cacheKey = createCacheKey(node.id, effectiveContext);
  const cachedNode = bindingsCache.get(cacheKey);
  const cachedTimestamp = nodeCacheTimestamps.get(cacheKey);

  if (
    cachedNode &&
    cachedTimestamp &&
    currentTime - cachedTimestamp < CACHE_TTL
  ) {
    return cachedNode;
  }

  if (!itemData) {
    await systemEvents.emit(
      createSystemEvent(SystemEventType.BINDING_RESOLUTION_START, {
        layout: node,
      })
    );
  }

  const result: UISpecNode = {
    ...node,
    props: node.props ? JSON.parse(JSON.stringify(node.props)) : null,
    events: node.events ? JSON.parse(JSON.stringify(node.events)) : null,
    bindings: node.bindings ? JSON.parse(JSON.stringify(node.bindings)) : null,
    children: null, // Initialize children to null
  };

  const resolvedBindings: Record<string, unknown> = {};
  if (node.bindings) {
    for (const [key, binding] of Object.entries(node.bindings)) {
      let value: unknown;
      // If it's a non-template string (doesn't start with {{ ), resolve it as a path.
      // Prioritize itemData if available.
      if (typeof binding === "string" && !binding.startsWith("{{")) {
        if (itemData) {
          // Try itemData first (e.g., binding is just "title")
          value = getValueByPath(itemData, binding);
          if (value === undefined) {
            // Fallback to main context (e.g., binding is "user.name")
            value = getValueByPath(context, binding);
          }
        } else {
          // No itemData, just use main context
          value = getValueByPath(context, binding);
        }
      } else {
        // It's a template string {{...}} or a non-string value (like an object/array)
        // processBinding handles context/itemData priority internally for {{...}}
        // and recursively processes objects/arrays.
        value = processBinding(binding, context, itemData);
      }

      resolvedBindings[key] = value;

      // Assign ALL resolved values (not just primitives) to props if the value is defined.
      if (value !== undefined) {
        if (!result.props) result.props = {};
        result.props[key] = value;
      }
    }
  }

  // Bindings have been processed (moved to props or used for structure like list data)
  // Clear the bindings from the result node.
  result.bindings = null;

  // --- Process Event Bindings ---
  // Let the main loop above and recursive calls handle resolving templates within event objects/payloads
  // if they are defined via bindings. Explicitly processing result.events here after the loop
  // might be redundant or interfere if events weren't defined via bindings initially.
  // Remove the explicit call:
  // if (result.events) { ... processBinding(result.events, ...) ... }

  // Get the value of the data binding, trying common keys like 'data' or 'items'
  const dataBindingValue =
    resolvedBindings["data"] ?? resolvedBindings["items"];

  if (
    (node.node_type === "ListView" || node.node_type === "Table") &&
    Array.isArray(dataBindingValue) &&
    node.children &&
    node.children.length > 0
  ) {
    const templateChild = node.children[0];
    const mappedChildren = await Promise.all(
      dataBindingValue.map(async (currentItemData, index) => {
        try {
          if (typeof currentItemData !== "object" || currentItemData === null) {
            console.warn(
              `List item at index ${index} for node ${node.id} is not an object:`,
              currentItemData
            );
            return null; // Return null for items that cannot be processed
          }
          console.log(`[resolveBindings Debug] Mapping item ${index} for node ${node.id}:`, currentItemData);

          const currentItemAsRecord = currentItemData as Record<string, unknown>;
          const itemId = currentItemAsRecord.id as string | number | undefined;
          const instanceId = `${templateChild.id}-${itemId || index}`;

          const childNodeInstance: UISpecNode = JSON.parse(
            JSON.stringify(templateChild)
          );
          childNodeInstance.id = instanceId;

          const resolvedChild = await resolveBindings(
            childNodeInstance,
            context,
            currentItemAsRecord
          );
          console.log(`[resolveBindings Debug] Resolved child for item ${index} (node ${node.id}):`, JSON.parse(JSON.stringify(resolvedChild)));

          // We resolved the child node's bindings/props above. Now, specifically resolve bindings
          // within the events of the newly created child instance using itemData.
          if (resolvedChild.events) {
            resolvedChild.events = processBinding(
              resolvedChild.events,
              context,
              currentItemAsRecord
            ) as UISpecNode["events"];
          }

          if (!resolvedChild.props) resolvedChild.props = {};
          resolvedChild.props.key = itemId || `${node.id}-item-${index}`;

          return resolvedChild;
        } catch (error) {
          console.error(`[resolveBindings Error] Error processing item at index ${index} for node ${node.id}:`, error, "Item Data:", currentItemData);
          return null; // Return null if an error occurs for this item
        }
      })
    );
    // Filter out nulls and assert the type for result.children
    result.children = mappedChildren.filter(
      (child) => child !== null
    ) as UISpecNode[];
    console.log(`[resolveBindings Debug] Final mapped children for node ${node.id}:`, JSON.parse(JSON.stringify(result.children))); // Log the final array assigned
  } else if (node.children && node.children.length > 0) {
    // Ensure node.children exists and is not empty
    result.children = await Promise.all(
      node.children.map((child) => resolveBindings(child, context, itemData))
    );
    // Remove redundant event processing for non-list children here too.
    // The recursive call to resolveBindings above handles resolving bindings
    // within the children, including any potential bindings within their event structures.
    /*
    result.children.forEach(resolvedChild => {
        if (resolvedChild.events) {
            resolvedChild.events = processBinding(resolvedChild.events, context, itemData) as UISpecNode['events'];
        }
    });
    */
  } else {
    result.children = []; // Default to empty array if no children or not a list view expansion
  }

  if (!itemData) {
    await systemEvents.emit(
      createSystemEvent(SystemEventType.BINDING_RESOLUTION_COMPLETE, {
        originalLayout: node,
        resolvedLayout: result,
      })
    );
  }

  bindingsCache.set(cacheKey, result);
  nodeCacheTimestamps.set(cacheKey, currentTime);

  // Clean up old cache entries
  if (bindingsCache.size > MAX_CACHE_SIZE) {
    let oldestKey: string | null = null;
    let oldestTimestamp = currentTime;
    for (const [key, timestamp] of nodeCacheTimestamps.entries()) {
      if (timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) {
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
