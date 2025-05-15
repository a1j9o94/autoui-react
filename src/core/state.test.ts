import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  Mock,
  MockedFunction,
} from "vitest";
import { act, renderHook } from "@testing-library/react";
import * as ReactSource from "react"; // Import original React for use in mock

import { useUIStateEngine, UseUIStateEngineOptions } from "./state";
import { ActionRouter, RouteResolution } from "./action-router";
import {
  UIEvent,
  UISpecNode,
  PlannerInput,
  UIAction,
  UIState,
} from "../schema/ui";
import { ActionType } from "../schema/action-types";

// Hold the current dispatch spy for each test
let currentTestDispatchSpy: Mock<[UIAction], void> | null = null;

vi.mock("react", async (importOriginal) => {
  const actualReact = await importOriginal<typeof ReactSource>();
  return {
    ...actualReact,
    useReducer: (
      reducer: (state: UIState, action: UIAction) => UIState,
      initialState: UIState
    ) => {
      const [state, dispatch] = actualReact.useReducer(reducer, initialState);

      // Memoize spiedDispatch to ensure stable identity if it's a dependency elsewhere
      const spiedDispatch = actualReact.useCallback(
        (action: UIAction) => {
          if (currentTestDispatchSpy) {
            currentTestDispatchSpy(action);
          }
          return dispatch(action);
        },
        [dispatch]
      ); // currentTestDispatchSpy is external, dispatch is the key internal dependency

      return [state, spiedDispatch];
    },
  };
});

vi.mock("./planner", async () => {
  const actualPlannerModule = await vi.importActual<typeof import("./planner")>("./planner");
  const mockNodeForPlanner: UISpecNode = { // Defined inside the factory
    id: "mock-llm-node-from-planner-mock",
    node_type: "Container",
    props: { title: "Mocked by vi.mock(./planner)" },
    children: [],
    bindings: null,
    events: null,
  };
  return {
    ...(actualPlannerModule as Record<string, unknown>),
    callPlannerLLM: vi.fn().mockResolvedValue(mockNodeForPlanner),
    mockPlanner: vi.fn().mockImplementation((input: PlannerInput, targetNodeId?: string) => ({
      id: targetNodeId || input.goal || "mock-planner-node-via-vi-mock",
      node_type: "Text",
      props: { text: input.goal },
      children: [],
      bindings: null,
      events: null,
    })),
    buildPrompt: vi.fn(), // Keep if ActionRouter might use it
  };
});

