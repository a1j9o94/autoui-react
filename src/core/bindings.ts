import { UISpecNode, DataItem } from "../schema/ui";
import { ActionType } from "../schema/action-types";

/**
 * Interface for the runtime data context
 */
export interface DataContext {
  [key: string]: unknown;
}

/**
 * Get a value from the data context by path
 * Supports dot notation for nested properties
 *
 * @param context - The data context object
 * @param path - The path to the value (e.g., "emails.data")
 * @returns The value at the path, or undefined if not found
 */
export function getValueByPath(context: DataContext, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a value in the data context by path
 * Creates intermediate objects if they don't exist
 *
 * @param context - The data context object
 * @param path - The path to set (e.g., "emails.selected")
 * @param value - The value to set
 * @returns Updated data context
 */
export function setValueByPath(
  context: DataContext,
  path: string,
  value: unknown
): DataContext {
  if (!path) {
    return context;
  }

  const result = { ...context };
  const parts = path.split(".");
  let current: unknown = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];

    // Ensure the current level is an object before trying to access/modify properties
    if (typeof current !== "object" || current === null) {
      console.warn(
        `setValueByPath: Cannot traverse path "${path}". Parent segment "${
          parts[i - 1] || "(root)"
        }" is not an object.`
      );
      return context;
    }
    const currentAsObject = current as Record<string, unknown>;
    const nextPartValue = currentAsObject[part];

    if (nextPartValue === undefined || nextPartValue === null) {
      // If the next part doesn't exist or is null, create an empty object
      currentAsObject[part] = {};
    } else if (typeof nextPartValue !== "object") {
      // If the next part exists but isn't an object, we cannot traverse further.
      console.warn(
        `setValueByPath: Cannot create nested path "${path}". Segment "${part}" is not an object.`
      );
      return context; // Prevent overwriting primitives during traversal
    } else {
      // It exists and is an object, make a copy for immutability
      currentAsObject[part] = { ...(nextPartValue as Record<string, unknown>) };
    }
    // Move to the next level (which is now guaranteed to be an object)
    current = currentAsObject[part];
  }

  // Set the value at the final property
  const lastPart = parts[parts.length - 1];
  if (typeof current === "object" && current !== null) {
    // Now we are at the direct parent, safe to assign the value
    (current as Record<string, unknown>)[lastPart] = value;
  } else {
    // This case implies the path was invalid (e.g., single segment, root not object)
    console.warn(
      `setValueByPath: Could not set value for path "${path}". Final segment parent is not an object.`
    );
    return context;
  }

  return result;
}

/**
 * Process a binding value from a UI node
 *
 * @param binding - The binding value (string path, template string, or direct value)
 * @param context - The main data context object
 * @param itemData - Optional data context for the current list item
 * @returns The resolved value
 */
