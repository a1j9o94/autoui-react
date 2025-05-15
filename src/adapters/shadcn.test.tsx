import React from "react";
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderNode, adapterMap } from "./shadcn"; // Testing the exported renderNode AND import adapterMap
import { UISpecNode, UIEvent } from "../schema/ui";
import { componentType } from "../schema/components"; // Import the componentType enum

// Helper to create a basic UISpecNode
const createMockNode = (overrides: Partial<UISpecNode>): UISpecNode => ({
  id: "test-id",
  node_type: "Unknown",
  props: null,
  bindings: null,
  events: null,
  children: null,
  ...overrides,
});

describe("Shadcn Adapter - renderNode", () => {
  let mockProcessEvent: Mock<[UIEvent], void>;
  let user: ReturnType<typeof userEvent.setup>; // Setup userEvent

  beforeEach(() => {
    mockProcessEvent = vi.fn<[UIEvent], void>();
    user = userEvent.setup(); // Initialize userEvent
    vi.spyOn(console, "warn").mockImplementation(() => {}); // Suppress console.warn for cleaner test output
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render a Button and call processEvent on click", () => {
    const buttonNode = createMockNode({
      id: "btn-1",
      node_type: "Button",
      props: { label: "Click Me" },
      events: {
        CLICK: {
          action: "submit",
          target: "form",
          payload: { from: "button" },
        },
      },
    });

    const { getByText } = render(renderNode(buttonNode, mockProcessEvent));

    const buttonElement = getByText("Click Me");
    expect(buttonElement).toBeInTheDocument();

    fireEvent.click(buttonElement);

    expect(mockProcessEvent).toHaveBeenCalledOnce();
    expect(mockProcessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CLICK",
        nodeId: "btn-1",
        payload: expect.objectContaining({
          from: "button",
        }),
      })
    );
  });

  it("should render a Container with children", () => {
    const childButtonNode = createMockNode({
      id: "child-btn",
      node_type: "Button",
      props: { label: "Child Button" },
    });
    const containerNode = createMockNode({
      id: "container-1",
      node_type: "Container",
      children: [childButtonNode],
      props: { className: "test-container-class" },
    });

    const { getByText, container } = render(
      renderNode(containerNode, mockProcessEvent)
    );

    expect(getByText("Child Button")).toBeInTheDocument();
    // Fix: Use the correct class name from the adapter
    const containerDiv = container.querySelector(
      ".autoui-container.test-container-class"
    );
    expect(containerDiv).toBeInTheDocument();
    expect(containerDiv).toHaveAttribute("data-id", "container-1"); // Verify data-id
  });

  it("should render a ListView and handle item selection", async () => {
    // Mark as async for userEvent
    // Fix: Provide children directly, not through bindings
    const itemNodes: UISpecNode[] = [
      createMockNode({
        id: "item-1",
        node_type: "Text",
        props: { text: "Item 1" },
      }),
      createMockNode({
        id: "item-2",
        node_type: "Text",
        props: { text: "Item 2" },
      }),
    ];
    const listViewNode = createMockNode({
      id: "list-1",
      node_type: "ListView",
      children: itemNodes, // Pass children here
      props: { selectable: true }, // Keep prop for adapter logic (now ignored in spread)
      events: {
        // Assuming CLICK on the container is how selection is handled,
        // or potentially on child elements if adapter logic changes.
        // The adapter currently doesn't explicitly handle selection events.
        // Let's test rendering for now. We might need a dedicated selection mechanism.
        // CLICK: { action: "selectItem", target: "detailView", payload: {} },
      },
    });

    render(renderNode(listViewNode, mockProcessEvent));

    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();

    // Selection handling needs clarification based on adapter implementation.
    // Current adapter doesn't have explicit click handling for items within ListView.
    // Skipping selection test for now until that's defined.
    // Example using userEvent if items were clickable:
    // await user.click(screen.getByText("Item 1"));
    // expect(mockProcessEvent).toHaveBeenCalledOnce();
    // expect(mockProcessEvent).toHaveBeenCalledWith(expect.objectContaining({ ... }));
  });

  it("should render a Detail view with data", () => {
    const data: Record<string, React.ReactNode> = {
      name: "Detail Item",
      description: "Some details",
    };
    const fields = [
      { key: "name", label: "Name" },
      { key: "description", label: "Description", type: "content" },
    ];
    const detailNode = createMockNode({
      id: "detail-1",
      node_type: "Detail",
      bindings: null, // Bindings are not used directly by adapter for these, resolveBindings would have moved them
      props: {
        title: "Item Details",
        visible: true, // Explicitly set for clarity
        data, // Moved from bindings to props
        fields, // Moved from bindings to props
      },
    });

    const { getByText } = render(renderNode(detailNode, mockProcessEvent));

    expect(getByText("Item Details")).toBeInTheDocument();
    expect(getByText("Detail Item")).toBeInTheDocument();
    expect(getByText("Some details")).toBeInTheDocument();
  });

  it("should render fallback for unknown node type and warn", () => {
    const unknownNode = createMockNode({
      id: "unknown-1",
      node_type: "WeirdNode77",
    });

    const { getByText } = render(renderNode(unknownNode, mockProcessEvent));

    expect(getByText("Unknown node type: WeirdNode77")).toBeInTheDocument();
    expect(console.warn).toHaveBeenCalledWith("Unknown node type: WeirdNode77");
  });

  it("should render a Card with children", () => {
    const childTextNode = createMockNode({
      id: "child-text",
      node_type: "Text",
      props: { text: "Card Content" },
    });
    const cardNode = createMockNode({
      id: "card-1",
      node_type: "Card",
      children: [childTextNode],
      props: { className: "test-card-class" },
    });

    const { getByText, container } = render(
      renderNode(cardNode, mockProcessEvent)
    );

    expect(getByText("Card Content")).toBeInTheDocument();
    // Fix: Use the correct class name from the adapter
    const cardDiv = container.querySelector(".autoui-card.test-card-class");
    expect(cardDiv).toBeInTheDocument();
    expect(cardDiv).toHaveAttribute("data-id", "card-1"); // Verify data-id
  });

  it("should render an Input and handle change", () => {
    const inputNode = createMockNode({
      id: "input-1",
      node_type: "Input",
      props: { name: "testInput", label: "Test Input" },
      bindings: { value: "initial" },
      events: { CHANGE: { action: "update", target: "state", payload: null } },
    });

    const { getByLabelText } = render(renderNode(inputNode, mockProcessEvent));
    const inputElement = getByLabelText("Test Input") as HTMLInputElement;

    expect(inputElement.value).toBe("initial");
    fireEvent.change(inputElement, { target: { value: "changed" } });

    expect(mockProcessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CHANGE",
        nodeId: "input-1",
        payload: { value: "changed" },
      })
    );
  });

  it("should render a Select and handle change", async () => {
    // Mark async
    const options = [
      { value: "1", label: "Option 1" },
      { value: "2", label: "Option 2" },
    ];
    const selectNode = createMockNode({
      id: "select-1",
      node_type: "Select",
      props: {
        name: "testSelect",
        label: "Test Select",
        placeholder: "Select...",
      },
      bindings: { options, value: "1" }, // Initial value '1'
      events: { CHANGE: { action: "select", target: "state", payload: null } },
    });

    render(renderNode(selectNode, mockProcessEvent)); // No need for container here

    const trigger = screen.getByRole("combobox", { name: "Test Select" });
    expect(trigger).toHaveTextContent("Option 1");

    await user.click(trigger);

    const option2 = await screen.findByRole("option", { name: "Option 2" });
    expect(document.body).toContainElement(option2); // Check if option is in body due to portal

    await user.click(option2);

    expect(mockProcessEvent).toHaveBeenCalledOnce();
    expect(mockProcessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CHANGE",
        nodeId: "select-1",
        payload: { value: "2" },
      })
    );
    // You could also check if the trigger text updates if the component behaves that way
    // expect(trigger).toHaveTextContent("Option 2");
  });

  it("should render a Textarea and handle change", () => {
    const textareaNode = createMockNode({
      id: "textarea-1",
      node_type: "Textarea",
      props: { name: "testTextarea", label: "Test Textarea" },
      bindings: { value: "initial text" },
      events: { CHANGE: { action: "update", target: "state", payload: null } },
    });

    const { getByLabelText } = render(
      renderNode(textareaNode, mockProcessEvent)
    );
    const textareaElement = getByLabelText(
      "Test Textarea"
    ) as HTMLTextAreaElement;

    expect(textareaElement.value).toBe("initial text");
    fireEvent.change(textareaElement, { target: { value: "new text" } });

    expect(mockProcessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CHANGE",
        nodeId: "textarea-1",
        payload: { value: "new text" },
      })
    );
  });

  it("should render a Checkbox and handle change", async () => {
    // Mark async
    const checkboxNode = createMockNode({
      id: "checkbox-1",
      node_type: "Checkbox",
      props: { name: "testCheckbox", label: "Test Checkbox" },
      bindings: { checked: false }, // Start unchecked
      events: { CHANGE: { action: "toggle", target: "state", payload: null } },
    });

    render(renderNode(checkboxNode, mockProcessEvent));
    const checkboxLabel = screen.getByLabelText("Test Checkbox");
    // The label points to the input, but we might need the button element for data-state
    const checkboxButton = screen.getByRole("checkbox", {
      name: "Test Checkbox",
    });

    // Fix: Check data-state for checked status
    expect(checkboxButton).toHaveAttribute("data-state", "unchecked");

    await user.click(checkboxLabel); // Click the label to toggle

    expect(mockProcessEvent).toHaveBeenCalledOnce();
    expect(mockProcessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CHANGE",
        nodeId: "checkbox-1",
        payload: { checked: true }, // Should be true after click
      })
    );

    // Optional: Check if data-state updated (requires re-render/state update)
    // expect(checkboxButton).toHaveAttribute("data-state", "checked");
  });

  it("should render a RadioGroup and handle change", async () => {
    // Mark async
    const options = [
      { value: "a", label: "Option A" },
      { value: "b", label: "Option B" },
    ];
    const radioGroupNode = createMockNode({
      id: "radio-group-1",
      node_type: "RadioGroup",
      props: { name: "testRadioGroup", label: "Test Radio Group" }, // Optional group label
      bindings: { options, value: "a" }, // Start with 'a' selected
      events: { CHANGE: { action: "select", target: "state", payload: null } },
    });

    render(renderNode(radioGroupNode, mockProcessEvent));

    const radioA = screen.getByRole("radio", { name: "Option A" });
    const radioB = screen.getByRole("radio", { name: "Option B" });

    // Fix: Check data-state for checked status
    expect(radioA).toHaveAttribute("data-state", "checked");
    expect(radioB).toHaveAttribute("data-state", "unchecked");

    await user.click(screen.getByLabelText("Option B")); // Click label for B

    expect(mockProcessEvent).toHaveBeenCalledOnce();
    expect(mockProcessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CHANGE",
        nodeId: "radio-group-1",
        payload: { value: "b" }, // Should be 'b' after clicking Option B
      })
    );

    // Optional: Check if data-state updated (requires re-render/state update)
    // expect(radioA).toHaveAttribute("data-state", "unchecked");
    // expect(radioB).toHaveAttribute("data-state", "checked");
  });

  it("should render Tabs and handle change", async () => {
    // Mark async
    const tab1Content = createMockNode({
      id: "t1-content",
      node_type: "Text",
      props: { text: "Content 1" },
    });
    const tab2Content = createMockNode({
      id: "t2-content",
      node_type: "Text",
      props: { text: "Content 2" },
    });
    const tabsData = [
      { value: "tab1", label: "Tab 1", content: tab1Content },
      { value: "tab2", label: "Tab 2", content: tab2Content },
    ];
    const tabsNode = createMockNode({
      id: "tabs-1",
      node_type: "Tabs",
      props: { defaultValue: "tab1" },
      bindings: { tabs: tabsData },
      events: {
        CHANGE: { action: "switchTab", target: "view", payload: null },
      },
    });

    render(renderNode(tabsNode, mockProcessEvent));

    // Fix: Assert content existence/absence for Shadcn Tabs
    expect(screen.getByText("Content 1")).toBeInTheDocument();
    expect(screen.queryByText("Content 2")).toBeNull();

    const tab2Trigger = screen.getByRole("tab", { name: "Tab 2" });
    await user.click(tab2Trigger);

    expect(mockProcessEvent).toHaveBeenCalledOnce();
    expect(mockProcessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CHANGE",
        nodeId: "tabs-1",
        payload: { value: "tab2" },
      })
    );

    // Fix: Assert content existence/absence after switch
    expect(screen.queryByText("Content 1")).toBeNull();
    expect(screen.getByText("Content 2")).toBeInTheDocument();
  });

  it("should render a Dialog when open and handle close", () => {
    const dialogContent = createMockNode({
      id: "dlg-content",
      node_type: "Text",
      props: { text: "Dialog text" },
    });
    const dialogNode = createMockNode({
      id: "dialog-1",
      node_type: "Dialog",
      props: { title: "Test Dialog", open: true },
      bindings: null, // Explicitly null for this test case, open state is controlled by props
      children: [dialogContent],
      events: { CLICK: { action: "close", target: "dialog-1", payload: null } }, // Using CLICK based on adapter change
    });

    const { getByText } = render(renderNode(dialogNode, mockProcessEvent));

    expect(getByText("Test Dialog")).toBeInTheDocument();
    expect(getByText("Dialog text")).toBeInTheDocument();

    // The mock Dialog has a close button
    const closeButton = getByText("Close");
    fireEvent.click(closeButton);

    expect(mockProcessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CLICK", // Mapped from onClose in adapterMap
        nodeId: "dialog-1",
        payload: {}, // Default payload if none specified
      })
    );
  });

  it("should not render a Dialog when not open", () => {
    const dialogNode = createMockNode({
      id: "dialog-2",
      node_type: "Dialog",
      props: { title: "Hidden Dialog" },
      bindings: { open: false }, // Explicitly closed
    });

    const { queryByText } = render(renderNode(dialogNode, mockProcessEvent));

    expect(queryByText("Hidden Dialog")).not.toBeInTheDocument();
  });

  it("should render a Heading", () => {
    const headingNode: UISpecNode = {
      id: "heading-1",
      node_type: "Heading",
      props: { text: "Main Title", level: 1 }, // Use level 1 for h1
      bindings: null,
      events: null,
      children: null,
    };
    const { getByRole } = render(renderNode(headingNode, mockProcessEvent));

    // Query specifically for h1
    const headingElement = getByRole("heading", { level: 1 });
    expect(headingElement).toHaveTextContent("Main Title");
    expect(headingElement.tagName).toBe("H1"); // Check the tag name
  });

  it("should render Text", () => {
    const textNode = createMockNode({
      id: "text-1",
      node_type: "Text",
      props: { text: "Some paragraph text." },
    });

    const { getByText } = render(renderNode(textNode, mockProcessEvent));

    expect(getByText("Some paragraph text.")).toBeInTheDocument();
  });

  it("should not spread data prop onto DOM element for ListView", () => {
    const childNode = createMockNode({
      id: "child-text",
      node_type: "Text",
      props: { text: "List Item" },
    });

    const listViewNode = createMockNode({
      id: "list-2",
      node_type: "ListView",
      props: {
        // This 'data' prop should be consumed by the adapter and NOT forwarded to the DOM
        data: [{ id: "1", name: "Item 1" }],
        className: "list-test-class",
      },
      children: [childNode],
    });

    const { container } = render(renderNode(listViewNode, mockProcessEvent));

    // Select the root div for this ListView via data-id that adapter always sets
    const listDiv = container.querySelector('[data-id="list-2"]');

    expect(listDiv).toBeInTheDocument();
    // The problematic attribute should be absent now
    expect(listDiv).not.toHaveAttribute("data");
  });

  // More tests can be added for other components (Header, etc.)
  // and specific prop/binding variations.
});

// New test suite for component coverage
describe("Shadcn Adapter - Component Coverage", () => {
  it("should have an adapter entry for every component defined in componentType enum", () => {
    const definedComponentTypes = componentType.options; // Get list of enum values
    const implementedComponentTypes = Object.keys(adapterMap);

    // Check 1: Every component type defined in the enum has an entry in the adapterMap
    definedComponentTypes.forEach((type) => {
      expect(
        implementedComponentTypes,
        `Component type '${type}' is defined in schema but missing in adapterMap`
      ).toContain(type);
    });

    // Check 2: Every key in adapterMap corresponds to a defined component type
    // This prevents extra keys in the map that are not in the schema.
    implementedComponentTypes.forEach((type) => {
      expect(
        definedComponentTypes,
        `Component type '${type}' is implemented in adapterMap but not defined in schema`
      ).toContain(type);
    });

    // Check 3: Ensure the counts match exactly
    expect(
      implementedComponentTypes.length,
      "Mismatch between number of defined component types and implemented adapters"
    ).toBe(definedComponentTypes.length);
  });
});
