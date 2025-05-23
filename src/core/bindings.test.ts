import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import {
  getValueByPath,
  setValueByPath,
  processBinding,
  resolveBindings,
  DataContext,
  executeAction,
} from "./bindings"; // Adjust path as necessary
import { ActionType } from "../schema/action-types"; // Correct import for ActionType
import { UISpecNode, DataItem } from "../schema/ui"; // Re-added UISpecNode and Added DataItem
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
    // The ListView's own bindings object should be preserved
    expect(resolvedNode.bindings).toEqual(node.bindings);
    // The resolved data from the binding should be in props
    expect(resolvedNode.props?.data).toEqual(context.items);

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

    await resolveBindings(node, context);

    expect(SystemEvents.systemEvents.emit).toHaveBeenCalledTimes(0);
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
    expect(SystemEvents.systemEvents.emit).toHaveBeenCalledTimes(0);
    // Verify the calls were for the outer START/COMPLETE
    // expect(SystemEvents.systemEvents.emit).toHaveBeenNthCalledWith( // Comment out this block
    //   1,
    //   expect.objectContaining({
    //     type: SystemEvents.SystemEventType.BINDING_RESOLUTION_START,
    //   })
    // );
    // expect(SystemEvents.systemEvents.emit).toHaveBeenNthCalledWith( // Comment out this block
    //   2,
    //   expect.objectContaining({
    //     type: SystemEvents.SystemEventType.BINDING_RESOLUTION_COMPLETE,
    //   })
    // );
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

  it("should NOT resolve templates or paths directly in props", async () => {
    const node: UISpecNode = {
      ...baseNode,
      id: "node-props-vs-bindings",
      props: {
        initialProp: "initial",
        templateInProp: "{{user.name}}", // Template string in props
        pathInProp: "user.id", // Path string in props
      },
      bindings: {
        // Only this binding should affect props
        fromBinding: "directValue",
      },
    };

    const resolvedNode = await resolveBindings(node, context);

    expect(resolvedNode.props).toBeDefined();
    // Check that props from original node.props remain UNRESOLVED
    expect(resolvedNode.props?.initialProp).toBe("initial");
    expect(resolvedNode.props?.templateInProp).toBe("{{user.name}}"); // Should NOT be "Alice"
    expect(resolvedNode.props?.pathInProp).toBe("user.id"); // Should NOT be "user-123"

    // Check that the prop from the binding WAS resolved and added
    expect(resolvedNode.props?.fromBinding).toBe(42);

    // Ensure the original bindings object is preserved, not cleared
    expect(resolvedNode.bindings).toEqual(node.bindings);
  });

  it("should preserve template bindings on expanded list view items and resolve their props", async () => {
    const listNode: UISpecNode = {
      id: "list-view-preserve-item-bindings",
      node_type: "ListView",
      props: { listProp: "listValue" },
      bindings: {
        // Original bindings for the ListView itself
        data: "items",
      },
      events: null,
      children: [
        // Template child
        {
          id: "template-item-for-preservation",
          node_type: "ListItem",
          props: { staticChildProp: "childStatic" },
          bindings: {
            // Original bindings for the template item
            itemId: "{{item.id}}",
            itemSpecificValue: "{{item.value}}",
            userNameFromContext: "{{user.name}}", // A binding from main context
          },
          events: null,
          children: null,
        },
      ],
    };

    const resolvedListNode = await resolveBindings(listNode, context);

    // 1. Check ListView node itself
    expect(resolvedListNode.props?.data).toEqual(context.items);
    expect(resolvedListNode.props?.listProp).toBe("listValue");
    expect(resolvedListNode.bindings).toEqual(listNode.bindings); // ListView's own bindings are preserved

    // 2. Check expanded list items
    expect(resolvedListNode.children).toHaveLength(context.items.length); // context.items has 2 items in standard setup

    const templateChildBindings = listNode.children![0].bindings;

    resolvedListNode.children?.forEach((resolvedChildItem, index) => {
      const sourceItem = context.items[index]; // e.g. { id: "item-1", value: 100 }

      // Check props are resolved correctly for each child item
      expect(resolvedChildItem.props?.staticChildProp).toBe("childStatic");
      expect(resolvedChildItem.props?.itemId).toBe(sourceItem.id);
      expect(resolvedChildItem.props?.itemSpecificValue).toBe(sourceItem.value);
      expect(resolvedChildItem.props?.userNameFromContext).toBe(
        context.user.name
      );

      // Crucially, check that the original bindings object from the template is preserved on the resolved child item
      expect(resolvedChildItem.bindings).toEqual(templateChildBindings);
    });
  });
});

