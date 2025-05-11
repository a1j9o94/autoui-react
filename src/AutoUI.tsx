import React, { useState, useCallback, useRef, useEffect } from "react";
import { UIEvent, UISpecNode, UIEventType } from "./schema/ui";
import { useUIStateEngine } from "./core/state";
import { renderNode, renderShimmer } from "./core/renderer";
import { resolveBindings, DataContext, executeAction } from "./core/bindings";
import { EventManager, EventHook } from "./core/events";
import {
  SystemEventType,
  SystemEventHook,
  systemEvents,
} from "./core/system-events";
import { SchemaAdapter } from "./adapters/schema";
import {
  areShadcnComponentsAvailable,
  getMissingComponentsMessage,
} from "./core/component-detection";
import "./styles/autoui.css";

// Interface for DrizzleAdapterOptions
interface DrizzleAdapterOptions {
  schema: Record<string, unknown>;
  // Add other options as needed
}

export interface AutoUIProps {
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
  planningConfig?: {
    // Future planning depth (for v0.2)
    prefetchDepth?: number;
    // Custom temperature for the LLM (0.0 - 1.0)
    temperature?: number;
    // Whether to use streaming (otherwise wait for complete response)
    streaming?: boolean;
  };
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
  mockMode = true,
  databaseConfig,
  planningConfig,
  integration = {},
  scope = {},
  enablePartialUpdates = false,
}) => {
  // Initialize schema adapter if provided
  const [schemaAdapterInstance, setSchemaAdapterInstance] =
    useState<SchemaAdapter | null>(null);
  const [dataContext, setDataContext] = useState<DataContext>({});
  // Check if required components are available
  const [componentsAvailable, setComponentsAvailable] = useState(true);

  // Use direct schema as the effective schema
  const effectiveSchema = schema as Record<string, unknown>;
  const scopedGoal = goal;
  // Pass undefined for the router - it will use the default in the useUIStateEngine function

  // Check if required components are available
  useEffect(() => {
    if (componentAdapter === "shadcn") {
      setComponentsAvailable(areShadcnComponentsAvailable());
    }
  }, [componentAdapter]);

  // Register system event hooks
  useEffect(() => {
    const unregisters: Array<() => void> = [];

    // Register system event hooks
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

    // Debug mode - log all system events to console EXCEPT FOR RENDER_START
    // to prevent infinite rendering loops
    if (debugMode) {
      const debugHook: SystemEventHook = (event) => {
        console.debug(`[AutoUI Debug] System Event:`, event);
      };

      // Register for all system event types EXCEPT RENDER_START and BINDING_RESOLUTION_START
      // which can cause infinite loops when debugging
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

  // Initialize data context based on schema
  useEffect(() => {
    const initializeDataContext = async () => {
      let initialData: DataContext = {};

      if (schemaAdapterInstance) {
        // Use schema adapter to initialize data context
        initialData = await schemaAdapterInstance.initializeDataContext();
      } else if (effectiveSchema) {
        // Initialize with direct schema object
        Object.entries(effectiveSchema).forEach(([key, tableSchema]) => {
          // Add schema information
          initialData[key] = {
            schema: tableSchema,
            // For development, add sample data if available
            data: (tableSchema as any)?.sampleData || [],
            selected: null,
          };
        });
      }

      // Add user context if provided
      if (userContext) {
        initialData.user = userContext;
      }

      setDataContext(initialData);
    };

    initializeDataContext();
  }, [effectiveSchema, schemaAdapterInstance, userContext]);

  // Initialize the UI state engine with scoped goal
  const { state, handleEvent } = useUIStateEngine({
    schema: effectiveSchema,
    goal: scopedGoal,
    userContext,
    mockMode,
    planningConfig,
    router: undefined,
    dataContext,
    enablePartialUpdates,
  });

  // Create event manager
  const eventManagerRef = useRef(new EventManager());

  // Register event hooks
  useEffect(() => {
    if (!eventHooks) return;

    const unregisters: Array<() => void> = [];

    // Register global hooks
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

    // Register type-specific hooks
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

    // Cleanup on unmount or when hooks change
    return () => {
      unregisters.forEach((unregister) => unregister());
    };
  }, [eventHooks]);

  // Process events and update data context
  const processEvent = useCallback(
    async (event: UIEvent) => {
      // Process through event hooks
      const shouldProceed = await eventManagerRef.current.processEvent(event);

      // Call the external event handler if provided
      if (onEvent) {
        onEvent(event);
      }

      if (!shouldProceed) {
        console.info("Event processing was prevented by hooks", event);
        return;
      }

      // Find the event configuration in the layout tree
      const findNodeById = (
        node: UISpecNode | undefined | null,
        id: string
      ): UISpecNode | undefined => {
        if (!node) return undefined;
        if (node.id === id) return node;
        if (node.children) {
          for (const child of node.children) {
            const found = findNodeById(child, id);
            if (found) return found;
          }
        }
        return undefined;
      };

      const sourceNode = findNodeById(state.layout, event.nodeId);
      if (!sourceNode) {
        console.warn(`Node not found for event: ${event.nodeId}`);
        handleEvent(event);
        return;
      }

      // Get the event configuration
      const eventConfig = sourceNode.events?.[event.type];
      if (!eventConfig) {
        console.warn(
          `No event config found for ${event.type} on node ${event.nodeId}`
        );
        handleEvent(event);
        return;
      }

      // Execute the action and update data context
      const newContext = executeAction(
        eventConfig.action,
        eventConfig.target || "", // Provide empty string as fallback if target is null
        {
          ...eventConfig.payload,
          ...event.payload,
        },
        dataContext,
        state.layout || undefined
      );

      // Update the data context
      setDataContext(newContext);

      // Forward the event to the UI state engine
      handleEvent(event);
    },
    [dataContext, handleEvent, onEvent, state.layout]
  );

  // Resolve bindings for the layout using the current data context
  const [resolvedLayout, setResolvedLayout] = useState<UISpecNode | undefined>(
    undefined
  );
  // Add state for rendered node
  const [renderedNode, setRenderedNode] = useState<React.ReactElement | null>(
    null
  );

  // Update the resolved layout whenever state.layout or dataContext changes
  // Create a stable function to avoid constantly re-running the effect
  const resolveLayoutBindings = useCallback(async () => {
    if (state.layout) {
      try {
        const resolved = await resolveBindings(state.layout, dataContext);
        setResolvedLayout(resolved);
      } catch (err) {
        console.error("Error resolving bindings:", err);
      }
    } else {
      setResolvedLayout(undefined);
    }
  }, [state.layout, dataContext]);

  // Call the stable function in the effect
  useEffect(() => {
    resolveLayoutBindings();
  }, [resolveLayoutBindings]);

  // Handle async rendering of the node with a stable reference
  const renderResolvedLayout = useCallback(async () => {
    if (resolvedLayout) {
      try {
        const rendered = await renderNode(
          resolvedLayout,
          componentAdapter as "shadcn"
        );
        setRenderedNode(rendered);
      } catch (err) {
        console.error("Error rendering node:", err);
      }
    } else {
      setRenderedNode(null);
    }
  }, [resolvedLayout, componentAdapter]);

  // Call the stable render function in the effect
  useEffect(() => {
    renderResolvedLayout();
  }, [renderResolvedLayout]);

  // If components are not available, show error message
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

  // Render UI
  return (
    <div
      className={`autoui-root ${integration.className || ""}`}
      id={integration.id}
      data-mode={integration.mode}
      data-scope={scope?.type || "full"}
    >
      {state.loading || !resolvedLayout ? (
        // Render shimmer loading state
        <div className="autoui-loading">
          {state.layout ? (
            renderShimmer(state.layout, componentAdapter as "shadcn")
          ) : (
            <div className="autoui-shimmer-container">
              <div className="autoui-shimmer-header" />
              <div className="autoui-shimmer-content" />
            </div>
          )}
        </div>
      ) : (
        // Render the resolved layout
        <div className="autoui-content">{renderedNode}</div>
      )}

      {state.error && (
        <div className="autoui-error p-4 border border-red-300 bg-red-50 dark:bg-red-900 dark:border-red-700 rounded-md">
          <p className="autoui-error-title text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
            Error generating UI
          </p>
          <p className="autoui-error-message text-sm text-red-600 dark:text-red-300">
            {state.error}
          </p>

          {!mockMode && (
            <div className="mt-4 text-sm text-red-600 dark:text-red-300">
              <p>This could be because:</p>
              <ul className="list-disc pl-5 mt-2">
                <li>Your OpenAI API key is missing or invalid</li>
                <li>The OpenAI service is experiencing issues</li>
                <li>Your API rate limit has been exceeded</li>
              </ul>
              <p className="mt-2">
                Try setting <code>mockMode=true</code> to use sample data
                instead.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
