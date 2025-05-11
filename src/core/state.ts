import { useReducer, useCallback, useEffect, useState } from "react";
// Mock useChat hook for development
const useChat = (config: any) => {
  const [content, setContent] = useState("{}");
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setError] = useState<Error | null>(null);

  const append = async (message: any) => {
    try {
      setIsLoading(true);
      // In the mock, we just return immediately with empty content
      // This prevents any infinite loops from chat API calls
      setContent("{}");
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    append,
    data: { content },
    isLoading,
    error: chatError,
    stop: () => {},
  };
};

import {
  UIState,
  UIEvent,
  UISpecNode,
  uiSpecNode,
  PlannerInput,
} from "../schema/ui";
import { uiReducer, initialState } from "./reducer";
import { buildPrompt, mockPlanner } from "./planner";
import {
  systemEvents,
  createSystemEvent,
  SystemEventType,
} from "./system-events";
import { ActionRouter, ActionType, createDefaultRouter } from "./action-router";

export interface UseUIStateEngineOptions {
  schema: Record<string, unknown>;
  goal: string;
  userContext?: Record<string, unknown> | undefined;
  mockMode?: boolean | undefined;
  planningConfig?:
    | {
        prefetchDepth?: number | undefined;
        temperature?: number | undefined;
        streaming?: boolean | undefined;
      }
    | undefined;
  router?: ActionRouter | undefined;
  dataContext?: Record<string, unknown> | undefined;
  enablePartialUpdates?: boolean | undefined;
}

/**
 * Custom hook for the UI state engine
 * @param options - Configuration options
 * @returns State and dispatcher
 */
