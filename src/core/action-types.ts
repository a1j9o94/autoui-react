// Centralized enums for UI event and action types

export enum UIEventType {
  INIT = "INIT",
  CLICK = "CLICK",
  CHANGE = "CHANGE",
  SUBMIT = "SUBMIT",
  MOUSEOVER = "MOUSEOVER",
  MOUSEOUT = "MOUSEOUT",
  FOCUS = "FOCUS",
  BLUR = "BLUR",
}

export enum ActionType {
  FULL_REFRESH = "FULL_REFRESH", // Generate a completely new UI
  UPDATE_NODE = "UPDATE_NODE", // Update a specific node, potentially with new children
  UPDATE_DATA = "UPDATE_DATA", // Add this for input changes
  ADD_DROPDOWN = "ADD_DROPDOWN", // Add a dropdown to a specific node
  SHOW_DETAIL = "SHOW_DETAIL", // Show a detail view
  HIDE_DETAIL = "HIDE_DETAIL", // Hide a detail view
  HIDE_DIALOG = "HIDE_DIALOG", // Explicitly add HIDE_DIALOG
  SAVE_TASK_CHANGES = "SAVE_TASK_CHANGES", // Add action for saving
  TOGGLE_STATE = "TOGGLE_STATE", // Toggle a boolean state (expanded, selected, etc.)
  UPDATE_FORM = "UPDATE_FORM", // Update a form based on selections
  NAVIGATE = "NAVIGATE", // Navigate to a different view
  OPEN_DIALOG = "OPEN_DIALOG", // Open a dialog (for clarity)
  CLOSE_DIALOG = "CLOSE_DIALOG", // Close a dialog (for clarity)
  UPDATE_CONTEXT = "UPDATE_CONTEXT", // Generic context update
} 