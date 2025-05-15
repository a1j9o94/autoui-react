import React from "react";
import { UISpecNode, UIEvent } from "../schema/ui";
import {
  renderNode as renderShadcnNode,
  ShimmerBlock,
  ShimmerTable,
  ShimmerCard,
} from "../adapters/shadcn";
import {
  createSystemEvent,
  systemEvents,
  SystemEventType,
} from "./system-events";

// This helps prevent infinite loops in the rendering process
const renderedNodesCache = new Map<
  string,
  { element: React.ReactElement; timestamp: number }
>();
const MAX_CACHE_SIZE = 10;
const CACHE_TTL = 5000; // 5 seconds

// Export for targeted cache clearing
export const clearRenderedNodeCacheEntry = (cacheKey: string) => {
  renderedNodesCache.delete(cacheKey);
  console.log(`[Renderer Cache] Cleared entry FOR REAL for key: ${cacheKey}`);
};

// Function to construct the cache key, can also be exported if needed elsewhere
export const getRendererCacheKey = (node: UISpecNode): string => {
  if (node.id === "task-detail") {
    // Simplified key for task-detail for more reliable cache invalidation
    const dataId = (node.props?.data as { id?: string | number })?.id;
    return `${node.id}:${node.props?.visible}:${dataId || "no-data-selected"}`;
  }

  // Default detailed key for other nodes
  let propsString = "null";
  try {
    propsString = JSON.stringify(node.props);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_e) {
    console.warn(
      `[Renderer Cache Key] Error stringifying node.props for ID ${node.id}, using 'null' for props part of key.`
    );
  }
  let bindingsString = "null";
  try {
    bindingsString = JSON.stringify(node.bindings);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_e) {
    console.warn(
      `[Renderer Cache Key] Error stringifying node.bindings for ID ${node.id}, using 'null' for bindings part of key.`
    );
  }
  return `${node.id}:${propsString}:${bindingsString}`;
};

/**
 * Renders a UI node using the appropriate adapter
 * @param node - UI specification node
 * @param adapter - Component adapter (default: "shadcn")
 * @param processEvent - Optional callback to handle UI events
 * @returns React element
 */
export async function renderNode(
  node: UISpecNode,
  adapter: "shadcn" = "shadcn",
  processEvent?: (event: UIEvent) => void
): Promise<React.ReactElement> {
  const startTime = Date.now();
  const cacheKey = getRendererCacheKey(node);
  const cachedItem = renderedNodesCache.get(cacheKey);

  // Standard Cache Check - RESTORED
  if (cachedItem && startTime - cachedItem.timestamp < CACHE_TTL) {
    return cachedItem.element;
  }

  // if (node.id === "task-detail") { // Log for task-detail (if needed for other diagnostics)
  //     console.log(`[Renderer renderNode] Cache MISS or expired for node: ${node.id}. Key: ${cacheKey}`);
  // }

  // MOVED THIS LOG UP: For task-detail, log BEFORE the RENDER_START event emission
  if (node.id === "task-detail") {
    let safeNodeString = "Error stringifying node for log";
    let propsToLog = "{}";
    try {
      const clonedProps = node.props ? { ...node.props } : {};
      if (clonedProps && clonedProps.data) {
        clonedProps.data = `Data present (type: ${typeof clonedProps.data}, logging suppressed)`;
      }
      if (clonedProps && Array.isArray(clonedProps.fields)) {
        clonedProps.fields = `Fields array (length: ${clonedProps.fields.length}, logging suppressed)`;
      } else if (clonedProps && clonedProps.fields) {
        clonedProps.fields = `Fields present (type: ${typeof clonedProps.fields}, logging suppressed)`;
      }
      propsToLog = JSON.stringify(clonedProps);

      const nodeToLog = {
        id: node.id,
        node_type: node.node_type,
        props: "See props above",
        bindings: node.bindings,
        events: node.events,
        children: node.children
          ? `Children array (length: ${node.children.length}, logging suppressed)`
          : null,
      };
      safeNodeString = JSON.stringify(nodeToLog);
    } catch (e: unknown) {
      if (e instanceof Error) {
        safeNodeString = `Error stringifying node for log: ${e.message}`;
      } else {
        safeNodeString = `Error stringifying node for log: Unknown error`;
      }
      if (node.props === undefined) propsToLog = "undefined";
      else if (node.props === null) propsToLog = "null";
    }
    console.log(
      `[Renderer renderNode BEFORE RENDER_START event] About to call adapter for task-detail. ID: ${
        node.id
      }, Visible: ${
        node.props?.visible
      }, Props (safe): ${propsToLog}, Bindings: ${JSON.stringify(
        node.bindings
      )}, Node (safe): ${safeNodeString}`
    );
  }

  await systemEvents.emit(
    createSystemEvent(SystemEventType.RENDER_START, { layout: node })
  );

  let result: React.ReactElement;

  switch (adapter) {
    case "shadcn":
      result = renderShadcnNode(node, processEvent);
      break;
    default:
      console.warn(`Unsupported adapter: ${adapter}, falling back to shadcn`);
      result = renderShadcnNode(node, processEvent);
  }

  if (node.id === "task-detail") {
    let elementType: string | undefined = undefined;
    if (result && typeof (result as React.ReactElement).type === "function") {
      elementType = ((result as React.ReactElement).type as { name: string })
        .name;
    } else if (
      result &&
      typeof (result as React.ReactElement).type === "string"
    ) {
      elementType = (result as React.ReactElement).type as string;
    } else if (
      result &&
      typeof (result as React.ReactElement).type === "object" &&
      (result as React.ReactElement).type !== null
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const componentType = (result as React.ReactElement).type as any;
      if (typeof componentType.displayName === "string") {
        elementType = componentType.displayName;
      }
    }
    console.log(
      `[Renderer renderNode] Adapter for task-detail returned element. Element type:`,
      elementType
    );
  }

  await systemEvents.emit(
    createSystemEvent(SystemEventType.RENDER_COMPLETE, {
      layout: node,
      renderTimeMs: Date.now() - startTime,
    })
  );

  // Store in cache - RESTORED
  renderedNodesCache.set(cacheKey, {
    element: result,
    timestamp: startTime,
  });

  // Clean cache if it gets too big - RESTORED
  if (renderedNodesCache.size > MAX_CACHE_SIZE) {
    // Delete oldest entry
    const oldestEntry = renderedNodesCache.entries().next().value;
    if (oldestEntry) {
      renderedNodesCache.delete(oldestEntry[0]);
    }
  }

  return result;
}

/**
 * Generates a shimmer placeholder for a UI node
 * @param node - UI specification node
 * @param adapter - Component adapter (default: "shadcn")
 * @returns React element
 */
export function renderShimmer(
  node?: UISpecNode,
  adapter: "shadcn" = "shadcn"
): React.ReactElement {
  // If no node, render a default shimmer
  if (!node) {
    return <ShimmerBlock />;
  }

  // Generate appropriate shimmer based on node type
  switch (node.node_type) {
    case "ListView":
      return <ShimmerTable rows={3} />;
    case "Detail":
      return <ShimmerCard />;
    case "Container":
      return (
        <div className="space-y-4">
          {node.children?.map((child, index) => (
            <div key={index}>{renderShimmer(child, adapter)}</div>
          ))}
        </div>
      );
    default:
      return <ShimmerBlock />;
  }
}
