import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { PlannerInput, UISpecNode, openAIUISpec, UIEvent } from "../schema/ui";
import {
  createSystemEvent,
  systemEvents,
  SystemEventType,
} from "./system-events";
import { env } from "../env";
import { ActionRouter, RouteResolution } from "./action-router";
import { DataContext } from "./bindings";

// Create a strictly compatible OpenAI provider for structured outputs
const strictOpenAI = createOpenAI({
  compatibility: "strict", // Required for structured outputs with OpenAI API
});

/**
 * Builds the prompt for the LLM planner
 * @param input - Planner input including schema, goal, and history
 * @param targetNodeId - Optional target node ID for partial updates
 * @param customPrompt - Optional custom prompt
 * @returns Formatted prompt string
 */
export function buildPrompt(
  input: PlannerInput,
  customPrompt?: string
): string {
  const { schema, goal, history, userContext } = input;

  // Extract schema information without actual data rows
  const schemaInfo = Object.entries(schema)
    .map(([tableName, tableSchema]) => {
      return `Table: ${tableName}\nSchema: ${JSON.stringify(tableSchema)}`;
    })
    .join("\n\n");

  // Format recent events for context
  const recentEvents =
    history
      ?.slice(-5)
      .map(
        (event) =>
          `Event: ${event.type} on node ${event.nodeId}${
            event.payload
              ? ` with payload ${JSON.stringify(event.payload)}`
              : ""
          }`
      )
      .join("\n") || "No recent events";

  // Build user context section if provided
  const userContextSection = userContext
    ? `\n\nUser Context:\n${JSON.stringify(userContext)}`
    : "";

  // Use custom prompt if provided, otherwise use the default
  if (customPrompt) {
    return customPrompt;
  }

  // Assemble the full prompt
  return `
You are an expert UI generator. 
Create a user interface that achieves the following goal: "${goal}"

Available data schema:
${schemaInfo}

Recent user interactions:
${recentEvents}${userContextSection}

Generate a complete UI specification in JSON format that matches the following TypeScript type:
type UISpecNode = {
  id: string;
  node_type: string;
  props?: Record<string, unknown>;
  bindings?: Record<string, unknown>;
  events?: Record<string, { action: string; target: string; payload?: Record<string, unknown>; }>;
  children?: UISpecNode[];
};

UI Guidance:
1. Create a focused interface that directly addresses the goal
2. Use appropriate UI patterns (lists, forms, details, etc.)
3. Include navigation between related views when needed
4. Keep the interface simple and intuitive
5. Bind to schema data where appropriate
6. Provide event handlers for user interactions - make sure to always include both action and target properties

Respond ONLY with the JSON UI specification and no other text.
  `;
}

/**
 * Mock planner for development and testing
 * @param input - Planner input
 * @param targetNodeId - Optional target node ID for partial updates
 * @param customPrompt - Optional custom prompt
 * @returns Promise resolving to a UISpecNode
 */
export function mockPlanner(
  input: PlannerInput,
  targetNodeId?: string,
  customPrompt?: string
): UISpecNode {
  if (customPrompt) {
    console.log("mockPlanner received customPrompt:", customPrompt);
  }
  const taskSchema = input.schema.tasks as
    | { sampleData?: unknown[] }
    | undefined;
  const taskData = taskSchema?.sampleData || [
    {
      id: "1",
      title: "Example Task 1",
      description: "This is a sample task",
      status: "pending",
      priority: "medium",
    },
    {
      id: "2",
      title: "Example Task 2",
      description: "Another sample task",
      status: "completed",
      priority: "high",
    },
  ];

  const mockNode: UISpecNode = {
    id: targetNodeId || "root",
    node_type: "Container",
    props: {
      className: "p-4 space-y-6",
    },
    bindings: null,
    events: null,
    children: [
      {
        id: "header-1",
        node_type: "Header",
        props: {
          title: "Task Management Dashboard",
          className: "mb-4",
        },
        bindings: null,
        events: null,
        children: null,
      },
      {
        id: "main-content",
        node_type: "Container",
        props: {
          className: "grid grid-cols-1 gap-6 md:grid-cols-3",
        },
        bindings: null,
        events: null,
        children: [
          {
            id: "tasks-container",
            node_type: "Container",
            props: {
              className: "md:col-span-2",
            },
            bindings: null,
            events: null,
            children: [
              {
                id: "list-heading",
                node_type: "Container",
                props: {
                  className: "flex justify-between items-center mb-4",
                },
                bindings: null,
                events: null,
                children: [
                  {
                    id: "list-title",
                    node_type: "Header",
                    props: {
                      title: "Tasks",
                      className: "border-none p-0 m-0",
                    },
                    bindings: null,
                    events: null,
                    children: null,
                  },
                  {
                    id: "add-task-button",
                    node_type: "Button",
                    props: {
                      label: "Add Task",
                      variant: "default",
                    },
                    bindings: null,
                    events: {
                      onClick: {
                        action: "ADD_TASK",
                        target: "tasks-container",
                        payload: {},
                      },
                    },
                    children: null,
                  },
                ],
              },
              {
                id: "task-list",
                node_type: "ListView",
                props: {
                  selectable: "true",
                },
                bindings: {
                  items: JSON.stringify(taskData),
                  fields: JSON.stringify([
                    { key: "id", label: "ID" },
                    { key: "title", label: "Title" },
                    { key: "status", label: "Status" },
                    { key: "priority", label: "Priority" },
                  ]),
                },
                events: {
                  onSelect: {
                    action: "SELECT_TASK",
                    target: "task-detail",
                    payload: {
                      source: "task-list",
                    },
                  },
                },
                children: null,
              },
            ],
          },
          {
            id: "task-detail",
            node_type: "Detail",
            props: {
              title: "Task Details",
              visible: "true",
            },
            bindings: {
              data: JSON.stringify(taskData[0]),
              fields: JSON.stringify([
                { key: "title", label: "Title", type: "heading" },
                { key: "description", label: "Description", type: "content" },
                { key: "status", label: "Status" },
                { key: "priority", label: "Priority" },
                { key: "dueDate", label: "Due Date" },
              ]),
            },
            events: {
              onBack: {
                action: "CLOSE_DETAIL",
                target: "task-detail",
                payload: {},
              },
            },
            children: null,
          },
        ],
      },
    ],
  };

  return mockNode;
}

