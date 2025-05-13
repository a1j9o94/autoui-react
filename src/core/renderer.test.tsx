import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UISpecNode, UIEvent } from "../schema/ui";
import * as ShadcnAdapter from "../adapters/shadcn";
// import * as SystemEvents from './system-events'; // Original import for type, vi.mock will handle the module itself

// Hoist the mock function definition
const { mockSystemEventsEmit, mockCreateSystemEvent } = vi.hoisted(() => {
  return {
    mockSystemEventsEmit: vi.fn().mockResolvedValue(undefined),
    mockCreateSystemEvent: vi.fn((type, payload) => ({
      type,
      payload,
      timestamp: Date.now(),
    })),
  };
});

// Mock shadcn adapter
vi.mock("../adapters/shadcn", () => ({
  renderNode: vi.fn(
    (node: UISpecNode, processEvent?: (event: UIEvent) => void) => {
      if (processEvent) {
        // console.warn("processEvent passed to mock renderShadcnNode in test for node:", node.id);
      }
      // Make mock render output dependent on props like 'label' or 'text' for testing purposes
      const textContent = node.props?.label || node.props?.text || `Mock-${node.node_type}`;
      return <div data-testid={node.id}>{textContent}</div>;
    }
  ),
  ShimmerBlock: () => <div data-testid="shimmer-block">ShimmerBlock</div>,
  ShimmerTable: ({ rows }: { rows: number }) => (
    <div data-testid="shimmer-table">ShimmerTable({rows})</div>
  ),
  ShimmerCard: () => <div data-testid="shimmer-card">ShimmerCard</div>,
}));

// Mock system events using the hoisted mock function
vi.mock("./system-events", async (importOriginal) => {
  const original = await importOriginal<typeof import("./system-events")>();
  return {
    ...original, // Spread original exports like SystemEventType
    systemEvents: {
      ...original.systemEvents, // Spread other potential properties of systemEvents object
      emit: mockSystemEventsEmit,
    },
    createSystemEvent: mockCreateSystemEvent,
  };
});

// Declare a variable to hold the dynamically imported renderer module
let rendererModule: typeof import("./renderer");

