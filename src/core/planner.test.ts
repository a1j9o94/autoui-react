import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PlannerInput, UIEvent, UISpecNode } from "../schema/ui";
// Restore static imports
import { buildPrompt, mockPlanner, callPlannerLLM, processEvent } from "./planner";
import { ActionRouter } from "./action-router";

// Mock the system events
vi.mock("./system-events", () => ({
  systemEvents: {
    emit: vi.fn().mockResolvedValue(undefined),
  },
  createSystemEvent: (type: string, payload: any) => ({ type, payload }),
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
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("buildPrompt", () => {
    it("should build a proper prompt from planner input", () => {
      const input: PlannerInput = {
        schema: {
          users: {
            id: "string",
            name: "string",
            email: "string",
          },
          todos: {
            id: "string",
            title: "string",
            completed: "boolean",
            userId: "string",
          },
        },
        goal: "Create a todo management app",
        history: [
          {
            type: "CLICK",
            nodeId: "add-todo-button",
            timestamp: 123456789,
            payload: null,
          },
        ],
        userContext: null,
      };

      const prompt = buildPrompt(input);

      // Check that the prompt contains key elements
      expect(prompt).toContain("Create a todo management app");
      expect(prompt).toContain("Table: users");
      expect(prompt).toContain("Table: todos");
      expect(prompt).toContain("Event: CLICK on node add-todo-button");
    });

    it("should use custom prompt when provided", () => {
      const input: PlannerInput = {
        schema: {},
        goal: "Test goal",
        history: null,
        userContext: null,
      };

      const customPrompt = "This is a custom prompt";
      const prompt = buildPrompt(input, customPrompt);

      expect(prompt).toBe(customPrompt);
    });
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
      expect(mockNode.children).toHaveLength(2); // Now expects 2 children
      expect(mockNode.children?.[0].node_type).toBe("Header"); // First child is a Header
      expect(mockNode.children?.[1].node_type).toBe("Container"); // Second child is Container
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
      const result = await callPlannerLLM(input, undefined, undefined);

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
      it("should generate UI with a real LLM call", async () => {
        // Use statically imported callPlannerLLM
        const input: PlannerInput = {
          schema: {
            todos: {
              id: "string",
              title: "string",
              completed: "boolean",
            },
          },
          goal: "Create a simple todo list with just a title and checkbox",
          history: null,
          userContext: null,
        };
        try {
          // Pass the key directly
          const result = await callPlannerLLM(input, undefined, process.env.VITE_OPENAI_API_KEY);
          expect(result).toBeDefined();
          expect(result.id).toBeDefined();
          expect(result.node_type).toBeDefined();
        } catch (error) {
          console.error("LLM call failed:", error);
          throw error;
        }
      }, 30000);
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
        processEvent(event, emptyRouter, {}, layout, {}, "Test goal", undefined, undefined)
      ).rejects.toThrow("No route found for event");
    });
  });
});