/**
 * Calls the LLM planner to generate a UI specification
 * @param input - Planner input
 * @param routeResolution - Optional route resolution for partial updates
 * @returns Promise resolving to a UISpecNode
 */
export async function callPlannerLLM(
  input: PlannerInput,
  routeResolution?: RouteResolution
): Promise<UISpecNode> {
  // console.log("🚀 callPlannerLLM called with input:", input);
  // console.log("🚀 Environment variables:", {
  //   MOCK_PLANNER: env.MOCK_PLANNER,
  //   OPENAI_API_KEY: env.OPENAI_API_KEY ? "Available" : "Not available",
  // });
  // console.log("🔍 Debugging env in planner.ts:");
  // console.log("  env.MOCK_PLANNER actual value:", env.MOCK_PLANNER);
  // console.log("  env.OPENAI_API_KEY actual value:", env.OPENAI_API_KEY);
  // console.log("  Is env.OPENAI_API_KEY truthy?:", !!env.OPENAI_API_KEY);
  // console.log(
  //   "  Condition for mock (env.MOCK_PLANNER === '1'):",
  //   env.MOCK_PLANNER === "1"
  // );
  // console.log(
  //   "  Condition for mock (!env.OPENAI_API_KEY):",
  //   !env.OPENAI_API_KEY
  // );
  // console.log(
  //   "  Combined condition for mock (mock enabled || key missing):",
  //   env.MOCK_PLANNER === "1" || !env.OPENAI_API_KEY
  // );

  // Emit planning start event
  await systemEvents.emit(
    createSystemEvent(SystemEventType.PLAN_START, { plannerInput: input })
  );

  // Use mock planner if environment variable is set
  if (env.MOCK_PLANNER === "1" || !env.OPENAI_API_KEY) {
    console.warn(
      "Using mock planner because MOCK_PLANNER is enabled or OPENAI_API_KEY is not available"
    );
    return mockPlanner(input);
  }

  const startTime = Date.now();

  // Use route resolution prompt if available, otherwise build a default prompt
  const prompt = routeResolution?.prompt || buildPrompt(input);

  // Emit prompt created event
  await systemEvents.emit(
    createSystemEvent(SystemEventType.PLAN_PROMPT_CREATED, { prompt })
  );

  try {
    // Use AI SDK's generateObject with structured outputs
    const { object: uiSpec } = await generateObject({
      model: strictOpenAI("gpt-4o", { structuredOutputs: true }),
      schema: openAIUISpec,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      maxTokens: 4000,
    });

    // Emit planning complete event
    await systemEvents.emit(
      createSystemEvent(SystemEventType.PLAN_COMPLETE, {
        layout: uiSpec,
        executionTimeMs: Date.now() - startTime,
      })
    );

    return uiSpec;
  } catch (error) {
    console.error("Error calling LLM planner:", error);

    // Emit error event
    await systemEvents.emit(
      createSystemEvent(SystemEventType.PLAN_ERROR, {
        error: error instanceof Error ? error : new Error(String(error)),
      })
    );

    throw error;
  }
}

/**
 * Process an event and generate an appropriate UI update
 * @param event - UI event that triggered the update
 * @param router - Action router to determine what to update
 * @param schema - Data schema
 * @param layout - Current UI layout
 * @param dataContext - Current data context
 * @param goal - The user's goal
 * @param userContext - Optional user context
 * @returns Promise resolving to a UI spec node
 */
export async function processEvent(
  event: UIEvent,
  router: ActionRouter,
  schema: Record<string, unknown>,
  layout: UISpecNode | undefined,
  dataContext: DataContext,
  goal: string,
  userContext?: Record<string, unknown>
): Promise<UISpecNode> {
  // const startTime = Date.now(); // Commented out as it's currently unused

  const routeResolution = await router.resolveRoute(
    event,
    schema,
    layout || null,
    dataContext,
    goal,
    userContext
  );

  if (!routeResolution) {
    throw new Error(
      `No route found for event type: ${event.type}, node: ${event.nodeId}`
    );
  }

  if (routeResolution.actionType.toString() === "NoOp") {
    // Temporarily comment out SystemEvent calls
    // await systemEvents.emit(
    //   createSystemEvent(SystemEventType.EVENT_PROCESSING_COMPLETE, {
    //     event,
    //     action: "NoOp",
    //     executionTimeMs: Date.now() - startTime, // startTime would be used here
    //   })
    // );
    if (!layout) throw new Error("Layout is undefined and action is NoOp");
    return layout;
  }

  const plannerInputForLLM: PlannerInput = routeResolution.plannerInput;
  const newLayout = await callPlannerLLM(plannerInputForLLM, routeResolution);

  // Temporarily comment out SystemEvent calls
  // await systemEvents.emit(
  //   createSystemEvent(SystemEventType.EVENT_PROCESSING_COMPLETE, {
  //     event,
  //     action: routeResolution.actionType.toString(),
  //     targetNodeId: routeResolution.targetNodeId,
  //     executionTimeMs: Date.now() - startTime, // startTime would be used here
  //   })
  // );

  return newLayout;
}
