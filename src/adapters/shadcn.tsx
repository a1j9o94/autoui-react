import React from "react";
import { UISpecNode, UIEvent, UIEventType } from "../schema/ui";
import { componentConfig } from "../schema/components";

// This would typically import components from your shadcn UI library
// For this example, we'll create placeholder components

// Shimmer components
export const ShimmerBlock: React.FC = () => (
  <div className="w-full h-8 bg-gray-200 animate-pulse rounded" />
);

export const ShimmerTable: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="w-full space-y-2">
    <div className="w-full h-10 bg-gray-200 animate-pulse rounded" />
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="w-full h-12 bg-gray-200 animate-pulse rounded" />
    ))}
  </div>
);

export const ShimmerCard: React.FC = () => (
  <div className="w-full p-4 space-y-4 border rounded-lg">
    <div className="w-3/4 h-6 bg-gray-200 animate-pulse rounded" />
    <div className="space-y-2">
      <div className="w-full h-4 bg-gray-200 animate-pulse rounded" />
      <div className="w-full h-4 bg-gray-200 animate-pulse rounded" />
      <div className="w-5/6 h-4 bg-gray-200 animate-pulse rounded" />
    </div>
  </div>
);

// Mock ShadCN components for demonstration
const Container: React.FC<{
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}> = (props) => (
  <div className={`autoui-mock-container ${props.className || ""}`}>
    {props.children}
  </div>
);

const Header: React.FC<{ title: string; className?: string }> = ({
  title,
  className,
}) => (
  <header
    className={`py-4 px-6 border-b border-gray-300 mb-4 bg-gray-50 dark:bg-gray-800 ${
      className || ""
    }`}
  >
    <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
      {title}
    </h1>
  </header>
);

const Button: React.FC<{
  onClick?: (() => void) | undefined;
  children: React.ReactNode;
  variant?: "default" | "outline" | "destructive" | undefined;
}> = ({ onClick, children, variant = "default" }) => (
  <button
    className={`px-4 py-2 rounded-md font-medium transition-colors ${
      variant === "default"
        ? "bg-blue-600 text-white hover:bg-blue-700"
        : variant === "outline"
        ? "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        : "bg-red-600 text-white hover:bg-red-700"
    }`}
    onClick={() => onClick?.()}
  >
    {children}
  </button>
);

