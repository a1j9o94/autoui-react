/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ActionRouter } from "./action-router";
import { ActionType, UIEventType } from "../schema/action-types";
import { UIEvent, UISpecNode, PlannerInput } from "../schema/ui";
import * as reducerModule from "./reducer";
import * as plannerModule from "./planner";

// Mock findNodeById
vi.mock("./reducer", () => ({
  findNodeById: vi.fn(),
}));

// Mock callPlannerLLM from the planner module
vi.mock("./planner", async () => {
  const actualPlannerModule = await vi.importActual("./planner") as Record<string, unknown>;
  return {
    ...(Object.keys(actualPlannerModule).length > 0 ? actualPlannerModule : {}),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    callPlannerLLM: vi.fn().mockImplementation(async (input: PlannerInput, _apiKey: string) => {
      return {
        id: `mock-llm-node-for-${input.goal || "default"}`,
        node_type: "Container",
        props: { title: `LLM for ${input.goal}` },
        children: [],
        bindings: {},
        events: {},
      } as UISpecNode;
    }),
  };
});

describe("ActionRouter (Deterministic)", () => {
  let router: ActionRouter;
  let mockSchema: Record<string, unknown>;
  let mockLayout: UISpecNode | null;
  let mockDataContext: Record<string, unknown>;
  let mockGoal: string;
  let mockUserContext: Record<string, unknown>;
  let mockedFindNodeById: ReturnType<typeof vi.fn>;
  let mockedCallPlannerLLM: ReturnType<typeof vi.fn>;
  const mockApiKey = "test-api-key";

  beforeEach(() => {
    router = new ActionRouter(mockApiKey);
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

    mockedFindNodeById = reducerModule.findNodeById as ReturnType<typeof vi.fn>;
    mockedCallPlannerLLM = plannerModule.callPlannerLLM as ReturnType<typeof vi.fn>;

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
    mockedCallPlannerLLM.mockClear();
  });

  describe("resolveRoute", () => {
    it("should handle INIT event with FULL_REFRESH, calling LLM", async () => {
      const initEvent: UIEvent = {
        type: UIEventType.INIT,
        nodeId: "system",
        timestamp: Date.now(),
        payload: null,
      };
      mockedFindNodeById.mockImplementation(
        (layoutNode: UISpecNode | undefined, id: string): UISpecNode | undefined => {
          if (id === "system") return undefined;
          if (id === "root" && layoutNode?.id === "root") return layoutNode;
          return undefined;
        }
      );

      const resolution = await router.resolveRoute(
        initEvent,
        mockSchema,
        mockLayout,
        mockDataContext,
        mockGoal,
        mockApiKey,
        mockUserContext
      );
      expect(resolution).toBeDefined();
      expect(resolution.actionType).toBe(ActionType.FULL_REFRESH);
      expect(resolution.targetNodeId).toBe("root");
      expect(mockedCallPlannerLLM).toHaveBeenCalled();
      expect(resolution.updatedNode).toBeDefined();
      expect(resolution.updatedNode?.id).toContain("mock-llm-node");
    });

    it("should handle generic CLICK event with FULL_REFRESH if no node config, calling LLM", async () => {
      const clickEvent: UIEvent = {
        type: UIEventType.CLICK,
        nodeId: "some-button-id",
        timestamp: Date.now(),
        payload: { x: 10, y: 20 },
      };
      mockedFindNodeById.mockImplementation(
        (layoutNode: UISpecNode | undefined, id: string): UISpecNode | undefined => {
          if (id === "some-button-id") return undefined;
          if (id === "root" && layoutNode?.id === "root") return layoutNode;
          return undefined;
        }
      );

      const resolution = await router.resolveRoute(
        clickEvent,
        mockSchema,
        mockLayout,
        mockDataContext,
        mockGoal,
        mockApiKey,
        mockUserContext
      );
      expect(resolution).toBeDefined();
      expect(resolution.actionType).toBe(ActionType.FULL_REFRESH);
      expect(resolution.targetNodeId).toBe("root");
      expect(mockedCallPlannerLLM).toHaveBeenCalled();
      expect(resolution.updatedNode).toBeDefined();
      expect(resolution.updatedNode?.id).toContain("mock-llm-node");
    });

    it("should default to FULL_REFRESH for CLICK on Button with no specific event config, calling LLM", async () => {
      const buttonNode: UISpecNode = {
        id: "actual-button-id",
        node_type: "Button",
        props: { label: "Test Button" },
        events: null,
        children: null,
        bindings: null,
      };
      mockedFindNodeById.mockImplementation(
        (layoutNode: UISpecNode | undefined, id: string): UISpecNode | undefined => {
          if (id === buttonNode.id) return buttonNode;
          if (id === "root" && layoutNode?.id === "root") return layoutNode;
          return undefined;
        }
      );

      const clickEvent: UIEvent = {
        type: UIEventType.CLICK,
        nodeId: "actual-button-id",
        timestamp: Date.now(),
        payload: null,
      };
      const resolution = await router.resolveRoute(
        clickEvent,
        mockSchema,
        mockLayout,
        mockDataContext,
        mockGoal,
        mockApiKey,
        mockUserContext
      );
      expect(resolution).toBeDefined();
      expect(resolution.actionType).toBe(ActionType.FULL_REFRESH);
      expect(resolution.targetNodeId).toBe("root");
      expect(mockedCallPlannerLLM).toHaveBeenCalled();
      expect(resolution.updatedNode).toBeDefined();
      expect(resolution.updatedNode?.id).toContain("mock-llm-node");
    });

    it("should use node-specific config for CLICK event (SHOW_DETAIL), calling LLM", async () => {
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
      const resolution = await router.resolveRoute(
        clickEvent,
        mockSchema,
        mockLayout,
        mockDataContext,
        mockGoal,
        mockApiKey,
        mockUserContext
      );
      expect(resolution).toBeDefined();
      expect(resolution.actionType).toBe(ActionType.UPDATE_CONTEXT);
      expect(resolution.targetNodeId).toBe("detail-section-abc");
      expect(resolution.updatedDataContext).toBeDefined();
      expect(resolution.updatedDataContext?.isTaskDetailDialogVisible).toBe(true);
      expect(resolution.updatedDataContext?.selectedTask).toBeUndefined();
      expect(mockedCallPlannerLLM).toHaveBeenCalled();
      expect(resolution.updatedNode).toBeDefined();
      expect(resolution.updatedNode?.id).toContain("mock-llm-node");
    });

    it("should default to UPDATE_DATA for CHANGE on Input, not calling LLM", async () => {
      const inputNode: UISpecNode = {
        id: "input-field-id",
        node_type: "Input",
        props: { type: "text" },
        bindings: { value: "initialValue" },
        events: null,
        children: null,
      };
      mockLayout = { 
        id: "root-for-update-data",
        node_type: "Container", 
        props: { className: "test-layout" },
        bindings: {},
        events: {},
        children: [inputNode]
      }; 
      mockedFindNodeById.mockImplementation(
        ( layoutNode: UISpecNode | undefined, id: string ): UISpecNode | undefined => {
          if (id === "input-field-id") return inputNode;
          if (layoutNode && id === layoutNode.id && layoutNode.id === "root-for-update-data") return layoutNode; 
          return undefined;
        }
      );

      const changeEvent: UIEvent = {
        type: UIEventType.CHANGE,
        nodeId: "input-field-id",
        timestamp: Date.now(),
        payload: { value: "newValue" },
      };
      const resolution = await router.resolveRoute(
        changeEvent,
        mockSchema,
        mockLayout, 
        mockDataContext,
        mockGoal,
        mockApiKey, 
        mockUserContext
      );
      expect(resolution).toBeDefined();
      expect(resolution.actionType).toBe(ActionType.UPDATE_DATA);
      expect(resolution.targetNodeId).toBe("input-field-id");
      expect(resolution.updatedDataContext).toBeDefined();
      expect(mockedCallPlannerLLM).not.toHaveBeenCalled();
      expect(resolution.updatedNode).toEqual(mockLayout); 
    });

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
          events: { CLICK: { action: ActionType.HIDE_DIALOG, target: dialogId, payload: null } },
          children: null,
        },
      ];
      if (saveButtonId) {
        dialogChildren.push({
          id: saveButtonId,
          node_type: "Button",
          props: { label: "Save" },
          bindings: null,
          events: { CLICK: { action: ActionType.SAVE_TASK_CHANGES, target: dialogId, payload: { data: "sample" } } },
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
          { id: "main-view", node_type: "Container", children: [], props: null, bindings: null, events: null },
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

    it("should handle HIDE_DIALOG directly, not calling LLM", async () => {
      const dialogId = "myTestDialog";
      const closeButtonId = "myTestDialog-closeButton";
      mockLayout = createDialogLayout(dialogId, closeButtonId);
      const initialDataContext = { ...mockDataContext, isMyDialogVisible: true };

      mockedFindNodeById.mockImplementation(
        (layoutToSearch: UISpecNode | undefined, idToFind: string): UISpecNode | undefined => {
          function findRecursively(node: UISpecNode | undefined, id: string): UISpecNode | undefined {
            if (!node) return undefined;
            if (node.id === id) return node;
            if (node.children) {
              for (const child of node.children) {
                const found = findRecursively(child, id);
                if (found) return found;
              }
            }
            return undefined;
          }
          return findRecursively(layoutToSearch, idToFind);
        }
      );

      const event: UIEvent = {
        type: UIEventType.CLICK,
        nodeId: closeButtonId,
        timestamp: Date.now(),
        payload: null,
      };

      const resolution = await router.resolveRoute(
        event,
        mockSchema,
        mockLayout,
        initialDataContext,
        mockGoal,
        mockApiKey,
        mockUserContext
      );

      expect(resolution).toBeDefined();
      expect(resolution.actionType).toBe(ActionType.UPDATE_CONTEXT); 
      expect(resolution.updatedNode).toEqual(mockLayout); 
      expect(resolution.updatedDataContext?.isTaskDetailDialogVisible).toBe(false);
      expect(resolution.updatedDataContext?.selectedTask).toBeNull(); 
      expect(mockedCallPlannerLLM).not.toHaveBeenCalled();
    });

    it("should handle SAVE_TASK_CHANGES action, not calling LLM", async () => {
      const dialogId = "mySaveDialog";
      const closeButtonId = "mySaveDialog-closeButton";
      const saveButtonId = "mySaveDialog-saveButton";
      mockLayout = createDialogLayout(dialogId, closeButtonId, saveButtonId);
      const initialDataContext = {
        ...mockDataContext,
        isMyDialogVisible: true,
        selectedTask: { id: "task1", title: "Original Title" },
        tasks: { data: [{ id: "task1", title: "Original Title" }] },
      };
      
      const currentTestLayout = mockLayout;
      mockedFindNodeById.mockImplementation(
        (_layoutNode: UISpecNode | undefined, idToFind: string): UISpecNode | undefined => {
          function findInCurrentTestLayout(node: UISpecNode | undefined, id: string): UISpecNode | undefined {
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
        payload: { formValue: "updated title" },
      };

      const resolution = await router.resolveRoute(
        event,
        mockSchema,
        mockLayout,
        initialDataContext,
        mockGoal,
        mockApiKey,
        mockUserContext
      );

      expect(resolution).toBeDefined();
      expect(resolution.actionType).toBe(ActionType.SAVE_TASK_CHANGES);
      expect(resolution.targetNodeId).toBe(dialogId);
      expect(resolution.updatedNode).toEqual(mockLayout); 
      expect(resolution.updatedDataContext).toBeDefined();
      expect(mockedCallPlannerLLM).not.toHaveBeenCalled();
    });
  });
});
