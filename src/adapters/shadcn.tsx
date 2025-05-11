import React from "react";
import { UISpecNode } from "../schema/ui";
import { componentConfig, ComponentType } from "../schema/components";

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
  <div
    className={`w-full text-gray-800 dark:text-gray-100 ${
      props.className || ""
    }`}
    style={{ ...props.style, color: "inherit" }}
  >
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
  items?: any[] | undefined;
  fields?: { key: string; label: string }[] | undefined;
  onSelect?: ((item: any) => void) | undefined;
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
                {item[field.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Detail: React.FC<{
  data?: any | undefined;
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
                {data?.[field.key]}
              </h3>
            );
          }

          if (field.type === "content") {
            return (
              <div
                key={field.key}
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                {data?.[field.key]}
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
                {data?.[field.key]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Mock implementation - in a real application, this would dispatch events to your state engine
const createEventHandler = (node: UISpecNode, eventName: string) => {
  const eventConfig = node.events?.[eventName];
  if (!eventConfig) return undefined;

  return () => {
    console.log(`Event triggered: ${eventName} on node ${node.id}`, {
      action: eventConfig.action,
      target: eventConfig.target,
      payload: eventConfig.payload,
    });
    // In real implementation: dispatch({ type: 'UI_EVENT', event: { ... } })
  };
};

// Adapter function to map node types to shadcn components
export const adapterMap: Record<
  string,
  (node: UISpecNode) => React.ReactElement
> = {
  Container: (node) => (
    <Container
      style={node.props?.style as React.CSSProperties}
      className={node.props?.className as string}
    >
      {node.children?.map((child) => renderNode(child))}
    </Container>
  ),

  Header: (node) => (
    <Header
      title={(node.props?.title as string) || "Untitled"}
      className={node.props?.className as string}
    />
  ),

  Button: (node) => (
    <Button
      variant={
        node.props?.variant as "default" | "outline" | "destructive" | undefined
      }
      onClick={createEventHandler(node, "onClick")}
    >
      {(node.props?.label as string) || "Button"}
    </Button>
  ),

  ListView: (node) => (
    <Table
      items={(node.bindings?.items as any[]) || []}
      fields={(node.bindings?.fields as { key: string; label: string }[]) || []}
      selectable={node.props?.selectable as boolean | undefined}
      onSelect={createEventHandler(node, "onSelect")}
    />
  ),

  Detail: (node) => (
    <Detail
      data={node.bindings?.data}
      fields={
        (node.bindings?.fields as {
          key: string;
          label: string;
          type?: string;
        }[]) || []
      }
      title={node.props?.title as string}
      visible={node.props?.visible !== false}
      onBack={createEventHandler(node, "onBack")}
    />
  ),
};

// Helper to render a node using the adapter map
export function renderNode(node: UISpecNode): React.ReactElement {
  const Component = adapterMap[node.node_type];

  if (Component) {
    return Component(node);
  }

  // Fallback for unsupported node types
  return (
    <div className="p-2 border border-red-300 rounded">
      <p className="text-sm text-red-500">
        Unsupported component: {node.node_type}
      </p>
      {node.children?.map((child) => renderNode(child))}
    </div>
  );
}

// Export the component configuration for reference
export { componentConfig };