describe("useUIStateEngine", () => {
  const defaultOptions: UseUIStateEngineOptions = {
    schema: { users: { id: "string", name: "string" } },
    goal: "Manage users",
    openaiApiKey: "test-api-key-for-state", // Added openaiApiKey
    userContext: undefined,
    dataContext: {}, // Ensure dataContext is initialized for tests
    planningConfig: { prefetchDepth: 0, temperature: 0.1, streaming: false }, // ensure defined
  };

  // Helper to render the hook and get the current dispatch spy
  const renderHelper = (options: Partial<UseUIStateEngineOptions> = {}) => {
    currentTestDispatchSpy = vi.fn() as Mock<[UIAction], void>;
    const hookResult = renderHook(() =>
      useUIStateEngine({ ...defaultOptions, ...options })
    );
    return { ...hookResult, dispatchSpy: currentTestDispatchSpy! };
  };

  let resolveRouteSpy: MockedFunction<
    typeof ActionRouter.prototype.resolveRoute
  >;

  beforeEach(() => {
    vi.clearAllMocks();
    currentTestDispatchSpy = null; // Reset spy
    resolveRouteSpy = vi.spyOn(
      ActionRouter.prototype,
      "resolveRoute"
    ) as unknown as MockedFunction<typeof ActionRouter.prototype.resolveRoute>;
  });

  describe("Initial Load", () => {
    it("should use ActionRouter.resolveRoute and dispatch AI_RESPONSE on successful initial load", async () => {
      const initialMockNode: UISpecNode = { id: "initial-mock-node", node_type: "Text", props: null, bindings: null, events: null, children: []};
      const initialRouteResolution: RouteResolution = {
        actionType: ActionType.FULL_REFRESH,
        targetNodeId: "root",
        updatedNode: initialMockNode, 
        updatedDataContext: { initialContext: true },
      };
      resolveRouteSpy.mockResolvedValue(initialRouteResolution);

      const { result, dispatchSpy } = renderHelper({}); 
      await act(async () => {}); 

      expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: true });
      expect(resolveRouteSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "INIT" }),
        defaultOptions.schema,
        null, 
        defaultOptions.dataContext, 
        defaultOptions.goal,
        defaultOptions.openaiApiKey,
        defaultOptions.userContext
      );
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: "SET_DATA_CONTEXT",
        payload: initialRouteResolution.updatedDataContext,
      });
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: "AI_RESPONSE",
        node: initialMockNode,
      });
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: false });
      expect(result.current.state.layout).toEqual(initialMockNode);
      expect(result.current.state.loading).toBe(false);
      expect(result.current.state.error).toBeNull();
    });

    it("should handle error from resolveRoute on initial load", async () => {
      const errorMessage = "Initial routing failed";
      resolveRouteSpy.mockRejectedValue(new Error(errorMessage));

      const { result, dispatchSpy } = renderHelper({});
      await act(async () => {}); 

      expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: true });
      expect(resolveRouteSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "INIT" }),
        defaultOptions.schema,
        null,
        defaultOptions.dataContext,
        defaultOptions.goal,
        defaultOptions.openaiApiKey,
        defaultOptions.userContext
      );
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "ERROR", message: errorMessage });
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: false });
      expect(result.current.state.layout).toBeNull();
      expect(result.current.state.error).toBe(errorMessage);
    });
  });

  describe("handleEvent", () => {
    const testEvent: UIEvent = {
      type: "CLICK",
      nodeId: "button-1",
      timestamp: Date.now(),
      payload: { detail: "click-payload" },
    };
    const currentLayoutForEvent: UISpecNode = { id: "current-layout", node_type: "View" , props: null, bindings: null, events: null, children: []};

    // Test for PARTIAL_UPDATE path
    it("should call resolveRoute and dispatch PARTIAL_UPDATE for relevant actions", async () => {
      const partialUpdateNode: UISpecNode = { id: "updated-node-partial", node_type: "Input" , props: null, bindings: null, events: null, children: []};
      const partialUpdateRouteResult: RouteResolution = {
        actionType: ActionType.UPDATE_NODE,
        targetNodeId: "node-to-update",
        updatedNode: partialUpdateNode,
        updatedDataContext: { eventContextUpdate: true },
      };
      resolveRouteSpy.mockResolvedValue(partialUpdateRouteResult);

      const { result, dispatchSpy } = renderHelper({});
      act(() => {
        result.current.dispatch({ type: "AI_RESPONSE", node: currentLayoutForEvent });
      });
      dispatchSpy.mockClear();

      await act(async () => {
        result.current.handleEvent(testEvent, currentLayoutForEvent, defaultOptions.dataContext);
      });

      expect(resolveRouteSpy).toHaveBeenCalledWith(
        testEvent,
        defaultOptions.schema,
        currentLayoutForEvent,
        defaultOptions.dataContext,
        defaultOptions.goal,
        defaultOptions.openaiApiKey,
        defaultOptions.userContext
      );
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "UI_EVENT", event: testEvent });
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: true });
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: "SET_DATA_CONTEXT",
        payload: partialUpdateRouteResult.updatedDataContext,
      });
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: "PARTIAL_UPDATE",
        nodeId: partialUpdateRouteResult.targetNodeId,
        node: partialUpdateNode,
      });
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: false });
      expect(result.current.state.error).toBeNull();
    });

    // Test for AI_RESPONSE path (e.g., FULL_REFRESH)
    it("should call resolveRoute and dispatch AI_RESPONSE for FULL_REFRESH actions", async () => {
      const fullRefreshNode: UISpecNode = { id: "refreshed-node-full", node_type: "List" , props: null, bindings: null, events: null, children: []};
      const fullRefreshRouteResult: RouteResolution = {
        actionType: ActionType.FULL_REFRESH,
        targetNodeId: "root",
        updatedNode: fullRefreshNode,
        // No data context change in this specific mock response for simplicity
      };
      resolveRouteSpy.mockResolvedValue(fullRefreshRouteResult);

      const { result, dispatchSpy } = renderHelper({});
      act(() => {
        result.current.dispatch({ type: "AI_RESPONSE", node: currentLayoutForEvent });
      });
      dispatchSpy.mockClear();

      await act(async () => {
        result.current.handleEvent(testEvent, currentLayoutForEvent, defaultOptions.dataContext);
      });

      expect(resolveRouteSpy).toHaveBeenCalledWith(
        testEvent,
        defaultOptions.schema,
        currentLayoutForEvent,
        defaultOptions.dataContext,
        defaultOptions.goal,
        defaultOptions.openaiApiKey,
        defaultOptions.userContext
      );
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "UI_EVENT", event: testEvent });
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: true });
      // Check if SET_DATA_CONTEXT was called or not based on mock
      if (fullRefreshRouteResult.updatedDataContext) {
        expect(dispatchSpy).toHaveBeenCalledWith({
          type: "SET_DATA_CONTEXT",
          payload: fullRefreshRouteResult.updatedDataContext,
        });
      }
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: "AI_RESPONSE",
        node: fullRefreshNode,
      });
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: false });
      expect(result.current.state.error).toBeNull();
    });

    it("should handle error from resolveRoute during event processing", async () => {
      const errorMessage = "Event routing failed";
      // Mock resolveRoute to reject for the specific event call we are interested in.
      // The initial call from useEffect will use whatever the spy was configured with before this test,
      // or its default mock implementation if not specifically overridden for initial load.
      resolveRouteSpy.mockRejectedValueOnce(new Error(errorMessage)); // Apply rejection only for the next call

      const { result, dispatchSpy } = renderHelper({});
      // Allow initial load to complete. The initial resolveRoute call would have happened here.
      await act(async () => {}); 
      
      // Clear all mock call counts (including resolveRouteSpy) that happened during initial render/setup.
      vi.clearAllMocks(); 
      // Re-apply the rejection specifically for the upcoming handleEvent call.
      resolveRouteSpy.mockRejectedValueOnce(new Error(errorMessage));

      // Optional: If there was an initial layout set by the first (successful) resolveRoute call from initialFetch,
      // and we want to ensure handleEvent uses it, we could dispatch it here.
      // However, for testing an error from handleEvent's resolveRoute, the initial layout state might not be critical
      // unless the absence of it causes an earlier failure.
      // For now, let's assume the primary goal is to test the error path of handleEvent.

      await act(async () => {
        // Pass null for currentResolvedLayout if we don't want to depend on prior state for this error test.
        // Or pass currentLayoutForEvent if it's relevant.
        result.current.handleEvent(testEvent, null, defaultOptions.dataContext);
      });

      expect(resolveRouteSpy).toHaveBeenCalledTimes(1); // Should now only count the call from handleEvent
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "UI_EVENT", event: testEvent });
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: true });
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "ERROR", message: errorMessage });
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: false });
      expect(result.current.state.error).toBe(errorMessage);
    });
  });
});

