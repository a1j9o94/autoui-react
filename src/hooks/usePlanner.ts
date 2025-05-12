import { useState, useEffect, useCallback, useRef } from "react";
import {
  ActionRouter,
  callPlannerLLM,
  createDefaultRouter,
  processEvent,
  mockPlanner,
} from "../core";
import { PlannerInput, UIEvent, UISpecNode } from "../schema/ui";

export interface UsePlannerOptions {
  goal: string;
  schema: Record<string, unknown>;
  openaiApiKey?: string;
  userContext?: Record<string, unknown>;
  router?: ActionRouter;
  modelProvider?: unknown; // To be expanded for different providers
  initialLayout?: UISpecNode;
  mockMode?: boolean;
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
  const {
    schema,
    goal,
    openaiApiKey,
    userContext,
    initialLayout,
    mockMode: optionsMockMode,
  } = options;

  // State for UI layout
  const [layout, setLayout] = useState<UISpecNode | undefined>(
    initialLayout || undefined
  );

  // State for loading and error tracking
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Use provided router or create a default one
  const router = options.router || createDefaultRouter();

  // Data context for bindings (simplified for now)
  const dataContext: Record<string, unknown> = {};

  // Ref to track if initial fetch has been attempted
  const initialFetchAttempted = useRef(false);

  // Determine actual mock mode based on option OR missing API key
  const mockMode = optionsMockMode || !openaiApiKey;

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

      let generatedLayout: UISpecNode;
      if (mockMode) {
        console.warn(
          "Using mock planner in usePlanner hook (mockMode enabled or API key missing)."
        );
        generatedLayout = mockPlanner(plannerInput);
      } else {
        // We know openaiApiKey is defined here because mockMode is false
        generatedLayout = await callPlannerLLM(
          plannerInput,
          openaiApiKey as string,
          undefined
        );
      }
      setLayout(generatedLayout);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [schema, goal, userContext, openaiApiKey, mockMode]);

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
          userContext,
          openaiApiKey
        );

        setLayout(updatedLayout);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [layout, router, schema, dataContext, goal, userContext, openaiApiKey]
  );

  // Effect for initial fetch
  useEffect(() => {
    // Only attempt initial fetch if:
    // 1. No initialLayout was provided via options.
    // 2. We haven't set a layout state yet.
    // 3. We haven't already attempted the initial fetch.
    if (
      options.initialLayout === undefined &&
      layout === undefined &&
      !initialFetchAttempted.current
    ) {
      // Mark that we are attempting the fetch
      initialFetchAttempted.current = true;
      generateInitialLayout();
    }
    // Dependencies are minimal now, just checking if an initial layout was provided
    // or if generateInitialLayout function identity changes (which it shouldn't often).
  }, [options.initialLayout, layout, generateInitialLayout]); // Removed loading from deps

  return {
    layout,
    loading,
    error,
    handleEvent,
    generateInitialLayout,
  };
}