const Table: React.FC<{
  items?: Record<string, React.ReactNode>[] | undefined;
  fields?: { key: string; label: string }[] | undefined;
  onSelect?: ((item: Record<string, React.ReactNode>) => void) | undefined;
  selectable?: boolean | undefined;
}> = ({ items = [], fields = [], onSelect, selectable }) => (
  <div className="w-full border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
    <table className="w-full">
      <thead className="bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
        <tr>
          {fields.map((field) => (
            <th
              key={field.key}
              className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider"
            >
              {field.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
        {items.map((item, index) => (
          <tr
            key={index}
            onClick={() => selectable && onSelect && onSelect(item)}
            className={
              selectable
                ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                : ""
            }
          >
            {fields.map((field) => (
              <td
                key={field.key}
                className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-300"
              >
                {item[field.key] ?? ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Detail: React.FC<{
  data?: Record<string, React.ReactNode> | undefined;
  fields?: { key: string; label: string; type?: string }[] | undefined;
  title?: string | undefined;
  visible?: boolean | undefined;
  onBack?: (() => void) | undefined;
}> = ({ data, fields = [], title, visible = true, onBack }) => {
  if (!visible) return null;

  return (
    <div className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-6 space-y-4 bg-white dark:bg-gray-900 shadow-sm">
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
        {title && (
          <h2 className="text-lg font-medium text-gray-800 dark:text-white">
            {title}
          </h2>
        )}
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {fields.map((field) => {
          if (field.type === "heading") {
            return (
              <h3
                key={field.key}
                className="text-xl font-semibold text-gray-800 dark:text-white"
              >
                {data?.[field.key] ?? ""}
              </h3>
            );
          }

          if (field.type === "content") {
            return (
              <div
                key={field.key}
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                {data?.[field.key] ?? ""}
              </div>
            );
          }

          return (
            <div
              key={field.key}
              className="flex flex-col border-b border-gray-100 dark:border-gray-800 py-2"
            >
              {field.label && (
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                  {field.label}
                </span>
              )}
              <span className="text-sm text-gray-800 dark:text-gray-200">
                {data?.[field.key] ?? ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const getSafeProp = <T, K extends string, D extends T>(
  props: Record<string, unknown> | null | undefined,
  key: K,
  validator: (value: unknown) => value is T,
  defaultValue: D
): T | D => {
  if (props && typeof props === "object" && key in props) {
    const value = props[key];
    if (validator(value)) {
      return value;
    }
  }
  return defaultValue;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";
const isCSSProperties = (value: unknown): value is React.CSSProperties =>
  isObject(value); // Simplified check
const isButtonVariant = (
  value: unknown
): value is "default" | "outline" | "destructive" =>
  isString(value) && ["default", "outline", "destructive"].includes(value);

const getSafeBinding = <T, K extends string, D extends T>(
  bindings: Record<string, unknown> | null | undefined,
  key: K,
  validator: (value: unknown) => value is T,
  defaultValue: D
): T | D => {
  if (bindings && typeof bindings === "object" && key in bindings) {
    const value = bindings[key];
    if (validator(value)) {
      return value;
    }
  }
  return defaultValue;
};

const isArrayOf =
  <T extends object>(itemValidator: (item: unknown) => item is T) =>
  (arr: unknown): arr is T[] =>
    Array.isArray(arr) && arr.every(itemValidator);

const isReactNode = (value: unknown): value is React.ReactNode => {
  // This is a simplified check. A full check is complex.
  // For basic scenarios, we can check for string, number, boolean, null, undefined, or React elements.
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    typeof value === "undefined" ||
    (typeof value === "object" && value !== null && "$$typeof" in value) // Basic check for React element
  );
};

const isRecordWithReactNodeValues = (
  value: unknown
): value is Record<string, React.ReactNode> =>
  isObject(value) && Object.values(value).every(isReactNode);

const isFieldObject = (item: unknown): item is { key: string; label: string } =>
  isObject(item) && isString(item.key) && isString(item.label);

const isSelectOptionObject = (
  item: unknown
): item is { value: string; label: string } =>
  isObject(item) && isString(item.value) && isString(item.label);

const isTabObject = (
  item: unknown
): item is { value: string; label: string; content?: UISpecNode } => // Allow content to be optional initially
  isObject(item) &&
  isString(item.value) &&
  isString(item.label) &&
  (item.content === undefined || isUISpecNode(item.content));

const isUISpecNode = (value: unknown): value is UISpecNode => {
  if (!isObject(value)) return false;
  return isString(value.id) && isString(value.node_type); // Basic check
};

const isDetailFieldObject = (
  item: unknown
): item is { key: string; label: string; type?: string } =>
  isObject(item) &&
  isString(item.key) &&
  isString(item.label) &&
  (item.type === undefined || isString(item.type));

// Mock implementation - in a real application, this would dispatch events to your state engine
const createEventHandler = (
  node: UISpecNode,
  eventName: string,
  uiEventType: UIEventType,
  processEvent?: (event: UIEvent) => void
) => {
  const eventConfig = node.events?.[uiEventType];
  if (!processEvent || !eventConfig) return undefined;

  return (eventPayload?: Record<string, unknown>) => {
    const fullEvent: UIEvent = {
      type: uiEventType,
      nodeId: node.id,
      timestamp: Date.now(),
      payload: {
        ...(eventConfig.payload || {}),
        ...(eventPayload || {}),
      },
    };
    processEvent(fullEvent);
  };
};

export const adapterMap: Record<
  string,
  (
    node: UISpecNode,
    processEvent?: (event: UIEvent) => void
  ) => React.ReactElement
> = {
  Container: (node, processEvent) => (
    <Container
      style={getSafeProp(node.props, "style", isCSSProperties, {})}
      className={getSafeProp(node.props, "className", isString, "")}
    >
      {node.children?.map((child) => renderNode(child, processEvent))}
    </Container>
  ),

  Header: (node) => (
    <Header
      title={getSafeProp(node.props, "title", isString, "Untitled")}
      className={getSafeProp(node.props, "className", isString, "")}
    />
  ),

  Button: (node, processEvent) => (
    <Button
      variant={getSafeProp(node.props, "variant", isButtonVariant, "default")}
      onClick={createEventHandler(node, "onClick", "CLICK", processEvent)}
    >
      {getSafeProp(node.props, "label", isString, "Button")}
    </Button>
  ),

  ListView: (node, processEvent) => {
    const items = getSafeBinding(
      node.bindings,
      "items",
      isArrayOf(isRecordWithReactNodeValues),
      []
    );
    const fields = getSafeBinding(
      node.bindings,
      "fields",
      isArrayOf(isFieldObject),
      []
    );
    const selectable = getSafeProp(node.props, "selectable", isBoolean, false);

    return (
      <Table
        items={items as Record<string, React.ReactNode>[]}
        fields={fields}
        selectable={selectable}
        onSelect={(item) => {
          const handler = createEventHandler(
            node,
            "onSelect",
            "CLICK",
            processEvent
          );
          if (handler) {
            handler({ selectedItem: item });
          }
        }}
      />
    );
  },

  Detail: (node, processEvent) => {
    const data = getSafeBinding(
      node.bindings,
      "data",
      isRecordWithReactNodeValues,
      {}
    ) as Record<string, React.ReactNode>;
    const fields = getSafeBinding(
      node.bindings,
      "fields",
      isArrayOf(isDetailFieldObject),
      []
    );
    const title = getSafeProp(node.props, "title", isString, "");
    const visible = getSafeProp(node.props, "visible", isBoolean, true);

    return (
      <Detail
        data={data}
        fields={fields}
        title={title}
        visible={visible}
        onBack={createEventHandler(node, "onBack", "CLICK", processEvent)}
      />
    );
  },

  Card: (node, processEvent) => (
    <Card className={getSafeProp(node.props, "className", isString, "")}>
      {node.children?.map((child) => renderNode(child, processEvent))}
    </Card>
  ),

  Input: (node, processEvent) => (
    <Input
      name={getSafeProp(node.props, "name", isString, "inputName")}
      label={getSafeProp(node.props, "label", isString, "")}
      placeholder={getSafeProp(node.props, "placeholder", isString, "")}
      disabled={getSafeProp(node.props, "disabled", isBoolean, false)}
      value={getSafeBinding(node.bindings, "value", isString, "")}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const handler = createEventHandler(
          node,
          "onChange",
          "CHANGE",
          processEvent
        );
        if (handler) handler({ value: e.target.value });
      }}
      onFocus={
        createEventHandler(node, "onFocus", "FOCUS", processEvent) || undefined
      }
      onBlur={
        createEventHandler(node, "onBlur", "BLUR", processEvent) || undefined
      }
      className={getSafeProp(node.props, "className", isString, "")}
    />
  ),

  Select: (node, processEvent) => (
    <Select
      name={getSafeProp(node.props, "name", isString, "selectName")}
      options={getSafeBinding(
        node.bindings,
        "options",
        isArrayOf(isSelectOptionObject),
        []
      )}
      label={getSafeProp(node.props, "label", isString, "")}
      placeholder={getSafeProp(node.props, "placeholder", isString, "")}
      disabled={getSafeProp(node.props, "disabled", isBoolean, false)}
      value={getSafeBinding(node.bindings, "value", isString, "")}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
        const handler = createEventHandler(
          node,
          "onChange",
          "CHANGE",
          processEvent
        );
        if (handler) handler({ value: e.target.value });
      }}
      className={getSafeProp(node.props, "className", isString, "")}
    />
  ),

  Textarea: (node, processEvent) => (
    <Textarea
      name={getSafeProp(node.props, "name", isString, "textareaName")}
      label={getSafeProp(node.props, "label", isString, "")}
      placeholder={getSafeProp(node.props, "placeholder", isString, "")}
      disabled={getSafeProp(node.props, "disabled", isBoolean, false)}
      rows={getSafeProp(
        node.props,
        "rows",
        (v): v is number => typeof v === "number",
        3
      )}
      value={getSafeBinding(node.bindings, "value", isString, "")}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const handler = createEventHandler(
          node,
          "onChange",
          "CHANGE",
          processEvent
        );
        if (handler) handler({ value: e.target.value });
      }}
      onFocus={
        createEventHandler(node, "onFocus", "FOCUS", processEvent) || undefined
      }
      onBlur={
        createEventHandler(node, "onBlur", "BLUR", processEvent) || undefined
      }
      className={getSafeProp(node.props, "className", isString, "")}
    />
  ),

  Checkbox: (node, processEvent) => (
    <Checkbox
      name={getSafeProp(node.props, "name", isString, "checkboxName")}
      label={getSafeProp(node.props, "label", isString, "")}
      checked={getSafeBinding(node.bindings, "checked", isBoolean, false)}
      disabled={getSafeProp(node.props, "disabled", isBoolean, false)}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const handler = createEventHandler(
          node,
          "onChange",
          "CHANGE",
          processEvent
        );
        if (handler) handler({ checked: e.target.checked });
      }}
      className={getSafeProp(node.props, "className", isString, "")}
    />
  ),

  RadioGroup: (node, processEvent) => (
    <RadioGroup
      name={getSafeProp(node.props, "name", isString, "radioGroupName")}
      options={getSafeBinding(
        node.bindings,
        "options",
        isArrayOf(isSelectOptionObject),
        []
      )}
      label={getSafeProp(node.props, "label", isString, "")}
      value={getSafeBinding(node.bindings, "value", isString, "")}
      disabled={getSafeProp(node.props, "disabled", isBoolean, false)}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const handler = createEventHandler(
          node,
          "onChange",
          "CHANGE",
          processEvent
        );
        if (handler) handler({ value: e.target.value });
      }}
      className={getSafeProp(node.props, "className", isString, "")}
    />
  ),

  Tabs: (node, processEvent) => {
    // For Tabs, children are defined by the 'tabs' prop which includes content as UISpecNode
    // We need to render these UISpecNode children.
    const rawTabs = getSafeBinding(
      node.bindings,
      "tabs",
      isArrayOf(isTabObject),
      []
    );
    const tabs = rawTabs.map((tab) => ({
      ...tab,
      content: tab.content
        ? renderNode(tab.content, processEvent)
        : "No content", // Render child node or provide fallback
    }));

    return (
      <Tabs
        tabs={tabs}
        defaultValue={getSafeProp(node.props, "defaultValue", isString, "")}
        onChange={(value: string) => {
          const handler = createEventHandler(
            node,
            "onChange",
            "CHANGE",
            processEvent
          );
          if (handler) handler({ value });
        }}
        className={getSafeProp(node.props, "className", isString, "")}
      />
    );
  },

  Dialog: (node, processEvent) => (
    <Dialog
      title={getSafeProp(node.props, "title", isString, "Dialog Title")}
      open={getSafeBinding(node.bindings, "open", isBoolean, false)}
      description={getSafeProp(node.props, "description", isString, "")}
      onClose={
        createEventHandler(node, "onClose", "CLICK", processEvent) || undefined
      }
      className={getSafeProp(node.props, "className", isString, "")}
    >
      {node.children?.map((child) => renderNode(child, processEvent))}
    </Dialog>
  ),

  Heading: (node) => (
    <Heading
      text={getSafeProp(node.props, "text", isString, "Heading")}
      size={getSafeProp(node.props, "size", isString, "h2")}
      className={getSafeProp(node.props, "className", isString, "")}
    />
  ),

  Text: (node) => (
    <Text
      text={getSafeProp(node.props, "text", isString, "Some text")}
      size={getSafeProp(node.props, "size", isString, "p")} // Size might not be directly applicable for <p> with Tailwind
      className={getSafeProp(node.props, "className", isString, "")}
    />
  ),
};

export function renderNode(
  node: UISpecNode,
  processEvent?: (event: UIEvent) => void
): React.ReactElement {
  const mappedComponent = adapterMap[node.node_type];
  if (mappedComponent) {
    return mappedComponent(node, processEvent);
  }
  console.warn(`Unknown node type: ${node.node_type}`);
  return React.createElement(
    Container,
    {},
    `Unknown node type: ${node.node_type}`
  );
}

// Export the component configuration for reference
export { componentConfig };

// Mock ShadCN components for demonstration
const Card: React.FC<{ className?: string; children?: React.ReactNode }> = ({
  className,
  children,
}) => (
  <div
    className={`autoui-mock-card border rounded-lg p-4 shadow ${
      className || ""
    }`}
  >
    {children}
  </div>
);

const Input: React.FC<{
  name: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (() => void) | undefined;
  onBlur?: (() => void) | undefined;
  className?: string;
}> = ({
  name,
  label,
  placeholder,
  disabled,
  value,
  onChange,
  onFocus,
  onBlur,
  className,
}) => (
  <div className={`autoui-mock-input-container ${className || ""}`}>
    {label && (
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label}
      </label>
    )}
    <input
      type="text"
      id={name}
      name={name}
      placeholder={placeholder}
      disabled={disabled}
      value={value ?? ""}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
    />
  </div>
);

const Select: React.FC<{
  name: string;
  options: { value: string; label: string }[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
}> = ({
  name,
  options,
  label,
  placeholder,
  disabled,
  value,
  onChange,
  className,
}) => (
  <div className={`autoui-mock-select-container ${className || ""}`}>
    {label && (
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label}
      </label>
    )}
    <select
      id={name}
      name={name}
      disabled={disabled}
      value={value ?? ""}
      onChange={onChange}
      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const Textarea: React.FC<{
  name: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  value?: string;
  rows?: number;
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onFocus?: (() => void) | undefined;
  onBlur?: (() => void) | undefined;
  className?: string;
}> = ({
  name,
  label,
  placeholder,
  disabled,
  value,
  rows,
  onChange,
  onFocus,
  onBlur,
  className,
}) => (
  <div className={`autoui-mock-textarea-container ${className || ""}`}>
    {label && (
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label}
      </label>
    )}
    <textarea
      id={name}
      name={name}
      placeholder={placeholder}
      disabled={disabled}
      value={value ?? ""}
      rows={rows}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
    />
  </div>
);

const Checkbox: React.FC<{
  name: string;
  label?: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}> = ({ name, label, checked, disabled, onChange, className }) => (
  <div
    className={`autoui-mock-checkbox-container flex items-center ${
      className || ""
    }`}
  >
    <input
      type="checkbox"
      id={name}
      name={name}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className="h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
    />
    {label && (
      <label
        htmlFor={name}
        className="ml-2 block text-sm text-gray-900 dark:text-gray-300"
      >
        {label}
      </label>
    )}
  </div>
);

const RadioGroup: React.FC<{
  name: string;
  options: { value: string; label: string }[];
  label?: string;
  value?: string;
  disabled?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}> = ({ name, options, label, value, disabled, onChange, className }) => (
  <div className={`autoui-mock-radiogroup-container ${className || ""}`}>
    {label && (
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
    )}
    <div className="space-y-2">
      {options.map((option) => (
        <div key={option.value} className="flex items-center">
          <input
            type="radio"
            id={`${name}-${option.value}`}
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={onChange}
            className="h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 focus:ring-indigo-500"
          />
          <label
            htmlFor={`${name}-${option.value}`}
            className="ml-2 block text-sm text-gray-900 dark:text-gray-300"
          >
            {option.label}
          </label>
        </div>
      ))}
    </div>
  </div>
);

const Tabs: React.FC<{
  tabs: { value: string; label: string; content: React.ReactNode }[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
}> = ({ tabs, defaultValue, onChange, className }) => {
  const [activeTab, setActiveTab] = React.useState(
    defaultValue || (tabs.length > 0 ? tabs[0].value : "")
  );

  const handleTabClick = (value: string) => {
    setActiveTab(value);
    onChange?.(value);
  };

  return (
    <div className={`autoui-mock-tabs-container ${className || ""}`}>
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabClick(tab.value)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.value
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="pt-5">
        {tabs.find((tab) => tab.value === activeTab)?.content}
      </div>
    </div>
  );
};

const Dialog: React.FC<{
  title: string;
  open?: boolean;
  onClose?: (() => void) | undefined;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}> = ({ title, open, onClose, description, children, className }) => {
  if (!open) return null;

  return (
    <div
      className={`autoui-mock-dialog-overlay fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity ${
        className || ""
      }`}
    >
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
            <div className="bg-white dark:bg-gray-800 px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <h3
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                    id="modal-title"
                  >
                    {title}
                  </h3>
                  {description && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {description}
                      </p>
                    </div>
                  )}
                  {children && <div className="mt-4">{children}</div>}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <Button onClick={onClose}>Close</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Heading: React.FC<{
  text: string;
  size?: string;
  className?: string;
}> = ({ text, size = "h2", className }) => {
  const Tag = size as keyof JSX.IntrinsicElements; // e.g. "h1", "h2"
  return (
    <Tag
      className={`font-semibold text-gray-800 dark:text-white ${
        className || ""
      }`}
    >
      {text}
    </Tag>
  );
};

const Text: React.FC<{ text: string; size?: string; className?: string }> = ({
  text,
  className,
}) => {
  // Note: size prop might not directly apply to <p> with Tailwind, styling is primarily via className
  return (
    <p className={`text-gray-700 dark:text-gray-300 ${className || ""}`}>
      {text}
    </p>
  );
};
