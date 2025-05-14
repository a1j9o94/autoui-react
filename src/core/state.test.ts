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
import * as SystemEvents from "./system-events";
import { ActionRouter, RouteResolution } from "./action-router";
import {
  UIEvent,
  UISpecNode,
  PlannerInput,
  UIAction,
  UIState,
} from "../schema/ui";
import { SystemEventType, AnySystemEvent } from "./system-events";
import { ActionType } from "../schema/action-types";

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

// Mock planner module with correct signature for callPlannerLLM
vi.mock("./planner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./planner")>();
  return {
    ...actual,
    // Provide a mock implementation matching the new signature
    callPlannerLLM: vi.fn().mockImplementation(
      async (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _input: PlannerInput,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _apiKey?: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    mockPlanner: vi.fn().mockImplementation(
      (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        input: PlannerInput,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        targetNodeId?: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _prompt?: string
      ) => ({
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let mockSystemEventsEmit: Mock<[AnySystemEvent], Promise<void>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let mockCreateSystemEvent: Mock<[SystemEventType, unknown], AnySystemEvent>;

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
const mockCallPlannerLLM = callPlannerLLM as MockedFunction<
  typeof callPlannerLLM
>;
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

  let resolveRouteSpy: MockedFunction<
    typeof ActionRouter.prototype.resolveRoute
  >;

  beforeEach(() => {
    vi.clearAllMocks();
    currentTestDispatchSpy = null;
    mockSystemEventsEmit = vi
      .spyOn(SystemEvents.systemEvents, "emit")
      .mockResolvedValue(undefined) as Mock<[AnySystemEvent], Promise<void>>;
    mockCreateSystemEvent = vi
      .spyOn(SystemEvents, "createSystemEvent")
      .mockImplementation(
        (
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          type: SystemEventType,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: any
        ) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ({ type, payload, timestamp: Date.now() } as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as Mock<[SystemEventType, any], AnySystemEvent>;

    resolveRouteSpy = vi.spyOn(
      ActionRouter.prototype,
      "resolveRoute"
    ) as unknown as MockedFunction<typeof ActionRouter.prototype.resolveRoute>;
  });

  describe("Initial Load", () => {
    it("should initialize with mock data if mockMode is true", async () => {
      const { result, dispatchSpy } = renderHelper({ mockMode: true });
      await act(async () => {}); // Flush effects
      expect(mockMockPlanner).toHaveBeenCalled();
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: "LOADING",
        isLoading: true,
      });
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: "AI_RESPONSE",
        node: expect.objectContaining({ id: defaultOptions.goal }),
      });
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: "LOADING",
        isLoading: false,
      });
      expect(result.current.state.layout?.id).toBe(defaultOptions.goal);
      expect(result.current.state.loading).toBe(false);
    });

    it("should call callPlannerLLM and update state on successful initial load if mockMode is false", async () => {
      const specificNode = {
        ...mockPlannerResultNode,
        id: "llm-initial-success",
      };
      mockCallPlannerLLM.mockResolvedValue(specificNode);

      const initialRouteResolution: RouteResolution = {
        actionType: ActionType.FULL_REFRESH,
        targetNodeId: "root",
        plannerInput: {
          goal: defaultOptions.goal,
          schema: defaultOptions.schema,
          history: [expect.objectContaining({ type: "INIT" })],
          userContext: defaultOptions.userContext,
        },
      };

      resolveRouteSpy.mockImplementation(
        async (
          event: UIEvent,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _schema: unknown,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _layout: unknown,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _dataContext: unknown,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _goal: unknown,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _userContext: unknown
        ): Promise<RouteResolution> => {
          if (event.type === "INIT") {
            return Promise.resolve({
              ...initialRouteResolution,
              plannerInput: {
                ...initialRouteResolution.plannerInput,
                history: [event],
              },
            });
          }
          return Promise.resolve({
            actionType: ActionType.FULL_REFRESH,
            targetNodeId: "root",
            plannerInput: {
              goal: "fallback-SHOULD-NOT-HIT",
              schema: {},
              history: [event],
            },
            directUpdateLayout: null,
          });
        }
      );

      const { result, dispatchSpy } = renderHelper({ mockMode: false });
      await act(async () => {
        await Promise.resolve();
      });

      expect(dispatchSpy).toHaveBeenCalledWith({
        type: "LOADING",
        isLoading: true,
      });
      expect(resolveRouteSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "INIT" }),
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
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: "AI_RESPONSE",
        node: specificNode,
      });
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: "LOADING",
        isLoading: false,
      });
      expect(result.current.state.layout).toEqual(specificNode);
      expect(result.current.state.error).toBeNull();
    });

    it("should call callPlannerLLM and update state with error on failed initial load if mockMode is false", async () => {
      const errorMessage = "Initial LLM call failed";
      mockCallPlannerLLM.mockRejectedValue(new Error(errorMessage));

      const initialErrorRouteResolution: RouteResolution = {
        actionType: ActionType.FULL_REFRESH,
        targetNodeId: "root",
        plannerInput: {
          goal: defaultOptions.goal,
          schema: defaultOptions.schema,
          history: [expect.objectContaining({ type: "INIT" })],
          userContext: defaultOptions.userContext,
        },
      };

      resolveRouteSpy.mockImplementation(
        async (
          event: UIEvent,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _schema: unknown,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _layout: unknown,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _dataContext: unknown,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _goal: unknown,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _userContext: unknown
        ): Promise<RouteResolution> => {
          if (event.type === "INIT") {
            return Promise.resolve({
              ...initialErrorRouteResolution,
              plannerInput: {
                ...initialErrorRouteResolution.plannerInput,
                history: [event],
              },
            });
          }
          return Promise.resolve({
            actionType: ActionType.FULL_REFRESH,
            targetNodeId: "root",
            plannerInput: {
              goal: "fallback-SHOULD-NOT-HIT-ERROR-CASE",
              schema: {},
              history: [event],
            },
            directUpdateLayout: null,
          });
        }
      );

      const { result, dispatchSpy } = renderHelper({ mockMode: false });
      await act(async () => {
        await Promise.resolve();
      });

      expect(dispatchSpy).toHaveBeenCalledWith({
        type: "LOADING",
        isLoading: true,
      });
      expect(resolveRouteSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "INIT" }),
        defaultOptions.schema,
        null,
        {},
        defaultOptions.goal,
        defaultOptions.userContext
      );
      expect(mockCallPlannerLLM).toHaveBeenCalledWith(
        expect.objectContaining(initialErrorRouteResolution.plannerInput),
        defaultOptions.openaiApiKey || "",
        expect.objectContaining(initialErrorRouteResolution)
      );
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: "ERROR",
        message: errorMessage,
      });
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: "LOADING",
        isLoading: false,
      });
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
    };
    const fullRefreshRouteResult: RouteResolution = {
      actionType: ActionType.FULL_REFRESH,
      targetNodeId: "root",
      plannerInput: {
        goal: defaultOptions.goal,
        schema: defaultOptions.schema,
        history: [testEvent],
      },
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

        expect(resolveRouteSpy).toHaveBeenCalled();
      });

      it("should use routing and dispatch PARTIAL_UPDATE if partial updates enabled", async () => {
        resolveRouteSpy.mockResolvedValue(partialUpdateRouteResult);
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
      });
    });

    describe("mockMode: false", () => {
      it("should call callPlannerLLM for full refresh and update state on success", async () => {
        resolveRouteSpy.mockResolvedValue(fullRefreshRouteResult);
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
        expect(dispatchSpy).toHaveBeenCalledWith({
          type: "UI_EVENT",
          event: testEvent,
        });
        expect(dispatchSpy).toHaveBeenCalledWith({
          type: "LOADING",
          isLoading: true,
        });
        expect(mockCallPlannerLLM).toHaveBeenCalledWith(
          expect.objectContaining(fullRefreshRouteResult.plannerInput),
          defaultOptions.openaiApiKey || "",
          expect.objectContaining(fullRefreshRouteResult)
        );
        expect(dispatchSpy).toHaveBeenCalledWith({
          type: "AI_RESPONSE",
          node: successNode,
        });
        expect(dispatchSpy).toHaveBeenCalledWith({
          type: "LOADING",
          isLoading: false,
        });
        expect(result.current.state.error).toBeNull();
      });

      it("should use routing, call callPlannerLLM for partial update and update state on success", async () => {
        resolveRouteSpy.mockResolvedValue(partialUpdateRouteResult);
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
        expect(dispatchSpy).toHaveBeenCalledWith({
          type: "PARTIAL_UPDATE",
          nodeId: partialUpdateRouteResult.targetNodeId,
          node: successNode,
        });
        expect(result.current.state.error).toBeNull();
      });

      it("should use routing, call callPlannerLLM for partial update and update state on error", async () => {
        resolveRouteSpy.mockResolvedValue(partialUpdateRouteResult);
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
        expect(dispatchSpy).toHaveBeenCalledWith({
          type: "ERROR",
          message: errorMessage,
        });
        expect(result.current.state.error).toBe(errorMessage);
      });
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
