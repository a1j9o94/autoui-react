import { useReducer, useCallback, useEffect } from "react";
// Mock useChat hook for development
// const useChat = (config: any) => { ... };

import {
  UIState,
  UIEvent,
  UISpecNode,
  // uiSpecNode, // Will be handled by planner.ts, not directly by state.ts for parsing
  PlannerInput,
} from "../schema/ui";
import { uiReducer, initialState } from "./reducer";
import { buildPrompt, mockPlanner, callPlannerLLM } from "./planner"; // Added callPlannerLLM
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
              resolvedNode = await callPlannerLLM(route.plannerInput, route);
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
              resolvedNode = await callPlannerLLM(input);
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
            resolvedNode = await callPlannerLLM(input);
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
      enablePartialUpdates,
      dispatch, // Add dispatch
    ]
  );

  // Effect to process LLM responses - REMOVE THIS ENTIRE useEffect
  // useEffect(() => { ... }, [data.content, error, isLoading, enablePartialUpdates]);

  // Initial query on mount
  useEffect(() => {
    const initialFetch = async () => {
      /**
       console.log( // <--- ADD THIS LOG
        "🚀 useUIStateEngine initial load EFFECT TRIGGERED. Goal:", goal,
        "MockMode:", mockMode,
        "Schema changed:", schema !== (window as any)._previousSchema, // Crude check
        "UserContext changed:", userContext !== (window as any)._previousUserContext // Crude check
      );
       */
      dispatch({ type: "LOADING", isLoading: true });
      try {
        const input: PlannerInput = {
          schema,
          goal,
          history: [],
          userContext: userContext,
        };
        let node: UISpecNode;
        if (mockMode) {
          node = mockPlanner(input);
          // TODO: Consider emitting PLAN_COMPLETE for mock path if callPlannerLLM does it internally
        } else {
          // callPlannerLLM will emit PLAN_START, PLAN_PROMPT_CREATED, PLAN_COMPLETE/ERROR
          node = await callPlannerLLM(input);
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
  }, [goal, schema, userContext, mockMode, dispatch]); // Removed append, kept dispatch

  return {
    state,
    dispatch,
    handleEvent,
  };
}
