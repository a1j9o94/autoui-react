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
    onClick={onClick}
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
