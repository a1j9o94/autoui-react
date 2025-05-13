import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { PlannerInput, UISpecNode, openAIUISpec, UIEvent } from "../schema/ui";
import {
  createSystemEvent,
  systemEvents,
  SystemEventType,
} from "./system-events";
import { env } from "../env";
import { ActionRouter, RouteResolution, buildPrompt } from "./action-router";
import { DataContext } from "./bindings";

// Helper function to create the OpenAI client REQUIRES an API key
const getOpenAIClient = (apiKey: string) => {
  return createOpenAI({
    apiKey: apiKey, // Use the provided key directly
    compatibility: "strict",
  });
};

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
                  data: "tasks.data",
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
 * @param openaiApiKey - Optional OpenAI API key
 * @returns Promise resolving to a UISpecNode
 */
export async function callPlannerLLM(
  input: PlannerInput,
  openaiApiKey: string,
  routeResolution?: RouteResolution
): Promise<UISpecNode> {
  await systemEvents.emit(
    createSystemEvent(SystemEventType.PLAN_START, { plannerInput: input })
  );

  // Use mock planner if MOCK_PLANNER env var is set
  if (env.MOCK_PLANNER === "1") {
    console.warn(
      `Using mock planner because MOCK_PLANNER environment variable is set to "1".`
    );
    return mockPlanner(input);
  }

  // If not using mock planner via env var, API key is required for real LLM call
  if (!openaiApiKey) {
    console.warn(
      `OpenAI API key was not provided to callPlannerLLM. Falling back to mock planner.`
    );
    return mockPlanner(input);
  }

  const startTime = Date.now();

  let prompt: string;
  if (routeResolution?.prompt) {
    prompt = routeResolution.prompt;
  } else {
    // If no prompt from routeResolution (e.g., for full refresh or when enablePartialUpdates is false),
    // build a default prompt using the main PlannerInput.
    console.warn(
      "[callPlannerLLM] No prompt provided by routeResolution or routeResolution is undefined. Building default prompt from input."
    );
    prompt = buildPrompt(input); // Fallback to generating a prompt from the input
  }

  // Emit prompt created event
  await systemEvents.emit(
    createSystemEvent(SystemEventType.PLAN_PROMPT_CREATED, { prompt })
  );

  try {
    // Use AI SDK's generateObject with structured outputs
    const { object: uiSpec } = await generateObject({
      model: getOpenAIClient(openaiApiKey)("gpt-4o", {
        structuredOutputs: true,
      }),
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
 * @param openaiApiKey - Optional OpenAI API key
 * @returns Promise resolving to a UI spec node
 */
export async function processEvent(
  event: UIEvent,
  router: ActionRouter,
  schema: Record<string, unknown>,
  layout: UISpecNode | undefined,
  dataContext: DataContext,
  goal: string,
  userContext?: Record<string, unknown>,
  openaiApiKey?: string
): Promise<UISpecNode> {
  // const startTime = Date.now(); // Commented out as it's currently unused

  // Log the layout that processEvent received
  console.log(
    `[Planner.processEvent] Received event for nodeId: ${event.nodeId}`
  );
  if (layout) {
    const taskListViewNode = layout.children?.find(
      (c) => c.id === "taskListView" || c.id === "task-list-view"
    );
    let taskListViewChildrenSnapshot = null;
    if (taskListViewNode && taskListViewNode.children) {
      taskListViewChildrenSnapshot = taskListViewNode.children.map((child) => ({
        id: child.id,
        children: child.children?.map((grandChild) => ({
          id: grandChild.id,
          props: grandChild.props,
          events: grandChild.events,
        })),
      }));
    }
    console.log(
      `[Planner.processEvent] Layout snapshot (taskListView children):`,
      JSON.stringify(taskListViewChildrenSnapshot, null, 2)
    );
  } else {
    console.log(`[Planner.processEvent] Layout is undefined.`);
  }

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
  const newLayout = await callPlannerLLM(
    plannerInputForLLM,
    openaiApiKey || "",
    routeResolution
  );

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
