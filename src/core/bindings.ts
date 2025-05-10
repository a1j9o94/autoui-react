import { UISpecNode } from "../schema/ui";
import { createSystemEvent, systemEvents, SystemEventType } from "./system-events";

/**
 * Interface for the runtime data context
 */
export interface DataContext {
  [key: string]: unknown;
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
  const parts = path.split('.');
  let current: unknown = context;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    if (typeof current !== 'object') {
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
  const parts = path.split('.');
  
  let current: any = result;
  
  // Navigate to the parent object of the property we want to set
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    
    // Create the object if it doesn't exist
    if (!(part in current) || current[part] === null || current[part] === undefined) {
      current[part] = {};
    }
    
    // Move to the next level
    current = current[part];
    
    // Ensure the current level is an object
    if (typeof current !== 'object') {
      current = {};
    }
  }
  
  // Set the value at the final property
  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
  
  return result;
}

/**
 * Process a binding value from a UI node
 * 
 * @param binding - The binding value (string path or direct value)
 * @param context - The data context object
 * @returns The resolved value
 */
export function processBinding(binding: unknown, context: DataContext): unknown {
  // If binding is a string, treat it as a path to a value in the context
  if (typeof binding === 'string') {
    return getValueByPath(context, binding);
  }
  
  // If binding is an array, process each item recursively
  if (Array.isArray(binding)) {
    return binding.map(item => processBinding(item, context));
  }
  
  // If binding is an object, process each property recursively
  if (binding !== null && typeof binding === 'object') {
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
export async function resolveBindings(node: UISpecNode, context: DataContext): Promise<UISpecNode> {
  // Emit binding resolution start event
  await systemEvents.emit(
    createSystemEvent(SystemEventType.BINDING_RESOLUTION_START, { layout: node })
  );
  
  // Clone the node to avoid mutating the original
  const result: UISpecNode = {
    ...node,
    props: node.props ? { ...node.props } : undefined,
    events: node.events ? { ...node.events } : undefined,
  };
  
  // Resolve bindings to concrete values
  if (node.bindings) {
    // Process each binding in the node
    for (const [key, binding] of Object.entries(node.bindings)) {
      const value = processBinding(binding, context);
      
      // Add the resolved value to props if not undefined
      if (value !== undefined) {
        if (!result.props) {
          result.props = {};
        }
        result.props[key] = value;
      }
    }
  }
  
  // Process children recursively
  if (node.children) {
    result.children = await Promise.all(node.children.map(child => resolveBindings(child, context)));
  }
  
  // Emit binding resolution complete event
  await systemEvents.emit(
    createSystemEvent(SystemEventType.BINDING_RESOLUTION_COMPLETE, { 
      originalLayout: node,
      resolvedLayout: result
    })
  );
  
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
    case 'VIEW_DETAIL': {
      // Set the selected item in the context
      if (payload?.item) {
        newContext = setValueByPath(newContext, 'selected', payload.item);
      }
      
      // Update visibility of the target node if provided
      if (targetId && layoutTree) {
        // For now, we don't modify the layout tree directly
        // This would be handled by the reducer in a real implementation
      }
      break;
    }
      
    case 'HIDE_DETAIL': {
      // Clear the selected item
      newContext = setValueByPath(newContext, 'selected', null);
      
      // Update visibility of the target node if provided
      if (targetId && layoutTree) {
        // For now, we don't modify the layout tree directly
        // This would be handled by the reducer in a real implementation
      }
      break;
    }
    
    case 'SET_VALUE': {
      // Set a value in the context
      if (payload?.path && 'value' in payload) {
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