export function processBinding(
  binding: unknown,
  context: DataContext,
  itemData?: Record<string, unknown> // Added item context
): unknown {
  if (typeof binding === "string") {
    const exactMatchArr = binding.match(/^{{(.*)}}$/);
    const pathInsideExact = exactMatchArr ? exactMatchArr[1].trim() : null;

    // Case 1: True "Exact Template" like {{item.name}}
    if (
      pathInsideExact !== null &&
      !pathInsideExact.includes("{{") &&
      !pathInsideExact.includes("}}")
    ) {
      const pathToResolve = pathInsideExact;
      let resolvedValue: unknown = undefined;
      // --- DEBUG LOGGING ---
      // console.log(
      //   `[processBinding Debug] Processing EXACT template: "${binding}", Path: "${pathToResolve}", Has itemData: ${!!itemData}`
      // );
      // if (itemData) {
      //   // Log itemData content for debugging
      //   try {
      //     console.log(
      //       `[processBinding Debug] itemData content (EXACT):`,
      //       JSON.parse(JSON.stringify(itemData))
      //     );
      //   } catch {
      //     /* ignore logging error */
      //   }
      // }
      // --- DEBUG LOGGING END ---

      if (
        (pathToResolve.startsWith("item.") ||
          pathToResolve.startsWith("row.")) &&
        itemData
      ) {
        if (pathToResolve.startsWith("item.")) {
          resolvedValue = getValueByPath(itemData, pathToResolve.substring(5));
        } else {
          // Starts with "row."
          resolvedValue = getValueByPath(itemData, pathToResolve.substring(4));
        }
      } else if (itemData && pathToResolve in itemData) {
        // Direct access to itemData property if path doesn't have "item." or "row." prefix but exists in itemData
        resolvedValue = getValueByPath(itemData, pathToResolve);
      }

      if (resolvedValue === undefined) {
        resolvedValue = getValueByPath(context, pathToResolve);
      }
      return resolvedValue; // Return original type (or undefined)

      // Case 2: "Embedded Template" like "Name: {{item.name}}" or "{{item.name}} has {{item.id}}"
    } else if (binding.includes("{{") && binding.includes("}}")) {
      // --- DEBUG LOGGING ---
      // console.log(
      //   `[processBinding Debug] Processing EMBEDDED templates: "${binding}", Has itemData: ${!!itemData}`
      // );
      // if (itemData) {
      //   // Log itemData content for debugging
      //   try {
      //     console.log(
      //       `[processBinding Debug] itemData content (EMBEDDED):`,
      //       JSON.parse(JSON.stringify(itemData))
      //     );
      //   } catch {
      //     /* ignore logging error */
      //   }
      // }
      // --- DEBUG LOGGING END ---

      const resolvedString = binding.replaceAll(
        /{{(.*?)}}/g, // Non-greedy match inside braces
        (match, path): string => {
          const trimmedPath = path.trim();
          let resolvedValue: unknown = undefined;

          if (
            (trimmedPath.startsWith("item.") ||
              trimmedPath.startsWith("row.")) &&
            itemData
          ) {
            if (trimmedPath.startsWith("item.")) {
              resolvedValue = getValueByPath(
                itemData,
                trimmedPath.substring(5)
              );
            } else {
              resolvedValue = getValueByPath(
                itemData,
                trimmedPath.substring(4)
              );
            }
          } else if (itemData && trimmedPath in itemData) {
            resolvedValue = getValueByPath(itemData, trimmedPath);
          }

          if (resolvedValue === undefined) {
            resolvedValue = getValueByPath(context, trimmedPath);
          }

          return resolvedValue === null || resolvedValue === undefined
            ? "" // Substitute with empty string for unresolved templates in embedded strings
            : String(resolvedValue);
        }
      );
      return resolvedString; // Return the modified string

      // Case 3: "Path String" like "user.name"
    } else {
      const pathToResolve = binding;
      let resolvedValue: unknown = undefined;
      // --- DEBUG LOGGING ---
      // console.log(
      //   `[processBinding Debug] Processing PATH string: "${pathToResolve}", Has itemData: ${!!itemData}`
      // );
      // --- DEBUG LOGGING END ---

      // For path strings, prefer context unless itemData is explicitly targeted (e.g. via "item." prefix handled above)
      // or if it's a simple property name that might exist on itemData.
      // Given current logic, exact paths like "item.name" are handled by EXACT, "title" could be item or context.
      // If itemData exists and path is a direct property of itemData (no dots)
      if (
        itemData &&
        !pathToResolve.includes(".") &&
        pathToResolve in itemData
      ) {
        resolvedValue = getValueByPath(itemData, pathToResolve);
      }

      if (resolvedValue === undefined) {
        resolvedValue = getValueByPath(context, pathToResolve);
      }
      return resolvedValue; // Return resolved value or undefined
    }
  }

  // If binding is an array, process each item recursively
  if (Array.isArray(binding)) {
    return binding.map((item) => processBinding(item, context, itemData));
  }

  // If binding is an object, process each property recursively
  if (binding !== null && typeof binding === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(binding)) {
      // IMPORTANT: Recursively call processBinding on the VALUE, not the key
      result[key] = processBinding(value, context, itemData);
    }
    return result;
  }

  // Otherwise, return the binding as-is (e.g., boolean, number, null)
  return binding;
}

/**
 * Create a deep clone of a node with all bindings resolved
 * Handles standard bindings and list expansion based on 'data' binding.
 *
 * @param node - The UI specification node
 * @param context - The main data context object
 * @param itemData - Optional data context for the current list item being resolved
 * @returns A new node with bindings resolved to concrete values
 */
