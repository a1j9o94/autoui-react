import { useReducer, useCallback, useEffect, useRef } from "react";
// Mock useChat hook for development
// const useChat = (config: any) => { ... };

import { UIEvent, UISpecNode, PlannerInput, UIState } from "../schema/ui";
import { uiReducer, initialState } from "./reducer";
import { mockPlanner, callPlannerLLM } from "./planner"; // Added callPlannerLLM
import {
  systemEvents,
  createSystemEvent,
  SystemEventType,
} from "./system-events";
import { ActionRouter, ActionType } from "./action-router";
import { DataContext } from "./bindings"; // Import DataContext

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  planningConfig,
  router = new ActionRouter(),
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
  const stateRef = useRef<UIState>(state); // Ref to hold the current state

  useEffect(() => {
    stateRef.current = state; // Keep the ref updated with the latest state
  }, [state]);

  // Function to handle UI events with routing
  const handleEvent = useCallback(
    async (
      event: UIEvent,
      currentResolvedLayout?: UISpecNode | null,
      updatedDataContext?: DataContext
    ) => {
      dispatch({ type: "UI_EVENT", event });
      dispatch({ type: "LOADING", isLoading: true });

      try {
        let resolvedNode: UISpecNode;
        let actionTypeForDispatch: ActionType = ActionType.FULL_REFRESH;
        let targetNodeIdForDispatch: string = "root";

        const layoutForRouting =
          currentResolvedLayout || stateRef.current.layout;
        const contextForRouting = updatedDataContext || dataContext;

        // ADD LOGS BEFORE AND AFTER router.resolveRoute
        console.log(
          "[state.ts handleEvent] About to call router.resolveRoute. enablePartialUpdates:",
          enablePartialUpdates
        );
        console.log(
          "[state.ts handleEvent] layoutForRouting ID (if exists):",
          layoutForRouting?.id
        );
        // console.log("[state.ts handleEvent] contextForRouting:", JSON.stringify(contextForRouting, null, 2)); // Can be large

        if (enablePartialUpdates) {
          const route = router.resolveRoute(
            event,
            schema,
            layoutForRouting,
            contextForRouting,
            goal,
            userContext
          );

          // ADD THIS LOG STRATEGICALLY
          console.log(
            "[state.ts handleEvent] router.resolveRoute returned:",
            route
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
              resolvedNode = await callPlannerLLM(
                route.plannerInput,
                openaiApiKey || "",
                route
              );
            }
          } else {
            const input: PlannerInput = {
              schema,
              goal,
              history: [...stateRef.current.history, event],
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
          const input: PlannerInput = {
            schema,
            goal,
            history: [...stateRef.current.history, event],
            userContext: userContext,
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

        // Dispatch based on action type (derived from routing or default)
        switch (actionTypeForDispatch) {
          case ActionType.UPDATE_NODE:
          case ActionType.SHOW_DETAIL:
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
          case ActionType.HIDE_DIALOG:
            dispatch({
              type: "PARTIAL_UPDATE",
              nodeId: targetNodeIdForDispatch,
              node: resolvedNode,
            });
            break;
          case ActionType.SAVE_TASK_CHANGES:
            dispatch({ type: "AI_RESPONSE", node: resolvedNode });
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
      goal,
      schema,
      userContext,
      router,
      mockMode,
      dataContext,
      openaiApiKey,
      enablePartialUpdates,
      dispatch,
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
          node = mockPlanner(input);
        } else {
          const initEvent: UIEvent = {
            type: "INIT",
            nodeId: "system",
            timestamp: Date.now(),
            payload: null,
          };

          // Resolve the route for the initial event.
          // For the very first fetch, dataContext might be empty or just being initialized.
          // The router should be able to handle this for an INIT event, typically leading to a full refresh prompt.
          const route = router.resolveRoute(
            initEvent,
            schema,
            stateRef.current.layout,
            dataContext,
            goal,
            userContext
          );

          if (!route || !route.prompt) {
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

          node = await callPlannerLLM(
            route.plannerInput,
            openaiApiKey || "",
            route
          );
        }
        dispatch({ type: "AI_RESPONSE", node });
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
    };
    initialFetch();
    // For diagnostic purposes in tests, temporarily making dependencies very minimal.
    // If tests pass, we need to carefully evaluate which of these truly need to trigger a re-fetch.
    // `goal` and `schema` are strong candidates for re-fetching. `dispatch` is stable.
    // `router`, `userContext`, `mockMode`, `openaiApiKey`, `dataContext` are less likely to need to trigger a full re-fetch IF the initial call was successful.
  }, [goal, schema, dispatch]); // Highly restricted dependencies for testing

  return {
    state,
    dispatch,
    handleEvent,
  };
}
