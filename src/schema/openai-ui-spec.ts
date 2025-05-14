import { z } from "zod";
import { componentType } from "./components";

// Zod enum for ActionType using the values from the TypeScript enum
const actionTypeEnum = z.enum([
  "FULL_REFRESH",
  "UPDATE_NODE",
  "UPDATE_DATA",
  "ADD_DROPDOWN",
  "SHOW_DETAIL",
  "HIDE_DETAIL",
  "HIDE_DIALOG",
  "SAVE_TASK_CHANGES",
  "TOGGLE_STATE",
  "UPDATE_FORM",
  "NAVIGATE",
  "OPEN_DIALOG",
  "CLOSE_DIALOG",
  "UPDATE_CONTEXT",
]);

// For OpenAI: props/bindings are records of these simplified values, or null.
const openAISimplifiedValue = z.string().nullable();
const openAIRecordSimplifiedNullable = z
  .record(openAISimplifiedValue)
  .nullable();
const openAIEventPayloadSimplifiedNullable = z
  .record(openAISimplifiedValue)
  .nullable();

const openAIBaseNode = z.object({
  id: z.string().describe("Unique identifier for the UI node."),
  node_type: componentType.describe(
    "The type of UI component (e.g., Container, Text, Button, ListView)."
  ),
  props: openAIRecordSimplifiedNullable.describe(
    'Component-specific properties (attributes). Values should be strings or null. E.g., for Header use { "title": "My Title" }; for Text use { "text": "My Text" }; for Button use { "label": "My Button Label" }.'
  ),
  bindings: openAIRecordSimplifiedNullable.describe(
    'Data bindings map context paths to component props. Values are paths (e.g., "user.name") or templates (e.g., "{{item.title}}")...'
  ),
  events: z
    .record(
      z.string(),
      z.object({
        action: actionTypeEnum.describe(
          'Action identifier (e.g., "UPDATE_DATA", "ADD_ITEM", "DELETE_ITEM", "VIEW_DETAIL", "HIDE_DETAIL"). Defines what operation to perform when the event occurs.'
        ),
        target: z.string().describe("Target identifier."),
        payload: openAIEventPayloadSimplifiedNullable.describe(
          "Static payload to merge with the event's runtime payload."
        ),
      })
    )
    .nullable()
    .describe(
      'Defines event handlers mapped from UIEventType (e.g., "CLICK", "CHANGE") to an action configuration.'
    ),
  children: z.null(),
});

const openAINodeL4 = openAIBaseNode;
const openAINodeL3 = openAIBaseNode.extend({
  children: z.array(openAINodeL4).nullable(),
});
const openAINodeL2 = openAIBaseNode.extend({
  children: z.array(openAINodeL3).nullable(),
});

export const openAIUISpec = openAIBaseNode.extend({
  children: z.array(openAINodeL2).nullable(),
});

export type OpenAIUISpec = z.infer<typeof openAIUISpec>;
