import { describe, it, expect } from "vitest";
import { uiReducer, initialState } from "./reducer";
import { UIState, UISpecNode, UIEvent } from "../schema/ui";

describe("uiReducer", () => {
  it("should return the initial state", () => {
    const state = uiReducer(initialState, {
      type: "LOADING",
      isLoading: false,
    });
    expect(state.loading).toBe(false);
    expect(state.history).toEqual([]);
  });

  it("should handle UI_EVENT action", () => {
    const event: UIEvent = {
      type: "CLICK",
      nodeId: "button1",
      timestamp: Date.now(),
      payload: null,
    };

    const state = uiReducer(initialState, { type: "UI_EVENT", event });

    expect(state.loading).toBe(true);
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toEqual(event);
    expect(state.error).toBeNull();
  });

  it("should handle AI_RESPONSE action", () => {
    const mockLayout: UISpecNode = {
      id: "root",
      node_type: "Container",
      props: {},
      bindings: null,
      events: null,
      children: [
        {
          id: "header",
          node_type: "Header",
          props: { title: "Test Header" },
          bindings: null,
          events: null,
          children: null,
        },
      ],
    };

    // Start with a state that has some history
    const initialStateWithHistory: UIState = {
      ...initialState,
      history: [{ type: "CLICK", nodeId: "button1", payload: null } as UIEvent],
      loading: true,
    };

    const state = uiReducer(initialStateWithHistory, {
      type: "AI_RESPONSE",
      node: mockLayout,
    });

    expect(state.loading).toBe(false);
    expect(state.layout).toEqual(mockLayout);
    // History should be preserved
    expect(state.history).toEqual(initialStateWithHistory.history);
    // Error should be cleared
    expect(state.error).toBeNull();
  });

  it("should handle ERROR action", () => {
    const errorMessage = "Something went wrong";
    const state = uiReducer(
      { ...initialState, loading: true },
      { type: "ERROR", message: errorMessage }
    );

    expect(state.loading).toBe(false);
    expect(state.error).toBe(errorMessage);
  });

  it("should handle LOADING action", () => {
    const state = uiReducer(
      { ...initialState, loading: false },
      { type: "LOADING", isLoading: true }
    );

    expect(state.loading).toBe(true);
  });

  it("should ignore duplicate INIT events", () => {
    const initEvent: UIEvent = {
      type: "INIT",
      nodeId: "system",
      timestamp: Date.now(),
      payload: null,
    };

    // Dispatch the first INIT event
    let state = uiReducer(initialState, { type: "UI_EVENT", event: initEvent });

    expect(state.loading).toBe(true);
    expect(state.history).toHaveLength(1);
    expect(state.history[0].type).toBe("INIT");

    // Attempt to dispatch a second INIT event
    const prevState = { ...state }; // Save previous state for comparison
    state = uiReducer(state, { type: "UI_EVENT", event: initEvent });

    // State should not have changed, and loading should not be re-triggered if it was already true
    // and history should not have the second INIT event
    expect(state.loading).toBe(prevState.loading); // loading state should remain as is from the first INIT
    expect(state.history).toHaveLength(1);
    expect(state.history[0].type).toBe("INIT"); // Still only one INIT event
    expect(state.error).toBeNull();
    expect(state).toEqual(prevState); // The entire state should be the same
  });
});
