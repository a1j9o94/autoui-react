import React, { useState } from 'react';
import { AutoUI, SystemEventType } from '../../src';

// Project schema for demonstration
const projectsSchema = {
  tableName: 'projects',
  columns: {
    id: { type: 'serial', primaryKey: true },
    name: { type: 'text', notNull: true },
    description: { type: 'text' },
    status: { type: 'text', notNull: true },
    dueDate: { type: 'date' },
    priority: { type: 'integer', notNull: true },
    owner: { type: 'text', notNull: true },
  },
  sampleData: [
    {
      id: 1,
      name: 'Website Redesign',
      description: 'Complete overhaul of the company website with focus on UX improvements',
      status: 'In Progress',
      dueDate: '2025-06-30',
      priority: 1,
      owner: 'Sarah Chen',
    },
    {
      id: 2,
      name: 'Mobile App Development',
      description: 'Develop a companion mobile app for our web platform',
      status: 'Planning',
      dueDate: '2025-08-15',
      priority: 2,
      owner: 'Michael Johnson',
    },
    {
      id: 3,
      name: 'Database Migration',
      description: 'Migrate from old PostgreSQL instance to new cloud database',
      status: 'Not Started',
      dueDate: '2025-07-01',
      priority: 3,
      owner: 'David Wong',
    },
    {
      id: 4,
      name: 'Annual Report',
      description: 'Prepare the annual financial and business report',
      status: 'Complete',
      dueDate: '2025-04-15',
      priority: 1,
      owner: 'Emma Davis',
    },
    {
      id: 5,
      name: 'Product Launch',
      description: 'Coordinate the Q2 product launch event',
      status: 'In Progress',
      dueDate: '2025-06-01',
      priority: 1,
      owner: 'James Smith',
    },
  ],
};

// Team members schema
const membersSchema = {
  tableName: 'members',
  columns: {
    id: { type: 'serial', primaryKey: true },
    name: { type: 'text', notNull: true },
    role: { type: 'text', notNull: true },
    email: { type: 'text', notNull: true },
    department: { type: 'text', notNull: true },
  },
  sampleData: [
    {
      id: 1,
      name: 'Sarah Chen',
      role: 'Lead Designer',
      email: 'sarah.chen@example.com',
      department: 'Design',
    },
    {
      id: 2,
      name: 'Michael Johnson',
      role: 'Senior Developer',
      email: 'michael.johnson@example.com',
      department: 'Engineering',
    },
    {
      id: 3,
      name: 'David Wong',
      role: 'Database Administrator',
      email: 'david.wong@example.com',
      department: 'IT',
    },
    {
      id: 4,
      name: 'Emma Davis',
      role: 'Finance Manager',
      email: 'emma.davis@example.com',
      department: 'Finance',
    },
    {
      id: 5,
      name: 'James Smith',
      role: 'Product Manager',
      email: 'james.smith@example.com',
      department: 'Product',
    },
  ],
};

function PartialUpdatesExample() {
  const [updates, setUpdates] = useState<string[]>([]);
  
  // Track partial updates
  const handleSystemEvent = (event: any) => {
    if (event.type === SystemEventType.PARTIAL_UPDATE) {
      setUpdates(prev => [...prev, `Updated node: ${event.nodeId}`]);
    }
  };
  
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Partial UI Updates Example</h1>
        <p className="text-gray-600">
          This demonstrates AutoUI's ability to update only specific portions of the UI
        </p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="col-span-3 p-6 border rounded-lg shadow-sm bg-white">
          <AutoUI 
            schema={{
              projects: projectsSchema,
              members: membersSchema,
            }}
            goal="Create a project management dashboard. Show a list of projects with the ability to see more details about each project. When the user selects a project, show the details in a side panel rather than navigating to a new screen."
            mockMode={true}
            userContext={{
              id: 1,
              role: 'manager',
            }}
            // Enable partial updates for more responsive UX
            enablePartialUpdates={true}
            updatePatterns={{
              enableDetailViews: true,
              enableDropdowns: true,
              enableExpandCollapse: true,
              enableFormNavigation: true,
            }}
            // Monitor system events to track updates
            systemEventHooks={{
              [SystemEventType.PARTIAL_UPDATE]: [handleSystemEvent],
            }}
            debugMode={true}
          />
        </div>
        
        {/* Update log panel */}
        <div className="p-4 border rounded-lg bg-gray-50 overflow-y-auto" style={{ maxHeight: '600px' }}>
          <h2 className="text-lg font-semibold mb-3">UI Update Log</h2>
          <div className="space-y-3">
            {updates.map((update, i) => (
              <div key={i} className="p-2 bg-white border rounded text-sm">
                {update}
              </div>
            ))}
            {updates.length === 0 && (
              <div className="text-gray-500 text-sm">
                Interact with the UI to see partial updates
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-8 p-4 border rounded-lg bg-blue-50">
        <h3 className="font-semibold mb-2">How Partial Updates Work</h3>
        <p className="mb-2">Instead of regenerating the entire UI on each interaction:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>When clicking a project, only the detail panel is updated</li>
          <li>When toggling sections, only that section changes</li>
          <li>Dropdowns appear without regenerating the entire UI</li>
          <li>Form navigation preserves the overall layout</li>
        </ul>
        <p className="mt-2 text-sm text-gray-600">
          This makes for a more responsive experience and preserves UI state between interactions
        </p>
      </div>
    </div>
  );
}

export default PartialUpdatesExample;