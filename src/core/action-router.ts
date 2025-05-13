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
6. **CRITICAL for Buttons:** All \`Button\` nodes **MUST** include a \`label\` property in their \`props\` (e.g., \`{ "props": { "label": "Click Me" } }\`).
7. Provide event handlers for user interactions - make sure to always include both action and target properties`;

// Specific guidance for list bindings
const LIST_BINDING_GUIDANCE = `8. **CRITICAL:** For \`ListView\` or \`Table\` nodes, the \`data\` binding key **MUST** point to the *exact path* of the data *array* within the context.`;

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
  UPDATE_DATA = "UPDATE_DATA", // Add this for input changes
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
  constructor() {
    // this.registerRoute("CLICK",    { actionType: ActionType.FULL_REFRESH, targetNodeId: "root" });
    // this.registerRoute("INIT",     { actionType: ActionType.FULL_REFRESH, targetNodeId: "root" });
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
  ): RouteResolution {
    console.log(
      `[ActionRouter Debug] resolveRoute called for event type: ${event.type}, nodeId: ${event.nodeId}`
    );
    // ADD THIS LOG: Be very specific about what part of the layout to log to avoid excessively large logs.
    // We are interested in the children of the taskListView node, if it exists and has children.
    const taskListViewNode = layout?.children?.find(c => c.id === 'taskListView' || c.id === 'task-list-view');
    let taskListViewChildrenSnapshot = null;
    if (taskListViewNode && taskListViewNode.children) {
      taskListViewChildrenSnapshot = taskListViewNode.children.map(child => ({ id: child.id, children: child.children?.map(grandChild => ({id: grandChild.id, props: grandChild.props, bindings: grandChild.bindings, events: grandChild.events })) })); // Include grandchildren details
    }
    console.log(`[ActionRouter Debug] Searching for nodeId: ${event.nodeId} in taskListView children (snapshot):`, JSON.stringify(taskListViewChildrenSnapshot, null, 2));

    const sourceNode = layout ? findNodeById(layout, event.nodeId) : undefined;
    const nodeConfig = sourceNode?.events?.[event.type];

    let actionType: ActionType;
    let determinedTargetNodeId: string;
    let promptTemplate: string | undefined = undefined;
    let contextKeys: string[] | undefined = undefined;
    let determinedNodeConfigPayload: Record<string, unknown> | null = null;

    // Determine action, targetNodeId, and template based on event and node config
    if (nodeConfig?.action) {
      actionType = nodeConfig.action as ActionType;
      determinedTargetNodeId = nodeConfig.target || sourceNode?.id || "root";
      determinedNodeConfigPayload = nodeConfig.payload ? { ...nodeConfig.payload } : null;

      // Ensure SHOW_DIALOG from event config is mapped to ActionType.SHOW_DETAIL for routing logic
      if (nodeConfig.action === "SHOW_DIALOG") { 
        actionType = ActionType.SHOW_DETAIL;
      }

      if (actionType === ActionType.SHOW_DETAIL) {
        // Ensure template refers to selectedTask which is set by executeAction("SHOW_DIALOG",...)
        promptTemplate = "Action: ${actionType}. Show detail for ${nodeId} (source of event) which targets dialog ${targetNodeId}. Selected Task ID: ${selectedTask_id}";
        contextKeys = ["selectedTask"]; // Ensure this matches what executeAction sets
      } else if (actionType === ActionType.NAVIGATE) {
        promptTemplate = "Action: ${actionType}. Navigate from ${nodeId} to view: ${targetNodeId}";
      } else {
        promptTemplate = "Action: ${actionType}. Event ${eventType} on node ${nodeId}. Target: ${targetNodeId}. Goal: ${goal}";
      }
    } else {
      // Default behaviors if no specific nodeConfig.action
      switch (event.type) {
        case "INIT":
          actionType = ActionType.FULL_REFRESH;
          determinedTargetNodeId = "root";
          promptTemplate = "Action: ${actionType}. Initialize the application view for the goal: ${goal}";
          break;
        case "CLICK":
          actionType = ActionType.FULL_REFRESH;
          determinedTargetNodeId = "root"; // Default for unconfigured clicks (button or otherwise)
          if (sourceNode?.node_type === "Button") {
            promptTemplate = "Action: ${actionType}. Button ${nodeId} clicked. Goal: ${goal}";
          } else {
            promptTemplate = "Action: ${actionType}. Generic click on ${nodeId}. Goal: ${goal}";
          }
          break;
        case "CHANGE":
          if (sourceNode && ["Input", "Select", "Textarea", "Checkbox", "RadioGroup"].includes(sourceNode.node_type)) {
            actionType = ActionType.UPDATE_DATA;
            determinedTargetNodeId = sourceNode.id; 
            promptTemplate = "Action: ${actionType}. Update data for ${nodeId} due to change. New value: ${eventPayload_value}. Goal: ${goal}";
          } else {
            actionType = ActionType.FULL_REFRESH;
            determinedTargetNodeId = "root";
            promptTemplate = "Action: ${actionType}. Change event on ${nodeId}. Goal: ${goal}";
          }
          break;
        default:
          actionType = ActionType.FULL_REFRESH;
          determinedTargetNodeId = "root";
          promptTemplate = "Action: ${actionType}. Unhandled event ${eventType} on ${nodeId}. Goal: ${goal}";
          console.warn(
            `[ActionRouter] Unhandled event type: ${event.type} for node ${event.nodeId}, falling back to FULL_REFRESH.`
          );
          break;
      }
    }

    // Assemble additionalContext for plannerInput.userContext
    const additionalContext: Record<string, unknown> = {};
    if (sourceNode) {
      additionalContext.sourceNode = sourceNode;
    }
    // Determine and add targetNode to context if found
    const targetNode = layout ? findNodeById(layout, determinedTargetNodeId) : undefined;
    if (targetNode) {
      additionalContext.targetNode = targetNode;
    }
    // Note: if targetNode is not found, additionalContext.targetNode will remain undefined (not explicitly set to undefined)

    if (contextKeys) {
      contextKeys.forEach((key) => {
        if (dataContext[key] !== undefined) {
          additionalContext[key] = dataContext[key];
        }
      });
    }

    let finalEventPayload: Record<string, unknown> | null = null;
    if (event.payload && Object.keys(event.payload).length > 0) {
      finalEventPayload = { ...event.payload };
    }
    if (determinedNodeConfigPayload) {
      finalEventPayload = { ...(finalEventPayload || {}), ...determinedNodeConfigPayload };
    }
    // Set eventPayload in additionalContext: null if both inputs were null/empty, otherwise the merged object.
    if (finalEventPayload) {
      additionalContext.eventPayload = finalEventPayload;
    } else if (event.payload === null && (determinedNodeConfigPayload === null || Object.keys(determinedNodeConfigPayload).length === 0) ) {
      additionalContext.eventPayload = null;
    }
    // If both event.payload and determinedNodeConfigPayload were undefined or empty objects, 
    // finalEventPayload would be null or {}, and additionalContext.eventPayload would not be set by the above,
    // which is fine as it means no payload.

    const plannerInput: PlannerInput = {
      schema,
      goal,
      history: [event],
      userContext: {
        ...(userContext || {}),
        ...additionalContext,
      },
    };

    const templateValues: Record<string, unknown> = {
      goal,
      eventType: event.type,
      nodeId: event.nodeId, 
      targetNodeId: determinedTargetNodeId, // Use the consistently determined targetNodeId
      actionType: actionType.toString(),
      ...(userContext || {}),
      ...additionalContext,
    };
    
    if (typeof additionalContext.eventPayload === 'object' && additionalContext.eventPayload !== null) {
        for (const [key, value] of Object.entries(additionalContext.eventPayload)) {
            templateValues[`eventPayload_${key}`] = value;
        }
    }
    if (additionalContext.selectedItem && typeof additionalContext.selectedItem === 'object' && additionalContext.selectedItem !== null) {
        for (const [key, value] of Object.entries(additionalContext.selectedItem)) {
            templateValues[`selectedItem_${key}`] = value; 
        }
    }
    
    const finalPrompt = buildPrompt(
      plannerInput,
      promptTemplate, 
      templateValues
    );

    return {
      actionType,
      targetNodeId: determinedTargetNodeId, // Return the consistently determined targetNodeId
      plannerInput,
      prompt: finalPrompt,
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
      return values[key] !== undefined ? String(values[key]) : `\${${key}}`;
    });
  }
}

// export function createDefaultRouter(): ActionRouter {
// ... (all its content)
// }
