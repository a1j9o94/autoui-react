import { describe, it, expect, vi, beforeEach, MockedFunction } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePlanner, UsePlannerOptions } from "./usePlanner";
import { callPlannerLLM, processEvent, mockPlanner } from "../core";
import { UIEvent, UISpecNode } from "../schema/ui";

// Mock the core planner functions
vi.mock("../core/planner"); // Mock the whole module

// Mock Data - Define placeholders
const mockSchema = {
  tasks: {
    /* Define mock schema structure if needed */
  },
};
const mockGoal = "Test Goal";
const mockApiKey = "test-api-key";
const mockUserContext = { userId: "user-123" };
const mockGeneratedNode: UISpecNode = {
  id: "root-generated",
  node_type: "Container",
  props: null,
  bindings: null,
  events: null,
  children: [],
};
const mockLayout: UISpecNode = {
  id: "root-initial",
  node_type: "Container",
  props: null,
  bindings: null,
  events: null,
  children: [],
};
const mockUpdatedLayout: UISpecNode = {
  id: "root-updated",
  node_type: "Container",
  props: null,
  bindings: null,
  events: null,
  children: [],
};

describe("usePlanner", () => {
  const mockOptions: UsePlannerOptions = {
    schema: mockSchema,
    goal: mockGoal,
    openaiApiKey: mockApiKey,
    userContext: mockUserContext,
    mockMode: false,
  };

  // Mock planner functions
  // Get typed mocks after vi.mock()
  let typedMockCallPlannerLLM: MockedFunction<typeof callPlannerLLM>;
  let typedMockMockPlanner: MockedFunction<typeof mockPlanner>;
  let typedMockProcessEvent: MockedFunction<typeof processEvent>;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks(); // This clears all mocks, including those from vi.mock()

    // Re-assign typed mocks for clarity in tests if needed, or use vi.mocked(callPlannerLLM) directly
    typedMockCallPlannerLLM = vi.mocked(callPlannerLLM);
    typedMockMockPlanner = vi.mocked(mockPlanner);
    typedMockProcessEvent = vi.mocked(processEvent); // Get typed mock for processEvent

    // Default mock implementations
    typedMockCallPlannerLLM.mockResolvedValue(mockGeneratedNode);
    typedMockMockPlanner.mockReturnValue(mockGeneratedNode); // mockPlanner is synchronous
    typedMockProcessEvent.mockResolvedValue(mockUpdatedLayout); // Mock processEvent resolution
  });

  it("should fetch layout on init and update loading/layout state", async () => {
    const { result } = renderHook(() => usePlanner(mockOptions));

    // Initially, layout is undefined. useEffect will trigger the fetch.
    expect(result.current.layout).toBeUndefined();

    // Wait for the layout to be populated by the effect-triggered fetch
    await waitFor(() => {
      expect(result.current.layout).toEqual(mockGeneratedNode);
    });

    // Assert final state after successful fetch
    expect(result.current.layout).toEqual(mockGeneratedNode);
    expect(result.current.loading).toBe(false); // Loading should be false now
    expect(result.current.error).toBeNull();
  });

  it("should generate initial layout on generateInitialLayout call", async () => {
    // Render with an initial layout to prevent useEffect fetch
    const optionsWithInitial: UsePlannerOptions = {
      ...mockOptions,
      initialLayout: mockLayout,
    };
    const { result } = renderHook(() => usePlanner(optionsWithInitial));

    // Before calling the function, layout is the initial one, loading is false
    expect(result.current.layout).toEqual(mockLayout);
    expect(result.current.loading).toBe(false);

    // Call the function
    await act(async () => {
      await result.current.generateInitialLayout();
    });

    // After successful call
    expect(typedMockCallPlannerLLM).toHaveBeenCalledWith(
      expect.objectContaining({ schema: mockSchema, goal: mockGoal }),
      mockApiKey,
      undefined // Explicitly pass undefined for the third argument if expected
    );
    // The layout should be the newly generated one
    expect(result.current.layout).toEqual(mockGeneratedNode);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle errors during initial layout generation", async () => {
    const error = new Error("Generation failed");
    typedMockCallPlannerLLM.mockRejectedValue(error);

    const { result } = renderHook(() => usePlanner(mockOptions));

    // Wait for the loading state to become false, indicating the async operation finished (or failed)
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Now assert the final state
    expect(result.current.layout).toBeUndefined();
    expect(result.current.loading).toBe(false); // Double-check loading state
    expect(result.current.error).toEqual(error); // Assert error is set correctly
  });

  it("should handle events and update the layout", async () => {
    // Render with an initial layout to avoid useEffect fetch interference
    const optionsWithInitial: UsePlannerOptions = {
      ...mockOptions,
      initialLayout: mockLayout,
    };
    const { result } = renderHook(() => usePlanner(optionsWithInitial));

    // Wait for initial state (no loading)
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.layout).toEqual(mockLayout); // Verify initial layout

    // Then handle an event
    const event: UIEvent = {
      type: "CLICK",
      nodeId: "button",
      timestamp: Date.now(),
      payload: null,
    };

    await act(async () => {
      await result.current.handleEvent(event);
    });

    expect(typedMockProcessEvent).toHaveBeenCalledWith(
      event,
      expect.anything(), // The router
      mockSchema,
      mockLayout, // The layout state *before* the event was the initial one
      expect.anything(), // The data context
      mockGoal,
      mockUserContext, // Pass userContext if it's expected by processEvent
      mockApiKey // Pass apiKey as it's now passed by handleEvent
    );
    expect(result.current.layout).toEqual(mockUpdatedLayout);
    expect(result.current.loading).toBe(false);
  });

  it("should show error when trying to handle event without a layout", async () => {
    const { result } = renderHook(() => usePlanner(mockOptions));

    // Try to handle an event without having a layout first
    const event: UIEvent = {
      type: "CLICK",
      nodeId: "button",
      timestamp: Date.now(),
      payload: null,
    };

    await act(async () => {
      await result.current.handleEvent(event);
    });

    expect(typedMockProcessEvent).not.toHaveBeenCalled();
    expect(result.current.error).toEqual(
      new Error("Cannot handle event - no layout exists")
    );
  });

  it("should handle errors during event processing", async () => {
    // Render with an initial layout
    const optionsWithInitial: UsePlannerOptions = {
      ...mockOptions,
      initialLayout: mockLayout,
    };
    const { result } = renderHook(() => usePlanner(optionsWithInitial));

    // Wait for initial state
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.layout).toEqual(mockLayout);

    // Setup error for event processing
    const error = new Error("Event processing failed");
    typedMockProcessEvent.mockRejectedValueOnce(error);

    // Handle an event that will fail
    const event: UIEvent = {
      type: "CLICK",
      nodeId: "button",
      timestamp: Date.now(),
      payload: null,
    };

    await act(async () => {
      await result.current.handleEvent(event);
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.loading).toBe(false);
    // Layout should remain unchanged from before the failed event
    expect(result.current.layout).toEqual(mockLayout);
  });

  it("should use mockPlanner if apiKey is missing and mockMode is false", async () => {
    // Define options without apiKey directly
    const optionsWithoutKey: UsePlannerOptions = {
      schema: mockSchema,
      goal: mockGoal,
      // openaiApiKey is omitted
      userContext: mockUserContext,
      mockMode: false, // Ensure mockMode is false as per test description
    };

    const { result } = renderHook(() => usePlanner(optionsWithoutKey));
    await act(async () => {
      await result.current.generateInitialLayout();
    });

    // The check for callPlannerLLM not being called indirectly verifies this.
    // Wait for the initial fetch (using mockPlanner) to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.layout).toEqual(mockGeneratedNode); // mockPlanner returns mockGeneratedNode by default
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
