import React from 'react';
import { UISpecNode } from '../schema/ui';
import { renderNode as renderShadcnNode, ShimmerBlock, ShimmerTable, ShimmerCard } from '../adapters/shadcn';
import { createSystemEvent, systemEvents, SystemEventType } from './system-events';

/**
 * Renders a UI node using the appropriate adapter
 * @param node - UI specification node
 * @param adapter - Component adapter (default: "shadcn")
 * @returns React element
 */
export async function renderNode(
  node: UISpecNode,
  adapter: 'shadcn' = 'shadcn'
): Promise<React.ReactElement> {
  const startTime = Date.now();
  
  // Emit render start event
  await systemEvents.emit(
    createSystemEvent(SystemEventType.RENDER_START, { layout: node })
  );
  
  // Select the right adapter based on the adapter parameter
  let result: React.ReactElement;
  
  switch (adapter) {
    case 'shadcn':
      result = renderShadcnNode(node);
      break;
    default:
      console.warn(`Unsupported adapter: ${adapter}, falling back to shadcn`);
      result = renderShadcnNode(node);
  }
  
  // Emit render complete event
  await systemEvents.emit(
    createSystemEvent(SystemEventType.RENDER_COMPLETE, { 
      layout: node,
      renderTimeMs: Date.now() - startTime
    })
  );
  
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
  adapter: 'shadcn' = 'shadcn'
): React.ReactElement {
  // If no node, render a default shimmer
  if (!node) {
    return <ShimmerBlock />;
  }

  // Generate appropriate shimmer based on node type
  switch (node.type) {
    case 'ListView':
      return <ShimmerTable rows={3} />;
    case 'Detail':
      return <ShimmerCard />;
    case 'Container':
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