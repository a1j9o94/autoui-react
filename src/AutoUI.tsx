import React, { useState, useCallback, useRef, useEffect } from "react";
import { UIEvent, UISpecNode, UIEventType, DataItem } from "./schema/ui";
import { ActionType } from "./schema/action-types";
import { useUIStateEngine, UseUIStateEngineOptions } from "./core/state";
import {
  renderNode,
  renderShimmer,
  clearRenderedNodeCacheEntry,
} from "./core/renderer";
import { resolveBindings, DataContext } from "./core/bindings";
import { EventManager, EventHook } from "./core/events";
import {
  SystemEventType,
  SystemEventHook,
  systemEvents,
  createSystemEvent,
} from "./core/system-events";
import { SchemaAdapter } from "./adapters/schema";
import {
  areShadcnComponentsAvailable,
  getMissingComponentsMessage,
} from "./core/component-detection";
import "./styles/autoui.css";
import { PlanningConfig } from "./core/action-router";

// Helper function to correct list bindings
function correctListBindingsRecursive(
  node: UISpecNode,
  dataContext: DataContext
): UISpecNode {
  // Deep clone to avoid mutating the original state.layout directly during correction
  // This is important because state.layout might be used elsewhere or in dependencies.
  const correctedNode = JSON.parse(JSON.stringify(node)) as UISpecNode;

  if (
    (correctedNode.node_type === "ListView" ||
      correctedNode.node_type === "Table") &&
    correctedNode.bindings?.data
  ) {
    const bindingPath = correctedNode.bindings.data;
    if (typeof bindingPath === "string") {
      const pathSegments = bindingPath.split(".");
      const mainKey = pathSegments[0]; // e.g., 'tasks'

      // Check if the binding path is just the main key (e.g., "tasks")
      // and if a .data sub-property exists and is an array in the context.
      if (pathSegments.length === 1) {
        const potentialDataContextEntry = dataContext[mainKey];
        if (
          potentialDataContextEntry &&
          typeof potentialDataContextEntry === "object" &&
          potentialDataContextEntry !== null &&
          "data" in potentialDataContextEntry &&
          Array.isArray((potentialDataContextEntry as { data: unknown }).data)
        ) {
          correctedNode.bindings.data = `${mainKey}.data`;
          console.log(
            `[AutoUI Debug] Corrected list binding for node '${correctedNode.id}': from '${mainKey}' to '${mainKey}.data'`
          );
        }
      }
    }
  }

  if (correctedNode.children) {
    correctedNode.children = correctedNode.children.map((child) =>
      correctListBindingsRecursive(child, dataContext)
    );
  }

  return correctedNode;
}

// Interface for DrizzleAdapterOptions
interface DrizzleAdapterOptions {
  schema: Record<string, unknown>;
  // Add other options as needed
}

export interface AutoUIProps
  extends Omit<UseUIStateEngineOptions, "router" | "dataContext"> {
  // Extend options from the state engine, excluding ones managed internally
  // Schema definition (one of these is required)
  schema:
    | Record<string, unknown> // Direct schema object
    | { type: "drizzle"; options: DrizzleAdapterOptions } // Drizzle adapter
    | { type: "custom"; adapter: SchemaAdapter }; // Custom adapter

  // Required
  goal: string;

  // Optional configurations
  componentAdapter?: "shadcn";
  userContext?: Record<string, unknown>;
  onEvent?: (evt: UIEvent) => void;

  // UI Event hooks
  eventHooks?: {
    all?: EventHook[];
    [key: string]: EventHook[] | undefined;
  };

  // System Event hooks
  systemEventHooks?: {
    [key: string]: SystemEventHook[] | undefined;
  };

  // Enable partial UI updates (instead of regenerating entire UI on each interaction)
  enablePartialUpdates?: boolean;

  // Define custom UI update patterns
  updatePatterns?: {
    // Allow target components to show dropdowns
    enableDropdowns?: boolean;
    // Allow for showing/hiding detail views
    enableDetailViews?: boolean;
    // Allow for expanding/collapsing sections
    enableExpandCollapse?: boolean;
    // Allow for multi-step form navigation
    enableFormNavigation?: boolean;
  };

  // Integration configuration
  integration?: {
    // Whether to generate a standalone UI or a component for integration
    mode?: "standalone" | "component";
    // CSS class names to apply to the root element
    className?: string;
    // Inline styles to apply to the root element
    style?: React.CSSProperties;
    // ID of the root element
    id?: string;
  };

  // Scope of the generation - what kind of UI element to generate
  scope?: {
    // Type of component to generate
    type?: "form" | "list" | "detail" | "dashboard" | "full-page" | "card";
    // Specific focus for the generation
    focus?: string;
  };

  // Debug mode - shows system events in console
  debugMode?: boolean;

  mockMode?: boolean;

  // Database configuration
  databaseConfig?: Record<string, unknown>;

  // Planning configuration
  planningConfig?: PlanningConfig;

  // Add the openaiApiKey prop here
  openaiApiKey: string;
}

