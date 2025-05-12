import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import {
  getValueByPath,
  setValueByPath,
  processBinding,
  resolveBindings,
  DataContext,
} from "./bindings"; // Adjust path as necessary
import { UISpecNode } from "../schema/ui"; // Re-added
import * as SystemEvents from "./system-events"; // Import to mock

// Define a more specific structure for the test context
interface TestContextStructure {
  [key: string]: unknown; // Changed from any to unknown
  user: {
    id: string;
    name: string;
    details: {
      isAdmin: boolean;
      preferences: {
        theme: string;
      };
      newProp?: { deep: boolean }; // For testing creation
    };
  };
  items: { id: string; value: number }[];
  selectedItemId: string;
  settings: { enabled?: boolean } | null;
  config: {
    featureFlags: string[];
  };
  newRoot?: {
    // For testing creation
    level1: {
      level2: string;
    };
  };
  directValue: number;
  anotherValue: string;
  // Add index signature if needed for direct assignment compatibility, though casting is safer
  // [key: string]: any;
}

// Mock the system events module
vi.mock("./system-events", () => ({
  systemEvents: {
    emit: vi.fn().mockResolvedValue(undefined),
  },
  createSystemEvent: (type: string, payload: unknown) => ({
    type,
    payload,
    timestamp: Date.now(),
  }),
  SystemEventType: {
    BINDING_RESOLUTION_START: "BINDING_RESOLUTION_START",
    BINDING_RESOLUTION_COMPLETE: "BINDING_RESOLUTION_COMPLETE",
    // Add other event types if needed by bindings logic, though likely not
  },
}));