export async function resolveBindings(
  node: UISpecNode,
  context: DataContext,
  itemData?: DataItem | null
  // ...
): Promise<UISpecNode> {
  if (node.id === "task-detail") {
    console.log(
      `[resolveBindings task-detail SPECIFIC CHECK] Context for task-detail:`,
      JSON.stringify(context)
    );
    console.log(
      `[resolveBindings task-detail SPECIFIC CHECK] context.isTaskDetailDialogVisible = ${context.isTaskDetailDialogVisible}`
    );
    console.log(
      `[resolveBindings task-detail SPECIFIC CHECK] context.selectedTask = ${JSON.stringify(
        context.selectedTask
      )}`
    );
  }

  // Existing log:
  console.log(
    `[resolveBindings ENTRY] Node ID: ${node.id}, Type: ${
      node.node_type
    }, Has itemData: ${!!itemData}, Context keys: ${Object.keys(
      context || {} // Ensure context is not null before Object.keys
    ).join(", ")}`
  );

  const result: UISpecNode = {
    ...node,
    props: node.props ? JSON.parse(JSON.stringify(node.props)) : null,
    events: node.events ? JSON.parse(JSON.stringify(node.events)) : null,
    bindings: node.bindings ? JSON.parse(JSON.stringify(node.bindings)) : null,
    children: null, // Initialize children to null
  };

  let mergedProps: Record<string, unknown> | null = node.props
    ? { ...JSON.parse(JSON.stringify(node.props)) }
    : null;

  const PROP_KEYS_TO_RESOLVE = new Set([
    "text",
    "label",
    "title",
    "placeholder",
    "value",
  ]);

  if (node.props) {
    for (const [key, value] of Object.entries(node.props)) {
      if (!mergedProps) mergedProps = {}; // Ensure mergedProps is initialized here

      if (PROP_KEYS_TO_RESOLVE.has(key)) {
        const resolvedPropValue = processBinding(
          value,
          context,
          itemData ?? undefined
        );
        if (resolvedPropValue !== undefined) {
          mergedProps[key] = resolvedPropValue;
        } else {
          // If a prop in PROP_KEYS_TO_RESOLVE was a path/template that resolved to undefined,
          // set it to an empty string. Otherwise, preserve its original literal value.
          if (
            typeof value === "string" &&
            (value.includes("{{") || value.includes("."))
          ) {
            mergedProps[key] = ""; // It was a path/template, make it empty
          } else {
            mergedProps[key] = value; // It was a literal or something else, preserve original node.props value if binding failed/absent for this key
          }
        }
      } else if (value !== undefined) {
        // For props not in PROP_KEYS_TO_RESOLVE, carry them over if they are defined.
        mergedProps[key] = value;
      } else {
        // If original prop value was undefined, ensure it's not on mergedProps unless explicitly set later by bindings
        delete mergedProps[key];
      }
    }
  }

  result.props = mergedProps;

  if (node.bindings) {
    for (const [key, bindingValue] of Object.entries(node.bindings)) {
      const resolvedValue = processBinding(
        bindingValue,
        context,
        itemData ?? undefined
      );
      if (node.id === "task-detail") {
        // Log specifically for task-detail
        console.log(
          `[resolveBindings - ${node.id}] Binding for '${key}': '${String(
            bindingValue
          )}' -> Resolved:`,
          resolvedValue
        );
      }

      if (resolvedValue !== undefined) {
        if (!result.props) result.props = {};
        result.props[key] = resolvedValue;
        if (node.id === "task-detail") {
          // Log specifically for task-detail
          console.log(
            `[resolveBindings - ${node.id}] Set result.props.${key} =`,
            resolvedValue
          );
        }
      } else {
        if (node.id === "task-detail") {
          // Log specifically for task-detail
          console.log(
            `[resolveBindings - ${node.id}] Binding for '${key}' ('${String(
              bindingValue
            )}') resolved to undefined. Not setting prop.`
          );
        }
      }
    }
  }

  // Process event payloads if events exist
  if (node.events) {
    const processedEvents: UISpecNode["events"] = {};
    for (const eventType in node.events) {
      const eventConfig = node.events[eventType];
      processedEvents[eventType] = {
        ...eventConfig,
        payload: eventConfig.payload
          ? (processBinding(
              eventConfig.payload,
              context,
              itemData ?? undefined
            ) as Record<string, unknown> | null)
          : null,
      };
    }
    result.events = processedEvents;
  } else {
    result.events = null;
  }

  const dataBindingValue = result.props?.data ?? result.props?.items;

  // // Add detailed logs before the ListView processing condition
  // if (node.id === "task-list") {
  //   // Log only for the specific ListView we are interested in
  //   console.log(
  //     `[resolveBindings Debug] Checking node ${node.id} (${node.node_type}) for ListView processing eligibility:`
  //   );
  //   console.log(
  //     `[resolveBindings Debug]   Is ListView or Table type: ${
  //       node.node_type === "ListView" || node.node_type === "Table"
  //     }`
  //   );
  //   console.log(
  //     `[resolveBindings Debug]   Is dataBindingValue an array: ${Array.isArray(
  //       dataBindingValue
  //     )}`
  //   );
  //   if (Array.isArray(dataBindingValue)) {
  //     console.log(
  //       `[resolveBindings Debug]     dataBindingValue length: ${dataBindingValue.length}`
  //     );
  //   }
  //   console.log(
  //     `[resolveBindings Debug]   Original node.children (template) exists: ${!!node.children}`
  //   );
  //   if (node.children) {
  //     console.log(
  //       `[resolveBindings Debug]     Original node.children.length (template count): ${node.children.length}`
  //     );
  //   }
  // }

  if (
    (node.node_type === "ListView" || node.node_type === "Table") &&
    Array.isArray(dataBindingValue) &&
    node.children &&
    node.children.length > 0
  ) {
    // if (node.id === "task-list") {
    //   console.log(
    //     `[resolveBindings Debug] ENTERED ListView processing for ${node.id}`
    //   );
    // }

    // Check if the children are already instantiated items or a template
    // A simple heuristic: if the first child's ID does not strictly match the template ID we expect.
    // This assumes a single template child in the spec from the planner.
    const templateChild = node.children[0];
    const isAlreadyExpanded =
      node.children.length > 1 ||
      (node.children.length === 1 && templateChild.id !== "taskItem-template");

    if (isAlreadyExpanded && node.id === "task-list") {
      // console.log(
      //   `[resolveBindings Debug] ListView ${node.id} appears to be already expanded. Re-resolving its existing children.`
      // );
      // If already expanded, just re-resolve bindings on existing children
      // This might happen if the parent re-renders and passes the already processed ListView node.
      result.children = await Promise.all(
        node.children.map((existingChild) =>
          resolveBindings(existingChild, context, itemData)
        ) // itemData is tricky here, should it be from parent or is it irrelevant?
        // For now, assume itemData is not applicable for re-resolving top-level list items this way.
      );
    } else {
      // Standard expansion logic using templateChild
      // if (node.id === "task-list") {
      //   console.log(
      //     `[resolveBindings Debug] ListView ${node.id} is using template: ${templateChild.id}`
      //   );
      // }
      const mappedChildren = await Promise.all(
        dataBindingValue.map(async (currentItemData, index) => {
          try {
            if (
              typeof currentItemData !== "object" ||
              currentItemData === null
            ) {
              console.warn(
                `List item at index ${index} for node ${node.id} is not an object:`,
                currentItemData
              );
              return null;
            }
            const currentItemAsRecord = currentItemData as Record<
              string,
              unknown
            >;
            const itemId = currentItemAsRecord.id as
              | string
              | number
              | undefined;
            const instanceId = `${templateChild.id}-${itemId || index}`;

            const childNodeInstance: UISpecNode = JSON.parse(
              JSON.stringify(templateChild)
            );
            childNodeInstance.id = instanceId;

            makeChildIdsUniqueInInstance(
              childNodeInstance,
              instanceId,
              templateChild.id
            );

            const resolvedChild = await resolveBindings(
              childNodeInstance,
              context,
              currentItemAsRecord
            );

            if (resolvedChild && !resolvedChild.props) resolvedChild.props = {};
            if (resolvedChild && resolvedChild.props) {
              resolvedChild.props.key = itemId || `${node.id}-item-${index}`;
            }
            return resolvedChild;
          } catch (error) {
            console.error(
              `[resolveBindings Error] Error processing item at index ${index} for node ${node.id}:`,
              error,
              "Item Data:",
              currentItemData
            );
            return null;
          }
        })
      );
      // console.log(
      //   `[resolveBindings Debug] ListView ${node.id} - mappedChildren:`,
      //   JSON.stringify(mappedChildren, null, 2)
      // );
      result.children = mappedChildren.filter(
        (child) => child !== null
      ) as UISpecNode[];
    }
  } else if (node.children && node.children.length > 0) {
    result.children = await Promise.all(
      node.children.map((child) => resolveBindings(child, context, itemData))
    );
  } else {
    result.children = [];
  }

  // // Add this for task-detail just before returning
  // if (node.id === "task-detail") {
  //   console.log(
  //     `[resolveBindings RETURN Debug] task-detail final result.props:`,
  //     JSON.stringify(result.props)
  //   );
  //   console.log(
  //     `[resolveBindings RETURN Debug] task-detail final result.bindings:`,
  //     JSON.stringify(result.bindings)
  //   );
  // }

  return result;
}

