import React, { useState, useEffect } from 'react';
import { 
  AutoUI, 
  createEventHook, 
  EventHookContext, 
  UIEvent,
  DrizzleAdapter,
  SystemEventType,
  AnySystemEvent
} from '../../src';

// Example schema definitions
const emailsSchema = {
  tableName: 'emails',
  columns: {
    id: { type: 'serial', primaryKey: true },
    sender: { type: 'text', notNull: true },
    recipient: { type: 'text', notNull: true },
    subject: { type: 'text', notNull: true },
    body: { type: 'text', notNull: true },
    date: { type: 'timestamp', notNull: true },
    read: { type: 'boolean', default: false },
    starred: { type: 'boolean', default: false },
    folder: { type: 'text', default: 'inbox' },
  },
  // Sample data for development/demo
  sampleData: [
    {
      id: 1,
      sender: 'john.doe@example.com',
      recipient: 'me@example.com',
      subject: 'Project Update - Q2 Goals',
      body: 'Hi team,\n\nI wanted to share a quick update on our Q2 goals. We\'re making good progress on the AutoUI project and should be ready for the first release next week.\n\nLet me know if you have any questions.\n\nBest,\nJohn',
      date: '2025-04-28T14:22:00Z',
      read: false,
      starred: true,
      folder: 'inbox',
    },
    {
      id: 2,
      sender: 'marketing@company.com',
      recipient: 'me@example.com',
      subject: 'Marketing Campaign Results',
      body: 'Hello,\n\nThe results from our recent marketing campaign are in! We\'ve seen a 25% increase in website traffic and a 15% increase in signups.\n\nAttached is the full report.\n\nRegards,\nMarketing Team',
      date: '2025-04-27T09:15:00Z',
      read: true,
      starred: false,
      folder: 'inbox',
    },
    {
      id: 3,
      sender: 'sarah.johnson@example.com',
      recipient: 'me@example.com',
      subject: 'Meeting Notes - Product Planning',
      body: 'Hi everyone,\n\nHere are the notes from our product planning session today:\n\n1. New features for v2.0 prioritized\n2. Timeline adjusted to account for QA requirements\n3. UI improvements scheduled for next sprint\n\nLet me know if I missed anything.\n\nThanks,\nSarah',
      date: '2025-04-26T16:48:00Z',
      read: true,
      starred: false,
      folder: 'inbox',
    },
    {
      id: 4,
      sender: 'support@service.com',
      recipient: 'me@example.com',
      subject: 'Your Subscription Renewal',
      body: 'Dear Customer,\n\nYour subscription to our service will renew automatically on May 15, 2025. If you wish to make any changes to your plan, please do so before the renewal date.\n\nThank you for your continued support!\n\nCustomer Support Team',
      date: '2025-04-25T11:30:00Z',
      read: false,
      starred: false,
      folder: 'inbox',
    },
    {
      id: 5,
      sender: 'david.wilson@example.com',
      recipient: 'me@example.com',
      subject: 'Feedback on Your Presentation',
      body: 'Hi,\n\nI really enjoyed your presentation yesterday. The way you explained the complex technical concepts was clear and engaging. I particularly liked the demo of the AutoUI framework.\n\nI have a few questions about implementation details - do you have time for a quick call tomorrow?\n\nBest regards,\nDavid',
      date: '2025-04-24T15:12:00Z',
      read: true,
      starred: true,
      folder: 'inbox',
    },
  ],
};

const usersSchema = {
  tableName: 'users',
  columns: {
    id: { type: 'serial', primaryKey: true },
    name: { type: 'text', notNull: true },
    email: { type: 'text', notNull: true, unique: true },
    role: { type: 'text', notNull: true },
    avatar: { type: 'text' },
    createdAt: { type: 'timestamp', notNull: true },
  },
  // Sample data
  sampleData: [
    {
      id: 1,
      name: 'Current User',
      email: 'me@example.com',
      role: 'admin',
      avatar: 'https://i.pravatar.cc/150?u=1',
      createdAt: '2024-01-15T08:00:00Z',
    },
    {
      id: 2,
      name: 'John Doe',
      email: 'john.doe@example.com',
      role: 'user',
      avatar: 'https://i.pravatar.cc/150?u=2',
      createdAt: '2024-01-20T10:30:00Z',
    },
    {
      id: 3,
      name: 'Sarah Johnson',
      email: 'sarah.johnson@example.com',
      role: 'manager',
      avatar: 'https://i.pravatar.cc/150?u=3',
      createdAt: '2024-02-05T14:45:00Z',
    },
  ],
};

function App() {
  const [systemEvents, setSystemEvents] = useState<AnySystemEvent[]>([]);
  
  // Optional: display system events for debugging
  const recordSystemEvent = (event: AnySystemEvent) => {
    setSystemEvents(prev => [...prev, event]);
  };
  
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AutoUI Demo</h1>
        <p className="text-gray-600">
          AI-generated interfaces based on your data schema and goals
        </p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="col-span-3 p-6 border rounded-lg shadow-sm bg-white">
          <AutoUI 
            schema={{ 
              emails: emailsSchema,
              users: usersSchema,
            }}
            goal="Create an email inbox interface with a list of emails and a detail view. Allow users to star/unstar emails and mark them as read."
            mockMode={true} // Use mock data for demonstration
            userContext={{
              id: 1,
              email: 'me@example.com',
              role: 'admin',
            }}
            // Example UI event hook - confirm before deleting
            eventHooks={{
              CLICK: [
                createEventHook(async (ctx) => {
                  if (ctx.originalEvent.nodeId === 'deleteButton') {
                    const confirmed = window.confirm('Are you sure you want to delete this email?');
                    if (!confirmed) {
                      ctx.preventDefault();
                    }
                  }
                })
              ]
            }}
            // System event hooks - for monitoring planning process
            systemEventHooks={{
              [SystemEventType.PLAN_START]: [recordSystemEvent],
              [SystemEventType.PLAN_COMPLETE]: [recordSystemEvent],
              [SystemEventType.BINDING_RESOLUTION_COMPLETE]: [recordSystemEvent],
              [SystemEventType.DATA_FETCH_COMPLETE]: [recordSystemEvent]
            }}
            // Show all system events in console
            debugMode={true}
            // Planning configuration
            planningConfig={{
              prefetchDepth: 1,
              temperature: 0.5,
              streaming: true
            }}
          />
        </div>
        
        {/* Event Monitor Panel */}
        <div className="p-4 border rounded-lg bg-gray-50 overflow-y-auto" style={{ maxHeight: '600px' }}>
          <h2 className="text-lg font-semibold mb-3">System Events</h2>
          <div className="space-y-3">
            {systemEvents.map((event, i) => (
              <div key={i} className="p-2 bg-white border rounded text-sm">
                <div className="font-medium">{event.type}</div>
                <div className="text-gray-500 text-xs">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
            {systemEvents.length === 0 && (
              <div className="text-gray-500 text-sm">No events yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;