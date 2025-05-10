import React from 'react';
import { UISpecNode } from '../schema/ui';

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
const Container: React.FC<{ style?: React.CSSProperties; className?: string; children?: React.ReactNode }> = (props) => (
  <div className={`w-full ${props.className || ''}`} style={props.style}>
    {props.children}
  </div>
);

const Header: React.FC<{ title: string }> = ({ title }) => (
  <header className="py-4 px-6 border-b mb-4">
    <h1 className="text-xl font-semibold">{title}</h1>
  </header>
);

const Button: React.FC<{ 
  onClick?: () => void; 
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'destructive';
}> = ({ onClick, children, variant = 'default' }) => (
  <button 
    className={`px-4 py-2 rounded font-medium ${
      variant === 'default' ? 'bg-blue-600 text-white' : 
      variant === 'outline' ? 'border border-gray-300 text-gray-700' :
      'bg-red-600 text-white'
    }`}
    onClick={onClick}
  >
    {children}
  </button>
);

const Table: React.FC<{
  items?: any[];
  fields?: { key: string; label: string }[];
  onSelect?: (item: any) => void;
  selectable?: boolean;
}> = ({ items = [], fields = [], onSelect, selectable }) => (
  <div className="w-full border rounded-lg overflow-hidden">
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          {fields.map((field) => (
            <th key={field.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {field.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {items.map((item, index) => (
          <tr 
            key={index}
            onClick={() => selectable && onSelect && onSelect(item)}
            className={selectable ? 'cursor-pointer hover:bg-gray-50' : ''}
          >
            {fields.map((field) => (
              <td key={field.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
  data?: any;
  fields?: { key: string; label: string; type?: string }[];
  title?: string;
  visible?: boolean;
  onBack?: () => void;
}> = ({ data, fields = [], title, visible = true, onBack }) => {
  if (!visible) return null;
  
  return (
    <div className="w-full border rounded-lg p-6 space-y-4">
      <div className="flex justify-between items-center">
        {title && <h2 className="text-lg font-medium">{title}</h2>}
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
      </div>
      
      <div className="space-y-4">
        {fields.map((field) => {
          if (field.type === 'heading') {
            return (
              <h3 key={field.key} className="text-xl font-semibold">
                {data?.[field.key]}
              </h3>
            );
          }
          
          if (field.type === 'content') {
            return (
              <div key={field.key} className="text-sm text-gray-700">
                {data?.[field.key]}
              </div>
            );
          }
          
          return (
            <div key={field.key} className="flex flex-col">
              {field.label && (
                <span className="text-xs text-gray-500">{field.label}</span>
              )}
              <span className="text-sm">{data?.[field.key]}</span>
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
export const adapterMap: Record<string, (node: UISpecNode) => React.ReactElement> = {
  Container: (node) => (
    <Container style={node.props?.style} className={node.props?.className}>
      {node.children?.map((child) => renderNode(child))}
    </Container>
  ),
  
  Header: (node) => (
    <Header title={node.props?.title || 'Untitled'} />
  ),
  
  Button: (node) => (
    <Button 
      variant={node.props?.variant} 
      onClick={createEventHandler(node, 'onClick')}
    >
      {node.props?.label || 'Button'}
    </Button>
  ),
  
  ListView: (node) => (
    <Table 
      items={node.bindings?.items || []}
      fields={node.bindings?.fields || []}
      selectable={node.props?.selectable}
      onSelect={createEventHandler(node, 'onSelect')}
    />
  ),
  
  Detail: (node) => (
    <Detail 
      data={node.bindings?.data}
      fields={node.bindings?.fields || []}
      title={node.props?.title}
      visible={node.props?.visible !== false}
      onBack={createEventHandler(node, 'onBack')}
    />
  ),
};

// Helper to render a node using the adapter map
export function renderNode(node: UISpecNode): React.ReactElement {
  const Component = adapterMap[node.type];
  
  if (Component) {
    return Component(node);
  }
  
  // Fallback for unsupported node types
  return (
    <div className="p-2 border border-red-300 rounded">
      <p className="text-sm text-red-500">Unsupported component: {node.type}</p>
      {node.children?.map((child) => renderNode(child))}
    </div>
  );
}