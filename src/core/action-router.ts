import { UIEvent, UISpecNode, PlannerInput } from "../schema/ui";
import { DataContext } from "./bindings";
import { findNodeById } from "./reducer";

// --- Constants for Prompt Generation ---

// Base UI Guidance
const UI_GUIDANCE_BASE = `
UI Guidance:
1. Create a focused interface that directly addresses the goal
2. Use appropriate UI patterns (lists, forms, details, etc.)
3. Include navigation between related views when needed
4. Keep the interface simple and intuitive
5. Bind to schema data where appropriate
6. Provide event handlers for user interactions - make sure to always include both action and target properties`;

// Specific guidance for list bindings
const LIST_BINDING_GUIDANCE = `7. **CRITICAL:** For \`ListView\` or \`Table\` nodes, the \`data\` binding key **MUST** point to the *exact path* of the data *array* within the context.`;

// Example for list binding
const LIST_BINDING_EXAMPLE = `Example: If the context has \`{ tasks: { data: [...] } }\`, the binding **MUST** be \`{ "bindings": { "data": "tasks.data" } }\`. If the context has \`{ userList: [...] }\`, the binding **MUST** be \`{ "bindings": { "data": "userList" } }\`. **NEVER** bind to the parent object containing the array (e.g., DO NOT USE \`{ "bindings": { "data": "tasks" } }\`).`;

// Combined common UI guidance - THIS SHOULD BE EXPORTED
export const COMMON_UI_GUIDANCE =
  UI_GUIDANCE_BASE +
  "\n" + // Add a newline separator
  LIST_BINDING_GUIDANCE + // Add the specific list binding rule
  "\n" + // Add a newline separator
  LIST_BINDING_EXAMPLE; // Add the example

// Function to process template strings (simple substitution)
function processTemplate(
  template: string,
  values: Record<string, unknown>
): string {
  return template.replace(/\${(.*?)}/g, (match, key) => {
    const trimmedKey = key.trim();
    // Basic handling for simple keys; does not handle nested paths like eventPayload.detail
    return trimmedKey in values ? String(values[trimmedKey]) : match;
  });
}

// Moved from planner.ts
/**
 * Builds the prompt for the LLM planner
 * @param input - Planner input including schema, goal, history, and userContext
 * @param promptTemplate - Optional prompt template string
 * @param templateValues - Optional values for the template string, used if promptTemplate is provided
 * @returns Formatted prompt string
 */
export function buildPrompt(
  input: PlannerInput,
  promptTemplate?: string,
  templateValues?: Record<string, unknown>
): string {
  const { schema, goal, history, userContext } = input;

  // Extract schema information without actual data rows
  const schemaInfo = Object.entries(schema)
    .map(([tableName, tableSchema]) => {
      // Simple check if it looks like a structured schema object vs a simple type
      const schemaString =
        typeof tableSchema === "object" && tableSchema !== null
          ? JSON.stringify(tableSchema)
          : String(tableSchema);
      return `Table: ${tableName}\nSchema: ${schemaString}`;
    })
    .join("\n\n");

  // Format recent events for context
  const recentEvents =
    history && history.length > 0
      ? history
          .slice(-5) // Limit history length
          .map(
            (event) =>
              `Event: ${event.type} on node ${event.nodeId}${
                event.payload
                  ? ` with payload ${JSON.stringify(event.payload)}`
                  : ""
              }`
          )
          .join("\n")
      : "No recent events";

  // Build user context section if provided
  const userContextSection = userContext
    ? `\n\nUser Context:\n${JSON.stringify(userContext)}`
    : "";

  // If a specific prompt template is provided, process it
  // This now becomes the primary way to use custom prompts via ActionRouteConfig
  if (promptTemplate && templateValues) {
    // Inject schema, history, userContext, and common guidance into values for template processing
    const fullTemplateValues = {
      ...templateValues,
      schemaInfo,
      recentEvents,
      userContextString: userContextSection.trim(), // Use trimmed version
      commonUIGuidance: COMMON_UI_GUIDANCE,
      goal, // Ensure goal is always available to templates
    };
    return processTemplate(promptTemplate, fullTemplateValues);
  }

  // --- Default Prompt Construction (used when no template is provided by a route, e.g. initial FULL_REFRESH) ---

  // Default interaction description: Check if history is empty
  const interactionDescription =
    history && history.length > 0
      ? `The user's last action was: ${
          history[history.length - 1].type
        } on node ${history[history.length - 1].nodeId}`
      : "The user initiated the session for the goal";

  // Assemble the full default prompt
  return `
You are an expert UI generator.
Create a user interface that achieves the following goal: "${goal}".
${interactionDescription}.

Available data schema:
${schemaInfo}

Recent user interactions:
${recentEvents}${userContextSection}

Generate a complete UI specification in JSON format that matches the following TypeScript type:
type UISpecNode = { id: string; node_type: string; props?: Record<string, unknown>; bindings?: Record<string, unknown>; events?: Record<string, { action: string; target: string; payload?: Record<string, unknown>; }>; children?: UISpecNode[]; };
${COMMON_UI_GUIDANCE}

Respond ONLY with the JSON UI specification and no other text.
  `;
}

