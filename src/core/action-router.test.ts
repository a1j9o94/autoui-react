/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ActionRouter, ActionType } from "./action-router"; // Removed RouteResolution
import { UIEvent, UISpecNode } from "../schema/ui"; // Removed PlannerInput
import { findNodeById } from "./reducer"; // Assuming findNodeById is still used or will be by the new router logic
// Removed buildPrompt as it's not directly used in this initial test, can be re-added if needed.

// Mock findNodeById if it's a dependency of ActionRouter
vi.mock("./reducer", () => ({
  findNodeById: vi.fn(),
}));

describe("ActionRouter (Deterministic)", () => {
  let router: ActionRouter;
  let mockSchema: Record<string, unknown>;
  let mockLayout: UISpecNode | null;
  let mockDataContext: Record<string, unknown>;
  let mockGoal: string;
  let mockUserContext: Record<string, unknown>;
  let mockFindNodeById: vi.MockedFunction<typeof findNodeById>; // More specific Vitest mock type

  beforeEach(() => {
    router = new ActionRouter();
    mockSchema = { tasks: { type: "object" } };
    mockLayout = {
      id: "root",
      node_type: "Container",
      props: null,
      bindings: null,
      events: null,
      children: null,
    };
    mockDataContext = { user: { id: "user-1" } };
    mockGoal = "Achieve test goal";
    mockUserContext = { sessionToken: "abc" };

    // Setup mocks
    mockFindNodeById = findNodeById as vi.MockedFunction<typeof findNodeById>;
    mockFindNodeById.mockImplementation((layoutNode: UISpecNode | null, id: string): UISpecNode | undefined => {
      if (id === "root" && layoutNode?.id === "root") return mockLayout as UISpecNode;
      return undefined; // Default to not finding other nodes
    });
  });

  describe("resolveRoute", () => {
    it("should handle INIT event with FULL_REFRESH", () => {
      const initEvent: UIEvent = {
        type: "INIT",
        nodeId: "system", // sourceNode will be undefined
        timestamp: Date.now(),
        payload: null, 
      };
      // findNodeById for "system" returns undefined (by default beforeEach mock or specific below)
      // findNodeById for "root" (target) returns mockLayout
      mockFindNodeById.mockImplementation((layoutNode: UISpecNode | null, id: string): UISpecNode | undefined => {
        if (id === "system") return undefined;
        if (id === "root" && layoutNode === mockLayout) return mockLayout as UISpecNode;
        return undefined;
      });

      const resolution = router.resolveRoute(initEvent, mockSchema, mockLayout, mockDataContext, mockGoal, mockUserContext);
      expect(resolution).toBeDefined();
      if (resolution) {
        expect(resolution.actionType).toBe(ActionType.FULL_REFRESH);
        expect(resolution.targetNodeId).toBe("root");
        expect(resolution.plannerInput.userContext).toEqual(expect.objectContaining({ 
          ...mockUserContext,
          targetNode: mockLayout, 
          eventPayload: null 
        }));
        expect(resolution.prompt).toContain(ActionType.FULL_REFRESH.toString());
      }
    });

    it("should handle generic CLICK event with FULL_REFRESH if no node config", () => {
      const clickEvent: UIEvent = {
        type: "CLICK",
        nodeId: "some-button-id", // sourceNode will be undefined
        timestamp: Date.now(),
        payload: { x: 10, y: 20 },
      };
      // findNodeById for "some-button-id" returns undefined
      // findNodeById for "root" (target) returns mockLayout
      mockFindNodeById.mockImplementation((layoutNode: UISpecNode | null, id: string): UISpecNode | undefined => {
        if (id === "some-button-id") return undefined;
        if (id === "root" && layoutNode === mockLayout) return mockLayout as UISpecNode;
          return undefined;
      });

      const resolution = router.resolveRoute(clickEvent, mockSchema, mockLayout, mockDataContext, mockGoal, mockUserContext);
      expect(resolution).toBeDefined();
      if (resolution) {
        expect(resolution.actionType).toBe(ActionType.FULL_REFRESH);
        expect(resolution.targetNodeId).toBe("root");
        expect(resolution.plannerInput.userContext).toEqual(expect.objectContaining({
          ...mockUserContext,
          targetNode: mockLayout, 
          eventPayload: clickEvent.payload 
        }));
        expect(resolution.prompt).toContain(ActionType.FULL_REFRESH.toString());
      }
    });

    it("should default to FULL_REFRESH for CLICK on Button with no specific event config", () => {
      const buttonNode: UISpecNode = { id: "actual-button-id", node_type: "Button", props: { label: "Test Button" }, events: null, children: null, bindings: null };
      // findNodeById for "actual-button-id" (source) returns buttonNode
      // findNodeById for "root" (target, as per logic for unconf. button) returns mockLayout
      mockFindNodeById.mockImplementation((layoutNode: UISpecNode | null, id: string): UISpecNode | undefined => {
        if (id === "actual-button-id") return buttonNode;
        if (id === "root" && layoutNode === mockLayout) return mockLayout as UISpecNode;
        return undefined;
      });

      const clickEvent: UIEvent = { type: "CLICK", nodeId: "actual-button-id", timestamp: Date.now(), payload: null };
      const resolution = router.resolveRoute(clickEvent, mockSchema, mockLayout, mockDataContext, mockGoal, mockUserContext);
      expect(resolution).toBeDefined();
      if (resolution) {
        expect(resolution.actionType).toBe(ActionType.FULL_REFRESH);
        expect(resolution.targetNodeId).toBe("root"); 
        expect(resolution.plannerInput.userContext).toEqual(expect.objectContaining({
          ...mockUserContext,
          sourceNode: buttonNode,
          targetNode: mockLayout, 
          eventPayload: null 
        }));
        expect(resolution.prompt).toContain(ActionType.FULL_REFRESH.toString());
      }
    });

    it("should use node-specific config for CLICK event", () => {
      const nodeWithEventConfig: UISpecNode = {
        id: "button-with-event", node_type: "Button", props: { label: "Action Button" }, bindings: null, children: null,
        events: { CLICK: { action: ActionType.SHOW_DETAIL, target: "detail-section-abc", payload: { mode: "edit" } } },
      };
      mockFindNodeById.mockImplementation((layoutNode: UISpecNode | null, id: string): UISpecNode | undefined => {
        if (id === "button-with-event") return nodeWithEventConfig; 
        if (id === "detail-section-abc") return undefined; 
        return undefined;
      });

      const clickEvent: UIEvent = { type: "CLICK", nodeId: "button-with-event", timestamp: Date.now(), payload: { clickX: 100, clickY: 50 } };
      const resolution = router.resolveRoute(clickEvent, mockSchema, mockLayout, mockDataContext, mockGoal, mockUserContext);
      expect(resolution).toBeDefined();
      if (resolution) {
        expect(resolution.actionType).toBe(ActionType.SHOW_DETAIL);
        expect(resolution.targetNodeId).toBe("detail-section-abc");
        expect(resolution.plannerInput.userContext).toEqual(expect.objectContaining({
          ...mockUserContext,
          sourceNode: nodeWithEventConfig,
          eventPayload: { clickX: 100, clickY: 50, mode: "edit" },
        }));
        expect(resolution.prompt).toContain(ActionType.SHOW_DETAIL.toString());
      }
    });

    it("should default to UPDATE_DATA for CHANGE on Input with no specific event config", () => {
      const inputNode: UISpecNode = { id: "input-field-id", node_type: "Input", props: { type: "text" }, bindings: { value: "initialValue" }, events: null, children: null };
      // findNodeById for "input-field-id" (source AND target) returns inputNode
      mockFindNodeById.mockImplementation((layoutNode: UISpecNode | null, id: string): UISpecNode | undefined => {
        if (id === "input-field-id") return inputNode;
        return undefined;
      });

      const changeEvent: UIEvent = { type: "CHANGE", nodeId: "input-field-id", timestamp: Date.now(), payload: { value: "newValue" } };
      const resolution = router.resolveRoute(changeEvent, mockSchema, mockLayout, mockDataContext, mockGoal, mockUserContext);
      expect(resolution).toBeDefined();
      if (resolution) {
        expect(resolution.actionType).toBe(ActionType.UPDATE_DATA);
        expect(resolution.targetNodeId).toBe("input-field-id");
        expect(resolution.plannerInput.userContext).toEqual(expect.objectContaining({
          ...mockUserContext,
          sourceNode: inputNode,
          targetNode: inputNode, 
          eventPayload: { value: "newValue" },
        }));
        expect(resolution.prompt).toContain(ActionType.UPDATE_DATA.toString());
      }
    });

    // More tests will go here
  });
});