describe("Data Context Utilities", () => {
  let testContext: TestContextStructure;

  beforeEach(() => {
    testContext = {
      user: {
        id: "user-123",
        name: "Alice",
        details: {
          isAdmin: true,
          preferences: {
            theme: "dark",
          },
        },
      },
      items: [
        { id: "item-1", value: 100 },
        { id: "item-2", value: 200 },
      ],
      selectedItemId: "item-1",
      settings: null, // Test handling null
      config: {
        featureFlags: ["flagA", "flagB"],
      },
      directValue: 42,
      anotherValue: "hello world",
    };
  });

  // ====================================
  // getValueByPath Tests
  // ====================================
  describe("getValueByPath", () => {
    it("should get top-level values", () => {
      expect(getValueByPath(testContext, "selectedItemId")).toBe("item-1");
    });

    it("should get nested values using dot notation", () => {
      expect(getValueByPath(testContext, "user.name")).toBe("Alice");
      expect(getValueByPath(testContext, "user.details.isAdmin")).toBe(true);
      expect(
        getValueByPath(testContext, "user.details.preferences.theme")
      ).toBe("dark");
    });

    it("should return undefined for non-existent paths", () => {
      expect(getValueByPath(testContext, "user.nonExistent")).toBeUndefined();
      expect(
        getValueByPath(testContext, "completely.made.up.path")
      ).toBeUndefined();
    });

    it("should return undefined when path traverses through null or undefined", () => {
      expect(getValueByPath(testContext, "settings.someProp")).toBeUndefined(); // settings is null
      expect(
        getValueByPath(testContext, "user.details.nonExistent.deep")
      ).toBeUndefined();
    });

    it("should return undefined when path traverses through a non-object", () => {
      expect(getValueByPath(testContext, "user.name.length")).toBeUndefined(); // name is a string
      expect(getValueByPath(testContext, "selectedItemId.id")).toBeUndefined(); // selectedItemId is a string
    });

    it("should get array values", () => {
      // Cast DataContext to TestContextStructure for assertion
      const ctx = testContext as TestContextStructure;
      expect(getValueByPath(testContext as DataContext, "items")).toEqual(
        ctx.items
      );
      expect(getValueByPath(testContext as DataContext, "items.0")).toEqual(
        ctx.items[0]
      );
      expect(
        getValueByPath(testContext as DataContext, "config.featureFlags")
      ).toEqual(ctx.config.featureFlags);
    });
  });

  // ====================================
  // setValueByPath Tests
  // ====================================
  describe("setValueByPath", () => {
    it("should set top-level values", () => {
      // Cast result for specific assertions
      const updatedContext = setValueByPath(
        testContext,
        "selectedItemId",
        "item-2"
      ) as TestContextStructure;
      expect(updatedContext.selectedItemId).toBe("item-2");
      expect(testContext.selectedItemId).toBe("item-1");
    });

    it("should set nested values using dot notation", () => {
      let updatedContext = setValueByPath(testContext, "user.name", "Bob");
      // Cast intermediate result if needed for chaining setValueByPath, or final for assertion
      updatedContext = setValueByPath(
        updatedContext,
        "user.details.isAdmin",
        false
      );
      updatedContext = setValueByPath(
        updatedContext,
        "user.details.preferences.theme",
        "light"
      );

      // Cast final result for assertion
      const finalContext = updatedContext as TestContextStructure;
      expect(finalContext.user.name).toBe("Bob");
      expect(finalContext.user.details.isAdmin).toBe(false);
      expect(finalContext.user.details.preferences.theme).toBe("light");
      // Assert original context is unchanged
      expect(testContext.user.name).toBe("Alice");
    });

    it("should create intermediate objects if they dont exist", () => {
      let updatedContext = setValueByPath(
        testContext,
        "newRoot.level1.level2",
        "value"
      );
      updatedContext = setValueByPath(
        updatedContext,
        "user.details.newProp.deep",
        true
      );

      const finalContext = updatedContext as TestContextStructure;
      expect(finalContext.newRoot).toBeDefined();
      expect(finalContext.newRoot?.level1.level2).toBe("value");
      expect(finalContext.user.details.newProp).toBeDefined();
      expect(finalContext.user.details.newProp?.deep).toBe(true);
      expect(testContext.newRoot).toBeUndefined();
      expect(testContext.user.details.newProp).toBeUndefined();
    });

    it("should overwrite existing values", () => {
      const updatedContext = setValueByPath(
        testContext,
        "user.id",
        "user-456"
      ) as TestContextStructure;
      expect(updatedContext.user.id).toBe("user-456");
    });

    it("should handle setting values on paths starting with null", () => {
      const updatedContext = setValueByPath(
        testContext,
        "settings.enabled",
        true
      ) as TestContextStructure;
      expect(updatedContext.settings).toEqual({ enabled: true });
      expect(testContext.settings).toBeNull();
    });

    it("should return original context if path leads to non-object intermediate", () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const updatedContext = setValueByPath(
        testContext,
        "user.name.someProp",
        "value"
      );
      expect(updatedContext).toEqual(testContext);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Cannot create nested path "user.name.someProp". Segment "name" is not an object'
        )
      );
      consoleWarnSpy.mockRestore();
    });

    it("should handle empty path", () => {
      const updatedContext = setValueByPath(testContext, "", "new value");
      expect(updatedContext).toEqual(testContext);
    });
  });
});

