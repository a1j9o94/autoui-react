import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePlanner } from "./usePlanner";
import { callPlannerLLM, processEvent } from "../core";
import { UIEvent } from "../schema/ui";

// Mock the core planner functions
vi.mock("../core", () => ({
  callPlannerLLM: vi.fn(),
  processEvent: vi.fn(),
  createDefaultRouter: vi.fn().mockReturnValue({
    /* mock router */
  }),
  ActionRouter: vi.fn(),
  ActionType: {
    FULL_REFRESH: "FULL_REFRESH",
    UPDATE_NODE: "UPDATE_NODE",
  },
}));

describe("usePlanner", () => {
  const mockOptions = {
    goal: "Create a todo app",
    schema: {
      todos: {
        id: "string",
        title: "string",
        completed: "boolean",
      },
    },
  };

  const mockLayout = {
    id: "root",
    type: "Container",
    children: [
      {
        id: "button",
        type: "Button",
        props: { text: "Add Todo" },
      },
    ],
  };

  const mockUpdatedLayout = {
    id: "root",
    type: "Container",
    children: [
      {
        id: "button",
        type: "Button",
        props: { text: "Add Todo" },
      },
      {
        id: "form",
        type: "Form",
        props: { title: "New Todo" },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock implementations
    (callPlannerLLM as any).mockResolvedValue(mockLayout);
    (processEvent as any).mockResolvedValue(mockUpdatedLayout);
  });

  it("should initialize with default values", () => {
    const { result } = renderHook(() => usePlanner(mockOptions));

    expect(result.current.layout).toBeUndefined();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should generate initial layout on generateInitialLayout call", async () => {
    const { result } = renderHook(() => usePlanner(mockOptions));

    // Before calling the function
    expect(result.current.layout).toBeUndefined();
    expect(result.current.loading).toBe(false);

    // Call the function
    await act(async () => {
      await result.current.generateInitialLayout();
    });

    // After successful call
    expect(callPlannerLLM).toHaveBeenCalledWith({
      schema: mockOptions.schema,
      goal: mockOptions.goal,
      userContext: null,
      history: null,
    });
    expect(result.current.layout).toEqual(mockLayout);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle errors during initial layout generation", async () => {
    const error = new Error("Generation failed");
    (callPlannerLLM as any).mockRejectedValueOnce(error);

    const { result } = renderHook(() => usePlanner(mockOptions));

    await act(async () => {
      await result.current.generateInitialLayout();
    });

    expect(result.current.layout).toBeUndefined();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toEqual(error);
  });

  it("should handle events and update the layout", async () => {
    const { result } = renderHook(() => usePlanner(mockOptions));

    // First generate initial layout
    await act(async () => {
      await result.current.generateInitialLayout();
    });

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

    expect(processEvent).toHaveBeenCalledWith(
      event,
      expect.anything(), // The router
      mockOptions.schema,
      mockLayout,
      expect.anything(), // The data context
      mockOptions.goal,
      undefined
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

    expect(processEvent).not.toHaveBeenCalled();
    expect(result.current.error).toEqual(
      new Error("Cannot handle event - no layout exists")
    );
  });

  it("should handle errors during event processing", async () => {
    const { result } = renderHook(() => usePlanner(mockOptions));

    // Generate initial layout
    await act(async () => {
      await result.current.generateInitialLayout();
    });

    // Setup error for event processing
    const error = new Error("Event processing failed");
    (processEvent as any).mockRejectedValueOnce(error);

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
    // Layout should remain unchanged when there's an error
    expect(result.current.layout).toEqual(mockLayout);
  });
});
