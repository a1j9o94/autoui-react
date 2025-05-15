import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { PlannerInput, UISpecNode } from "../schema/ui";
import {
  createSystemEvent,
  systemEvents,
  SystemEventType,
} from "./system-events";
import { buildPrompt } from "./action-router";
import { openAIUISpec } from "../schema/openai-ui-spec";

// Helper function to create the OpenAI client REQUIRES an API key
const getOpenAIClient = (apiKey: string) => {
  return createOpenAI({
    apiKey: apiKey, // Use the provided key directly
    compatibility: "strict",
  });
};

/**
 * Calls the LLM planner to generate a UI specification
 * @param input - Planner input
 * @param routeResolution - Optional route resolution for partial updates
 * @param openaiApiKey - Optional OpenAI API key
 * @returns Promise resolving to a UISpecNode
 */
export async function callPlannerLLM(
  input: PlannerInput,
  openaiApiKey: string
): Promise<UISpecNode> {
  await systemEvents.emit(
    createSystemEvent(SystemEventType.PLAN_START, { plannerInput: input })
  );

  // Use mock planner if MOCK_PLANNER env var is set
  // if (env.MOCK_PLANNER === "1") {
  //   console.warn(
  //     `Using mock planner because MOCK_PLANNER environment variable is set to "1".`
  //   );
  //   return mockPlanner(input);
  // }

  // If not using mock planner via env var, API key is required for real LLM call
  if (!openaiApiKey) {
    console.warn(
      `OpenAI API key was not provided to callPlannerLLM. Returning a placeholder UI.`
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
            text: "OpenAI API Key is required to generate the UI. Please provide one in your environment configuration.",
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
