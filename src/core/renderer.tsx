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

// Simple LRU cache for rendered nodes to avoid re-rendering the same node multiple times
// This helps prevent infinite loops in the rendering process
const renderedNodesCache = new Map<
  string,
  { element: React.ReactElement; timestamp: number }
>();
const MAX_CACHE_SIZE = 10;
const CACHE_TTL = 5000; // 5 seconds

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
  const nodeId = node.id; // Cache Key

  // Check cache first
  const cachedItem = renderedNodesCache.get(nodeId);
  if (cachedItem && startTime - cachedItem.timestamp < CACHE_TTL) {
    // Return cached result if it's not too old
    return cachedItem.element;
  }

  // Emit render start event
  await systemEvents.emit(
    createSystemEvent(SystemEventType.RENDER_START, { layout: node })
  );

  // Select the right adapter based on the adapter parameter
  let result: React.ReactElement;

  switch (adapter) {
    case "shadcn":
      result = renderShadcnNode(node, processEvent);
      break;
    default:
      console.warn(`Unsupported adapter: ${adapter}, falling back to shadcn`);
      result = renderShadcnNode(node, processEvent);
  }

  // Emit render complete event
  await systemEvents.emit(
    createSystemEvent(SystemEventType.RENDER_COMPLETE, {
      layout: node,
      renderTimeMs: Date.now() - startTime,
    })
  );

  // Store in cache
  renderedNodesCache.set(nodeId, {
    element: result,
    timestamp: startTime,
  });

  // Clean cache if it gets too big
  if (renderedNodesCache.size > MAX_CACHE_SIZE) {
    // Delete oldest entry
    const oldestKey = [...renderedNodesCache.entries()].sort(
      ([, a], [, b]) => a.timestamp - b.timestamp
    )[0][0];
    renderedNodesCache.delete(oldestKey);
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
