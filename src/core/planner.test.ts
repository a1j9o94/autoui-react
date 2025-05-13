/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PlannerInput, UIEvent, UISpecNode } from "../schema/ui";
// Restore static imports
import { mockPlanner, callPlannerLLM, processEvent } from "./planner";
import { ActionRouter } from "./action-router";
import { ActionType, RouteResolution } from "./action-router";
import { buildPrompt } from "./action-router";

// Mock the system events
vi.mock("./system-events", () => ({
  systemEvents: {
    emit: vi.fn().mockResolvedValue(undefined),
  },
  createSystemEvent: (type: string, payload: unknown) => ({ type, payload }),
  SystemEventType: {
    PLAN_START: "PLAN_START",
    PLAN_PROMPT_CREATED: "PLAN_PROMPT_CREATED",
    PLAN_RESPONSE_CHUNK: "PLAN_RESPONSE_CHUNK",
    PLAN_COMPLETE: "PLAN_COMPLETE",
    PLAN_ERROR: "PLAN_ERROR",
  },
}));

describe("Planner", () => {
  // Spy on console.error to suppress and check error logging
  let consoleErrorSpy: vi.SpyInstance<
    [message?: unknown, ...optionalParams: unknown[]],
    void
  >;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("mockPlanner", () => {
    it("should return a mock UI spec node", () => {
      const input: PlannerInput = {
        schema: {},
        goal: "Test goal",
        history: null,
        userContext: null,
      };

      const mockNode = mockPlanner(input);

      expect(mockNode.id).toBe("root");
      expect(mockNode.node_type).toBe("Container");
      // Find the ListView node within the mock structure
      // Note: This structure might change if mockPlanner is updated significantly
      const mainContent = mockNode.children?.find(
        (c) => c.id === "main-content"
      );
      const tasksContainer = mainContent?.children?.find(
        (c) => c.id === "tasks-container"
      );
      const listView = tasksContainer?.children?.find(
        (c) => c.node_type === "ListView"
      );

      expect(listView).toBeDefined();
      expect(listView?.bindings).toBeDefined();
      // Expect the data binding key to be 'data' and the value to be the path 'tasks.data'
      expect(listView?.bindings?.data).toBe("tasks.data");
      // Optionally, check that the old 'items' binding is gone (or adjust if standard changes)
      // expect(listView?.bindings?.items).toBeUndefined();
    });

    it("should use provided targetNodeId", () => {
      const input: PlannerInput = {
        schema: {},
        goal: "Test goal",
        history: null,
        userContext: null,
      };

      const mockNode = mockPlanner(input, "custom-id");

      expect(mockNode.id).toBe("custom-id");
    });
  });

  describe("callPlannerLLM", () => {
    it("should use mock planner when no API key is provided", async () => {
      // Use the statically imported callPlannerLLM
      const input: PlannerInput = {
        schema: {},
        goal: "Test goal",
        history: null,
        userContext: null,
      };

      // Call the statically imported function without providing an API key.
      // The internal logic of callPlannerLLM should now handle this and return the mock.
      const result = await callPlannerLLM(input, "", undefined);

      // Verify the mock result
      expect(result).toBeDefined();
      expect(result.id).toBe("root");
      expect(result.node_type).toBe("Container");
      expect(result.children).toHaveLength(2);
    });

    // Add a test case for MOCK_PLANNER env var if desired (optional)
    // it("should use mock planner when MOCK_PLANNER env var is set", async () => { ... });
  });

  // Integration test still passes the key explicitly
  (process.env.VITE_OPENAI_API_KEY ? describe : describe.skip)(
    "Integration with real LLM",
    () => {
      // Helper function to find a node by type recursively
      const findNodeByTypeRecursively = (
        node: UISpecNode | undefined,
        nodeType: string
      ): UISpecNode | undefined => {
        if (!node) return undefined;
        if (node.node_type === nodeType) return node;
        if (node.children) {
          for (const child of node.children) {
            const found = findNodeByTypeRecursively(child, nodeType);
            if (found) return found;
          }
        }
        return undefined;
      };

      it("should generate a valid root UI node", async () => {
        const input: PlannerInput = {
          schema: { simple: { value: "string" } },
          goal: "Display a simple value",
          history: null,
          userContext: null,
        };
        const prompt = buildPrompt(input); // Generate default prompt
        const mockRouteResolution: RouteResolution = {
          prompt,
          actionType: ActionType.FULL_REFRESH,
          targetNodeId: "root",
          plannerInput: input,
        };

        try {
          const result = await callPlannerLLM(
            input,
            process.env.VITE_OPENAI_API_KEY || "",
            mockRouteResolution
          );
          expect(result).toBeDefined();
          expect(result.id).toBeDefined();
          expect(result.node_type).toBe("Container"); // Expect a root container
        } catch (error) {
          console.error("LLM call failed in root node test:", error);
          throw error;
        }
      }, 30000);

      it("should generate correct ListView data binding for nested data", async () => {
        const input: PlannerInput = {
          schema: {
            // Schema where data is nested under a key
            tasks: {
              schema: { id: "string", title: "string" }, // Mock schema part
              data: [{ id: "1", title: "Task 1" }], // The actual data array
            },
          },
          goal: "Display a list of tasks",
          history: null,
          userContext: null,
        };
        const prompt = buildPrompt(input); // Generate default prompt with updated guidance
        const mockRouteResolution: RouteResolution = {
          prompt,
          actionType: ActionType.FULL_REFRESH,
          targetNodeId: "root",
          plannerInput: input,
        };

        try {
          const result = await callPlannerLLM(
            input,
            process.env.VITE_OPENAI_API_KEY || "",
            mockRouteResolution
          );

          // Find the ListView node within the result
          const listViewNode = findNodeByTypeRecursively(result, "ListView");

          expect(listViewNode).toBeDefined(); // Check if a ListView was generated
          expect(listViewNode?.bindings).toBeDefined();
          // **CRITICAL ASSERTION:** Check if the data binding path is correct
          expect(listViewNode?.bindings?.data).toBe("tasks.data");
        } catch (error) {
          console.error("LLM call failed in list binding test:", error);
          throw error;
        }
      }, 30000); // Increase timeout if needed

      it("should generate interactive elements like buttons", async () => {
        const input: PlannerInput = {
          schema: {
            userAction: { type: "string", description: "Action to perform" },
          },
          goal: "Create a button labeled 'Submit Action' that allows a user to submit an action.",
          history: null,
          userContext: null,
        };
        const prompt = buildPrompt(input);
        const mockRouteResolution: RouteResolution = {
          prompt,
          actionType: ActionType.FULL_REFRESH,
          targetNodeId: "root",
          plannerInput: input,
        };

        try {
          const result = await callPlannerLLM(
            input,
            process.env.VITE_OPENAI_API_KEY || "", // Fallback to empty string for environments without a key
            mockRouteResolution
          );
          console.log("Button call result\n", result);

          const buttonNode = findNodeByTypeRecursively(result, "Button");

          expect(buttonNode).toBeDefined(); // Check if a Button was generated
          expect(buttonNode?.props?.label).toBeDefined(); // Check if the button has a label
          expect(buttonNode?.events).toBeDefined(); // Check if the button has event handlers defined
          expect(buttonNode?.events?.CLICK).toBeDefined(); // Check for a CLICK event handler
          // Optionally, check the structure of the CLICK event if it's standardized
          // For example, expect(buttonNode.events.CLICK.action).toBeDefined();
        } catch (error) {
          console.error("LLM call failed in interactive element test:", error);
          throw error;
        }
      }, 30000); // Increase timeout if needed
    }
  );

  // processEvent test
  describe("processEvent", () => {
    it("should throw an error when no route is found", async () => {
      // Use statically imported processEvent
      const emptyRouter = new ActionRouter();
      const resolveRouteSpy = vi.spyOn(emptyRouter, "resolveRoute");
      resolveRouteSpy.mockReturnValue(null);
      const event: UIEvent = {
        type: "CLICK",
        nodeId: "button",
        timestamp: Date.now(),
        payload: null,
      };
      const layout: UISpecNode = {
        id: "root",
        node_type: "Container",
        props: null,
        bindings: null,
        events: null,
        children: null,
      };

      await expect(
        // Pass undefined for API key, processEvent passes it down
        processEvent(
          event,
          emptyRouter,
          {},
          layout,
          {},
          "Test goal",
          undefined,
          undefined
        )
      ).rejects.toThrow("No route found for event");
    });
  });
});
