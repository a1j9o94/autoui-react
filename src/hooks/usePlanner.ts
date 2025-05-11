import { useState, useCallback } from "react";
import { openai } from "@ai-sdk/openai";
import {
  ActionRouter,
  callPlannerLLM,
  createDefaultRouter,
  processEvent,
} from "../core";
import { PlannerInput, UIEvent, UISpecNode } from "../schema/ui";

interface UsePlannerOptions {
  goal: string;
  schema: Record<string, unknown>;
  userContext?: Record<string, unknown>;
  router?: ActionRouter;
  modelProvider?: unknown; // To be expanded for different providers
}

interface UsePlannerResult {
  layout: UISpecNode | undefined;
  loading: boolean;
  error: Error | null;
  handleEvent: (event: UIEvent) => Promise<void>;
  generateInitialLayout: () => Promise<void>;
}

/**
 * React hook for utilizing the AI planner functionality
 */
export function usePlanner(options: UsePlannerOptions): UsePlannerResult {
  const { goal, schema, userContext, router: customRouter } = options;

  // State for UI layout
  const [layout, setLayout] = useState<UISpecNode | undefined>(undefined);

  // State for loading and error tracking
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Use provided router or create a default one
  const router = customRouter || createDefaultRouter();

  // Data context for bindings (simplified for now)
  const dataContext: Record<string, unknown> = {};

  /**
   * Generate the initial UI layout
   */
  const generateInitialLayout = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Create initial planner input
      const plannerInput: PlannerInput = {
        schema,
        goal,
        userContext: userContext || null,
        history: null,
      };

      // Call the planner to generate the UI
      const generatedLayout = await callPlannerLLM(plannerInput);
      setLayout(generatedLayout);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [schema, goal, userContext]);

  /**
   * Handle UI events and update the layout
   */
  const handleEvent = useCallback(
    async (event: UIEvent) => {
      if (!layout) {
        setError(new Error("Cannot handle event - no layout exists"));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Process the event using the router and generate an updated UI
        const updatedLayout = await processEvent(
          event,
          router,
          schema,
          layout,
          dataContext,
          goal,
          userContext
        );

        setLayout(updatedLayout);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [layout, router, schema, dataContext, goal, userContext]
  );

  return {
    layout,
    loading,
    error,
    handleEvent,
    generateInitialLayout,
  };
}