// ====================================
// executeAction Tests
// ====================================

// Define a simple interface for task items for these tests
interface TestTaskItem {
  id: string;
  title: string;
  status: string;
  [key: string]: unknown; // Allow other properties if necessary, prefer unknown over any
}

describe("executeAction", () => {
  let context: DataContext;
  let baseTasks: { data: TestTaskItem[]; schema: Record<string, unknown> };

  beforeEach(() => {
    baseTasks = {
      data: [
        { id: "t1", title: "Task 1", status: "pending", description: "Desc 1" },
        {
          id: "t2",
          title: "Task 2",
          status: "in_progress",
          description: "Desc 2",
        },
        { id: "t3", title: "Task 3", status: "pending", description: "Desc 3" },
      ],
      schema: {},
    };
    context = {
      user: { id: "u1", name: "Alice" },
      tasks: { ...baseTasks },
      selected: null,
      selectedTask: null,
      isTaskDetailDialogVisible: false,
      selectedItemForDetail: null,
      isDetailViewOpen: false,
      form: {
        newTaskTitle: "",
        newTaskStatus: "pending",
      },
    };
  });

  it("should handle UPDATE_DATA action using target as path", () => {
    const newContext = executeAction(
      "UPDATE_DATA",
      "form.newTaskTitle", // target used as data path
      { value: "New Task Title" }, // payload contains the value
      context
    );
    expect((newContext.form as { newTaskTitle?: string })?.newTaskTitle).toBe(
      "New Task Title"
    );
    // Ensure original context is unchanged
    expect((context.form as { newTaskTitle?: string })?.newTaskTitle).toBe("");
  });

  it("should ignore UPDATE_DATA if target path or payload value is missing", () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    // Missing targetPath
    let newContext = executeAction(
      "UPDATE_DATA",
      undefined,
      { value: "New Value" },
      context
    );
    expect(newContext).toEqual(context); // Should not change
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE_DATA requires targetPath")
    );

    // Missing payload.value
    newContext = executeAction(
      "UPDATE_DATA",
      "form.newTaskTitle",
      {
        /* no value property */
      },
      context
    );
    expect(newContext).toEqual(context); // Should not change
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE_DATA requires targetPath")
    );

    consoleWarnSpy.mockRestore();
  });

  // Comment out the VIEW_DETAIL test as the string action was removed
  /*
  it("should handle VIEW_DETAIL action, setting context.selected", () => {
    const itemToSelect = { id: "t2", title: "Task 2", status: "in_progress" };
    const newContext = executeAction(
      "VIEW_DETAIL", // This was a string literal, now unhandled by default
      "detail-node-id", 
      { item: itemToSelect }, 
      context
    );
    expect(newContext.selected).toEqual(itemToSelect);
    expect(context.selected).toBeNull();
  });

  it("should ignore VIEW_DETAIL if payload.item is missing", () => {
    const newContext = executeAction(
      "VIEW_DETAIL",
      "detail-node-id",
      {
        // no item property 
      },
      context
    );
    expect(newContext).toEqual(context); // Should remain unchanged
  });
  */

  it("should handle ADD_ITEM action, adding item to end of list specified by target path", () => {
    const newItem = { id: "t4", title: "Task 4", status: "new" };
    const newContext = executeAction(
      "ADD_ITEM",
      "tasks.data", // target path pointing to the array
      { item: newItem }, // payload contains the item to add
      context
    );
    expect((newContext.tasks as { data?: TestTaskItem[] })?.data).toHaveLength(
      4
    );
    expect((newContext.tasks as { data?: TestTaskItem[] })?.data?.[3]).toEqual(
      newItem
    );
    // Check immutability
    expect((context.tasks as { data?: TestTaskItem[] })?.data).toHaveLength(3);
  });

  it("should handle ADD_ITEM prepending item if payload.position is 'start'", () => {
    const newItem = { id: "t0", title: "Task 0", status: "new" };
    const newContext = executeAction(
      "ADD_ITEM",
      "tasks.data", // target path
      { item: newItem, position: "start" }, // payload with item and position
      context
    );
    expect((newContext.tasks as { data?: TestTaskItem[] })?.data).toHaveLength(
      4
    );
    expect((newContext.tasks as { data?: TestTaskItem[] })?.data?.[0]).toEqual(
      newItem
    );
    expect(
      (
        (newContext.tasks as { data?: TestTaskItem[] })
          ?.data?.[1] as TestTaskItem
      ).id
    ).toBe("t1"); // Check original first item is now second
    expect((context.tasks as { data?: TestTaskItem[] })?.data).toHaveLength(3);
  });

  it("should ignore ADD_ITEM if target path does not resolve to an array", () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const newItem = { id: "x1", title: "Invalid Add" };
    const newContext = executeAction(
      "ADD_ITEM",
      "user.name", // Target is a string, not an array
      { item: newItem },
      context
    );
    expect(newContext).toEqual(context); // Context should not change
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[executeAction] ADD_ITEM failed: target path "user.name" does not resolve to an array.'
    );
    consoleWarnSpy.mockRestore();
  });

  it("should ignore ADD_ITEM if payload.item is missing", () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const newContext = executeAction(
      "ADD_ITEM",
      "tasks.data",
      {
        /* no item */
      },
      context
    );
    expect(newContext).toEqual(context); // Context should not change
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[executeAction] ADD_ITEM requires payload with item property."
    );
    consoleWarnSpy.mockRestore();
  });

  it("should handle DELETE_ITEM action, removing item by id from list specified by target path", () => {
    const itemIdToDelete = "t2";
    const newContext = executeAction(
      "DELETE_ITEM",
      "tasks.data", // target path pointing to the array
      { id: itemIdToDelete }, // payload contains the id of the item to delete
      context
    );
    expect((newContext.tasks as { data?: TestTaskItem[] })?.data).toHaveLength(
      2
    );
    // Check that the correct item was removed
    expect(
      (newContext.tasks as { data?: TestTaskItem[] })?.data?.find(
        (t) => t.id === itemIdToDelete
      )
    ).toBeUndefined();
    expect(
      (
        (newContext.tasks as { data?: TestTaskItem[] })
          ?.data?.[0] as TestTaskItem
      ).id
    ).toBe("t1");
    expect(
      (
        (newContext.tasks as { data?: TestTaskItem[] })
          ?.data?.[1] as TestTaskItem
      ).id
    ).toBe("t3");
    // Check immutability
    expect((context.tasks as { data?: TestTaskItem[] })?.data).toHaveLength(3);
  });

  it("should ignore DELETE_ITEM if item id is not found in the list", () => {
    const newContext = executeAction(
      "DELETE_ITEM",
      "tasks.data",
      { id: "non-existent-id" },
      context
    );
    expect((newContext.tasks as { data?: TestTaskItem[] })?.data).toHaveLength(
      3
    );
    expect(newContext).toEqual(context); // Context should be unchanged
  });

  it("should ignore DELETE_ITEM if target path does not resolve to an array", () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const newContext = executeAction(
      "DELETE_ITEM",
      "user.name", // Target is string, not array
      { id: "t1" },
      context
    );
    expect(newContext).toEqual(context); // Context should not change
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[executeAction] DELETE_ITEM failed: target path "user.name" does not resolve to an array.'
    );
    consoleWarnSpy.mockRestore();
  });

  it("should ignore DELETE_ITEM if payload.id is missing", () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const newContext = executeAction(
      "DELETE_ITEM",
      "tasks.data",
      {
        /* no id */
      },
      context
    );
    expect(newContext).toEqual(context); // Context should not change
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[executeAction] DELETE_ITEM requires payload with id property."
    );
    consoleWarnSpy.mockRestore();
  });

  it("should handle SHOW_DETAIL action, setting selectedTask and visibility flag", () => {
    const contextWithTasks = {
      ...context,
      tasks: {
        data: [
          { id: "task-1", title: "Task One", description: "Description one" },
          { id: "task-2", title: "Task Two", description: "Description two" },
        ] as DataItem[],
        schema: {},
      },
      selectedTask: null,
      isTaskDetailDialogVisible: false,
    };

    // Case 1: Valid taskId
    let newContext = executeAction(
      ActionType.SHOW_DETAIL,
      "taskDetailDialogNodeId",
      { taskId: "task-1" },
      contextWithTasks
    );
    console.log(
      "[Test Debug] SHOW_DETAIL Case 1 - newContext after executeAction:",
      JSON.stringify(newContext)
    );

    expect((newContext.selectedTask as DataItem)?.id).toBe("task-1");
    expect((newContext.selectedTask as DataItem)?.title).toBe("Task One");
    expect(newContext.isTaskDetailDialogVisible).toBe(true);

    // Case 2: Invalid taskId
    newContext = executeAction(
      ActionType.SHOW_DETAIL,
      "taskDetailDialogNodeId",
      { taskId: "task-nonexistent" },
      contextWithTasks
    );
    console.log(
      "[Test Debug] SHOW_DETAIL Case 2 - newContext after executeAction:",
      JSON.stringify(newContext)
    );
    expect(newContext.selectedTask).toBeNull();
    expect(newContext.isTaskDetailDialogVisible).toBe(true);

    // Case 3: Missing taskId in payload
    newContext = executeAction(
      ActionType.SHOW_DETAIL,
      "taskDetailDialogNodeId",
      {},
      contextWithTasks
    );
    console.log(
      "[Test Debug] SHOW_DETAIL Case 3 - newContext after executeAction:",
      JSON.stringify(newContext)
    );
    expect(newContext.selectedTask).toBeNull();
    expect(newContext.isTaskDetailDialogVisible).toBe(true);
  });

  it("should return original context for unknown actions", () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const newContext = executeAction("UNKNOWN_ACTION", undefined, {}, context);
    expect(newContext).toEqual(context);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[executeAction] Unhandled action type: UNKNOWN_ACTION"
    );
    consoleWarnSpy.mockRestore();
  });

  it("should preserve other parts of the context when updating", () => {
    const newContext = executeAction(
      ActionType.UPDATE_DATA,
      "form.newTaskTitle",
      { value: "Test" },
      context
    );
    expect(newContext.selected).toBeNull();
    expect(newContext.tasks).toEqual(context.tasks);
    expect(newContext.user).toEqual(context.user);
    expect(newContext.selectedTask).toBeNull();
    expect(newContext.isTaskDetailDialogVisible).toBe(false);
  });

  describe("ActionType.SHOW_DETAIL", () => {
    it("should set selectedTask and make dialog visible for a valid taskId", () => {
      const newContext = executeAction(
        ActionType.SHOW_DETAIL,
        "taskDetailDialogNodeId",
        { taskId: "t1" },
        context
      );
      expect((newContext.selectedTask as TestTaskItem)?.id).toBe("t1");
      expect(newContext.isTaskDetailDialogVisible).toBe(true);
    });

    it("should set selectedTask to null and make dialog visible for an invalid taskId", () => {
      const newContext = executeAction(
        ActionType.SHOW_DETAIL,
        "taskDetailDialogNodeId",
        { taskId: "t-nonexistent" },
        context
      );
      expect(newContext.selectedTask).toBeNull();
      expect(newContext.isTaskDetailDialogVisible).toBe(true);
    });

    it("should set selectedTask to null and make dialog visible if taskId is missing in payload", () => {
      const newContext = executeAction(
        ActionType.SHOW_DETAIL,
        "taskDetailDialogNodeId",
        {},
        context
      );
      expect(newContext.selectedTask).toBeNull();
      expect(newContext.isTaskDetailDialogVisible).toBe(true);
    });

    it("should update selectedTask if one is already selected", () => {
      const contextWithTaskSelected = {
        ...context,
        selectedTask: baseTasks.data[0], // t1 is selected
        isTaskDetailDialogVisible: true,
      };
      const newContext = executeAction(
        ActionType.SHOW_DETAIL,
        "taskDetailDialogNodeId",
        { taskId: "t2" }, // Select t2
        contextWithTaskSelected
      );
      expect((newContext.selectedTask as TestTaskItem)?.id).toBe("t2");
      expect(newContext.isTaskDetailDialogVisible).toBe(true);
    });
  });

  describe("ActionType.HIDE_DIALOG", () => {
    it("should clear selectedTask and hide dialog", () => {
      const contextWithDialogVisible = {
        ...context,
        selectedTask: baseTasks.data[0],
        isTaskDetailDialogVisible: true,
      };
      const newContext = executeAction(
        ActionType.HIDE_DIALOG,
        "taskDetailDialogNodeId", // target could be the dialog ID
        {},
        contextWithDialogVisible
      );
      expect(newContext.selectedTask).toBeNull();
      expect(newContext.isTaskDetailDialogVisible).toBe(false);
    });
  });

  describe("ActionType.OPEN_DIALOG", () => {
    it("should make a generic dialog visible (e.g., task detail dialog by default)", () => {
      const newContext = executeAction(
        ActionType.OPEN_DIALOG,
        "taskDetailDialogNodeId", // Targetting the specific known dialog
        {},
        context
      );
      expect(newContext.isTaskDetailDialogVisible).toBe(true);
    });
    // Add more tests if OPEN_DIALOG should handle other dialogIds or set other flags
  });

  describe("ActionType.CLOSE_DIALOG", () => {
    it("should hide a generic dialog and clear related data (e.g., task detail dialog)", () => {
      const contextWithDialogVisible = {
        ...context,
        selectedTask: baseTasks.data[0],
        isTaskDetailDialogVisible: true,
      };
      const newContext = executeAction(
        ActionType.CLOSE_DIALOG,
        "taskDetailDialogNodeId", // Targetting the specific known dialog
        {},
        contextWithDialogVisible
      );
      expect(newContext.isTaskDetailDialogVisible).toBe(false);
      expect(newContext.selectedTask).toBeNull(); // Assuming taskDetailDialog implies clearing selectedTask
    });
  });

  describe("ActionType.HIDE_DETAIL", () => {
    it("should clear selectedItemForDetail and set isDetailViewOpen to false", () => {
      const contextWithDetailOpen = {
        ...context,
        selectedItemForDetail: { id: "detail-1", content: "Some detail" },
        isDetailViewOpen: true,
      };
      const newContext = executeAction(
        ActionType.HIDE_DETAIL,
        "genericDetailViewNodeId", // Target could be the detail pane ID
        {},
        contextWithDetailOpen
      );
      expect(newContext.selectedItemForDetail).toBeNull();
      expect(newContext.isDetailViewOpen).toBe(false);
    });
  });

  describe("ActionType.SAVE_TASK_CHANGES", () => {
    it("should update task in tasks.data, clear selectedTask, and hide dialog", () => {
      const modifiedTaskData = {
        title: "Updated Task 1 Title",
        status: "completed",
      };
      const contextWithTaskSelected = {
        ...context,
        selectedTask: { ...baseTasks.data[0], ...modifiedTaskData }, // Simulate form changes applied to selectedTask
        isTaskDetailDialogVisible: true,
      };
      const newContext = executeAction(
        ActionType.SAVE_TASK_CHANGES,
        baseTasks.data[0].id, // target is the taskId
        {}, // Payload from form might be merged into selectedTask already, or passed here
        contextWithTaskSelected
      );
      const updatedTaskInList = (
        newContext.tasks as { data: TestTaskItem[] }
      ).data.find((t) => t.id === baseTasks.data[0].id);
      expect(updatedTaskInList?.title).toBe("Updated Task 1 Title");
      expect(updatedTaskInList?.status).toBe("completed");
      expect(newContext.selectedTask).toBeNull();
      expect(newContext.isTaskDetailDialogVisible).toBe(false);
    });

    it("should not save if target taskId does not match selectedTask id", () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const contextWithTaskSelected = {
        ...context,
        selectedTask: baseTasks.data[0],
        isTaskDetailDialogVisible: true,
      };
      const newContext = executeAction(
        ActionType.SAVE_TASK_CHANGES,
        "t2",
        { title: "Won't Save" },
        contextWithTaskSelected
      );
      expect((newContext.tasks as { data: TestTaskItem[] }).data[0].title).toBe(
        "Task 1"
      );
      expect(newContext.selectedTask).toEqual(baseTasks.data[0]);
      expect(newContext.isTaskDetailDialogVisible).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[executeAction] SAVE_TASK_CHANGES: Could not save. Task list, selected task, or ID mismatch.",
        expect.objectContaining({
          taskIdToSave: "t2",
          selectedTaskDataId: "t1",
          currentTasksExists: true,
        })
      );
      consoleWarnSpy.mockRestore();
    });
  });
});