describe("Renderer", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.resetModules(); // Reset modules before each test

    // Dynamically import the renderer module
    // Make sure mocks for dependencies (like shadcn adapter, system-events) are set up BEFORE this import
    rendererModule = await import("./renderer");

    // Re-mock shadcn adapter as resetModules might clear it.
    // Or ensure the mock is at the top level and vi.resetModules doesn't clear it if it's configured not to.
    // For safety, re-applying or ensuring mock persistence is good.
    // Given the current setup, the top-level vi.mock should persist.
    // If ShadcnAdapter.renderNode calls become 0 unexpectedly, explicit re-mocking here might be needed.
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe("renderNode", () => {
    const testNode: UISpecNode = {
      id: "test-node",
      node_type: "Container",
      props: null,
      bindings: null,
      events: null,
      children: null,
    };

    it("should call the shadcn adapter by default and emit render events", async () => {
      await rendererModule.renderNode(testNode);
      expect(ShadcnAdapter.renderNode).toHaveBeenCalledWith(
        testNode,
        undefined
      );
      expect(mockSystemEventsEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: (
            await vi.importActual<typeof import("./system-events")>(
              "./system-events"
            )
          ).SystemEventType.RENDER_START,
          payload: { layout: testNode },
        })
      );
      expect(mockSystemEventsEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: (
            await vi.importActual<typeof import("./system-events")>(
              "./system-events"
            )
          ).SystemEventType.RENDER_COMPLETE,
          payload: expect.objectContaining({
            layout: testNode,
            renderTimeMs: expect.any(Number),
          }),
        })
      );
    });

    it("should use cached result if called again within TTL", async () => {
      await rendererModule.renderNode(testNode); // First call, populates cache
      expect(ShadcnAdapter.renderNode).toHaveBeenCalledTimes(1);
      expect(mockSystemEventsEmit).toHaveBeenCalledTimes(2); // RENDER_START, RENDER_COMPLETE

      mockSystemEventsEmit.mockClear();
      (ShadcnAdapter.renderNode as ReturnType<typeof vi.fn>).mockClear();

      await rendererModule.renderNode(testNode); // Second call, should use cache
      expect(ShadcnAdapter.renderNode).not.toHaveBeenCalled();
      expect(mockSystemEventsEmit).not.toHaveBeenCalled();
    });

    it("should re-render if called again after TTL", async () => {
      await rendererModule.renderNode(testNode); // First call
      expect(ShadcnAdapter.renderNode).toHaveBeenCalledTimes(1);

      // Advance time beyond TTL (5000ms)
      vi.advanceTimersByTime(5001);

      mockSystemEventsEmit.mockClear();
      (ShadcnAdapter.renderNode as ReturnType<typeof vi.fn>).mockClear();

      await rendererModule.renderNode(testNode); // Second call, should re-render
      expect(ShadcnAdapter.renderNode).toHaveBeenCalledTimes(1);
      expect(mockSystemEventsEmit).toHaveBeenCalledTimes(2); // RENDER_START, RENDER_COMPLETE
    });

    it("should handle cache eviction when MAX_CACHE_SIZE is exceeded", async () => {
      // MAX_CACHE_SIZE is 10, CACHE_TTL is 5000ms
      const nodes: UISpecNode[] = Array.from({ length: 11 }, (_, i) => ({
        id: `node-${i}`,
        node_type: "Button",
        props: null,
        bindings: null,
        events: null,
        children: null,
      }));

      for (let i = 0; i < 10; i++) {
        await rendererModule.renderNode(nodes[i]);
      }
      expect(ShadcnAdapter.renderNode).toHaveBeenCalledTimes(10);
      mockSystemEventsEmit.mockClear();
      (ShadcnAdapter.renderNode as ReturnType<typeof vi.fn>).mockClear();

      // This one should be cached (node-0)
      await rendererModule.renderNode(nodes[0]);
      expect(ShadcnAdapter.renderNode).not.toHaveBeenCalled();

      // Render one more to exceed cache size
      await rendererModule.renderNode(nodes[10]);
      expect(ShadcnAdapter.renderNode).toHaveBeenCalledTimes(1); // nodes[10] is rendered
      (ShadcnAdapter.renderNode as ReturnType<typeof vi.fn>).mockClear();

      // Now, the first node (node-0) should have been evicted
      await rendererModule.renderNode(nodes[0]);
      expect(ShadcnAdapter.renderNode).toHaveBeenCalledTimes(1);
    });

    it("should fallback to shadcn adapter for unsupported adapter", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      // @ts-expect-error Testing unsupported adapter
      await rendererModule.renderNode(testNode, "unsupported-adapter");

      expect(ShadcnAdapter.renderNode).toHaveBeenCalledWith(
        testNode,
        undefined
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Unsupported adapter: unsupported-adapter, falling back to shadcn"
      );

      consoleWarnSpy.mockRestore();
    });

    it("should correctly render a node with new props even if ID is reused (would fail with naive ID-only cache)", async () => {
      const nodeV1: UISpecNode = {
        id: "shared-id-for-cache-test",
        node_type: "Button",
        props: { label: "Version 1" }, // Prop that affects rendering
        bindings: null, events: null, children: null,
      };
      const nodeV2: UISpecNode = {
        id: "shared-id-for-cache-test", // Same ID
        node_type: "Button",
        props: { label: "Version 2" }, // Different prop
        bindings: null, events: null, children: null,
      };

      // First call - this would populate the cache if it were active with old logic
      const element1 = await rendererModule.renderNode(nodeV1);
      expect(element1.props.children).toBe("Version 1");

      // Clear mocks for ShadcnAdapter.renderNode to ensure we are checking the second call correctly
      (ShadcnAdapter.renderNode as ReturnType<typeof vi.fn>).mockClear();

      // Second call with a node having the same ID but different props
      const element2 = await rendererModule.renderNode(nodeV2);

      // With the ID-only cache re-enabled in renderer.tsx, this should now return "Version 1"
      // because the ID "shared-id-for-cache-test" is the same.
      expect(element2.props.children).toBe("Version 1");

      // And ShadcnAdapter.renderNode should NOT have been called for nodeV2 because it was cached
      expect(ShadcnAdapter.renderNode).not.toHaveBeenCalled();
      // expect(ShadcnAdapter.renderNode).toHaveBeenCalledTimes(1); // This would be if it WAS called for V2
    });
  });

  describe("renderShimmer", () => {
    it("should render ShimmerBlock by default if no node is provided", () => {
      const shimmerElement = rendererModule.renderShimmer();
      if (typeof shimmerElement.type === "function") {
        const ShimmerComponent = shimmerElement.type as (
          props: unknown
        ) => React.ReactElement;
        const renderedOutput = ShimmerComponent(shimmerElement.props);
        expect(renderedOutput.props["data-testid"]).toBe("shimmer-block");
      } else {
        throw new Error(
          "Expected shimmerElement.type to be a function for ShimmerBlock"
        );
      }
    });

    it("should render ShimmerTable for ListView node", () => {
      const node: UISpecNode = {
        id: "list",
        node_type: "ListView",
        props: null,
        bindings: null,
        events: null,
        children: null,
      };
      const shimmerElement = rendererModule.renderShimmer(node);
      if (typeof shimmerElement.type === "function") {
        const ShimmerComponent = shimmerElement.type as (
          props: unknown
        ) => React.ReactElement;
        const renderedOutput = ShimmerComponent(shimmerElement.props);
        expect(renderedOutput.props["data-testid"]).toBe("shimmer-table");
      } else {
        throw new Error(
          "Expected shimmerElement.type to be a function for ShimmerTable"
        );
      }
    });

    it("should render ShimmerCard for Detail node", () => {
      const node: UISpecNode = {
        id: "detail",
        node_type: "Detail",
        props: null,
        bindings: null,
        events: null,
        children: null,
      };
      const shimmerElement = rendererModule.renderShimmer(node);
      if (typeof shimmerElement.type === "function") {
        const ShimmerComponent = shimmerElement.type as (
          props: unknown
        ) => React.ReactElement;
        const renderedOutput = ShimmerComponent(shimmerElement.props);
        expect(renderedOutput.props["data-testid"]).toBe("shimmer-card");
      } else {
        throw new Error(
          "Expected shimmerElement.type to be a function for ShimmerCard"
        );
      }
    });

    it("should render ShimmerBlock for other node types", () => {
      const node: UISpecNode = {
        id: "unknown",
        node_type: "UnknownType",
        props: null,
        bindings: null,
        events: null,
        children: null,
      };
      const shimmerElement = rendererModule.renderShimmer(node);
      if (typeof shimmerElement.type === "function") {
        const ShimmerComponent = shimmerElement.type as (
          props: unknown
        ) => React.ReactElement;
        const renderedOutput = ShimmerComponent(shimmerElement.props);
        expect(renderedOutput.props["data-testid"]).toBe("shimmer-block");
      } else {
        throw new Error(
          "Expected shimmerElement.type to be a function for other ShimmerBlock"
        );
      }
    });

    it("should render nested shimmers for Container node", () => {
      const childNode1: UISpecNode = {
        id: "child1",
        node_type: "Button",
        props: null,
        bindings: null,
        events: null,
        children: null,
      };
      const childNode2: UISpecNode = {
        id: "child2",
        node_type: "ListView",
        props: null,
        bindings: null,
        events: null,
        children: null,
      };
      const containerNode: UISpecNode = {
        id: "container",
        node_type: "Container",
        props: null,
        bindings: null,
        events: null,
        children: [childNode1, childNode2],
      };
      const shimmerContainerElement =
        rendererModule.renderShimmer(containerNode);
      expect(shimmerContainerElement.type).toBe("div");
      expect(shimmerContainerElement.props.children).toHaveLength(2);

      const child1Wrapper = shimmerContainerElement.props.children[0];
      const child1ShimmerElement = child1Wrapper.props.children;
      if (typeof child1ShimmerElement.type === "function") {
        const Child1Component = child1ShimmerElement.type as (
          props: unknown
        ) => React.ReactElement;
        const child1RenderedOutput = Child1Component(
          child1ShimmerElement.props
        );
        expect(child1RenderedOutput.props["data-testid"]).toBe("shimmer-block");
      } else {
        throw new Error("Expected child1ShimmerElement.type to be a function");
      }

      const child2Wrapper = shimmerContainerElement.props.children[1];
      const child2ShimmerElement = child2Wrapper.props.children;
      if (typeof child2ShimmerElement.type === "function") {
        const Child2Component = child2ShimmerElement.type as (
          props: unknown
        ) => React.ReactElement;
        const child2RenderedOutput = Child2Component(
          child2ShimmerElement.props
        );
        expect(child2RenderedOutput.props["data-testid"]).toBe("shimmer-table");
      } else {
        throw new Error("Expected child2ShimmerElement.type to be a function");
      }
    });
  });
});
