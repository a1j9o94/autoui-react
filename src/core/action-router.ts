import { UIEvent, UISpecNode, PlannerInput } from "../schema/ui";
import { DataContext } from "./bindings";
import { findNodeById } from "./reducer";
import { ActionType } from "../schema/action-types";
import { callPlannerLLM } from "./planner";
import { executeAction } from "./bindings";


export interface PlanningConfig {
  prefetchDepth: number;
  temperature: number;
  streaming: boolean;
}

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
  contextKeys?: string[]; // Optional: keys to extract from DataContext and include in planner input
}

/**
 * Interface for route resolution
 */
export interface RouteResolution {
  actionType: ActionType;
  targetNodeId: string;
  updatedNode: UISpecNode;
  updatedDataContext?: DataContext;
}

/**
 * Action router class - handles determining what part of the UI to update
 */
export class ActionRouter {
  private openaiApiKey: string;
  private planningConfig: PlanningConfig;

  constructor(openaiApiKey: string, planningConfig?: PlanningConfig) {
    this.openaiApiKey = openaiApiKey;
    this.planningConfig = planningConfig || {
      prefetchDepth: 1,
      temperature: 0.5,
      streaming: false,
    };
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
    openaiApiKey: string,
    userContext?: Record<string, unknown>,
  ): Promise<RouteResolution> {
    console.log(
      `[ActionRouter Debug] resolveRoute called for event type: ${event.type}, nodeId: ${event.nodeId}`
    );

    const sourceNode = layout ? findNodeById(layout, event.nodeId) : undefined;
    const nodeConfig = sourceNode?.events?.[event.type];

    let actionType: ActionType;
    let determinedTargetNodeId: string;
    let determinedNodeConfigPayload: Record<string, unknown> | null = null;

    // Determine initial action type and target
    if (nodeConfig?.action) {
      actionType = nodeConfig.action as ActionType;
      determinedTargetNodeId = nodeConfig.target || sourceNode?.id || "root";
      determinedNodeConfigPayload = nodeConfig.payload ? { ...nodeConfig.payload } : null;
    } else {
      switch (event.type) {
        case "INIT":
          actionType = ActionType.FULL_REFRESH;
          determinedTargetNodeId = "root";
          break;
        case "CLICK":
          actionType = ActionType.FULL_REFRESH;
          determinedTargetNodeId = "root";
          break;
        case "CHANGE":
          if (sourceNode && ["Input", "Select", "Textarea", "Checkbox", "RadioGroup"].includes(sourceNode.node_type)) {
            actionType = ActionType.UPDATE_DATA;
            determinedTargetNodeId = sourceNode.id;
          } else {
            actionType = ActionType.FULL_REFRESH;
            determinedTargetNodeId = "root";
          }
          break;
        default:
          actionType = ActionType.FULL_REFRESH;
          determinedTargetNodeId = "root";
          break;
      }
    }

    // Validate action type early
    if (!Object.values(ActionType).includes(actionType)) {
      throw new Error(`Invalid action type: ${actionType}`);
    }

    // Build additional context
    const additionalContext: Record<string, unknown> = {};
    if (sourceNode) {
      additionalContext.sourceNode = sourceNode;
    }
    const targetNode = layout ? findNodeById(layout, determinedTargetNodeId) : undefined;
    if (targetNode) {
      additionalContext.targetNode = targetNode;
    }

    // Handle event payload
    let finalEventPayload = event.payload && Object.keys(event.payload).length > 0 ? { ...event.payload } : null;
    if (determinedNodeConfigPayload) {
      finalEventPayload = { ...(finalEventPayload || {}), ...determinedNodeConfigPayload };
    }
    if (finalEventPayload) {
      additionalContext.eventPayload = finalEventPayload;
    }

    const plannerInput: PlannerInput = {
      schema,
      goal,
      history: [event],
      userContext: { ...(userContext || {}), ...additionalContext },
    };

    // Handle SHOW_DETAIL action
    if (actionType === ActionType.SHOW_DETAIL) {
      const itemData = (dataContext.tasks as { data?: Array<Record<string, unknown>> })?.data?.find(
        task => task.id === (event.payload?.itemId || event.payload?.taskId)
      );

      const updatedDataContext = {
        ...dataContext,
        selectedTask: itemData,
        isTaskDetailDialogVisible: true,
      };

      const layoutFromLLM = await callPlannerLLM(plannerInput, openaiApiKey);

      return {
        actionType: ActionType.UPDATE_CONTEXT,
        targetNodeId: determinedTargetNodeId,
        updatedDataContext,
        updatedNode: layoutFromLLM,
      };
    }

    // Handle HIDE_DIALOG action
    if (actionType === ActionType.HIDE_DIALOG) {
      if (!layout) {
        // This case should ideally not happen for HIDE_DIALOG if a UI is already rendered.
        // If it can, a default placeholder node might be needed or an error thrown.
        // For now, throwing an error if layout is null, as HIDE_DIALOG implies existing UI.
        throw new Error("Layout cannot be null when handling HIDE_DIALOG");
      }
      return {
        actionType: ActionType.UPDATE_CONTEXT,
        targetNodeId: determinedTargetNodeId,
        updatedDataContext: {
          ...dataContext,
          selectedTask: null,
          isTaskDetailDialogVisible: false,
        },
        updatedNode: layout,
      };
    }

    // Handle data update actions
    if ([ActionType.UPDATE_DATA, ActionType.ADD_ITEM, ActionType.DELETE_ITEM, ActionType.SAVE_TASK_CHANGES].includes(actionType)) {
      if (!layout) {
        // Similar to HIDE_DIALOG, data updates imply existing UI.
        throw new Error("Layout cannot be null when handling data update actions");
      }
      const targetPathOrId = actionType === ActionType.UPDATE_DATA
        ? (sourceNode?.bindings?.value as string) || determinedTargetNodeId
        : determinedTargetNodeId;

      return {
        actionType,
        targetNodeId: determinedTargetNodeId,
        updatedNode: layout,
        updatedDataContext: executeAction(actionType, targetPathOrId, finalEventPayload || {}, dataContext),
      };
    }

    // Handle LLM-based actions
    if ([
      ActionType.FULL_REFRESH,
      ActionType.UPDATE_NODE,
      ActionType.ADD_DROPDOWN,
      ActionType.TOGGLE_STATE,
      ActionType.UPDATE_FORM,
      ActionType.NAVIGATE,
      ActionType.UPDATE_CONTEXT
    ].includes(actionType)) {
      const layoutFromLLM = await callPlannerLLM(plannerInput, openaiApiKey);

      return {
        actionType,
        targetNodeId: determinedTargetNodeId,
        updatedNode: layoutFromLLM,
        updatedDataContext: dataContext,
      };
    }

    throw new Error(`Unhandled action type: ${actionType}`);
  }
}