describe("processBinding", () => {
  let context: TestContextStructure;
  let itemData: Record<string, unknown>;

  beforeEach(() => {
    // Re-initialize context for each test
    context = {
      user: {
        id: "user-123",
        name: "Alice",
        details: {
          isAdmin: true,
          preferences: { theme: "dark" },
        },
      },
      items: [
        { id: "item-1", value: 100 },
        { id: "item-2", value: 200 },
      ],
      selectedItemId: "item-1",
      settings: null,
      config: {
        featureFlags: ["flagA", "flagB"],
      },
      directValue: 42,
      anotherValue: "hello world",
    };

    itemData = {
      id: "item-current",
      value: 500,
      label: "Current Item Label",
      nested: {
        prop: "item-prop",
      },
    };
  });

  it("should resolve path strings from context (when not a template string)", () => {
    // processBinding now resolves paths, so it should return the resolved value
    expect(processBinding("user.name", context)).toBe("Alice");
    expect(processBinding("directValue", context)).toBe(42);
    expect(processBinding("nonexistent.path", context)).toBe(undefined);
  });

  it("should resolve template strings from context", () => {
    expect(processBinding("{{user.name}}", context)).toBe("Alice");
    expect(processBinding("{{user.details.preferences.theme}}", context)).toBe(
      "dark"
    );
    expect(processBinding("{{directValue}}", context)).toBe(42);
    expect(processBinding("{{nonexistent.path}}", context)).toBeUndefined();
  });

  it("should resolve template strings from itemData primarily (direct access)", () => {
    expect(processBinding("{{id}}", context, itemData)).toBe("item-current");
    expect(processBinding("{{label}}", context, itemData)).toBe(
      "Current Item Label"
    );
    // Accessing nested prop within itemData directly
    expect(
      processBinding("{{nested.prop}}", context, itemData)
    ).toBeUndefined(); // Direct nested access like this isn't supported without 'item.' prefix
  });

  it("should resolve template strings with item. or row. prefix from itemData", async () => {
    expect(processBinding("{{item.id}}", context, itemData)).toBe(
      "item-current"
    );
    expect(processBinding("{{item.value}}", context, itemData)).toBe(500);
    expect(processBinding("{{item.label}}", context, itemData)).toBe(
      "Current Item Label"
    );
    expect(processBinding("{{item.nested.prop}}", context, itemData)).toBe(
      "item-prop"
    );
    expect(
      processBinding("{{item.nonexistent}}", context, itemData)
    ).toBeUndefined();

    // Added tests for 'row.' prefix
    expect(processBinding("{{row.id}}", context, itemData)).toBe(
      "item-current"
    );
    expect(processBinding("{{row.value}}", context, itemData)).toBe(500);
    expect(processBinding("{{row.label}}", context, itemData)).toBe(
      "Current Item Label"
    );
    expect(processBinding("{{row.nested.prop}}", context, itemData)).toBe(
      "item-prop"
    );
    expect(
      processBinding("{{row.nonexistent}}", context, itemData)
    ).toBeUndefined();
  });

  it("should resolve template strings falling back to context if not in itemData", () => {
    // 'user.id' exists in context, not in itemData
    expect(processBinding("{{user.id}}", context, itemData)).toBe("user-123");
    // 'directValue' exists in context, not in itemData
    expect(processBinding("{{directValue}}", context, itemData)).toBe(42);
    // 'item.id' exists in itemData, should be resolved from there
    expect(processBinding("{{item.id}}", context, itemData)).toBe(
      "item-current"
    );
    // 'id' exists in itemData (direct), should resolve from there first
    expect(processBinding("{{id}}", context, itemData)).toBe("item-current");
  });

  it("should resolve arrays recursively", () => {
    const binding = [
      "{{user.name}}",
      { nested: "{{item.value}}" },
      "non-template",
      "{{nonexistent}}",
    ];
    const expected = ["Alice", { nested: 500 }, undefined, undefined];
    expect(processBinding(binding, context, itemData)).toEqual(expected);
  });

  it("should resolve objects recursively", () => {
    const binding = {
      userName: "{{user.name}}",
      itemId: "{{item.id}}",
      itemValue: "{{item.value}}",
      theme: "{{user.details.preferences.theme}}",
      direct: "{{directValue}}",
      missing: "{{nonexistent.deep}}",
      literal: "plain string",
      nested: {
        deepItemId: "{{item.id}}",
      },
    };
    const expected = {
      userName: "Alice",
      itemId: "item-current",
      itemValue: 500,
      theme: "dark",
      direct: 42,
      missing: undefined,
      literal: undefined,
      nested: {
        deepItemId: "item-current",
      },
    };
    expect(processBinding(binding, context, itemData)).toEqual(expected);
  });

  it("should return non-string, non-array, non-object bindings as-is", () => {
    expect(processBinding(123, context, itemData)).toBe(123);
    expect(processBinding(true, context, itemData)).toBe(true);
    expect(processBinding(null, context, itemData)).toBeNull();
    expect(processBinding(undefined, context, itemData)).toBeUndefined();
    // Already tested objects/arrays above
  });

  it("should resolve embedded template strings", () => {
    expect(
      processBinding("User: {{user.name}} ({{user.id}})", context, itemData)
    ).toBe("User: Alice (user-123)");
    expect(
      processBinding(
        "Item: {{item.label}} - Value: {{item.value}}",
        context,
        itemData
      )
    ).toBe("Item: Current Item Label - Value: 500");
    // Test mixing context and item data
    expect(
      processBinding("{{user.name}} has item {{item.id}}", context, itemData)
    ).toBe("Alice has item item-current");
    // Test with no templates (should be treated as path)
    expect(
      processBinding("Just a plain string", context, itemData)
    ).toBeUndefined(); // Tries to resolve "Just a plain string" as a path
    // Test with unresolved templates (should become empty string)
    expect(
      processBinding(
        "Missing: {{nonexistent}} and {{item.missing}}",
        context,
        itemData
      )
    ).toBe("Missing:  and "); // Resolves to empty strings
  });
});

