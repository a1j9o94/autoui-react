import { UIEvent, UISpecNode, PlannerInput } from "../schema/ui";
import { DataContext } from "./bindings";
import { findNodeById } from "./reducer";
import { ActionType } from "../schema/action-types";
import { callPlannerLLM } from "./planner";
import { executeAction } from "./bindings";

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
  directUpdateLayout?: UISpecNode | null;
  updatedDataContext?: DataContext;
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
  public async resolveRoute(
    event: UIEvent,
    schema: Record<string, unknown>,
    layout: UISpecNode | null,
    dataContext: DataContext,
    goal: string,
    userContext?: Record<string, unknown>,
    openaiApiKey?: string
  ): Promise<RouteResolution> {
    console.log(
      `[ActionRouter Debug] resolveRoute called for event type: ${event.type}, nodeId: ${event.nodeId}`
    );
    // ADD THIS LOG: Be very specific about what part of the layout to log to avoid excessively large logs.
    // We are interested in the children of the taskListView node, if it exists and has children.
    const taskListViewNode = layout?.children?.find(
      (c) => c.id === "taskListView" || c.id === "task-list-view"
    );
    let taskListViewChildrenSnapshot = null;
    if (taskListViewNode && taskListViewNode.children) {
      taskListViewChildrenSnapshot = taskListViewNode.children.map((child) => ({
        id: child.id,
        children: child.children?.map((grandChild) => ({
          id: grandChild.id,
          props: grandChild.props,
          bindings: grandChild.bindings,
          events: grandChild.events,
        })),
      })); // Include grandchildren details
    }
    console.log(
      `[ActionRouter Debug] Searching for nodeId: ${event.nodeId} in taskListView children (snapshot):`,
      JSON.stringify(taskListViewChildrenSnapshot, null, 2)
    );

    const sourceNode = layout ? findNodeById(layout, event.nodeId) : undefined;
    const nodeConfig = sourceNode?.events?.[event.type];

    // ADD THIS LOG: Enhanced debugging for sourceNode and nodeConfig
    console.log(
      `[ActionRouter Debug] Event: ${event.type} on ${
        event.nodeId
      }. Source node found: ${!!sourceNode}.`,
      sourceNode
        ? `Source Node ID: ${sourceNode.id}, Type: ${sourceNode.node_type}`
        : "Node not found in layout.",
      sourceNode
        ? `Source Node Events: ${JSON.stringify(sourceNode.events, null, 2)}`
        : "",
      `Derived nodeConfig: ${JSON.stringify(nodeConfig, null, 2)}`
    );

    let actionType: ActionType;
    let determinedTargetNodeId: string;
    let contextKeys: string[] | undefined = undefined;
    let determinedNodeConfigPayload: Record<string, unknown> | null = null;

    // Determine action, targetNodeId, and template based on event and node config
    if (nodeConfig?.action) {
      actionType = nodeConfig.action as ActionType;
      determinedTargetNodeId = nodeConfig.target || sourceNode?.id || "root";
      determinedNodeConfigPayload = nodeConfig.payload
        ? { ...nodeConfig.payload }
        : null;

      // Ensure SHOW_DIALOG from event config is mapped to ActionType.SHOW_DETAIL for routing logic
      if (nodeConfig.action === ActionType.SHOW_DETAIL) {
        actionType = ActionType.SHOW_DETAIL;
      } else if (nodeConfig.action === ActionType.HIDE_DIALOG) {
        actionType = ActionType.HIDE_DIALOG; // Ensure this is correctly typed
      } else if (nodeConfig.action === ActionType.SAVE_TASK_CHANGES) {
        actionType = ActionType.SAVE_TASK_CHANGES;
      }

      if (actionType === ActionType.SHOW_DETAIL) {
        // Ensure template refers to selectedTask which is set by executeAction("SHOW_DIALOG",...)
        contextKeys = ["selectedTask"]; // Ensure this matches what executeAction sets
      } else if (actionType === ActionType.HIDE_DIALOG) {
        contextKeys = ["targetNodeId"];
      } else if (actionType === ActionType.SAVE_TASK_CHANGES) {
        contextKeys = ["selectedTask", "tasks"]; // Provide relevant context
      } else if (actionType === ActionType.NAVIGATE) {
        contextKeys = ["targetNodeId"];
      } else {
        contextKeys = ["nodeId"];
      }
    } else {
      // Default behaviors if no specific nodeConfig.action
      switch (event.type) {
        case "INIT":
          actionType = ActionType.FULL_REFRESH;
          determinedTargetNodeId = "root";
          break;
        case "CLICK":
          actionType = ActionType.FULL_REFRESH;
          determinedTargetNodeId = "root"; // Default for unconfigured clicks (button or otherwise)
          break;
        case "CHANGE":
          if (
            sourceNode &&
            ["Input", "Select", "Textarea", "Checkbox", "RadioGroup"].includes(
              sourceNode.node_type
            )
          ) {
            actionType = ActionType.UPDATE_DATA;
            determinedTargetNodeId = sourceNode.id;
            // promptTemplate = "Action: ${actionType}. Update data for ${nodeId} due to change. New value: ${eventPayload_value}. Goal: ${goal}";
          } else {
            actionType = ActionType.FULL_REFRESH;
            determinedTargetNodeId = "root";
            // promptTemplate = "Action: ${actionType}. Change event on ${nodeId}. Goal: ${goal}";
          }
          break;
        default:
          actionType = ActionType.FULL_REFRESH;
          determinedTargetNodeId = "root";
          // promptTemplate = "Action: ${actionType}. Unhandled event ${eventType} on ${nodeId}. Goal: ${goal}";
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
    const targetNode = layout
      ? findNodeById(layout, determinedTargetNodeId)
      : undefined;
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
      finalEventPayload = {
        ...(finalEventPayload || {}),
        ...determinedNodeConfigPayload,
      };
    }
    // Set eventPayload in additionalContext: null if both inputs were null/empty, otherwise the merged object.
    if (finalEventPayload) {
      additionalContext.eventPayload = finalEventPayload;
    } else if (
      event.payload === null &&
      (determinedNodeConfigPayload === null ||
        Object.keys(determinedNodeConfigPayload).length === 0)
    ) {
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

    if (
      typeof additionalContext.eventPayload === "object" &&
      additionalContext.eventPayload !== null
    ) {
      for (const [key, value] of Object.entries(
        additionalContext.eventPayload
      )) {
        templateValues[`eventPayload_${key}`] = value;
      }
    }
    if (
      additionalContext.selectedItem &&
      typeof additionalContext.selectedItem === "object" &&
      additionalContext.selectedItem !== null
    ) {
      for (const [key, value] of Object.entries(
        additionalContext.selectedItem
      )) {
        templateValues[`selectedItem_${key}`] = value;
      }
    }

    // --- Consolidate HIDE actions ---
    if (
      (actionType === ActionType.HIDE_DIALOG ||
        actionType === ActionType.CLOSE_DIALOG ||
        actionType === ActionType.HIDE_DETAIL) &&
      layout
    ) {
      const clonedLayout: UISpecNode = JSON.parse(JSON.stringify(layout));
      const dialogNodeToHide = findNodeById(clonedLayout, determinedTargetNodeId);

      if (dialogNodeToHide) {
        if (!dialogNodeToHide.props) dialogNodeToHide.props = {};
        dialogNodeToHide.props.visible = false;
        if (dialogNodeToHide.bindings && dialogNodeToHide.bindings.visible !== undefined) {
          delete dialogNodeToHide.bindings.visible;
        }
      }
      // Return the entire cloned layout with the specific node modified
      return {
        actionType,
        targetNodeId: determinedTargetNodeId,
        plannerInput,
        directUpdateLayout: clonedLayout, // Return full modified layout
        updatedDataContext: dataContext, // Pass through existing dataContext, bindings will update based on it
      };
    }

    // --- Consolidate SHOW actions (data context for content, direct layout for visibility) ---
    if (
      (actionType === ActionType.SHOW_DETAIL || actionType === ActionType.OPEN_DIALOG) &&
      layout
    ) {
      const newDataContext = executeAction(
        actionType as string,
        determinedTargetNodeId,
        finalEventPayload || {},
        dataContext
      );

      // Create a fresh copy to modify
      const layoutToUpdate: UISpecNode = JSON.parse(JSON.stringify(layout));
      
      const updateVisibility = (node: UISpecNode, targetId: string): boolean => {
        if (node.id === targetId) {
          if (!node.props) node.props = {};
          node.props.visible = true;
          // Crucially, ensure the binding is still there if it's meant to be
          // If the original mockPlanner node has it, it should persist through clones
          // For now, let's assume it *should* be there.
          console.log(`[ActionRouter SHOW_DETAIL] Set ${targetId}.props.visible = true. Bindings:`, JSON.stringify(node.bindings));
          return true;
        }
        if (node.children) {
          for (const child of node.children) {
            if (updateVisibility(child, targetId)) return true;
          }
        }
        return false;
      };

      updateVisibility(layoutToUpdate, determinedTargetNodeId);

      return {
        actionType,
        targetNodeId: determinedTargetNodeId,
        plannerInput,
        directUpdateLayout: layoutToUpdate,
        updatedDataContext: newDataContext,
      };
    }

    // --- Data context update actions (no direct layout changes from router here) ---
    if (
      actionType === ActionType.UPDATE_DATA ||
      actionType === ActionType.ADD_ITEM ||
      actionType === ActionType.DELETE_ITEM ||
      actionType === ActionType.SAVE_TASK_CHANGES
    ) {
      let targetPathOrId: string | undefined = determinedTargetNodeId;
      if (actionType === ActionType.UPDATE_DATA) {
        targetPathOrId = sourceNode?.bindings?.value as string || determinedTargetNodeId;
      }
      const newDataContext = executeAction(
        actionType as string,
        targetPathOrId,
        finalEventPayload || {}, // Ensure payload is not null
        dataContext
      );
      return {
        actionType,
        targetNodeId: determinedTargetNodeId,
        plannerInput,
        directUpdateLayout: null, 
        updatedDataContext: newDataContext,
      };
    }

    // --- LLM/planner for "big" actions (ensure no overlaps with above) ---
    if (
      actionType === ActionType.FULL_REFRESH ||
      actionType === ActionType.UPDATE_NODE ||
      actionType === ActionType.ADD_DROPDOWN ||
      actionType === ActionType.TOGGLE_STATE || // Review if this can be a direct/data action
      actionType === ActionType.UPDATE_FORM || // Review if this can be a direct/data action
      actionType === ActionType.NAVIGATE || // Likely LLM or specific complex routing
      actionType === ActionType.UPDATE_CONTEXT // Generic, might be LLM if complex change needed
      // OPEN_DIALOG, CLOSE_DIALOG, HIDE_DETAIL, SHOW_DETAIL, HIDE_DIALOG are handled above
    ) {
      const layoutFromLLM = await callPlannerLLM(
        plannerInput,
        openaiApiKey || "",
        {
          actionType,
          targetNodeId: determinedTargetNodeId,
          plannerInput,
        }
      );
      return {
        actionType,
        targetNodeId: determinedTargetNodeId,
        plannerInput,
        directUpdateLayout: layoutFromLLM,
        updatedDataContext: dataContext,
      };
    }

    // Fallback: This case might need rethinking.
    // If no direct update or LLM call, what should it signify?
    // Previously, it returned a prompt. Now, it should probably just indicate no specific layout update.
    return {
      actionType, // Or a specific ActionType.NO_OP if that exists and makes sense
      targetNodeId: determinedTargetNodeId,
      plannerInput,
      directUpdateLayout: null, // Explicitly null
      updatedDataContext: dataContext,
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
