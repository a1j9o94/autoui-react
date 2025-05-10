import React from 'react';
import { AutoUI, SystemEventType } from '../../src';

// This would normally be your Drizzle schema
const usersTable = {
  name: 'users',
  schema: 'public',
  columns: {
    id: {
      name: 'id',
      dataType: 'serial',
      primaryKey: true
    },
    name: {
      name: 'name',
      dataType: 'text',
      notNull: true
    },
    email: {
      name: 'email',
      dataType: 'text',
      notNull: true,
      unique: true
    },
    role: {
      name: 'role',
      dataType: 'text',
      notNull: true
    }
  }
};

const projectsTable = {
  name: 'projects',
  schema: 'public',
  columns: {
    id: {
      name: 'id',
      dataType: 'serial',
      primaryKey: true
    },
    name: {
      name: 'name',
      dataType: 'text',
      notNull: true
    },
    description: {
      name: 'description',
      dataType: 'text'
    },
    ownerId: {
      name: 'owner_id',
      dataType: 'integer',
      references: {
        table: 'users',
        column: 'id'
      }
    }
  }
};

// Mock data
const mockData = {
  users: [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'user' }
  ],
  projects: [
    { id: 1, name: 'Project Alpha', description: 'This is the first project', ownerId: 1 },
    { id: 2, name: 'Project Beta', description: 'A sequel to Alpha', ownerId: 1 },
    { id: 3, name: 'Customer Portal', description: 'Web portal for customers', ownerId: 2 }
  ]
};

function DrizzleExample() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AutoUI with Drizzle</h1>
        <p className="text-gray-600">
          Example using the Drizzle schema adapter
        </p>
      </header>
      
      <div className="p-6 border rounded-lg shadow-sm bg-white">
        <AutoUI 
          schema={{
            type: 'drizzle',
            options: {
              schema: {
                users: usersTable,
                projects: projectsTable
              },
              useMockData: true,
              mockData: mockData
            }
          }}
          goal="Create a project management dashboard that shows users and their projects. Include the ability to view project details and see which user owns each project."
          mockMode={true}
          userContext={{
            id: 1,
            email: 'admin@example.com',
            role: 'admin'
          }}
          systemEventHooks={{
            [SystemEventType.PLAN_COMPLETE]: [(event) => {
              console.log('Plan completed in', event.executionTimeMs, 'ms');
            }]
          }}
        />
      </div>
    </div>
  );
}

export default DrizzleExample;