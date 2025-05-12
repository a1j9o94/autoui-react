import { useReducer, useCallback, useEffect } from "react";
// Mock useChat hook for development
// const useChat = (config: any) => { ... };

import {
  UIEvent,
  UISpecNode,
  // uiSpecNode, // Will be handled by planner.ts, not directly by state.ts for parsing
  PlannerInput,
} from "../schema/ui";
import { uiReducer, initialState } from "./reducer";
import { mockPlanner, callPlannerLLM } from "./planner"; // Added callPlannerLLM
import {
  systemEvents,
  createSystemEvent,
  SystemEventType,
} from "./system-events";
import { ActionRouter, ActionType, createDefaultRouter } from "./action-router";

export interface UseUIStateEngineOptions {
  schema: Record<string, unknown>;
  goal: string;
  openaiApiKey?: string | undefined;
  userContext?: Record<string, unknown> | undefined;
  mockMode?: boolean | undefined;
  planningConfig?:
    | {
        prefetchDepth?: number;
        temperature?: number;
        streaming?: boolean;
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
  openaiApiKey,
  userContext,
  mockMode = false,
  planningConfig,
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
  // const { append, data, isLoading, error, stop } = useChat(null); // REMOVE useChat

  // Function to handle UI events with routing
  const handleEvent = useCallback(
    async (event: UIEvent) => {
      // Make async
      dispatch({ type: "UI_EVENT", event });
      dispatch({ type: "LOADING", isLoading: true });

      try {
        let resolvedNode: UISpecNode;
        let actionTypeForDispatch: ActionType = ActionType.FULL_REFRESH; // Default
        let targetNodeIdForDispatch: string = "root"; // Default

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
            actionTypeForDispatch = route.actionType;
            targetNodeIdForDispatch = route.targetNodeId;

            systemEvents.emit(
              createSystemEvent(SystemEventType.PLAN_START, {
                plannerInput: route.plannerInput,
              })
            );

            if (mockMode) {
              resolvedNode = mockPlanner(
                route.plannerInput,
                route.targetNodeId,
                route.prompt
              );
            } else {
              // systemEvents.emit for PLAN_PROMPT_CREATED is handled inside callPlannerLLM
              resolvedNode = await callPlannerLLM(
                route.plannerInput,
                openaiApiKey || "",
                route
              );
            }
          } else {
            // Fallback if router.resolveRoute returns null (should not happen with default full refresh)
            const input: PlannerInput = {
              schema,
              goal,
              history: [...state.history, event],
              userContext,
            };
            if (mockMode) {
              resolvedNode = mockPlanner(input);
            } else {
              resolvedNode = await callPlannerLLM(
                input,
                openaiApiKey || "",
                undefined
              );
            }
          }
        } else {
          // Fallback to full refresh if partial updates disabled
          const input: PlannerInput = {
            schema,
            goal,
            history: [...state.history, event], // event is already in history from UI_EVENT dispatch
            userContext: userContext,
          };

          if (mockMode) {
            resolvedNode = mockPlanner(input);
          } else {
            // buildPrompt is handled inside callPlannerLLM if no route.prompt is provided
            resolvedNode = await callPlannerLLM(
              input,
              openaiApiKey || "",
              undefined
            );
          }
        }

        // Dispatch based on action type (derived from routing or default)
        switch (actionTypeForDispatch) {
          case ActionType.UPDATE_NODE:
          case ActionType.SHOW_DETAIL:
          case ActionType.HIDE_DETAIL:
          case ActionType.TOGGLE_STATE:
          case ActionType.ADD_DROPDOWN:
          case ActionType.UPDATE_FORM:
          case ActionType.NAVIGATE:
            dispatch({
              type: "PARTIAL_UPDATE",
              nodeId: targetNodeIdForDispatch,
              node: resolvedNode,
            });
            break;
          case ActionType.FULL_REFRESH:
          default:
            dispatch({ type: "AI_RESPONSE", node: resolvedNode });
            break;
        }
        // systemEvents.emit for PLAN_COMPLETE is handled by callPlannerLLM or should be added for mockPlanner path
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        dispatch({ type: "ERROR", message: errorMessage });
        systemEvents.emit(
          createSystemEvent(SystemEventType.PLAN_ERROR, {
            error: e instanceof Error ? e : new Error(String(e)),
          })
        );
      } finally {
        dispatch({ type: "LOADING", isLoading: false });
      }
    },
    [
      // append, // REMOVE
      goal,
      schema,
      state.history, // Keep state.history if input preparation needs it
      state.layout,
      // stop, // REMOVE
      userContext,
      router,
      mockMode,
      dataContext,
      openaiApiKey,
      enablePartialUpdates,
      dispatch, // Add dispatch
    ]
  );

  // Effect to process LLM responses - REMOVE THIS ENTIRE useEffect
  // useEffect(() => { ... }, [data.content, error, isLoading, enablePartialUpdates]);

  // Initial query on mount
  useEffect(() => {
    const initialFetch = async () => {
      dispatch({ type: "LOADING", isLoading: true });
      try {
        const input: PlannerInput = {
          schema,
          goal,
          history: [], // Initial history is empty
          userContext: userContext,
        };
        let node: UISpecNode;

        if (mockMode) {
          // For mock mode, we can still use the simpler mockPlanner directly
          // or simulate routing if necessary, but for now, let's keep it simple.
          node = mockPlanner(input);
          // Consider emitting PLAN_COMPLETE for mock path if needed
        } else {
          // For non-mock mode, we MUST go through the router to get a prompt
          const initEvent: UIEvent = {
            type: "INIT", // Assuming "INIT" is your initial event type
            nodeId: "system", // Or some other appropriate initial nodeId
            timestamp: Date.now(),
            payload: null,
          };

          // Resolve the route for the initial event
          const route = router.resolveRoute(
            initEvent,
            schema,
            null, // No existing layout on initial fetch
            dataContext,
            goal,
            userContext
          );

          if (!route || !route.prompt) {
            // This should ideally not happen if default routes are set up
            console.error(
              "[UIStateEngine] Initial fetch: Failed to resolve route or get prompt for INIT event."
            );
            throw new Error("Failed to initialize UI due to routing error.");
          }

          systemEvents.emit(
            createSystemEvent(SystemEventType.PLAN_START, {
              plannerInput: route.plannerInput,
            })
          );

          // Call planner with the resolved route (which includes the prompt)
          node = await callPlannerLLM(
            route.plannerInput, // Use plannerInput from the resolved route
            openaiApiKey || "",
            route // Pass the entire route object
          );
        }
        dispatch({ type: "AI_RESPONSE", node });
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        dispatch({ type: "ERROR", message: errorMessage });
        systemEvents.emit(
          // Also emit system event for initial load error
          createSystemEvent(SystemEventType.PLAN_ERROR, {
            error: e instanceof Error ? e : new Error(String(e)),
          })
        );
      } finally {
        dispatch({ type: "LOADING", isLoading: false });
      }
    };
    initialFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, schema, userContext, mockMode, dispatch, openaiApiKey]);

  return {
    state,
    dispatch,
    handleEvent,
  };
}
