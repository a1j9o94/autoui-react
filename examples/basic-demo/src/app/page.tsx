'use client';

import React from 'react';
import { AutoUI } from 'autoui-react';

// Example schema definition
const exampleSchema = {
  tasks: {
    tableName: 'tasks',
    columns: {
      id: { type: 'uuid', primaryKey: true },
      title: { type: 'text', notNull: true },
      description: { type: 'text' },
      status: { type: 'text', notNull: true, default: 'pending' },
      priority: { type: 'text', notNull: true, default: 'medium' },
      dueDate: { type: 'date' },
      createdAt: { type: 'timestamp', notNull: true, default: 'now()' },
      updatedAt: { type: 'timestamp' },
    },
    // Sample data for development
    sampleData: [
      {
        id: '1',
        title: 'Setup development environment',
        description: 'Install Node.js, TypeScript, and VS Code',
        status: 'completed',
        priority: 'high',
        dueDate: '2023-12-31',
        createdAt: '2023-12-01T10:00:00Z',
        updatedAt: '2023-12-01T15:30:00Z',
      },
      {
        id: '2',
        title: 'Create project structure',
        description: 'Set up initial files and directories',
        status: 'completed',
        priority: 'high',
        dueDate: '2023-12-31',
        createdAt: '2023-12-02T09:15:00Z',
        updatedAt: '2023-12-02T11:45:00Z',
      },
      {
        id: '3',
        title: 'Implement core features',
        description: 'Work on the main functionality',
        status: 'in_progress',
        priority: 'medium',
        dueDate: '2024-01-15',
        createdAt: '2023-12-05T08:30:00Z',
        updatedAt: '2023-12-10T14:20:00Z',
      },
      {
        id: '4',
        title: 'Write documentation',
        description: 'Create README and API docs',
        status: 'pending',
        priority: 'low',
        dueDate: '2024-01-31',
        createdAt: '2023-12-15T16:45:00Z',
        updatedAt: null,
      },
    ],
  },
  users: {
    tableName: 'users',
    columns: {
      id: { type: 'uuid', primaryKey: true },
      name: { type: 'text', notNull: true },
      email: { type: 'text', notNull: true, unique: true },
      role: { type: 'text', notNull: true, default: 'user' },
      createdAt: { type: 'timestamp', notNull: true, default: 'now()' },
    },
    // Sample data
    sampleData: [
      {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        createdAt: '2023-10-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'user',
        createdAt: '2023-10-15T08:30:00Z',
      },
      {
        id: '3',
        name: 'Bob Johnson',
        email: 'bob@example.com',
        role: 'user',
        createdAt: '2023-11-05T14:45:00Z',
      },
    ],
  },
};

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">AutoUI React Example</h1>
      {/* 
        Set mockMode={false} to use a real LLM (requires OpenAI API key in your environment).
        Set mockMode={true} to use local mock data for development.
      */}
      <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700 min-h-[500px]">
        {/* 
          IMPORTANT: To use the real LLM (mockMode={false}), you need an OpenAI API key.
          1. Create a file named `.env.local` in the `examples/basic-demo` directory.
          2. Add your API key to this file like so:
             NEXT_PUBLIC_OPENAI_API_KEY=YOUR_API_KEY_HERE
          Replace YOUR_API_KEY_HERE with your actual key (e.g., sk-...).
          The `NEXT_PUBLIC_` prefix is required by Next.js to expose the variable to the browser.
        */}
        <AutoUI
          // The schema prop defines the application's data structure (e.g., database tables).
          // AutoUI uses this schema information when planning the UI with the LLM.
          schema={exampleSchema}
          goal="Create a task management dashboard with list view and ability to view task details, and modify task details and status"
          mockMode={false}
          openaiApiKey={process.env.NEXT_PUBLIC_OPENAI_API_KEY}
          debugMode={true}
          componentAdapter="shadcn"
          userContext={{
            id: '1',
            name: 'John Doe',
            role: 'admin',
          }}
          onEvent={() => {}}
          eventHooks={{}}
          systemEventHooks={{}}
          databaseConfig={{}}
          planningConfig={{}}
        />
      </div>
    </main>
  );
} 