import { UIAction, UIState, UISpecNode } from "../schema/ui";

/**
 * Deep clones a UI node tree
 * @param node - Node to clone
 * @returns Cloned node
 */
function cloneNode(node: UISpecNode): UISpecNode {
  return {
    ...node,
    props: node.props ? { ...node.props } : null,
    bindings: node.bindings ? { ...node.bindings } : null,
    events: node.events ? { ...node.events } : null,
    children: node.children
      ? node.children.map((child) => cloneNode(child))
      : null,
  };
}

/**
 * Find a specific node in the UI tree by ID
 * @param tree - UI tree to search
 * @param nodeId - ID of the node to find
 * @returns The found node or undefined
 */
export function findNodeById(
  tree: UISpecNode | undefined,
  nodeId: string
): UISpecNode | undefined {
  if (!tree) return undefined;
  if (tree.id === nodeId) return tree;

  if (tree.children) {
    for (const child of tree.children) {
      const found = findNodeById(child, nodeId);
      if (found) return found;
    }
  }

  return undefined;
}

/**
 * Updates a specific node in the UI tree
 * @param tree - Original UI tree
 * @param nodeId - ID of the node to update
 * @param updater - Function that returns the updated node
 * @returns Updated UI tree
 */
export function updateNodeById(
  tree: UISpecNode,
  nodeId: string,
  updater: (node: UISpecNode) => UISpecNode
): UISpecNode {
  // Clone the tree to avoid mutations
  const result = cloneNode(tree);

  // Find the parent path to the node
  function findPath(
    node: UISpecNode,
    id: string,
    currentPath: UISpecNode[] = []
  ): UISpecNode[] | null {
    const newPath = [...currentPath, node];

    if (node.id === id) {
      return newPath;
    }

    if (node.children) {
      for (const child of node.children) {
        const path = findPath(child, id, newPath);
        if (path) return path;
      }
    }

    return null;
  }

  const path = findPath(result, nodeId);
  if (!path) return result; // Node not found, return original

  // The last item in the path is the node to update
  const nodeToUpdate = path[path.length - 1];
  const updatedNode = updater(nodeToUpdate);

  // If this is the root node, return the updated node
  if (path.length === 1) {
    return updatedNode;
  }

  // Otherwise, update the parent's children
  const parent = path[path.length - 2];
  const updatedParent = {
    ...parent,
    children: parent.children
      ? parent.children.map((child) =>
          child.id === nodeId ? updatedNode : child
        )
      : null,
  };

  // If the parent is root, return it
  if (path.length === 2) {
    return updatedParent;
  }

  // Otherwise, recursively update up the tree
  return updateNodeById(result, parent.id, () => updatedParent);
}

/**
 * Replace a specific node in the UI tree
 * @param tree - Original UI tree
 * @param nodeId - ID of the node to replace
 * @param newNode - New node to insert
 * @returns Updated UI tree
 */
export function replaceNodeById(
  tree: UISpecNode,
  nodeId: string,
  newNode: UISpecNode
): UISpecNode {
  return updateNodeById(tree, nodeId, () => newNode);
}

/**
 * Add a child node to a specific parent node
 * @param tree - Original UI tree
 * @param parentId - ID of the parent node
 * @param newChild - Child node to add
 * @param index - Optional index to insert at (default: append)
 * @returns Updated UI tree
 */
export function addChildNode(
  tree: UISpecNode,
  parentId: string,
  newChild: UISpecNode,
  index?: number
): UISpecNode {
  return updateNodeById(tree, parentId, (node) => {
    const children = node.children ? [...node.children] : [];

    if (index !== undefined && index >= 0 && index <= children.length) {
      children.splice(index, 0, newChild);
    } else {
      children.push(newChild);
    }

    return {
      ...node,
      children,
    };
  });
}

/**
 * Remove a node from the UI tree
 * @param tree - Original UI tree
 * @param nodeId - ID of the node to remove
 * @returns Updated UI tree
 */
export function removeNodeById(tree: UISpecNode, nodeId: string): UISpecNode {
  // Find the parent of the node
  function findParent(node: UISpecNode, id: string): UISpecNode | null {
    if (node.children) {
      if (node.children.some((child) => child.id === id)) {
        return node;
      }

      for (const child of node.children) {
        const parent = findParent(child, id);
        if (parent) return parent;
      }
    }

    return null;
  }

  // Clone the tree to avoid mutations
  const result = cloneNode(tree);

  // If trying to remove the root, return empty tree
  if (result.id === nodeId) {
    throw new Error("Cannot remove root node");
  }

  const parent = findParent(result, nodeId);
  if (!parent) return result; // Node not found, return original

  // Update the parent by filtering out the node
  return updateNodeById(result, parent.id, (node) => ({
    ...node,
    children: node.children
      ? node.children.filter((child) => child.id !== nodeId)
      : null,
  }));
}

/**
 * Pure reducer function for the UI state engine
 * @param state - Current state
 * @param action - Action to apply
 * @returns New state
 */
export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case "UI_EVENT": {
      // Prevent duplicate INIT events
      if (
        action.event.type === "INIT" &&
        state.history.some((e) => e.type === "INIT")
      ) {
        console.log("[AutoUI uiReducer] Ignoring duplicate INIT event");
        return state; // Ignore duplicate INIT
      }
      // Add the event to history and set loading state
      return {
        ...state,
        loading: true,
        history: [...state.history, action.event],
      };
    }

    case "AI_RESPONSE": {
      // Replace the layout with the new node and set loading to false
      return {
        ...state,
        layout: action.node,
        loading: false,
        error: null,
      };
    }

    case "PARTIAL_UPDATE": {
      if (!state.layout) {
        return {
          ...state,
          layout: action.node,
          loading: false,
          error: null,
        };
      }

      // Find the node to update
      if (action.nodeId === "root" || action.nodeId === state.layout.id) {
        // Root node replacement
        return {
          ...state,
          layout: action.node,
          loading: false,
          error: null,
        };
      }

      // Replace a specific node in the tree
      return {
        ...state,
        layout: replaceNodeById(state.layout, action.nodeId, action.node),
        loading: false,
        error: null,
      };
    }

    case "ADD_NODE": {
      if (!state.layout) {
        // Cannot add to a null layout, perhaps set the new node as root or error
        return {
          ...state,
          error: "Cannot add node: Layout is empty.",
          loading: false,
        };
      }
      return {
        ...state,
        layout: addChildNode(
          state.layout,
          action.parentId,
          action.node,
          action.index === null ? undefined : action.index
        ),
        loading: false,
        error: null,
      };
    }

    case "REMOVE_NODE": {
      if (!state.layout) {
        return {
          ...state,
          error: "Cannot remove node: Layout is empty.",
          loading: false,
        };
      }
      try {
        return {
          ...state,
          layout: removeNodeById(state.layout, action.nodeId),
          loading: false,
          error: null,
        };
      } catch (e: unknown) {
        const errorMessage =
          e instanceof Error ? e.message : "Failed to remove node.";
        return {
          ...state,
          error: errorMessage,
          loading: false,
        };
      }
    }

    case "ERROR": {
      return {
        ...state,
        error: action.message,
        loading: false,
      };
    }

    case "LOADING": {
      return {
        ...state,
        loading: action.isLoading,
      };
    }

    case "SET_DATA_CONTEXT": {
      return {
        ...state,
        dataContext: action.payload,
      };
    }

    default:
      return state;
  }
}

/**
 * Initial state for the UI state engine
 */
export const initialState: UIState = {
  layout: null,
  loading: true,
  error: null,
  history: [],
  dataContext: {},
};
