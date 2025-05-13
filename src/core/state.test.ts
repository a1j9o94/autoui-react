import { describe, it, expect, vi, beforeEach, Mock, MockedFunction } from "vitest";
import { act, renderHook } from "@testing-library/react";
import * as ReactSource from "react"; // Import original React for use in mock

import { useUIStateEngine, UseUIStateEngineOptions } from "./state";
import * as Planner from "./planner";
import * as SystemEvents from "./system-events";
import { ActionRouter, ActionType, RouteResolution } from "./action-router";
import {
  UIEvent,
  UISpecNode,
  PlannerInput,
  UIAction,
  UIState,
} from "../schema/ui";
import { SystemEventType, AnySystemEvent } from "./system-events";

// Hold the current dispatch spy for each test
let currentTestDispatchSpy: Mock<[UIAction], void> | null = null;

// No longer need mockResolveRouteFn here, will spy on prototype
// let mockResolveRouteFn: Mock<...>;

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
      const spiedDispatch = actualReact.useCallback((action: UIAction) => {
        if (currentTestDispatchSpy) {
          currentTestDispatchSpy(action);
        }
        return dispatch(action);
      }, [dispatch]); // currentTestDispatchSpy is external, dispatch is the key internal dependency

      return [state, spiedDispatch];
    },
  };
});

// Mock planner module with correct signature for callPlannerLLM
vi.mock("./planner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./planner")>();
  return {
    ...actual,
    // Provide a mock implementation matching the new signature
    callPlannerLLM: vi
      .fn()
      .mockImplementation(
        async (
          _input: PlannerInput,
          _apiKey?: string,
          _routeResolution?: RouteResolution
        ) => ({
          id: "mock-llm-response-root",
          node_type: "Container",
          props: null,
          children: [],
          bindings: null,
          events: null,
        })
      ),
    mockPlanner: vi
      .fn()
      .mockImplementation(
        (input: PlannerInput, targetNodeId?: string, _prompt?: string) => ({
          id: targetNodeId || input.goal || "mock-root", // Keep existing mockPlanner mock logic
          node_type: "Container",
          props: null,
          children: [],
          bindings: null,
          events: null,
        })
      ),
    buildPrompt: vi.fn(),
    processEvent: vi.fn(),
  };
});

// Mock the system events
let mockSystemEventsEmit: Mock<[AnySystemEvent], Promise<void>>;
let mockCreateSystemEvent: Mock<[SystemEventType, any], AnySystemEvent>;

const mockPlannerResultNode: UISpecNode = {
  id: "mock-root",
  node_type: "Container",
  props: null,
  children: [],
  bindings: null,
  events: null,
};

// Import the mocked functions for type safety
import { callPlannerLLM, mockPlanner } from "./planner";
const mockCallPlannerLLM = callPlannerLLM as MockedFunction<typeof callPlannerLLM>;
const mockMockPlanner = mockPlanner as MockedFunction<typeof mockPlanner>;