/**
 * Execute an action based on event configuration
 *
 * @param action - The action type (e.g., "VIEW_DETAIL", "UPDATE_DATA")
 * @param target - The target data path (e.g., "tasks.data", "user.name") or node ID (for specific actions)
 * @param payload - Optional payload for the action (e.g., { value: "new" }, { item: {...} }, { id: "..." })
 * @param context - The data context
 * @returns Updated data context
 */
export function executeAction(
  action: string,
  target?: string,
  payload?: Record<string, unknown>,
  context: DataContext = {}
): DataContext {
  // console.log(
  //   `[executeAction ENTRY] Received action string: "${action}" (type: ${typeof action}), Target: ${target}`
  // );
  // console.log(
  //   `[executeAction ENTRY] Comparing with ActionType.SHOW_DETAIL (enum): "${ActionType.SHOW_DETAIL}"`
  // );
  // console.log(
  //   `[executeAction ENTRY] Comparing with ActionType.HIDE_DIALOG (enum): "${ActionType.HIDE_DIALOG}"`
  // );

  let newContext = { ...context };

  switch (action as ActionType | string) {
    case ActionType.SHOW_DETAIL: {
      const taskId = payload?.taskId as string | undefined;
      const dialogNodeId = target;

      if (taskId && dialogNodeId) {
        const tasksData = getValueByPath(context, "tasks.data"); // Use original context for reading tasks
        if (Array.isArray(tasksData)) {
          const foundTask = (tasksData as DataItem[]).find(
            (t) => t.id === taskId
          );
          if (foundTask) {
            newContext = setValueByPath(newContext, "selectedTask", foundTask);
            // console.log(
            //   `[executeAction] ${ActionType.SHOW_DETAIL}: Set selectedTask to:`,
            //   foundTask
            // );
          } else {
            console.warn(
              `[executeAction] ${ActionType.SHOW_DETAIL}: Task with id "${taskId}" not found in tasks.data.`
            );
            newContext = setValueByPath(newContext, "selectedTask", null);
          }
        } else {
          console.warn(
            `[executeAction] ${ActionType.SHOW_DETAIL}: context.tasks.data is not an array or not found.`
          );
          newContext = setValueByPath(newContext, "selectedTask", null);
        }
      } else {
        console.warn(
          `[executeAction] ${ActionType.SHOW_DETAIL}: payload.taskId or target (dialogNodeId) was missing. Dialog will be shown without a selected task.`
        );
        newContext = setValueByPath(newContext, "selectedTask", null); // Ensure selectedTask is null if no taskId
      }

      // Always attempt to set the dialog visibility flag to true for SHOW_DETAIL action
      newContext = setValueByPath(
        newContext, // Use the potentially modified newContext (with selectedTask set or cleared)
        "isTaskDetailDialogVisible",
        true
      );
      // console.log(
      //   `[executeAction] ${ActionType.SHOW_DETAIL}: set isTaskDetailDialogVisible to true. Dialog target: ${dialogNodeId}, Payload:`,
      //   payload
      // );
      break;
    }

    case ActionType.HIDE_DIALOG: {
      newContext = setValueByPath(newContext, "selectedTask", null);
      newContext = setValueByPath(
        newContext,
        "isTaskDetailDialogVisible",
        false
      );
      // console.log(
      //   `[executeAction] ${ActionType.HIDE_DIALOG}: set isTaskDetailDialogVisible to false.`
      // );
      break;
    }

    case ActionType.HIDE_DETAIL: {
      newContext = setValueByPath(newContext, "selectedItemForDetail", null); // Example general detail item
      newContext = setValueByPath(newContext, "isDetailViewOpen", false); // Example general detail flag
      // console.log(
      //   `[executeAction] ${ActionType.HIDE_DETAIL}: Detail view hidden.`
      // );
      break;
    }

    case ActionType.OPEN_DIALOG: {
      const dialogId = target || (payload?.dialogId as string | undefined);
      // For now, assume it refers to the task detail dialog for simplicity, adjust if more dialogs exist
      if (dialogId === "taskDetailDialogNodeId" || !dialogId) {
        // Default to task detail if no specific id or it matches
        newContext = setValueByPath(
          newContext,
          "isTaskDetailDialogVisible",
          true
        );
        // If a specific item should be loaded, SHOW_DETAIL with taskId is more appropriate.
        // OPEN_DIALOG might just make a generic, perhaps empty, dialog visible.
        // console.log(
        //   `[executeAction] ${ActionType.OPEN_DIALOG}: Dialog ${
        //     dialogId || "taskDetailDialogNodeId"
        //   } opened (isTaskDetailDialogVisible: true).`
        // );
      } else {
        // Logic for other dialogs if their visibility is controlled by different flags
        console.warn(
          `[executeAction] ${ActionType.OPEN_DIALOG}: Unhandled dialogId: ${dialogId}.`
        );
      }
      break;
    }

    case ActionType.CLOSE_DIALOG: {
      const dialogId = target || (payload?.dialogId as string | undefined);
      if (dialogId === "taskDetailDialogNodeId" || !dialogId) {
        newContext = setValueByPath(
          newContext,
          "isTaskDetailDialogVisible",
          false
        );
        newContext = setValueByPath(newContext, "selectedTask", null); // Clear task for this specific dialog
        // console.log(
        //   `[executeAction] ${ActionType.CLOSE_DIALOG}: Dialog ${
        //     dialogId || "taskDetailDialogNodeId"
        //   } closed and selectedTask cleared.`
        // );
      } else {
        // Logic for other dialogs
        console.warn(
          `[executeAction] ${ActionType.CLOSE_DIALOG}: Unhandled dialogId: ${dialogId}.`
        );
      }
      break;
    }

    case ActionType.UPDATE_DATA: {
      // console.log(
      //   "[executeAction UPDATE_DATA] Context BEFORE setValueByPath:",
      //   JSON.stringify(context, null, 2)
      // );
      // console.log(
      //   `[executeAction UPDATE_DATA] Target path: ${target}, Payload value: ${payload?.value}`
      // );
      let updatedContext = context; // Start with the passed context
      if (target && payload && "value" in payload) {
        updatedContext = setValueByPath(context, target, payload.value); // Use original context as base for setValueByPath
      } else {
        console.warn(
          `[executeAction] ${ActionType.UPDATE_DATA} requires targetPath (data path) and payload with 'value' property.`
        );
        // newContext will remain a clone of the original context if conditions aren't met
      }
      // console.log(
      //   "[executeAction UPDATE_DATA] Context AFTER setValueByPath (assigned to newContext):",
      //   JSON.stringify(updatedContext, null, 2)
      // );
      newContext = updatedContext; // Assign the result to newContext which is returned by the function
      break;
    }

    case ActionType.ADD_ITEM: {
      // Adds an item to an array specified by the target path
      if (!target) {
        console.warn(`[executeAction] ADD_ITEM requires target path.`);
        break;
      }
      if (!payload?.item) {
        console.warn(
          `[executeAction] ADD_ITEM requires payload with item property.`
        );
        break;
      }

      const list = getValueByPath(newContext, target);
      if (!Array.isArray(list)) {
        console.warn(
          `[executeAction] ADD_ITEM failed: target path "${target}" does not resolve to an array.`
        );
        break;
      }

      const newItem = payload.item;
      const position = payload.position as string | undefined;
      let newList;
      if (position === "start") {
        newList = [newItem, ...list];
      } else {
        newList = [...list, newItem];
      }

      newContext = setValueByPath(newContext, target, newList);
      break;
    }

    case ActionType.DELETE_ITEM: {
      // Deletes an item (identified by id) from an array specified by the target path
      if (!target) {
        console.warn(`[executeAction] DELETE_ITEM requires target path.`);
        break;
      }
      const itemId = payload?.id as string | number | undefined;
      if (itemId === undefined || itemId === null) {
        console.warn(
          `[executeAction] DELETE_ITEM requires payload with id property.`
        );
        break;
      }

      const list = getValueByPath(newContext, target);
      if (!Array.isArray(list)) {
        console.warn(
          `[executeAction] DELETE_ITEM failed: target path "${target}" does not resolve to an array.`
        );
        break;
      }

      // Filter out the item with the matching id
      const newList = list.filter(
        (item: { id?: string | number | undefined }) => item?.id !== itemId
      );

      // Only update if the list actually changed
      if (newList.length !== list.length) {
        newContext = setValueByPath(newContext, target, newList);
      } else {
        console.warn(
          `[executeAction] DELETE_ITEM: Item with id "${itemId}" not found in list at path "${target}".`
        );
      }
      break;
    }

    case ActionType.SAVE_TASK_CHANGES: {
      if (!target) {
        // target here would be the selectedTask.id passed from payload or event
        console.warn(
          "[executeAction] SAVE_TASK_CHANGES requires target (task ID)."
        );
        break;
      }
      const taskIdToSave = target;
      const currentTasks = getValueByPath(newContext, "tasks.data") as
        | DataItem[]
        | undefined;
      const selectedTaskData = getValueByPath(newContext, "selectedTask") as
        | DataItem
        | undefined;

      if (
        currentTasks &&
        selectedTaskData &&
        selectedTaskData.id === taskIdToSave
      ) {
        const updatedTasks = currentTasks.map(
          (task) =>
            task.id === taskIdToSave
              ? { ...task, ...selectedTaskData, ...payload }
              : task // Merge selectedTaskData and any direct payload changes
        );
        newContext = setValueByPath(newContext, "tasks.data", updatedTasks);
        newContext = setValueByPath(newContext, "selectedTask", null); // Clear selected task
        newContext = setValueByPath(
          newContext,
          "isTaskDetailDialogVisible",
          false
        ); // Hide dialog
        // console.log(
        //   `[executeAction] SAVE_TASK_CHANGES: Updated task ${taskIdToSave} and hid dialog.`
        // );
      } else {
        console.warn(
          "[executeAction] SAVE_TASK_CHANGES: Could not save. Task list, selected task, or ID mismatch.",
          {
            taskIdToSave,
            selectedTaskDataId: selectedTaskData?.id,
            currentTasksExists: !!currentTasks,
          }
        );
      }
      break;
    }

    default:
      console.warn(`[executeAction] Unhandled action type: ${action}`);
  }

  return newContext;
}

