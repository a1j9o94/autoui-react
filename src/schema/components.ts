/**
 * Component definitions for shadcn/ui integration
 * This file defines which components from shadcn/ui are used by AutoUI
 */

import { z } from "zod";

// Define all possible component types
export const componentType = z.enum([
  // Layout components
  "Container",
  "Card",
  "Header",

  // Input components
  "Button",
  "Input",
  "Select",
  "Textarea",
  "Checkbox",
  "RadioGroup",

  // Data display components
  "ListView",
  "Detail",
  "Tabs",
  "Dialog",

  // Typography
  "Heading",
  "Text",
]);

export type ComponentType = z.infer<typeof componentType>;

// Map component types to their shadcn component and required props
export const componentConfig = {
  Button: {
    component: "Button",
    requiredProps: ["label"],
    optionalProps: ["variant", "size", "disabled"],
    events: ["onClick"],
  },
  Card: {
    component: "Card",
    requiredProps: [],
    optionalProps: ["className"],
    events: [],
  },
  Input: {
    component: "Input",
    requiredProps: ["name"],
    optionalProps: ["label", "placeholder", "disabled", "value"],
    events: ["onChange", "onFocus", "onBlur"],
  },
  Select: {
    component: "Select",
    requiredProps: ["name", "options"],
    optionalProps: ["label", "placeholder", "disabled", "value"],
    events: ["onChange"],
  },
  Textarea: {
    component: "Textarea",
    requiredProps: ["name"],
    optionalProps: ["label", "placeholder", "disabled", "value", "rows"],
    events: ["onChange", "onFocus", "onBlur"],
  },
  Container: {
    component: "div",
    requiredProps: [],
    optionalProps: ["className", "style"],
    events: [],
  },
  Header: {
    component: "header",
    requiredProps: ["title"],
    optionalProps: ["className"],
    events: [],
  },
  ListView: {
    component: "Table",
    requiredProps: ["fields"],
    optionalProps: ["items", "selectable"],
    events: ["onSelect"],
  },
  Detail: {
    component: "div",
    requiredProps: ["fields"],
    optionalProps: ["data", "title", "visible"],
    events: ["onBack"],
  },
  Dialog: {
    component: "Dialog",
    requiredProps: ["title"],
    optionalProps: ["open", "onClose", "description"],
    events: ["onClose"],
  },
  Tabs: {
    component: "Tabs",
    requiredProps: ["tabs"],
    optionalProps: ["defaultValue"],
    events: ["onChange"],
  },
  Heading: {
    component: "h2",
    requiredProps: ["text"],
    optionalProps: ["size", "className"],
    events: [],
  },
  Text: {
    component: "p",
    requiredProps: ["text"],
    optionalProps: ["size", "className"],
    events: [],
  },
  Checkbox: {
    component: "Checkbox",
    requiredProps: ["name"],
    optionalProps: ["label", "checked", "disabled"],
    events: ["onChange"],
  },
  RadioGroup: {
    component: "RadioGroup",
    requiredProps: ["name", "options"],
    optionalProps: ["label", "value", "disabled"],
    events: ["onChange"],
  },
};

// List of required shadcn components for the setup script
export const shadcnComponents = [
  "button",
  "card",
  "dialog",
  "dropdown-menu",
  "form",
  "input",
  "label",
  "select",
  "table",
  "tabs",
  "textarea",
  "checkbox",
  "radio-group",
];
