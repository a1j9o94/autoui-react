import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { PlannerInput, UISpecNode } from "../schema/ui";
import {
  createSystemEvent,
  systemEvents,
  SystemEventType,
} from "./system-events";
import { buildPrompt } from "./action-router";
import { openAIUISpec } from "../schema/openai-ui-spec";

// Helper function to create the Anthropic client - REQUIRES an API key
const getAnthropicClient = (apiKey: string) => {
  return createAnthropic({
    apiKey: apiKey,
  });
};

/**
 * Mock planner that returns a realistic task dashboard UI for testing
 */
function mockPlanner(_input: PlannerInput): UISpecNode {
  return {
    id: "task-dashboard",
    node_type: "Container",
    props: { className: "p-4 space-y-4" },
    bindings: null,
    events: null,
    children: [
      {
        id: "header",
        node_type: "Container",
        props: { className: "flex justify-between items-center mb-4" },
        bindings: null,
        events: null,
        children: [
          {
            id: "title",
            node_type: "Text",
            props: { text: "Task Dashboard", className: "text-2xl font-bold" },
            bindings: null,
            events: null,
            children: null,
          },
          {
            id: "add-task-button",
            node_type: "Button",
            props: { label: "Add Task", variant: "default" },
            bindings: null,
            events: {
              CLICK: { action: "SHOW_DETAIL", target: "new-task-form" },
            },
            children: null,
          },
        ],
      },
      {
        id: "main-content",
        node_type: "Container",
        props: { className: "flex gap-4" },
        bindings: null,
        events: null,
        children: [
          {
            id: "tasks-container",
            node_type: "Container",
            props: { className: "flex-1" },
            bindings: null,
            events: null,
            children: [
              {
                id: "task-list",
                node_type: "ListView",
                props: { className: "space-y-2" },
                bindings: { data: "tasks.data" },
                events: null,
                children: [
                  {
                    id: "task-item-{{index}}",
                    node_type: "Card",
                    props: { className: "p-3 border rounded" },
                    bindings: null,
                    events: null,
                    children: [
                      {
                        id: "task-title-{{index}}",
                        node_type: "Text",
                        props: { className: "font-medium" },
                        bindings: { text: "item.title" },
                        events: null,
                        children: null,
                      },
                      {
                        id: "task-status-{{index}}",
                        node_type: "Badge",
                        props: {},
                        bindings: { text: "item.status" },
                        events: null,
                        children: null,
                      },
                      {
                        id: "view-details-button-{{index}}",
                        node_type: "Button",
                        props: { label: "View Details", variant: "outline", size: "sm" },
                        bindings: null,
                        events: {
                          CLICK: { action: "SHOW_DETAIL", target: "task-detail" },
                        },
                        children: null,
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: "task-detail",
            node_type: "Container",
            props: { className: "w-1/3 border-l pl-4", visible: false },
            bindings: null,
            events: null,
            children: [
              {
                id: "detail-title",
                node_type: "Text",
                props: { text: "Task Details", className: "text-lg font-bold mb-2" },
                bindings: null,
                events: null,
                children: null,
              },
              {
                id: "detail-content",
                node_type: "Text",
                props: {},
                bindings: { text: "tasks.selected.description" },
                events: null,
                children: null,
              },
              {
                id: "close-detail-button",
                node_type: "Button",
                props: { label: "Close", variant: "ghost" },
                bindings: null,
                events: {
                  CLICK: { action: "HIDE_DETAIL", target: "task-detail" },
                },
                children: null,
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Calls the LLM planner to generate a UI specification
 * @param input - Planner input
 * @param apiKey - Anthropic API key
 * @param useMock - Optional flag to use mock planner (for testing)
 * @returns Promise resolving to a UISpecNode
 */
export async function callPlannerLLM(
  input: PlannerInput,
  apiKey: string,
  useMock?: boolean
): Promise<UISpecNode> {
  await systemEvents.emit(
    createSystemEvent(SystemEventType.PLAN_START, { plannerInput: input })
  );

  // Use mock planner if useMock flag is set or MOCK_PLANNER env var is set
  if (useMock || (typeof window !== 'undefined' && (window as any).__USE_MOCK_PLANNER)) {
    console.log("[Mock Planner] Using mock planner for testing");
    const mockLayout = mockPlanner(input);
    await systemEvents.emit(
      createSystemEvent(SystemEventType.PLAN_COMPLETE, {
        layout: mockLayout,
        executionTimeMs: 0,
      })
    );
    return mockLayout;
  }

  // If not using mock planner via env var, API key is required for real LLM call
  if (!apiKey) {
    console.warn(
      `Anthropic API key was not provided to callPlannerLLM. Returning a placeholder UI.`
    );
    // Return a simple placeholder UI instead of throwing an error or calling a mock
    return {
      id: "root-no-api-key",
      node_type: "Container",
      props: {
        className: "p-4 flex flex-col items-center justify-center h-full",
      },
      bindings: null,
      events: null,
      children: [
        {
          id: "no-api-key-message",
          node_type: "Text",
          props: {
            text: "Anthropic API Key is required to generate the UI. Please provide one in your environment configuration.",
            className: "text-red-500 text-center",
          },
          bindings: null,
          events: null,
          children: null,
        },
      ],
    };
  }

  const startTime = Date.now();

  // Use userContext from the main input for template processing
  const templateValuesForPrompt = input.userContext ? { ...input.userContext } : undefined;
  const promptTemplateFromInput = typeof input.userContext?.promptTemplate === 'string'
    ? input.userContext.promptTemplate
    : undefined;

  const prompt = buildPrompt(
    input,
    promptTemplateFromInput, // Use template from input.userContext
    templateValuesForPrompt    // Use values from input.userContext
  );

  // Emit prompt created event
  await systemEvents.emit(
    createSystemEvent(SystemEventType.PLAN_PROMPT_CREATED, { prompt })
  );

  try {
    let uiSpec: UISpecNode;

    // Check if we're in a browser environment - use API route to avoid CORS
    if (typeof window !== 'undefined') {
      // Browser environment - call the API route
      const response = await fetch('/api/generate-ui', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, apiKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      uiSpec = data.uiSpec;
    } else {
      // Server environment - call Anthropic directly
      // Use AI SDK's generateObject with Claude Haiku 4.5 (fastest small model)
      // Anthropic requires explicit mode - using 'tool' for structured outputs
      const { object } = await generateObject({
        model: getAnthropicClient(apiKey)("claude-haiku-4-5"),
        schema: openAIUISpec,
        mode: 'tool',
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        maxTokens: 4000,
      });
      uiSpec = object;
    }

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