/**
 * AutoUI - Main component for generating goal-oriented UIs
 *
 * @example
 * ```tsx
 * import { AutoUI } from 'autoui-react';
 * import { emailsTable, usersTable } from './schema';
 *
 * function MyApp() {
 *   return (
 *     <AutoUI
 *       schema={{ emails: emailsTable, users: usersTable }}
 *       goal="Create an inbox view with email list and detail view"
 *     />
 *   );
 * }
 * ```
 */
export const AutoUI: React.FC<AutoUIProps> = ({
  schema,
  goal,
  componentAdapter = "shadcn",
  userContext,
  onEvent,
  eventHooks,
  systemEventHooks,
  debugMode = false,
  planningConfig,
  integration = {},
  enablePartialUpdates = true,
  openaiApiKey,
}) => {
  const [schemaAdapterInstance] = useState<SchemaAdapter | null>(null);
  const [dataContext, setDataContext] = useState<DataContext>({});
  const [componentsAvailable, setComponentsAvailable] = useState(true);

  const [uiStatus, setUiStatus] = useState<
    | "idle"
    | "initializing"
    | "resolving_bindings"
    | "rendering"
    | "event_processing"
    | "error"
  >("initializing");

  const [currentResolvedLayoutForRender, setCurrentResolvedLayoutForRender] =
    useState<UISpecNode | null>(null);
  const [isResolvingBindings, setIsResolvingBindings] =
    useState<boolean>(false);

  const [renderedNode, setRenderedNode] = useState<React.ReactElement | null>(
    null
  );

  // Restore effectiveSchema and scopedGoal definitions
  const effectiveSchema = schema as Record<string, unknown>;
  const scopedGoal = goal;

  useEffect(() => {
    if (componentAdapter === "shadcn") {
      setComponentsAvailable(areShadcnComponentsAvailable());
    }
  }, [componentAdapter]);

  useEffect(() => {
    const unregisters: Array<() => void> = [];
    if (systemEventHooks) {
      Object.entries(systemEventHooks).forEach(([eventType, hooks]) => {
        if (!hooks) return;
        (hooks as SystemEventHook[]).forEach((hook) => {
          const unregister = systemEvents.on(
            eventType as SystemEventType,
            hook
          );
          unregisters.push(unregister);
        });
      });
    }
    if (debugMode) {
      const debugHook: SystemEventHook = (event) => {
        console.debug(`[AutoUI Debug] System Event:`, event);
      };
      Object.values(SystemEventType)
        .filter(
          (eventType) =>
            eventType !== SystemEventType.RENDER_START &&
            eventType !== SystemEventType.BINDING_RESOLUTION_START
        )
        .forEach((eventType) => {
          const unregister = systemEvents.on(eventType, debugHook);
          unregisters.push(unregister);
        });
    }
    return () => {
      unregisters.forEach((unregister) => unregister());
    };
  }, [systemEventHooks, debugMode]);

  useEffect(() => {
    const initializeDataContext = async () => {
      let initialData: DataContext = {};
      if (schemaAdapterInstance) {
        initialData = await schemaAdapterInstance.initializeDataContext();
      } else if (effectiveSchema) {
        Object.entries(effectiveSchema).forEach(([key, tableSchema]) => {
          initialData[key] = {
            schema: tableSchema,
            data:
              (tableSchema as { sampleData?: DataItem[] })?.sampleData || [],
            selected: null,
          };
        });
      }
      if (userContext) {
        initialData.user = userContext;
      }
      setDataContext(initialData);
    };
    initializeDataContext();
  }, [effectiveSchema, schemaAdapterInstance, userContext]);

  const { state, handleEvent } = useUIStateEngine({
    schema: effectiveSchema,
    goal: scopedGoal,
    userContext,
    planningConfig,
    dataContext, // Pass the local dataContext here, engine will use it if its own is empty initially
    enablePartialUpdates,
    openaiApiKey,
  });

  const eventManagerRef = useRef(new EventManager());

  useEffect(() => {
    if (!eventHooks) return;
    const unregisters: Array<() => void> = [];
    if (eventHooks.all) {
      const unregister = eventManagerRef.current.register(
        "all",
        async (ctx) => {
          for (const hook of eventHooks.all || []) {
            await hook(ctx);
            if (ctx.isPropagationStopped()) break;
          }
        }
      );
      unregisters.push(unregister);
    }
    Object.entries(eventHooks).forEach(([type, hooks]) => {
      if (type === "all" || !hooks) return;
      const unregister = eventManagerRef.current.register(
        [type as UIEventType],
        async (ctx) => {
          for (const hook of hooks as EventHook[]) {
            await hook(ctx);
            if (ctx.isPropagationStopped()) break;
          }
        }
      );
      unregisters.push(unregister);
    });
    return () => {
      unregisters.forEach((unregister) => unregister());
    };
  }, [eventHooks]);

  const processEvent = useCallback(
    async (event: UIEvent) => {
      setUiStatus("event_processing");
      // Use currentResolvedLayoutForRender as the layout active when the event occurred
      const layoutAtEventTime = currentResolvedLayoutForRender;

      const shouldProceed = await eventManagerRef.current.processEvent(event);
      if (onEvent) onEvent(event);

      if (!shouldProceed) {
        console.info(
          "[AutoUI.processEvent] Event processing stopped by local hooks",
          event
        );
        setUiStatus("idle");
        return;
      }

      if (
        event.type === "CLICK" &&
        layoutAtEventTime &&
        event.nodeId.includes("view-details-button")
      ) {
        const mainContent = layoutAtEventTime.children?.find(
          (c) => c.id === "main-content"
        );
        const taskList = mainContent?.children
          ?.find((c) => c.id === "tasks-container")
          ?.children?.find((c) => c.id === "task-list");
        const eventSourceListItemCard = taskList?.children?.find((item) =>
          item.children?.some((btn) => btn.id === event.nodeId)
        );
        const buttonNode = eventSourceListItemCard?.children?.find(
          (btn) => btn.id === event.nodeId
        );

        if (
          buttonNode?.events?.CLICK?.action === ActionType.SHOW_DETAIL &&
          buttonNode?.events?.CLICK?.target === "task-detail"
        ) {
          const cacheKeyToClear = `task-detail:false:no-data-selected`;
          clearRenderedNodeCacheEntry(cacheKeyToClear);
          console.log(
            `[AutoUI.processEvent] Attempted to clear cache for task-detail using simplified key: ${cacheKeyToClear}`
          );
        }
      }

      console.log(
        "[AutoUI.processEvent] Forwarding event to engine:",
        JSON.stringify(event, null, 2)
      );
      console.log(
        "[AutoUI.processEvent] Passing currentLayout ID (at event time):",
        layoutAtEventTime?.id
      );
      console.log(
        "[AutoUI.processEvent] Passing dataContext keys to engine:",
        Object.keys(dataContext)
      );

      // Pass layoutAtEventTime and the current dataContext to the engine.
      // The engine will use layoutAtEventTime to find the event source node.
      handleEvent(event, layoutAtEventTime, dataContext);

      // uiStatus will be managed by other effects based on state changes from the engine
      // No longer setting uiStatus to 'idle' here directly.
    },
    [
      dataContext,
      handleEvent,
      onEvent,
      eventManagerRef,
      currentResolvedLayoutForRender,
      // state.layout, // No longer directly using state.layout here for this callback's logic concerning handleEvent's second arg
      // setUiStatus is implicitly available
    ]
  );

  // Effect to update AutoUI's local dataContext when the engine's dataContext changes
  useEffect(() => {
    if (state.dataContext && Object.keys(state.dataContext).length > 0) {
      if (JSON.stringify(dataContext) !== JSON.stringify(state.dataContext)) {
        console.log(
          "[AutoUI] Syncing local dataContext from engine state. New keys:",
          Object.keys(state.dataContext),
          "Old keys:",
          Object.keys(dataContext)
        );
        setDataContext(state.dataContext);
      }
    }
  }, [state.dataContext, dataContext]);

  // Effect to resolve bindings when state.layout or local dataContext changes
  useEffect(() => {
    const resolveAndSetLayout = async () => {
      const hasMeaningfulDataContext =
        dataContext &&
        Object.keys(dataContext).some(
          (key) =>
            key !== "user" ||
            Object.keys(dataContext["user"] as object).length > 0
        );

      if (state.layout && hasMeaningfulDataContext) {
        console.log(
          `[AutoUI resolveAndSetLayout] Calling core resolveBindings for layout ID: ${
            state.layout.id
          }. DataContext keys: ${Object.keys(dataContext).join(", ")}`
        );
        setIsResolvingBindings(true);
        setUiStatus("resolving_bindings");
        try {
          const correctedLayout = correctListBindingsRecursive(
            state.layout,
            dataContext
          );

          systemEvents.emit(
            createSystemEvent(SystemEventType.BINDING_RESOLUTION_START, {
              layout: correctedLayout, // Log corrected layout before resolving
            })
          );

          const resolved = await resolveBindings(correctedLayout, dataContext);
          setCurrentResolvedLayoutForRender(resolved);

          systemEvents.emit(
            createSystemEvent(SystemEventType.BINDING_RESOLUTION_COMPLETE, {
              originalLayout: correctedLayout, // Log corrected layout
              resolvedLayout: resolved,
            })
          );
        } catch (err) {
          console.error("Error resolving bindings:", err);
          setUiStatus("error");
          setCurrentResolvedLayoutForRender(null);
        } finally {
          setIsResolvingBindings(false);
          // setUiStatus("idle"); // Will be set by render effect or if no layout
        }
      } else {
        if (!state.layout)
          console.log(
            "[AutoUI] Skipping resolveBindings: state.layout is null/undefined"
          );
        if (!hasMeaningfulDataContext)
          console.log(
            "[AutoUI] Skipping resolveBindings: dataContext is not meaningfully populated yet"
          );
        setCurrentResolvedLayoutForRender(null);
        if (
          !state.loading &&
          uiStatus !== "initializing" &&
          !isResolvingBindings
        )
          setUiStatus("idle");
      }
    };

    resolveAndSetLayout();
  }, [state.layout, dataContext]); // Removed resolveLayoutBindings from deps, uiStatus

  // Effect to render the resolved layout
  useEffect(() => {
    const renderLayout = async () => {
      if (currentResolvedLayoutForRender && !isResolvingBindings) {
        setUiStatus("rendering");
        console.log(
          "[AutoUI Debug] Rendering with currentResolvedLayoutForRender:",
          JSON.stringify(currentResolvedLayoutForRender, null, 2)
        );
        try {
          systemEvents.emit(
            createSystemEvent(SystemEventType.RENDER_START, {
              layout: currentResolvedLayoutForRender,
            })
          );
          const rendered = await renderNode(
            currentResolvedLayoutForRender,
            componentAdapter as "shadcn",
            processEvent
          );
          setRenderedNode(rendered);
          systemEvents.emit(
            createSystemEvent(SystemEventType.RENDER_COMPLETE, {
              layout: currentResolvedLayoutForRender,
              renderTimeMs: 0, // Placeholder, actual timing would be more complex
            })
          );
          setUiStatus("idle");
        } catch (err) {
          console.error("Error rendering node:", err);
          setUiStatus("error");
        }
      } else if (
        !currentResolvedLayoutForRender &&
        !state.loading &&
        !isResolvingBindings &&
        uiStatus !== "initializing"
      ) {
        setRenderedNode(null);
        setUiStatus("idle");
      }
    };
    renderLayout();
  }, [
    currentResolvedLayoutForRender,
    componentAdapter,
    processEvent,
    isResolvingBindings,
    state.loading,
    uiStatus,
  ]);

  // Initial status setting
  useEffect(() => {
    // Set to initializing only once on mount if not already an error
    if (uiStatus !== "error") {
      setUiStatus("initializing");
    }
  }, []); // Empty dependency array means this runs once on mount

  // Handle transitions from initializing based on engine state
  useEffect(() => {
    if (uiStatus === "initializing") {
      if (state.loading) {
        // Still initializing or engine is fetching initial layout
      } else if (state.layout && !isResolvingBindings) {
        // Layout received, bindings might be resolving or done, defer to other effects
      } else if (!state.layout && !state.loading && !isResolvingBindings) {
        // No layout, not loading, not resolving -> idle (or error if state.error)
        if (state.error) {
          setUiStatus("error");
        } else {
          setUiStatus("idle");
        }
      }
    }
  }, [state.loading, state.layout, state.error, uiStatus, isResolvingBindings]);

  if (!componentsAvailable) {
    return (
      <div className="autoui-error p-4 border border-red-300 bg-red-50 text-red-700 rounded">
        <p className="font-medium">Component Library Not Found</p>
        <p className="text-sm whitespace-pre-line">
          {getMissingComponentsMessage()}
        </p>
      </div>
    );
  }

  const showShimmer =
    (uiStatus === "initializing" || state.loading || isResolvingBindings) &&
    !state.error;

  return (
    <div
      className={`autoui-root ${integration.className || ""}`}
      id={integration.id}
    >
      <div>Current Status: {uiStatus}</div>
      {uiStatus === "idle" && !isResolvingBindings && renderedNode && (
        <div className="autoui-content">{renderedNode}</div>
      )}
      {state.error && <div className="autoui-error">Error: {state.error}</div>}

      {showShimmer &&
        state.layout && ( // Show shimmer if we have a layout to base it on
          <div className="autoui-loading">
            {renderShimmer(state.layout, componentAdapter as "shadcn")}
          </div>
        )}
      {showShimmer &&
        !state.layout && ( // Fallback shimmer if no layout yet
          <div className="autoui-loading p-4">
            <div className="w-full h-20 bg-gray-200 animate-pulse rounded mb-4" />
            <div className="w-full h-40 bg-gray-200 animate-pulse rounded" />
          </div>
        )}
    </div>
  );
};