describe("resolveBindings", () => {
  let context: TestContextStructure;
  let baseNode: UISpecNode;

  beforeEach(() => {
    context = {
      user: {
        id: "user-123",
        name: "Alice",
        details: {
          isAdmin: true,
          preferences: { theme: "dark" },
        },
      },
      items: [
        { id: "item-1", value: 100 },
        { id: "item-2", value: 200 },
      ],
      selectedItemId: "item-1",
      settings: null,
      config: {
        featureFlags: ["flagA", "flagB"],
      },
      directValue: 42,
      anotherValue: "hello world",
    } as TestContextStructure; // Cast to ensure all props are seen by TS based on interface

    baseNode = {
      id: "test-node-1",
      node_type: "Text",
      props: { initialProp: "initial" },
      bindings: {},
      events: null,
      children: null,
    };

    // Clear mock call history before each test for systemEvents.emit
    (SystemEvents.systemEvents.emit as Mock).mockClear();
  });

  it("should resolve simple prop bindings", async () => {
    const node: UISpecNode = {
      ...baseNode,
      bindings: {
        text: "user.name", // Simple path
        numericValue: "directValue", // Simple path
        stringValue: "anotherValue", // Simple path
      },
    };

    const resolvedNode = await resolveBindings(node, context);

    expect(resolvedNode.props).toBeDefined();
    expect(resolvedNode.props?.text).toBe("Alice");
    expect(resolvedNode.props?.numericValue).toBe(42);
    expect(resolvedNode.props?.stringValue).toBe("hello world");
    // Ensure initial props are preserved if not overridden by a binding
    expect(resolvedNode.props?.initialProp).toBe("initial");
  });

  it("should resolve template string prop bindings", async () => {
    const node: UISpecNode = {
      ...baseNode,
      id: "test-node-template-bindings",
      bindings: {
        userName: "{{user.name}}", // Template string
        themePref: "{{user.details.preferences.theme}}", // Nested template
        userId: "{{user.id}}",
        missing: "{{nonexistent.path}}", // Template for non-existent path
        // Note: processBinding currently only resolves pure '{{...}}' strings,
        // not embedded ones like "User: {{user.name}}".
        // If that feature were added, a test case for it would go here.
      },
    };

    const resolvedNode = await resolveBindings(node, context);

    expect(resolvedNode.props).toBeDefined();
    expect(resolvedNode.props?.userName).toBe("Alice");
    expect(resolvedNode.props?.themePref).toBe("dark");
    expect(resolvedNode.props?.userId).toBe("user-123");
    // Bindings resolving to undefined should not be added to props
    expect(resolvedNode.props?.missing).toBeUndefined();
    // Ensure initial props are preserved
    expect(resolvedNode.props?.initialProp).toBe("initial");
  });

  it("should recursively resolve bindings in children", async () => {
    const node: UISpecNode = {
      id: "parent-node-recursive",
      node_type: "Container",
      props: { layout: "column" },
      bindings: { parentProp: "directValue" }, // Parent binding
      events: null,
      children: [
        {
          id: "child-node-1",
          node_type: "Text",
          props: { initial: "child1" },
          bindings: { value: "user.name" }, // Child simple binding
          events: null,
          children: null,
        },
        {
          id: "child-node-2",
          node_type: "TextInput",
          props: { label: "User ID" },
          bindings: { defaultValue: "{{user.id}}" }, // Child template binding
          events: null,
          children: null,
        },
        {
          id: "child-node-3-nested",
          node_type: "Container",
          props: {},
          bindings: {},
          events: null,
          children: [
            {
              id: "grandchild-node",
              node_type: "Text",
              props: {},
              bindings: { content: "{{user.details.preferences.theme}}" }, // Grandchild template binding
              events: null,
              children: null,
            },
          ],
        },
      ],
    };

    const resolvedNode = await resolveBindings(node, context);

    // Check parent
    expect(resolvedNode.props?.parentProp).toBe(42);
    expect(resolvedNode.props?.layout).toBe("column"); // Original prop preserved

    // Check children
    expect(resolvedNode.children).toHaveLength(3);
    const child1 = resolvedNode.children?.[0];
    const child2 = resolvedNode.children?.[1];
    const child3 = resolvedNode.children?.[2];

    expect(child1?.props?.value).toBe("Alice");
    expect(child1?.props?.initial).toBe("child1"); // Original prop preserved

    expect(child2?.props?.defaultValue).toBe("user-123");
    expect(child2?.props?.label).toBe("User ID"); // Original prop preserved

    // Check grandchild
    expect(child3?.children).toHaveLength(1);
    const grandchild1 = child3?.children?.[0];
    expect(grandchild1?.props?.content).toBe("dark");
  });

  it("should expand ListView children based on data binding array", async () => {
    // Context has context.items = [{ id: "item-1", value: 100 }, { id: "item-2", value: 200 }];
    const node: UISpecNode = {
      id: "list-view-expansion",
      node_type: "ListView", // Should trigger list expansion
      props: { style: "list-style" },
      bindings: {
        data: "items", // Bind to the array in the context
      },
      events: null,
      children: [
        // Template child
        {
          id: "list-item-template",
          node_type: "ListItem",
          props: { staticProp: "template" }, // Static prop to check cloning
          bindings: { title: "{{user.name}}" }, // Binding NOT using item, resolved from main context
          events: null,
          children: null,
        },
      ],
    };

    const resolvedNode = await resolveBindings(node, context);

    // Check parent props
    expect(resolvedNode.props?.style).toBe("list-style");
    expect(resolvedNode.bindings?.data).toBeUndefined(); // Original data binding should ideally be removed or ignored

    // Check children length matches data source
    expect(resolvedNode.children).toBeDefined();
    expect(resolvedNode.children).toHaveLength(context.items.length); // Should be 2

    // Check if children are clones of the template
    const child1 = resolvedNode.children?.[0];
    const child2 = resolvedNode.children?.[1];

    expect(child1?.node_type).toBe("ListItem");
    expect(child1?.props?.staticProp).toBe("template");
    // Check binding resolved from *main* context (not item context yet)
    expect(child1?.props?.title).toBe("Alice");

    expect(child2?.node_type).toBe("ListItem");
    expect(child2?.props?.staticProp).toBe("template");
    expect(child2?.props?.title).toBe("Alice");

    // Check unique IDs (though key prop is tested separately)
    expect(child1?.id).not.toBe("list-item-template");
    expect(child2?.id).not.toBe("list-item-template");
    expect(child1?.id).not.toBe(child2?.id);
  });

  it("should resolve bindings within expanded list items using itemData", async () => {
    // Context has context.items = [{ id: "item-1", value: 100 }, { id: "item-2", value: 200 }];
    const node: UISpecNode = {
      id: "list-view-item-data",
      node_type: "ListView",
      props: {},
      bindings: {
        data: "items", // Bind to the array in the context
      },
      events: null,
      children: [
        // Template child with item-specific bindings
        {
          id: "item-template-data",
          node_type: "ListItem",
          props: {},
          bindings: {
            itemId: "{{item.id}}",
            itemValue: "{{item.value}}",
            // Mix with context binding to ensure it still works
            userName: "{{user.name}}",
          },
          events: null,
          children: null,
        },
      ],
    };

    const resolvedNode = await resolveBindings(node, context);

    expect(resolvedNode.children).toHaveLength(2);
    const child1 = resolvedNode.children?.[0];
    const child2 = resolvedNode.children?.[1];

    // Check child 1 - resolved using context.items[0] = { id: "item-1", value: 100 }
    expect(child1?.props?.itemId).toBe("item-1");
    expect(child1?.props?.itemValue).toBe(100);
    expect(child1?.props?.userName).toBe("Alice"); // Resolved from main context

    // Check child 2 - resolved using context.items[1] = { id: "item-2", value: 200 }
    expect(child2?.props?.itemId).toBe("item-2");
    expect(child2?.props?.itemValue).toBe(200);
    expect(child2?.props?.userName).toBe("Alice"); // Resolved from main context

    // Check IDs are unique instances
    expect(child1?.id).toBe("item-template-data-item-1");
    expect(child2?.id).toBe("item-template-data-item-2");
  });

  it("should add key prop to expanded list items", async () => {
    const listData = [
      { id: "key-item-1", value: "has id" },
      { value: "no id" }, // Item without an id field
      { id: 123, value: "numeric id" }, // Item with numeric id
    ];
    const testContextWithList = {
      ...context,
      listForKeys: listData,
    };

    const node: UISpecNode = {
      id: "list-view-key-prop",
      node_type: "ListView",
      props: {},
      bindings: {
        data: "listForKeys", // Bind to the array with mixed item types
      },
      events: null,
      children: [
        // Simple template child
        {
          id: "key-item-template",
          node_type: "ListItem",
          props: {},
          bindings: { value: "{{item.value}}" },
          events: null,
          children: null,
        },
      ],
    };

    const resolvedNode = await resolveBindings(node, testContextWithList);

    expect(resolvedNode.children).toHaveLength(3);
    const child1 = resolvedNode.children?.[0];
    const child2 = resolvedNode.children?.[1];
    const child3 = resolvedNode.children?.[2];

    // Check key prop presence and value
    expect(child1?.props?.key).toBeDefined();
    expect(child1?.props?.key).toBe("key-item-1"); // Should use item.id

    expect(child2?.props?.key).toBeDefined();
    // Fallback key format defined in resolveBindings: `${node.id}-item-${index}`
    expect(child2?.props?.key).toBe("list-view-key-prop-item-1"); // Should use fallback (index 1)

    expect(child3?.props?.key).toBeDefined();
    expect(child3?.props?.key).toBe(123); // Should use numeric item.id
  });

  it("should handle empty data array for list expansion", async () => {
    const emptyListContext = {
      ...context,
      emptyList: [],
    };

    const node: UISpecNode = {
      id: "list-view-empty",
      node_type: "ListView",
      props: {},
      bindings: {
        data: "emptyList", // Bind to the empty array
      },
      events: null,
      children: [
        // Template child (should not be used)
        {
          id: "empty-item-template",
          node_type: "ListItem",
          props: {},
          bindings: { value: "{{item.value}}" },
          events: null,
          children: null,
        },
      ],
    };

    const resolvedNode = await resolveBindings(node, emptyListContext);

    expect(resolvedNode.children).toBeDefined();
    expect(resolvedNode.children).toBeInstanceOf(Array);
    expect(resolvedNode.children).toHaveLength(0); // Expect exactly zero children
  });

  it("should handle non-object items in list data array", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const mixedListData = [
      { id: "item-good-1", value: "object1" },
      "string-item", // Invalid item
      null, // Invalid item
      { id: "item-good-2", value: "object2" },
      123, // Invalid item
      undefined, // Invalid item
    ];
    const testContextMixedList = {
      ...context,
      mixedList: mixedListData,
    };

    const node: UISpecNode = {
      id: "list-view-mixed",
      node_type: "ListView",
      props: {},
      bindings: {
        data: "mixedList",
      },
      events: null,
      children: [
        {
          id: "mixed-item-template",
          node_type: "ListItem",
          props: {},
          bindings: { value: "{{item.value}}" },
          events: null,
          children: null,
        },
      ],
    };

    const resolvedNode = await resolveBindings(node, testContextMixedList);

    // Should only contain children for the valid object items
    expect(resolvedNode.children).toHaveLength(2);
    expect(resolvedNode.children?.[0]?.props?.value).toBe("object1");
    expect(resolvedNode.children?.[1]?.props?.value).toBe("object2");

    // Check that warnings were logged for skipped items
    expect(consoleWarnSpy).toHaveBeenCalledTimes(4);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("not an object"),
      "string-item"
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("not an object"),
      null
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("not an object"),
      123
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("not an object"),
      undefined
    );

    consoleWarnSpy.mockRestore();
  });

  it("should emit start and complete events for non-item resolution", async () => {
    const node: UISpecNode = {
      ...baseNode,
      id: "simple-node-events",
      bindings: { text: "user.name" },
    };

    (SystemEvents.systemEvents.emit as Mock).mockClear(); // Reset mock history

    const resolvedNode = await resolveBindings(node, context);

    expect(SystemEvents.systemEvents.emit).toHaveBeenCalledTimes(2);

    // Check START event
    expect(SystemEvents.systemEvents.emit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: SystemEvents.SystemEventType.BINDING_RESOLUTION_START,
        payload: expect.objectContaining({ layout: node }),
      })
    );
    // Check COMPLETE event
    expect(SystemEvents.systemEvents.emit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: SystemEvents.SystemEventType.BINDING_RESOLUTION_COMPLETE,
        payload: expect.objectContaining({
          originalLayout: node,
          resolvedLayout: resolvedNode,
        }),
      })
    );
  });

  it("should NOT emit start and complete events during item resolution", async () => {
    // Use the same node setup as the list expansion test
    const node: UISpecNode = {
      id: "list-view-no-item-events",
      node_type: "ListView",
      props: {},
      bindings: {
        data: "items", // context.items has 2 items
      },
      events: null,
      children: [
        {
          id: "no-event-item-template",
          node_type: "ListItem",
          props: {},
          bindings: { value: "{{item.value}}" },
          events: null,
          children: null,
        },
      ],
    };

    (SystemEvents.systemEvents.emit as Mock).mockClear(); // Reset mock history

    await resolveBindings(node, context);

    // Should only be called twice (once for START, once for COMPLETE) for the *outer* resolution
    expect(SystemEvents.systemEvents.emit).toHaveBeenCalledTimes(2);
    // Verify the calls were for the outer START/COMPLETE
    expect(SystemEvents.systemEvents.emit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: SystemEvents.SystemEventType.BINDING_RESOLUTION_START,
      })
    );
    expect(SystemEvents.systemEvents.emit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: SystemEvents.SystemEventType.BINDING_RESOLUTION_COMPLETE,
      })
    );
  });

  it("should resolve simple path and object bindings within expanded list items using itemData", async () => {
    // Context with items having simple values and object values
    const listDataWithObjects = [
      {
        id: "obj-item-1",
        name: "First Item",
        config: { enabled: true, type: "A" },
      },
      {
        id: "obj-item-2",
        name: "Second Item",
        config: { enabled: false, type: "B" },
      },
    ];
    const testContextWithObjects = {
      ...context, // Include base context like user info if needed elsewhere
      objectList: listDataWithObjects,
    };

    const node: UISpecNode = {
      id: "list-view-object-props",
      node_type: "ListView",
      props: {},
      bindings: {
        data: "objectList", // Bind to the array in the context
      },
      events: null,
      children: [
        // Template child with item-specific bindings
        {
          id: "object-item-template",
          node_type: "ListItem",
          props: { static: "value" },
          bindings: {
            // Simple path binding - should resolve against itemData.name
            title: "name",
            // Template binding resolving to an object - should be assigned to props.config
            config: "{{item.config}}",
            // Binding from main context to ensure it still works
            userName: "{{user.name}}",
          },
          events: null,
          children: null,
        },
      ],
    };

    const resolvedNode = await resolveBindings(node, testContextWithObjects);

    expect(resolvedNode.children).toHaveLength(2);
    const child1 = resolvedNode.children?.[0];
    const child2 = resolvedNode.children?.[1];

    // Check child 1 - resolved using listDataWithObjects[0]
    expect(child1?.props?.static).toBe("value");
    expect(child1?.props?.title).toBe("First Item"); // Simple path resolved from itemData
    expect(child1?.props?.config).toEqual({ enabled: true, type: "A" }); // Object assigned from binding
    expect(child1?.props?.userName).toBe("Alice"); // Resolved from main context

    // Check child 2 - resolved using listDataWithObjects[1]
    expect(child2?.props?.static).toBe("value");
    expect(child2?.props?.title).toBe("Second Item");
    expect(child2?.props?.config).toEqual({ enabled: false, type: "B" });
    expect(child2?.props?.userName).toBe("Alice");

    // Check IDs and Keys
    expect(child1?.id).toBe("object-item-template-obj-item-1");
    expect(child1?.props?.key).toBe("obj-item-1");
    expect(child2?.id).toBe("object-item-template-obj-item-2");
    expect(child2?.props?.key).toBe("obj-item-2");
  });

  it("should fail if item-specific bindings are not resolved correctly", async () => {
    // Context has context.items = [{ id: "item-1", value: 100 }, { id: "item-2", value: 200 }];
    const node: UISpecNode = {
      id: "list-view-fail-item-data",
      node_type: "ListView",
      props: {},
      bindings: {
        data: "items", // Bind to the array in the context
      },
      events: null,
      children: [
        // Template child with item-specific template bindings
        {
          id: "fail-item-template",
          node_type: "ListItem",
          props: {},
          bindings: {
            // These require itemData to be passed and used correctly
            itemIdFromItem: "{{item.id}}",
            itemValueFromItem: "{{item.value}}",
            // This requires the main context
            userNameFromContext: "{{user.name}}",
          },
          events: null,
          children: null,
        },
      ],
    };

    const resolvedNode = await resolveBindings(node, context);

    expect(resolvedNode.children).toHaveLength(2);
    const child1 = resolvedNode.children?.[0];
    const child2 = resolvedNode.children?.[1];

    // Assertions that should fail if itemData isn't working
    // Check child 1 - resolved using context.items[0] = { id: "item-1", value: 100 }
    expect(child1?.props?.itemIdFromItem).toBe("item-1");
    expect(child1?.props?.itemValueFromItem).toBe(100);
    expect(child1?.props?.userNameFromContext).toBe("Alice"); // Should still work

    // Check child 2 - resolved using context.items[1] = { id: "item-2", value: 200 }
    expect(child2?.props?.itemIdFromItem).toBe("item-2");
    expect(child2?.props?.itemValueFromItem).toBe(200);
    expect(child2?.props?.userNameFromContext).toBe("Alice"); // Should still work

    // Check IDs and Keys are correctly generated
    expect(child1?.id).toBe("fail-item-template-item-1");
    expect(child1?.props?.key).toBe("item-1");
    expect(child2?.id).toBe("fail-item-template-item-2");
    expect(child2?.props?.key).toBe("item-2");
  });
});
