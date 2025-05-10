import { UIEvent, UISpecNode, PlannerInput } from '../schema/ui';
import { DataContext } from './bindings';
import { findNodeById } from './reducer';
import { 
  createSystemEvent, 
  systemEvents, 
  SystemEventType 
} from './system-events';

/**
 * Action types supported by the router
 */
export enum ActionType {
  FULL_REFRESH = 'FULL_REFRESH',   // Generate a completely new UI
  UPDATE_NODE = 'UPDATE_NODE',      // Update a specific node
  ADD_DROPDOWN = 'ADD_DROPDOWN',    // Add a dropdown to a specific node
  SHOW_DETAIL = 'SHOW_DETAIL',      // Show a detail view
  HIDE_DETAIL = 'HIDE_DETAIL',      // Hide a detail view
  TOGGLE_STATE = 'TOGGLE_STATE',    // Toggle a boolean state (expanded, selected, etc.)
  UPDATE_FORM = 'UPDATE_FORM',      // Update a form based on selections
  NAVIGATE = 'NAVIGATE',           // Navigate to a different view
}

/**
 * Routing configuration for an action
 */
export interface ActionRouteConfig {
  actionType: ActionType;
  targetNodeId: string;
  promptTemplate: string;
  contextKeys?: string[];  // Additional data context keys to include
}

/**
 * Interface for route resolution
 */
export interface RouteResolution {
  actionType: ActionType;
  targetNodeId: string;
  plannerInput: PlannerInput;
  prompt: string;
}

/**
 * Action router class - handles determining what part of the UI to update
 */
export class ActionRouter {
  private routes: Record<string, ActionRouteConfig[]> = {};
  
  /**
   * Register a new action route
   * @param eventType - UI event type to route
   * @param config - Route configuration
   */
  public registerRoute(eventType: string, config: ActionRouteConfig): void {
    if (!this.routes[eventType]) {
      this.routes[eventType] = [];
    }
    
    this.routes[eventType].push(config);
  }
  
  /**
   * Find the appropriate route for an event
   * @param event - UI event
   * @param layout - Current UI layout
   * @param dataContext - Current data context
   * @returns Route resolution or null if no match
   */
  public resolveRoute(
    event: UIEvent,
    schema: Record<string, unknown>,
    layout: UISpecNode | undefined,
    dataContext: DataContext,
    goal: string,
    userContext?: Record<string, unknown>,
  ): RouteResolution | null {
    // Get all routes for this event type
    const routes = this.routes[event.type] || [];
    
    if (routes.length === 0) {
      // Default to full refresh if no routes defined
      return {
        actionType: ActionType.FULL_REFRESH,
        targetNodeId: layout?.id || 'root',
        plannerInput: {
          schema,
          goal,
          history: [event],
          userContext,
        },
        prompt: `Generate a new UI for the goal: "${goal}". The user just triggered: ${event.type} on node ${event.nodeId}`
      };
    }
    
    // Try to find source node
    const sourceNode = layout ? findNodeById(layout, event.nodeId) : undefined;
    
    // Get the node configuration if available
    const nodeConfig = sourceNode?.events?.[event.type];
    
    // Try to find a matching route based on node configuration
    let matchingRoute: ActionRouteConfig | undefined;
    
    if (nodeConfig) {
      matchingRoute = routes.find(route => 
        route.actionType.toString() === nodeConfig.action
      );
    }
    
    // If no match via node configuration, use the first route
    if (!matchingRoute) {
      matchingRoute = routes[0];
    }
    
    // Resolve target node ID
    const targetNodeId = nodeConfig?.target || matchingRoute.targetNodeId || event.nodeId;
    
    // Build additional context
    const additionalContext: Record<string, unknown> = {};
    
    if (matchingRoute.contextKeys) {
      matchingRoute.contextKeys.forEach(key => {
        additionalContext[key] = dataContext[key];
      });
    }
    
    // Add source node info
    if (sourceNode) {
      additionalContext.sourceNode = sourceNode;
    }
    
    // Add target node info if available
    if (layout) {
      const targetNode = findNodeById(layout, targetNodeId);
      if (targetNode) {
        additionalContext.targetNode = targetNode;
      }
    }
    
    // Add event payload
    if (event.payload) {
      additionalContext.eventPayload = event.payload;
    }
    
    // Merge context with any payload from node config
    if (nodeConfig?.payload) {
      Object.entries(nodeConfig.payload).forEach(([key, value]) => {
        additionalContext[key] = value;
      });
    }
    
    // Build planner input
    const plannerInput: PlannerInput = {
      schema,
      goal,
      history: [event],
      userContext: {
        ...userContext,
        ...additionalContext,
      }
    };
    
    // Process prompt template
    const prompt = this.processTemplate(
      matchingRoute.promptTemplate, 
      {
        goal,
        eventType: event.type,
        nodeId: event.nodeId,
        targetNodeId,
        actionType: matchingRoute.actionType,
        ...additionalContext,
      }
    );
    
    return {
      actionType: matchingRoute.actionType,
      targetNodeId,
      plannerInput,
      prompt,
    };
  }
  
  /**
   * Process a prompt template with variables
   * @param template - Template string with ${var} placeholders
   * @param values - Values to substitute
   * @returns Processed string
   */
  private processTemplate(
    template: string, 
    values: Record<string, unknown>
  ): string {
    return template.replace(/\${(\w+)}/g, (_, key) => {
      return values[key] !== undefined 
        ? String(values[key]) 
        : `\${${key}}`;
    });
  }
}

// Create a default router with common routes
export function createDefaultRouter(): ActionRouter {
  const router = new ActionRouter();
  
  // Default full refresh route
  router.registerRoute('CLICK', {
    actionType: ActionType.FULL_REFRESH,
    targetNodeId: 'root',
    promptTemplate: 'Generate a new UI for the goal: "${goal}". The user just clicked on node ${nodeId}'
  });
  
  // Show detail route
  router.registerRoute('CLICK', {
    actionType: ActionType.SHOW_DETAIL,
    targetNodeId: '${targetNodeId}',
    promptTemplate: 'Update the UI to show details for the selected item. Current node: ${nodeId}, Target node: ${targetNodeId}',
    contextKeys: ['selected']
  });
  
  // Navigate route
  router.registerRoute('CLICK', {
    actionType: ActionType.NAVIGATE,
    targetNodeId: 'root',
    promptTemplate: 'Navigate to a new view based on the user clicking ${nodeId}. Current goal: ${goal}'
  });
  
  // Dropdown route
  router.registerRoute('CLICK', {
    actionType: ActionType.ADD_DROPDOWN,
    targetNodeId: '${targetNodeId}',
    promptTemplate: 'Add a dropdown menu to node ${targetNodeId} with options relevant to the clicked element ${nodeId}'
  });
  
  // Toggle state route
  router.registerRoute('CLICK', {
    actionType: ActionType.TOGGLE_STATE,
    targetNodeId: '${nodeId}',
    promptTemplate: 'Toggle the state of node ${nodeId} (e.g., expanded/collapsed, selected/unselected)'
  });
  
  // Form update route
  router.registerRoute('CHANGE', {
    actionType: ActionType.UPDATE_FORM,
    targetNodeId: '${targetNodeId}',
    promptTemplate: 'Update the form based on the user changing the value of ${nodeId}'
  });
  
  return router;
}