import React from 'react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { renderNode } from './shadcn'; // Testing the exported renderNode
import { UISpecNode, UIEvent } from '../schema/ui';

// Helper to create a basic UISpecNode
const createMockNode = (overrides: Partial<UISpecNode>): UISpecNode => ({
  id: 'test-id',
  node_type: 'Unknown',
  props: null,
  bindings: null,
  events: null,
  children: null,
  ...overrides,
});

describe('Shadcn Adapter - renderNode', () => {
  let mockProcessEvent: Mock<[UIEvent], void>;

  beforeEach(() => {
    mockProcessEvent = vi.fn<[UIEvent], void>();
    vi.spyOn(console, 'warn').mockImplementation(() => {}); // Suppress console.warn for cleaner test output
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render a Button and call processEvent on click', () => {
    const buttonNode = createMockNode({
      id: 'btn-1',
      node_type: 'Button',
      props: { label: 'Click Me' },
      events: {
        CLICK: { action: 'submit', target: 'form', payload: { from: 'button' } },
      },
    });

    const { getByText } = render(renderNode(buttonNode, mockProcessEvent));
    
    const buttonElement = getByText('Click Me');
    expect(buttonElement).toBeInTheDocument();

    fireEvent.click(buttonElement);

    expect(mockProcessEvent).toHaveBeenCalledOnce();
    expect(mockProcessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CLICK',
        nodeId: 'btn-1',
        payload: expect.objectContaining({ 
          from: 'button'
        }),
      })
    );
  });

  it('should render a Container with children', () => {
    const childButtonNode = createMockNode({
      id: 'child-btn',
      node_type: 'Button',
      props: { label: 'Child Button' },
    });
    const containerNode = createMockNode({
      id: 'container-1',
      node_type: 'Container',
      children: [childButtonNode],
      props: { className: 'test-container-class'},
    });

    const { getByText, container } = render(renderNode(containerNode, mockProcessEvent));

    expect(getByText('Child Button')).toBeInTheDocument();
    // Check if the container div (rendered by the mock Container component) exists and has the class
    // The mock Container in shadcn.tsx adds 'autoui-mock-container'
    const containerDiv = container.querySelector('.autoui-mock-container.test-container-class');
    expect(containerDiv).toBeInTheDocument();
  });

  it('should render a ListView and handle item selection', () => {
    const items: Record<string, React.ReactNode>[] = [{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }];
    const fields = [{ key: 'name', label: 'Name' }];
    const listViewNode = createMockNode({
      id: 'list-1',
      node_type: 'ListView',
      bindings: { items, fields },
      props: { selectable: true },
      events: {
        CLICK: { action: 'selectItem', target: 'detailView', payload: null },
      },
    });

    const { getByText } = render(renderNode(listViewNode, mockProcessEvent));

    expect(getByText('Item 1')).toBeInTheDocument();
    expect(getByText('Item 2')).toBeInTheDocument();

    // Simulate click on the first item (row)
    // The mock Table uses onClick on <tr> for selection
    fireEvent.click(getByText('Item 1').closest('tr')!);

    expect(mockProcessEvent).toHaveBeenCalledOnce();
    expect(mockProcessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CLICK', // Mapped from onSelect in adapterMap
        nodeId: 'list-1',
        payload: expect.objectContaining({
          selectedItem: items[0],
        }),
      })
    );
  });

  it('should render a Detail view with data', () => {
    const data: Record<string, React.ReactNode> = { name: 'Detail Item', description: 'Some details' };
    const fields = [
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description', type: 'content' },
    ];
    const detailNode = createMockNode({
      id: 'detail-1',
      node_type: 'Detail',
      bindings: { data, fields },
      props: { title: 'Item Details' },
    });

    const { getByText } = render(renderNode(detailNode, mockProcessEvent));

    expect(getByText('Item Details')).toBeInTheDocument();
    expect(getByText('Detail Item')).toBeInTheDocument();
    expect(getByText('Some details')).toBeInTheDocument();
  });

  it('should render fallback for unknown node type and warn', () => {
    const unknownNode = createMockNode({
      id: 'unknown-1',
      node_type: 'WeirdNode77',
    });

    const { getByText } = render(renderNode(unknownNode, mockProcessEvent));

    expect(getByText('Unknown node type: WeirdNode77')).toBeInTheDocument();
    expect(console.warn).toHaveBeenCalledWith('Unknown node type: WeirdNode77');
  });

  // More tests can be added for other components (Header, etc.)
  // and specific prop/binding variations.
}); 