// Replace all uses of mockCallPlannerLLM and mockMockPlanner with router.resolveRoute mocks
// For direct update:
/*
const directUpdateLayout: UISpecNode = {
  id: "direct-update-root",
  node_type: "Container",
  props: null,
  children: [],
  bindings: null,
  events: null,
};
const directUpdateRouteResult: RouteResolution = {
  actionType: ActionType.HIDE_DIALOG,
  targetNodeId: "dialog-1",
  plannerInput: { goal: "hide dialog", schema: {}, history: [] },
  directUpdateLayout,
};
*/
// For LLM update:
/*
const llmLayout: UISpecNode = {
  id: "llm-root",
  node_type: "Container",
  props: null,
  children: [],
  bindings: null,
  events: null,
};
const llmRouteResult: RouteResolution = {
  actionType: ActionType.FULL_REFRESH,
  targetNodeId: "root",
  plannerInput: { goal: "refresh", schema: {}, history: [] },
  // prompt: "LLM prompt", // This was the error - prompt is removed
  directUpdateLayout: null, // Or llmLayout if simulating a direct return from LLM via router
};
*/

// In tests, mock resolveRoute to return directUpdateRouteResult or llmRouteResult as needed
// Assert that state uses directUpdateLayout or the LLM-generated layout from the router
// Remove assertions that expect state to call the planner/LLM directly
