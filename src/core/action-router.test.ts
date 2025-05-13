/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ActionRouter, ActionType } from "./action-router"; // Removed RouteResolution
import { UIEvent, UISpecNode } from "../schema/ui"; // Removed PlannerInput
import * as reducerModule from "./reducer"; // Import original for controlled passthrough
import { UIEventType } from "./action-types";
// Removed buildPrompt as it's not directly used in this initial test, can be re-added if needed.

// Mock findNodeById if it's a dependency of ActionRouter
vi.mock("./reducer", () => ({
  findNodeById: vi.fn(), // This is what we will mock and control per test
}));

describe("ActionRouter (Deterministic)", () => {
  let router: ActionRouter;
  let mockSchema: Record<string, unknown>;
  let mockLayout: UISpecNode | null;
  let mockDataContext: Record<string, unknown>;
  let mockGoal: string;
  let mockUserContext: Record<string, unknown>;
  let mockedFindNodeById: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    router = new ActionRouter();
    mockSchema = { tasks: { type: "object" } };
    mockLayout = {
      id: "root",
      node_type: "Container",
      props: null,
      bindings: null,
      events: null,
      children: [],
    };
    mockDataContext = { user: { id: "user-1" } };
    mockGoal = "Achieve test goal";
    mockUserContext = { sessionToken: "abc" };

    // Get a reference to the vi.fn() created by vi.mock()
    mockedFindNodeById = reducerModule.findNodeById as ReturnType<typeof vi.fn>;

    // Default mock implementation: This will be called by ActionRouter.
    // It will search in whatever layout ActionRouter passes to it (which is this.layout from ActionRouter instance).
    mockedFindNodeById.mockImplementation(function findNodeRecursively(
      currentNode: UISpecNode | undefined,
      idToFind: string
    ): UISpecNode | undefined {
      if (!currentNode) return undefined;
      if (currentNode.id === idToFind) return currentNode;
      if (currentNode.children) {
        for (const child of currentNode.children) {
          const found = findNodeRecursively(child, idToFind);
          if (found) return found;
        }
      }
      return undefined;
    });
  });

  describe("resolveRoute", () => {
    it("should handle INIT event with FULL_REFRESH", () => {
      const initEvent: UIEvent = {
        type: UIEventType.INIT,
        nodeId: "system", // sourceNode will be undefined
        timestamp: Date.now(),
        payload: null,
      };
      // findNodeById for "system" returns undefined (by default beforeEach mock or specific below)
      // findNodeById for "root" (target) returns mockLayout
      mockedFindNodeById.mockImplementation(
        (
          layoutNode: UISpecNode | undefined,
          id: string
        ): UISpecNode | undefined => {
          if (id === "system") return undefined;
          if (id === "root" && layoutNode?.id === "root") return layoutNode;
          return reducerModule.findNodeById(layoutNode, id); // Passthrough to original (mocked) for other IDs
        }
      );

      const resolution = router.resolveRoute(
        initEvent,
        mockSchema,
        mockLayout,
        mockDataContext,
        mockGoal,
        mockUserContext
      );
      expect(resolution).toBeDefined();
      if (resolution) {
        expect(resolution.actionType).toBe(ActionType.FULL_REFRESH);
        expect(resolution.targetNodeId).toBe("root");
        expect(resolution.plannerInput.userContext).toEqual(
          expect.objectContaining({
            ...mockUserContext,
            targetNode: mockLayout,
            eventPayload: null,
          })
        );
        expect(resolution.plannerInput.userContext?.sourceNode).toBeUndefined();
        expect(resolution.prompt).toContain(ActionType.FULL_REFRESH.toString());
      }
    });

    it("should handle generic CLICK event with FULL_REFRESH if no node config", () => {
      const clickEvent: UIEvent = {
        type: UIEventType.CLICK,
        nodeId: "some-button-id", // sourceNode will be undefined
        timestamp: Date.now(),
        payload: { x: 10, y: 20 },
      };
      // findNodeById for "some-button-id" returns undefined
      // findNodeById for "root" (target) returns mockLayout
      mockedFindNodeById.mockImplementation(
        (
          layoutNode: UISpecNode | undefined,
          id: string
        ): UISpecNode | undefined => {
          if (id === "some-button-id") return undefined;
          if (id === "root" && layoutNode?.id === "root") return layoutNode;
          return reducerModule.findNodeById(layoutNode, id);
        }
      );

      const resolution = router.resolveRoute(
        clickEvent,
        mockSchema,
        mockLayout,
        mockDataContext,
        mockGoal,
        mockUserContext
      );
      expect(resolution).toBeDefined();
      if (resolution) {
        expect(resolution.actionType).toBe(ActionType.FULL_REFRESH);
        expect(resolution.targetNodeId).toBe("root");
        expect(resolution.plannerInput.userContext).toEqual(
          expect.objectContaining({
            ...mockUserContext,
            targetNode: mockLayout,
            eventPayload: clickEvent.payload,
          })
        );
        expect(resolution.plannerInput.userContext?.sourceNode).toBeUndefined();
        expect(resolution.prompt).toContain(ActionType.FULL_REFRESH.toString());
      }
    });

    it("should default to FULL_REFRESH for CLICK on Button with no specific event config", () => {
      const buttonNode: UISpecNode = {
        id: "actual-button-id",
        node_type: "Button",
        props: { label: "Test Button" },
        events: null,
        children: null,
        bindings: null,
      };
      // findNodeById for "actual-button-id" (source) returns buttonNode
      // findNodeById for "root" (target, as per logic for unconf. button) returns mockLayout
      mockedFindNodeById.mockImplementation(
        (
          layoutNode: UISpecNode | undefined,
          id: string
        ): UISpecNode | undefined => {
          if (id === buttonNode.id) return buttonNode;
          if (id === "root" && layoutNode?.id === "root") return layoutNode;
          // Simplified recursive search for this test case
          function find(
            node: UISpecNode | undefined,
            targetId: string
          ): UISpecNode | undefined {
            if (!node) return undefined;
            if (node.id === targetId) return node;
            if (node.children) {
              for (const child of node.children) {
                const f = find(child, targetId);
                if (f) return f;
              }
            }
            return undefined;
          }
          return find(layoutNode, id);
        }
      );

      const clickEvent: UIEvent = {
        type: UIEventType.CLICK,
        nodeId: "actual-button-id",
        timestamp: Date.now(),
        payload: null,
      };
      const resolution = router.resolveRoute(
        clickEvent,
        mockSchema,
        mockLayout,
        mockDataContext,
        mockGoal,
        mockUserContext
      );
      expect(resolution).toBeDefined();
      if (resolution) {
        expect(resolution.actionType).toBe(ActionType.FULL_REFRESH);
        expect(resolution.targetNodeId).toBe("root");
        expect(resolution.plannerInput.userContext).toEqual(
          expect.objectContaining({
            ...mockUserContext,
            sourceNode: buttonNode,
            targetNode: mockLayout,
            eventPayload: null,
          })
        );
        expect(resolution.prompt).toContain(ActionType.FULL_REFRESH.toString());
      }
    });

    it("should use node-specific config for CLICK event", () => {
      const detailSectionNode: UISpecNode = {
        id: "detail-section-abc",
        node_type: "Container",
        props: {},
        bindings: null,
        events: null,
        children: [],
      };
      const nodeWithEventConfig: UISpecNode = {
        id: "button-with-event",
        node_type: "Button",
        props: { label: "Action Button" },
        bindings: null,
        children: null,
        events: {
          CLICK: {
            action: ActionType.SHOW_DETAIL,
            target: "detail-section-abc",
            payload: { mode: "edit" },
          },
        },
      };
      // Update mockLayout to include this button
      mockLayout = {
        id: "root",
        node_type: "Container",
        props: null,
        bindings: null,
        events: null,
        children: [nodeWithEventConfig, detailSectionNode],
      };

      mockedFindNodeById.mockImplementation(
        (layoutToSearch: UISpecNode | null | undefined, id: string) => {
          function find(node: UISpecNode | undefined, targetId: string): UISpecNode | undefined {
            if (!node) return undefined;
            if (node.id === targetId) return node;
            if (node.children) {
              for (const child of node.children) {
                const f = find(child, targetId);
                if (f) return f;
              }
            }
            return undefined;
          }
          return find(layoutToSearch ?? undefined, id);
        }
      );

      const clickEvent: UIEvent = {
        type: UIEventType.CLICK,
        nodeId: "button-with-event",
        timestamp: Date.now(),
        payload: { clickX: 100, clickY: 50 },
      };
      const resolution = router.resolveRoute(
        clickEvent,
        mockSchema,
        mockLayout,
        mockDataContext,
        mockGoal,
        mockUserContext
      );
      expect(resolution).toBeDefined();
      if (resolution) {
        expect(resolution.actionType).toBe(ActionType.SHOW_DETAIL);
        expect(resolution.targetNodeId).toBe("detail-section-abc");
        expect(resolution.plannerInput.userContext).toEqual(
          expect.objectContaining({
            ...mockUserContext,
            sourceNode: nodeWithEventConfig,
            eventPayload: { clickX: 100, clickY: 50, mode: "edit" },
          })
        );
        expect(resolution.prompt).toContain(ActionType.SHOW_DETAIL.toString());
      }
    });

    it("should default to UPDATE_DATA for CHANGE on Input with no specific event config", () => {
      const inputNode: UISpecNode = {
        id: "input-field-id",
        node_type: "Input",
        props: { type: "text" },
        bindings: { value: "initialValue" },
        events: null,
        children: null,
      };
      // findNodeById for "input-field-id" (source AND target) returns inputNode
      mockedFindNodeById.mockImplementation(
        (
          layoutNode: UISpecNode | undefined,
          id: string
        ): UISpecNode | undefined => {
          if (id === "input-field-id") return inputNode;
          return undefined;
        }
      );

      const changeEvent: UIEvent = {
        type: UIEventType.CHANGE,
        nodeId: "input-field-id",
        timestamp: Date.now(),
        payload: { value: "newValue" },
      };
      const resolution = router.resolveRoute(
        changeEvent,
        mockSchema,
        mockLayout,
        mockDataContext,
        mockGoal,
        mockUserContext
      );
      expect(resolution).toBeDefined();
      if (resolution) {
        expect(resolution.actionType).toBe(ActionType.UPDATE_DATA);
        expect(resolution.targetNodeId).toBe("input-field-id");
        expect(resolution.plannerInput.userContext).toEqual(
          expect.objectContaining({
            ...mockUserContext,
            sourceNode: inputNode,
            targetNode: inputNode,
            eventPayload: { value: "newValue" },
          })
        );
        expect(resolution.prompt).toContain(ActionType.UPDATE_DATA.toString());
      }
    });

    // --- Tests for Dialog Interactions ---

    const createDialogLayout = (
      dialogId: string,
      closeButtonId: string,
      saveButtonId?: string
    ): UISpecNode => {
      const dialogChildren: UISpecNode[] = [
        {
          id: closeButtonId,
          node_type: "Button",
          props: { label: "Close" },
          bindings: null,
          events: {
            CLICK: {
              action: ActionType.HIDE_DIALOG,
              target: dialogId,
              payload: null,
            },
          },
          children: null,
        },
      ];
      if (saveButtonId) {
        dialogChildren.push({
          id: saveButtonId,
          node_type: "Button",
          props: { label: "Save" },
          bindings: null,
          events: {
            CLICK: {
              action: ActionType.SAVE_TASK_CHANGES,
              target: dialogId,
              payload: { data: "sample" },
            },
          },
          children: null,
        });
      }
      return {
        id: "root",
        node_type: "Container",
        props: null,
        bindings: null,
        events: null,
        children: [
          {
            id: "main-view",
            node_type: "Container",
            children: [],
            props: null,
            bindings: null,
            events: null,
          },
          {
            id: dialogId,
            node_type: "Dialog",
            props: { title: "Test Dialog", visible: true },
            bindings: { visible: "isMyDialogVisible" },
            events: null,
            children: dialogChildren,
          },
        ],
      };
    };

    it("should handle HIDE_DIALOG action from a button within an open dialog", () => {
      const dialogId = "myTestDialog";
      const closeButtonId = "myTestDialog-closeButton";
      mockLayout = createDialogLayout(dialogId, closeButtonId);
      mockDataContext.isMyDialogVisible = true; // Simulate dialog is open in context

      const currentTestLayout = mockLayout; // Closure to capture the correct layout
      // Override the global mock for this specific test case
      mockedFindNodeById.mockImplementation(
        (
          _layoutNode: UISpecNode | undefined,
          idToFind: string
        ): UISpecNode | undefined => {
          // This custom mock implementation searches within the specific currentTestLayout
          function findInCurrentTestLayout(
            node: UISpecNode | undefined,
            id: string
          ): UISpecNode | undefined {
            if (!node) return undefined;
            if (node.id === id) return node;
            if (node.children) {
              for (const child of node.children) {
                const found = findInCurrentTestLayout(child, id);
                if (found) return found;
              }
            }
            return undefined;
          }
          return findInCurrentTestLayout(currentTestLayout, idToFind);
        }
      );

      const event: UIEvent = {
        type: UIEventType.CLICK,
        nodeId: closeButtonId,
        timestamp: Date.now(),
        payload: null,
      };

      const resolution = router.resolveRoute(
        event,
        mockSchema,
        mockLayout,
        mockDataContext,
        mockGoal,
        mockUserContext
      );

      expect(resolution).toBeDefined();
      expect(resolution.actionType).toBe(ActionType.HIDE_DIALOG);
      expect(resolution.targetNodeId).toBe(dialogId);
      expect(resolution.prompt).toContain(ActionType.HIDE_DIALOG.toString());
      expect(resolution.prompt).toContain(`dialog ${dialogId}`);
      expect(
        (resolution.plannerInput.userContext?.sourceNode as UISpecNode)?.id
      ).toBe(closeButtonId);
      expect(
        (resolution.plannerInput.userContext?.targetNode as UISpecNode)?.id
      ).toBe(dialogId);
    });

    it("should handle SAVE_TASK_CHANGES action from a button within an open dialog", () => {
      const dialogId = "mySaveDialog";
      const closeButtonId = "mySaveDialog-closeButton"; // Still need a way to find it for the general mock
      const saveButtonId = "mySaveDialog-saveButton";
      mockLayout = createDialogLayout(dialogId, closeButtonId, saveButtonId);
      mockDataContext.isMyDialogVisible = true;
      mockDataContext.selectedTask = { id: "task1", title: "Original Title" };
      mockDataContext.tasks = {
        data: [{ id: "task1", title: "Original Title" }],
      };

      const currentTestLayout = mockLayout; // Closure to capture the correct layout
      // Override the global mock for this specific test case
      mockedFindNodeById.mockImplementation(
        (
          _layoutNode: UISpecNode | undefined,
          idToFind: string
        ): UISpecNode | undefined => {
          // This custom mock implementation searches within the specific currentTestLayout
          function findInCurrentTestLayout(
            node: UISpecNode | undefined,
            id: string
          ): UISpecNode | undefined {
            if (!node) return undefined;
            if (node.id === id) return node;
            if (node.children) {
              for (const child of node.children) {
                const found = findInCurrentTestLayout(child, id);
                if (found) return found;
              }
            }
            return undefined;
          }
          return findInCurrentTestLayout(currentTestLayout, idToFind);
        }
      );

      const event: UIEvent = {
        type: UIEventType.CLICK,
        nodeId: saveButtonId,
        timestamp: Date.now(),
        payload: { formValue: "updated title" }, // Event payload from a form field, for example
      };

      const resolution = router.resolveRoute(
        event,
        mockSchema,
        mockLayout,
        mockDataContext,
        mockGoal,
        mockUserContext
      );

      expect(resolution).toBeDefined();
      expect(resolution.actionType).toBe(ActionType.SAVE_TASK_CHANGES);
      expect(resolution.targetNodeId).toBe(dialogId); // Target for UI update is the dialog
      expect(resolution.prompt).toContain(
        ActionType.SAVE_TASK_CHANGES.toString()
      );
      expect(resolution.prompt).toContain(`dialog ${dialogId}`);
      expect(
        (resolution.plannerInput.userContext?.sourceNode as UISpecNode)?.id
      ).toBe(saveButtonId);
      expect(
        (resolution.plannerInput.userContext?.targetNode as UISpecNode)?.id
      ).toBe(dialogId);
      expect(
        resolution.plannerInput.userContext?.eventPayload as {
          data: string;
          formValue: string;
        }
      ).toEqual({ data: "sample", formValue: "updated title" }); // Merged payload
      expect(
        resolution.plannerInput.userContext?.selectedTask as {
          id: string;
          title: string;
        }
      ).toEqual({ id: "task1", title: "Original Title" });
      expect(
        resolution.plannerInput.userContext?.tasks as {
          data: { id: string; title: string }[];
        }
      ).toBeDefined();
    });

    // More tests will go here
  });
});