/**
 * Action types supported by the router
 */
export enum ActionType {
  FULL_REFRESH = "FULL_REFRESH", // Generate a completely new UI
  UPDATE_NODE = "UPDATE_NODE", // Update a specific node, potentially with new children
  ADD_DROPDOWN = "ADD_DROPDOWN", // Add a dropdown to a specific node
  SHOW_DETAIL = "SHOW_DETAIL", // Show a detail view
  HIDE_DETAIL = "HIDE_DETAIL", // Hide a detail view
  TOGGLE_STATE = "TOGGLE_STATE", // Toggle a boolean state (expanded, selected, etc.)
  UPDATE_FORM = "UPDATE_FORM", // Update a form based on selections
  NAVIGATE = "NAVIGATE", // Navigate to a different view
}

/**
 * Routing configuration for an action
 */
export interface ActionRouteConfig {
  actionType: ActionType;
  targetNodeId?: string; // Optional: target node for the action (e.g., where to place a new detail view)
  promptTemplate?: string; // Template for the LLM prompt, now optional
  contextKeys?: string[]; // Optional: keys to extract from DataContext and include in planner input
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
    layout: UISpecNode | null,
    dataContext: DataContext,
    goal: string,
    userContext?: Record<string, unknown>
  ): RouteResolution | null {
    console.log(
      `[ActionRouter Debug] resolveRoute called for event type: ${event.type}`
    );
    // Get all routes for this event type
    const routes = this.routes[event.type] || [];

    console.log(
      `[ActionRouter Debug] Found ${routes.length} routes for ${event.type}`
    );

    if (routes.length === 0) {
      // Default to full refresh if no routes defined
      console.log(
        `[ActionRouter Debug] No specific route found for ${event.type}, using default FULL_REFRESH.`
      );
      const defaultPlannerInput = {
        schema,
        goal,
        history: [event],
        userContext: userContext || null,
      };
      const defaultPrompt = buildPrompt(
        defaultPlannerInput,
        undefined,
        undefined
      );
      const defaultResolution = {
        actionType: ActionType.FULL_REFRESH,
        targetNodeId: layout?.id || "root",
        plannerInput: defaultPlannerInput,
        prompt: defaultPrompt,
      };
      console.log(
        "[ActionRouter Debug] Default Resolution:",
        defaultResolution
      );
      return defaultResolution;
    }

    // Try to find source node
    const sourceNode = layout ? findNodeById(layout, event.nodeId) : undefined;

    // Get the node configuration if available
    const nodeConfig = sourceNode?.events?.[event.type];

    // Try to find a matching route based on node configuration
    let matchingRoute: ActionRouteConfig | undefined;

    if (nodeConfig) {
      matchingRoute = routes.find(
        (route) => route.actionType.toString() === nodeConfig.action
      );
    }

    // If no match via node configuration, use the first route
    if (!matchingRoute) {
      matchingRoute = routes[0];
    }

    console.log("[ActionRouter Debug] Matching Route Config:", matchingRoute);

    // Resolve target node ID
    const targetNodeId =
      nodeConfig?.target || matchingRoute.targetNodeId || event.nodeId;

    // Build additional context
    const additionalContext: Record<string, unknown> = {};

    if (matchingRoute.contextKeys) {
      matchingRoute.contextKeys.forEach((key) => {
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
      },
    };

    // Process prompt template
    const templateValues = {
      goal,
      eventType: event.type,
      nodeId: event.nodeId,
      targetNodeId,
      actionType: matchingRoute.actionType,
      ...(userContext || {}), // Spread the original userContext (passed to resolveRoute)
      ...additionalContext, // Spread additionalContext afterwards (can override userContext keys)
    };

    console.log("[ActionRouter Debug] Template Values:", templateValues);

    // Generate final prompt using buildPrompt
    // It will use the template if provided, otherwise generate the default based on plannerInput.
    const finalPrompt = buildPrompt(
      plannerInput,
      matchingRoute.promptTemplate, // Pass template if it exists (can be undefined)
      templateValues // Pass templateValues (used only if promptTemplate exists)
    );
    console.log("[ActionRouter Debug] Generated Prompt:", finalPrompt);

    const finalResolution = {
      actionType: matchingRoute.actionType,
      targetNodeId: targetNodeId,
      plannerInput,
      prompt: finalPrompt, // Use the generated prompt
    };

    console.log("[ActionRouter Debug] Final Resolution:", finalResolution);
    return finalResolution;
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
      return values[key] !== undefined ? String(values[key]) : `\${${key}}`;
    });
  }
}

