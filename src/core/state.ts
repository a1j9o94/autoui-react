import { useReducer, useCallback, useEffect, useRef } from "react";

import { UIEvent, UISpecNode, UIState } from "../schema/ui";
import { uiReducer, initialState } from "./reducer";
import {
  systemEvents,
  createSystemEvent,
  SystemEventType,
} from "./system-events";
import { ActionRouter, PlanningConfig } from "./action-router";
import { ActionType } from "../schema/action-types";
import { DataContext } from "./bindings"; // Import DataContext

export interface UseUIStateEngineOptions {
  schema: Record<string, unknown>;
  goal: string;
  openaiApiKey: string;
  userContext?: Record<string, unknown> | undefined;
  planningConfig?: PlanningConfig | undefined;
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
  openaiApiKey = "",
  userContext,
  planningConfig,
  dataContext = {},
  enablePartialUpdates = true,
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
  const router = new ActionRouter(openaiApiKey, planningConfig);

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
        console.log(
          "[state.ts handleEvent] contextForRouting:",
          JSON.stringify(contextForRouting, null, 2)
        ); // Can be large

        // Always call router.resolveRoute for every event
        const route = await router.resolveRoute(
          event,
          schema,
          layoutForRouting,
          contextForRouting,
          goal,
          openaiApiKey,
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

          // If router provided an updated data context, dispatch an action to set it
          if (route.updatedDataContext) {
            dispatch({
              type: "SET_DATA_CONTEXT",
              payload: route.updatedDataContext,
            });
          }

          // Use directUpdateLayout if present, otherwise call LLM
          if (!route.updatedNode) {
            throw new Error(
              "No updatedNode returned from router.resolveRoute. This should not happen."
            );
          }

          resolvedNode = route.updatedNode;
        } else {
          throw new Error("No route returned from router.resolveRoute");
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
          // systemEvents.emit for PLAN_COMPLETE is handled by callPlannerLLM or should be added for mockPlanner path
        }
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
      dataContext,
      openaiApiKey,
      enablePartialUpdates,
      dispatch,
    ]
  );

  // Initial query on mount
  useEffect(() => {
    const initialFetch = async () => {
      dispatch({ type: "LOADING", isLoading: true });
      try {
        const initEvent: UIEvent = {
          type: "INIT",
          nodeId: "system",
          timestamp: Date.now(),
          payload: null,
        };

        const route = await router.resolveRoute(
          initEvent,
          schema,
          stateRef.current.layout,
          dataContext,
          goal,
          openaiApiKey,
          userContext
        );

        if (!route) {
          console.error(
            "[UIStateEngine] Initial fetch: Failed to resolve route for INIT event."
          );
          throw new Error("Failed to initialize UI due to routing error.");
        }

        // If router provided an updated data context on initial load, set it.
        // This is less common for INIT but good practice.
        if (route.updatedDataContext) {
          dispatch({
            type: "SET_DATA_CONTEXT",
            payload: route.updatedDataContext,
          });
        }

        if (!route.updatedNode) {
          throw new Error(
            "No updatedNode returned from router.resolveRoute on initial fetch. This should not happen."
          );
        }

        const node = route.updatedNode;

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
