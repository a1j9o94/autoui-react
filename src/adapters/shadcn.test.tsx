import React from "react";
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { render, fireEvent } from "@testing-library/react";
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

  beforeEach(() => {
    mockProcessEvent = vi.fn<[UIEvent], void>();
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
    // Check if the container div (rendered by the mock Container component) exists and has the class
    // The mock Container in shadcn.tsx adds 'autoui-mock-container'
    const containerDiv = container.querySelector(
      ".autoui-mock-container.test-container-class"
    );
    expect(containerDiv).toBeInTheDocument();
  });

  it("should render a ListView and handle item selection", () => {
    const items: Record<string, React.ReactNode>[] = [
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
    ];
    const fields = [{ key: "name", label: "Name" }];
    const listViewNode = createMockNode({
      id: "list-1",
      node_type: "ListView",
      bindings: { items, fields },
      props: { selectable: true },
      events: {
        CLICK: { action: "selectItem", target: "detailView", payload: null },
      },
    });

    const { getByText } = render(renderNode(listViewNode, mockProcessEvent));

    expect(getByText("Item 1")).toBeInTheDocument();
    expect(getByText("Item 2")).toBeInTheDocument();

    // Simulate click on the first item (row)
    // The mock Table uses onClick on <tr> for selection
    fireEvent.click(getByText("Item 1").closest("tr")!);

    expect(mockProcessEvent).toHaveBeenCalledOnce();
    expect(mockProcessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CLICK", // Mapped from onSelect in adapterMap
        nodeId: "list-1",
        payload: expect.objectContaining({
          selectedItem: items[0],
        }),
      })
    );
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
      bindings: { data, fields },
      props: { title: "Item Details" },
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
    const cardDiv = container.querySelector(
      ".autoui-mock-card.test-card-class"
    );
    expect(cardDiv).toBeInTheDocument();
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

  it("should render a Select and handle change", () => {
    const options = [
      { value: "1", label: "Option 1" },
      { value: "2", label: "Option 2" },
    ];
    const selectNode = createMockNode({
      id: "select-1",
      node_type: "Select",
      props: { name: "testSelect", label: "Test Select" },
      bindings: { options, value: "1" },
      events: { CHANGE: { action: "select", target: "state", payload: null } },
    });

    const { getByLabelText } = render(renderNode(selectNode, mockProcessEvent));
    const selectElement = getByLabelText("Test Select") as HTMLSelectElement;

    expect(selectElement.value).toBe("1");
    fireEvent.change(selectElement, { target: { value: "2" } });

    expect(mockProcessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CHANGE",
        nodeId: "select-1",
        payload: { value: "2" },
      })
    );
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

  it("should render a Checkbox and handle change", () => {
    const checkboxNode = createMockNode({
      id: "checkbox-1",
      node_type: "Checkbox",
      props: { name: "testCheckbox", label: "Test Checkbox" },
      bindings: { checked: false },
      events: { CHANGE: { action: "toggle", target: "state", payload: null } },
    });

    const { getByLabelText } = render(
      renderNode(checkboxNode, mockProcessEvent)
    );
    const checkboxElement = getByLabelText("Test Checkbox") as HTMLInputElement;

    expect(checkboxElement.checked).toBe(false);
    fireEvent.click(checkboxElement); // Use click for checkbox change

    expect(mockProcessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CHANGE",
        nodeId: "checkbox-1",
        payload: { checked: true },
      })
    );
  });

  it("should render a RadioGroup and handle change", () => {
    const options = [
      { value: "a", label: "Option A" },
      { value: "b", label: "Option B" },
    ];
    const radioGroupNode = createMockNode({
      id: "radio-1",
      node_type: "RadioGroup",
      props: { name: "testRadio", label: "Test Radio" },
      bindings: { options, value: "a" },
      events: { CHANGE: { action: "set", target: "state", payload: null } },
    });

    const { getByLabelText } = render(
      renderNode(radioGroupNode, mockProcessEvent)
    );
    const radioB = getByLabelText("Option B") as HTMLInputElement;

    expect(radioB.checked).toBe(false);
    fireEvent.click(radioB);

    expect(mockProcessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CHANGE",
        nodeId: "radio-1",
        payload: { value: "b" },
      })
    );
  });

  it("should render Tabs and handle change", () => {
    const tab1Content = createMockNode({
      id: "tab1-content",
      node_type: "Text",
      props: { text: "Tab 1 Content" },
    });
    const tab2Content = createMockNode({
      id: "tab2-content",
      node_type: "Text",
      props: { text: "Tab 2 Content" },
    });
    const tabs = [
      { value: "tab1", label: "Tab 1", content: tab1Content },
      { value: "tab2", label: "Tab 2", content: tab2Content },
    ];
    const tabsNode = createMockNode({
      id: "tabs-1",
      node_type: "Tabs",
      props: { defaultValue: "tab1" },
      bindings: { tabs },
      events: {
        CHANGE: { action: "switchTab", target: "view", payload: null },
      },
    });

    const { getByText } = render(renderNode(tabsNode, mockProcessEvent));

    expect(getByText("Tab 1 Content")).toBeInTheDocument();
    expect(getByText("Tab 2")).toBeInTheDocument(); // Tab label

    const tab2Button = getByText("Tab 2");
    fireEvent.click(tab2Button);

    // Check if event was fired (content change is handled internally by mock Tabs)
    expect(mockProcessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CHANGE",
        nodeId: "tabs-1",
        payload: { value: "tab2" },
      })
    );
    // We might need more sophisticated tests to check content switch depending on mock component
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
      props: { title: "Test Dialog" },
      bindings: { open: true },
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
    const headingNode = createMockNode({
      id: "heading-1",
      node_type: "Heading",
      props: { text: "Main Title", size: "h1" },
    });

    const { getByRole } = render(renderNode(headingNode, mockProcessEvent));

    const headingElement = getByRole("heading", { level: 1 });
    expect(headingElement).toHaveTextContent("Main Title");
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