// Helper function to recursively make all child IDs within an instance unique
// Moved here to satisfy linter and define it once per resolveBindings call for a list parent
function makeChildIdsUniqueInInstance(
  parentNode: UISpecNode,
  baseInstanceId: string,
  originalTemplateRootId: string
) {
  if (parentNode.children) {
    parentNode.children = parentNode.children.map((child) => {
      // Attempt to get the original ID part, removing any previously prefixed instance ID
      let originalChildId = child.id;
      // This check is a bit heuristic; assumes original IDs don't naturally contain the template root ID with a dash.
      // A more robust way might involve storing original IDs separately if this becomes problematic.
      if (child.id.startsWith(originalTemplateRootId + "-")) {
        const parts = child.id.split("-");
        if (parts.length > 1) {
          // Takes the last part assuming it's the original specific ID part if multiple hyphens exist from prior processing
          originalChildId = parts[parts.length - 1];
        }
      }

      const newChildId = `${baseInstanceId}-${originalChildId}`;
      const newChild = {
        ...JSON.parse(JSON.stringify(child)), // Deep clone child
        id: newChildId,
      };
      makeChildIdsUniqueInInstance(
        newChild,
        baseInstanceId,
        originalTemplateRootId
      ); // Recurse with the same baseInstanceId
      return newChild;
    });
  }
}