// Create a default router with common routes
export function createDefaultRouter(): ActionRouter {
  const router = new ActionRouter();

  // Register a default route for CLICK events (will generate a full refresh prompt)
  router.registerRoute("CLICK", {
    actionType: ActionType.FULL_REFRESH,
    targetNodeId: "root",
  });

  // Default route for INIT event (typically the first event)
  router.registerRoute("INIT", {
    actionType: ActionType.FULL_REFRESH,
    targetNodeId: "root",
  });

  // Show detail route
  router.registerRoute("CLICK", {
    actionType: ActionType.SHOW_DETAIL,
    targetNodeId: "${targetNodeId}",
    promptTemplate:
      "Update the UI to show details for the selected item. Current node: ${nodeId}, Target node: ${targetNodeId}",
    contextKeys: ["selected"],
  });

  // Navigate route
  router.registerRoute("CLICK", {
    actionType: ActionType.NAVIGATE,
    targetNodeId: "root",
    promptTemplate:
      "Navigate to a new view based on the user clicking ${nodeId}. Current goal: ${goal}",
  });

  // Dropdown route
  router.registerRoute("CLICK", {
    actionType: ActionType.ADD_DROPDOWN,
    targetNodeId: "${targetNodeId}",
    promptTemplate:
      "Add a dropdown menu to node ${targetNodeId} with options relevant to the clicked element ${nodeId}",
  });

  // Toggle state route
  router.registerRoute("CLICK", {
    actionType: ActionType.TOGGLE_STATE,
    targetNodeId: "${nodeId}",
    promptTemplate:
      "Toggle the state of node ${nodeId} (e.g., expanded/collapsed, selected/unselected)",
  });

  // Form update route
  router.registerRoute("CHANGE", {
    actionType: ActionType.UPDATE_FORM,
    targetNodeId: "${targetNodeId}",
    promptTemplate:
      "Update the form based on the user changing the value of ${nodeId}",
  });

  return router;
}