export function useUIStateEngine({
  schema,
  goal,
  userContext,
  mockMode = false,
  planningConfig = {},
  router = createDefaultRouter(),
  dataContext = {},
  enablePartialUpdates = false,
}: UseUIStateEngineOptions) {
  // Warn if userContext is explicitly null, as it's an edge case we want to discourage.
  // Consumers should use undefined if they mean to omit it.
  if (userContext === null) {
    console.warn(
      "useUIStateEngine: userContext was explicitly set to null. " +
        "This is an allowed but discouraged value. Consider using undefined if you intend to omit the user context."
    );
  }

  const [state, dispatch] = useReducer(uiReducer, initialState);
  const { append, data, isLoading, error, stop } = useChat(null);

  // Function to handle UI events with routing
  const handleEvent = useCallback(
    (event: UIEvent) => {
      // Dispatch the UI event
      dispatch({ type: "UI_EVENT", event });

      // Stop any ongoing chat streams
      stop();

      // Use the router to determine how to handle this event
      if (enablePartialUpdates) {
        const route = router.resolveRoute(
          event,
          schema,
          state.layout,
          dataContext,
          goal,
          userContext
        );

        if (route) {
          console.log("Resolved route:", route);

          // Emit routing event
          systemEvents.emit(
            createSystemEvent(SystemEventType.PLAN_START, {
              plannerInput: route.plannerInput,
            })
          );

          if (mockMode) {
            // Use mock planner with routing info
            const node = mockPlanner(
              route.plannerInput,
              route.targetNodeId,
              route.prompt
            );
            // Dispatch based on action type
            switch (route.actionType) {
              case ActionType.FULL_REFRESH:
                dispatch({ type: "AI_RESPONSE", node });
                break;

              case ActionType.UPDATE_NODE:
              case ActionType.SHOW_DETAIL:
              case ActionType.HIDE_DETAIL:
              case ActionType.TOGGLE_STATE:
              case ActionType.ADD_DROPDOWN:
              case ActionType.UPDATE_FORM:
              case ActionType.NAVIGATE:
                dispatch({
                  type: "PARTIAL_UPDATE",
                  nodeId: route.targetNodeId,
                  node,
                });
                break;
            }
          } else {
            // Send prompt to LLM
            const prompt = route.prompt;

            systemEvents.emit(
              createSystemEvent(SystemEventType.PLAN_PROMPT_CREATED, { prompt })
            );

            append({
              content: prompt,
              role: "user",
            });

            // The response will be handled in the useEffect below
            // We'll need to store the current route info for when the response comes back
            sessionStorage.setItem(
              "currentRoute",
              JSON.stringify({
                actionType: route.actionType,
                targetNodeId: route.targetNodeId,
              })
            );
          }

          return;
        }
      }

      // Fallback to full refresh if no route or partial updates disabled
      const input: PlannerInput = {
        schema,
        goal,
        history: [...state.history, event],
        userContext: userContext,
      };

      if (mockMode) {
        // Use mock planner for faster development
        const node = mockPlanner(input);
        dispatch({ type: "AI_RESPONSE", node });
      } else {
        // Send prompt to LLM
        const prompt = buildPrompt(input);
        append({
          content: prompt,
          role: "user",
        });
      }
    },
    [
      append,
      goal,
      schema,
      state.history,
      state.layout,
      stop,
      userContext,
      router,
      mockMode,
      dataContext,
      enablePartialUpdates,
    ]
  );

  // Effect to process LLM responses
  useEffect(() => {
    if (isLoading) {
      dispatch({ type: "LOADING", isLoading: true });
    } else if (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      dispatch({ type: "ERROR", message: errorMessage });

      // Emit error event
      systemEvents.emit(
        createSystemEvent(SystemEventType.PLAN_ERROR, {
          error: error instanceof Error ? error : new Error(String(error)),
        })
      );
    } else if (data.content && data.content !== "{}") {
      try {
        // Emit response chunk event
        systemEvents.emit(
          createSystemEvent(SystemEventType.PLAN_RESPONSE_CHUNK, {
            chunk: data.content,
            isComplete: true,
          })
        );

        // Extract JSON from the response (handling potential markdown code blocks)
        const jsonMatch = data.content.match(
          /```(?:json)?\s*([\s\S]*?)\s*```/
        ) || [null, data.content];
        const jsonStr = jsonMatch[1].trim();

        const parsedJson = JSON.parse(jsonStr);
        // Validate the response using Zod
        const validatedNode = uiSpecNode.parse(parsedJson);

        // Check for stored route info
        const routeInfoStr = sessionStorage.getItem("currentRoute");
        if (routeInfoStr && enablePartialUpdates) {
          try {
            const routeInfo = JSON.parse(routeInfoStr);

            // Handle response based on action type
            switch (routeInfo.actionType) {
              case ActionType.FULL_REFRESH:
                dispatch({ type: "AI_RESPONSE", node: validatedNode });
                break;

              case ActionType.UPDATE_NODE:
              case ActionType.SHOW_DETAIL:
              case ActionType.HIDE_DETAIL:
              case ActionType.TOGGLE_STATE:
              case ActionType.ADD_DROPDOWN:
              case ActionType.UPDATE_FORM:
              case ActionType.NAVIGATE:
                dispatch({
                  type: "PARTIAL_UPDATE",
                  nodeId: routeInfo.targetNodeId,
                  node: validatedNode,
                });
                break;

              default:
                dispatch({ type: "AI_RESPONSE", node: validatedNode });
            }

            // Clear stored route info
            sessionStorage.removeItem("currentRoute");
          } catch (e) {
            // Fallback to full response if route info is invalid
            console.error("Error parsing route info:", e);
            dispatch({ type: "AI_RESPONSE", node: validatedNode });
          }
        } else {
          // Default handling - full response
          dispatch({ type: "AI_RESPONSE", node: validatedNode });
        }

        // Emit planning complete event
        systemEvents.emit(
          createSystemEvent(SystemEventType.PLAN_COMPLETE, {
            layout: validatedNode,
            executionTimeMs: 0, // Not available here
          })
        );
      } catch (parseError) {
        console.error("Failed to parse LLM response:", parseError);
        dispatch({
          type: "ERROR",
          message: "Failed to parse LLM response",
        });

        // Emit error event
        systemEvents.emit(
          createSystemEvent(SystemEventType.PLAN_ERROR, {
            error:
              parseError instanceof Error
                ? parseError
                : new Error("Parse error"),
          })
        );
      }
    }
  }, [data.content, error, isLoading, enablePartialUpdates]);

  // Initial query on mount
  useEffect(() => {
    const input: PlannerInput = {
      schema,
      goal,
      history: [],
      userContext: userContext,
    };

    if (mockMode) {
      // Use mock planner for faster development
      const node = mockPlanner(input);
      dispatch({ type: "AI_RESPONSE", node });
    } else {
      // Send prompt to LLM
      const prompt = buildPrompt(input);
      append({
        content: prompt,
        role: "user",
      });
    }
  }, [append, goal, schema, userContext, mockMode]);

  return {
    state,
    dispatch,
    handleEvent,
  };
}