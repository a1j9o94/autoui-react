/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SpyInstance } from "vitest";
import { PlannerInput, UISpecNode } from "../schema/ui";
// Restore static imports
import { callPlannerLLM } from "./planner";

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
  let consoleErrorSpy: SpyInstance<
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

  describe("callPlannerLLM", () => {
    it("should return placeholder UI when no API key is provided", async () => {
      const input: PlannerInput = {
        schema: {},
        goal: "Test goal",
        history: null,
        userContext: null,
      };

      const result = await callPlannerLLM(input, "");

      expect(result).toBeDefined();
      expect(result.id).toBe("root-no-api-key");
      expect(result.node_type).toBe("Container");
      expect(result.children).toHaveLength(1);
      const messageNode = result.children?.[0];
      expect(messageNode?.id).toBe("no-api-key-message");
      expect(messageNode?.node_type).toBe("Text");
      expect(messageNode?.props?.text).toContain("OpenAI API Key is required");
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


        try {
          const result = await callPlannerLLM(
            input,
            process.env.VITE_OPENAI_API_KEY || "",
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
        try {
          const result = await callPlannerLLM(
            input,
            process.env.VITE_OPENAI_API_KEY || "",
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

        try {
          const result = await callPlannerLLM(
            input,
            process.env.VITE_OPENAI_API_KEY || "", // Fallback to empty string for environments without a key
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
});