describe("useUIStateEngine", () => {
  const defaultOptions: UseUIStateEngineOptions = {
    schema: { users: { id: "string", name: "string" } },
    goal: "Manage users",
    userContext: undefined,
  };

  // Helper to render the hook and get the current dispatch spy
  const renderHelper = (options: Partial<UseUIStateEngineOptions> = {}) => {
    currentTestDispatchSpy = vi.fn() as Mock<[UIAction], void>;
    const hookResult = renderHook(() =>
      useUIStateEngine({ ...defaultOptions, ...options })
    );
    return { ...hookResult, dispatchSpy: currentTestDispatchSpy! };
  };

  let resolveRouteSpy: MockedFunction<typeof ActionRouter.prototype.resolveRoute>;

  beforeEach(() => {
    vi.clearAllMocks();
    currentTestDispatchSpy = null;
    mockSystemEventsEmit = vi.spyOn(SystemEvents.systemEvents, "emit").mockResolvedValue(undefined) as Mock<[AnySystemEvent], Promise<void>>;
    mockCreateSystemEvent = vi.spyOn(SystemEvents, "createSystemEvent").mockImplementation(
        (type: SystemEventType, payload: any) => ({ type, payload, timestamp: Date.now() } as any)
      ) as Mock<[SystemEventType, any], AnySystemEvent>;
    
    resolveRouteSpy = vi.spyOn(ActionRouter.prototype, 'resolveRoute') as unknown as MockedFunction<typeof ActionRouter.prototype.resolveRoute>;
  });

  describe("Initial Load", () => {
    it("should initialize with mock data if mockMode is true", async () => {
      const { result, dispatchSpy } = renderHelper({ mockMode: true });
      await act(async () => {}); // Flush effects
      expect(mockMockPlanner).toHaveBeenCalled();
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: true });
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "AI_RESPONSE", node: expect.objectContaining({ id: defaultOptions.goal }) });
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: false });
      expect(result.current.state.layout?.id).toBe(defaultOptions.goal);
      expect(result.current.state.loading).toBe(false);
    });

    it("should call callPlannerLLM and update state on successful initial load if mockMode is false", async () => {
      const specificNode = { ...mockPlannerResultNode, id: "llm-initial-success" };
      mockCallPlannerLLM.mockResolvedValue(specificNode);

      const initialRouteResolution: RouteResolution = {
        actionType: ActionType.FULL_REFRESH, targetNodeId: "root",
        plannerInput: { goal: defaultOptions.goal, schema: defaultOptions.schema, history: [expect.objectContaining({ type: "INIT" })], userContext: defaultOptions.userContext },
        prompt: "Mocked initial prompt for INIT event",
      };
      
      resolveRouteSpy.mockImplementation(((event: UIEvent, _schema, _layout, _dataContext, _goal, _userContext): RouteResolution => {
        if (event.type === "INIT") {
          return { 
            ...initialRouteResolution, 
            plannerInput: { 
              ...initialRouteResolution.plannerInput, 
              history: [event] // Use the actual event in history
            } 
          };
        }
        // Fallback for this specific test - should ideally not be hit if only INIT occurs.
        return { 
            actionType: ActionType.FULL_REFRESH, targetNodeId: "root", 
            plannerInput: {goal: "fallback-SHOULD-NOT-HIT", schema: {}, history: [event]}, 
            prompt: "Fallback prompt - SHOULD NOT HIT IN THIS TEST"
        };
      }) as any); // Cast to any to satisfy complex mock signature if needed, though parameters are listed

      const { result, dispatchSpy } = renderHelper({ mockMode: false });
      await act(async () => { await Promise.resolve(); }); 
      
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: true });
      expect(resolveRouteSpy).toHaveBeenCalledWith(
        expect.objectContaining({type: "INIT"}), 
        defaultOptions.schema, 
        null, 
        {}, 
        defaultOptions.goal, 
        defaultOptions.userContext
      );
      expect(mockCallPlannerLLM).toHaveBeenCalledWith(
        expect.objectContaining(initialRouteResolution.plannerInput),
        defaultOptions.openaiApiKey || "", 
        expect.objectContaining(initialRouteResolution) 
      );
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "AI_RESPONSE", node: specificNode });
      expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: false });
      expect(result.current.state.layout).toEqual(specificNode);
      expect(result.current.state.error).toBeNull();
    });

    it("should call callPlannerLLM and update state with error on failed initial load if mockMode is false", async () => {
      const errorMessage = "Initial LLM call failed";
      mockCallPlannerLLM.mockRejectedValue(new Error(errorMessage));

      const initialErrorRouteResolution: RouteResolution = {
        actionType: ActionType.FULL_REFRESH,
        targetNodeId: "root",
        plannerInput: { goal: defaultOptions.goal, schema: defaultOptions.schema, history: [expect.objectContaining({type: "INIT"})], userContext: defaultOptions.userContext },
        prompt: "Mocked initial prompt for INIT error case",
      };

      resolveRouteSpy.mockImplementation(((event: UIEvent, _schema, _layout, _dataContext, _goal, _userContext): RouteResolution => {
        if (event.type === "INIT") {
          return { 
            ...initialErrorRouteResolution, 
            plannerInput: { 
              ...initialErrorRouteResolution.plannerInput, 
              history: [event] 
            } 
          };
        }
        return { 
            actionType: ActionType.FULL_REFRESH, targetNodeId: "root", 
            plannerInput: {goal: "fallback-SHOULD-NOT-HIT-ERROR-CASE", schema: {}, history: [event]}, 
            prompt: "Fallback prompt - SHOULD NOT HIT IN THIS ERROR TEST"
        };
      })as any);

      const { result, dispatchSpy } = renderHelper({ mockMode: false });
      await act(async () => { await Promise.resolve(); });

      expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: true });
      expect(resolveRouteSpy).toHaveBeenCalledWith(expect.objectContaining({type: "INIT"}), defaultOptions.schema, null, {}, defaultOptions.goal, defaultOptions.userContext);
      expect(mockCallPlannerLLM).toHaveBeenCalledWith(
        expect.objectContaining(initialErrorRouteResolution.plannerInput),
        defaultOptions.openaiApiKey || "",
        expect.objectContaining(initialErrorRouteResolution)
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
    const partialUpdateRouteResult: RouteResolution = {
      actionType: ActionType.UPDATE_NODE,
      targetNodeId: "node-to-update",
      plannerInput: { goal: "partial goal", schema: {}, history: [testEvent] },
      prompt: "partial update prompt",
    };
    const fullRefreshRouteResult: RouteResolution = {
      actionType: ActionType.FULL_REFRESH,
      targetNodeId: "root",
      plannerInput: {
        goal: defaultOptions.goal,
        schema: defaultOptions.schema,
        history: [testEvent],
      },
      prompt: "full refresh prompt for event",
    };

    describe("mockMode: true", () => {
      it("should process event with full refresh if routing is disabled", async () => {
        const { result, dispatchSpy } = renderHelper({
          mockMode: true,
          enablePartialUpdates: false,
        });
        await act(async () => {}); // Initial load
        dispatchSpy.mockClear();

        await act(async () => {
          result.current.handleEvent(testEvent);
        });

        expect(mockMockPlanner).toHaveBeenCalledWith(
          expect.objectContaining({
            goal: defaultOptions.goal,
            history: expect.arrayContaining([testEvent]),
          })
        );
      });

      it("should use routing and dispatch PARTIAL_UPDATE if partial updates enabled", async () => {
        resolveRouteSpy.mockReturnValue(partialUpdateRouteResult);
        const { result, dispatchSpy } = renderHelper({
          mockMode: true,
          enablePartialUpdates: true,
        });
        await act(async () => {});
        dispatchSpy.mockClear();

        await act(async () => {
          result.current.handleEvent(testEvent);
        });

        expect(resolveRouteSpy).toHaveBeenCalled();
        expect(mockMockPlanner).toHaveBeenCalledWith(
          partialUpdateRouteResult.plannerInput,
          partialUpdateRouteResult.targetNodeId,
          partialUpdateRouteResult.prompt
        );
      });
    });

    describe("mockMode: false", () => {
      it("should call callPlannerLLM for full refresh and update state on success", async () => {
        resolveRouteSpy.mockReturnValue(fullRefreshRouteResult);
        const successNode = {
          ...mockPlannerResultNode,
          id: "llm-event-success",
        };
        mockCallPlannerLLM.mockResolvedValue(successNode);
        const { result, dispatchSpy } = renderHelper({
          mockMode: false,
          enablePartialUpdates: false,
        });
        await act(async () => {});
        dispatchSpy.mockClear();

        await act(async () => {
          result.current.handleEvent(testEvent);
        });

        expect(resolveRouteSpy).toHaveBeenCalled();
        expect(dispatchSpy).toHaveBeenCalledWith({ type: "UI_EVENT", event: testEvent });
        expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: true });
        expect(mockCallPlannerLLM).toHaveBeenCalledWith(
          expect.objectContaining(fullRefreshRouteResult.plannerInput),
          defaultOptions.openaiApiKey || "",
          expect.objectContaining(fullRefreshRouteResult) // Pass the whole route result
        );
        expect(dispatchSpy).toHaveBeenCalledWith({ type: "AI_RESPONSE", node: successNode });
        expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOADING", isLoading: false });
        expect(result.current.state.error).toBeNull();
      });

      it("should use routing, call callPlannerLLM for partial update and update state on success", async () => {
        resolveRouteSpy.mockReturnValue(partialUpdateRouteResult);
        const successNode = {
          ...mockPlannerResultNode,
          id: partialUpdateRouteResult.targetNodeId,
        };
        mockCallPlannerLLM.mockResolvedValue(successNode);
        const { result, dispatchSpy } = renderHelper({
          mockMode: false,
          enablePartialUpdates: true,
        });
        await act(async () => {});
        dispatchSpy.mockClear();

        await act(async () => {
          result.current.handleEvent(testEvent);
        });

        expect(resolveRouteSpy).toHaveBeenCalled();
        expect(mockCallPlannerLLM).toHaveBeenCalledWith(
          partialUpdateRouteResult.plannerInput,
          defaultOptions.openaiApiKey || "",
          partialUpdateRouteResult
        );
        expect(dispatchSpy).toHaveBeenCalledWith({ type: "PARTIAL_UPDATE", nodeId: partialUpdateRouteResult.targetNodeId, node: successNode });
        expect(result.current.state.error).toBeNull();
      });

      it("should use routing, call callPlannerLLM for partial update and update state on error", async () => {
        resolveRouteSpy.mockReturnValue(partialUpdateRouteResult);
        const errorMessage = "LLM partial update error";
        mockCallPlannerLLM.mockRejectedValue(new Error(errorMessage));
        const { result, dispatchSpy } = renderHelper({
          mockMode: false,
          enablePartialUpdates: true,
        });
        await act(async () => {});
        dispatchSpy.mockClear();

        await act(async () => {
          result.current.handleEvent(testEvent);
        });

        expect(mockCallPlannerLLM).toHaveBeenCalledWith(
          partialUpdateRouteResult.plannerInput,
          defaultOptions.openaiApiKey || "",
          partialUpdateRouteResult
        );
        expect(dispatchSpy).toHaveBeenCalledWith({ type: "ERROR", message: errorMessage });
        expect(result.current.state.error).toBe(errorMessage);
      });
    });
  });
});
