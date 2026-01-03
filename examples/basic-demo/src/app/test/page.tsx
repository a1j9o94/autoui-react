'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { AutoUI } from 'autoui-react';

// CRM Schema - Contacts and Meetings
const crmSchema = {
  contacts: {
    tableName: 'contacts',
    columns: {
      id: { type: 'uuid', primaryKey: true },
      name: { type: 'text', notNull: true },
      email: { type: 'text', notNull: true },
      company: { type: 'text' },
      phone: { type: 'text' },
      status: { type: 'text', default: 'lead' },
    },
    sampleData: [
      { id: '1', name: 'Alice Cooper', email: 'alice@acme.com', company: 'Acme Corp', phone: '555-0101', status: 'customer' },
      { id: '2', name: 'Bob Wilson', email: 'bob@techstart.io', company: 'TechStart', phone: '555-0102', status: 'lead' },
      { id: '3', name: 'Carol Davis', email: 'carol@bigco.com', company: 'BigCo Inc', phone: '555-0103', status: 'customer' },
      { id: '4', name: 'David Chen', email: 'david@startup.co', company: 'Startup Co', phone: '555-0104', status: 'prospect' },
    ],
  },
  meetings: {
    tableName: 'meetings',
    columns: {
      id: { type: 'uuid', primaryKey: true },
      title: { type: 'text', notNull: true },
      contactId: { type: 'uuid', references: 'contacts.id' },
      date: { type: 'date' },
      time: { type: 'text' },
      notes: { type: 'text' },
    },
    sampleData: [
      { id: '1', title: 'Product Demo', contactId: '1', date: '2024-01-15', time: '10:00 AM', notes: 'Demo new features' },
      { id: '2', title: 'Contract Review', contactId: '3', date: '2024-01-16', time: '2:00 PM', notes: 'Review Q1 contract' },
      { id: '3', title: 'Initial Call', contactId: '2', date: '2024-01-17', time: '11:00 AM', notes: 'Discovery call' },
    ],
  },
};

// Sales Dashboard Schema - Team Performance
const salesSchema = {
  team: {
    tableName: 'team',
    columns: {
      id: { type: 'uuid', primaryKey: true },
      name: { type: 'text', notNull: true },
      role: { type: 'text' },
      quota: { type: 'number' },
      achieved: { type: 'number' },
      deals: { type: 'number' },
    },
    sampleData: [
      { id: '1', name: 'Sarah Johnson', role: 'Senior Rep', quota: 100000, achieved: 125000, deals: 12 },
      { id: '2', name: 'Mike Brown', role: 'Account Exec', quota: 80000, achieved: 72000, deals: 8 },
      { id: '3', name: 'Emily White', role: 'Senior Rep', quota: 100000, achieved: 95000, deals: 10 },
      { id: '4', name: 'James Lee', role: 'Junior Rep', quota: 50000, achieved: 48000, deals: 6 },
    ],
  },
  deals: {
    tableName: 'deals',
    columns: {
      id: { type: 'uuid', primaryKey: true },
      company: { type: 'text', notNull: true },
      value: { type: 'number' },
      stage: { type: 'text' },
      owner: { type: 'text' },
      closeDate: { type: 'date' },
    },
    sampleData: [
      { id: '1', company: 'Acme Corp', value: 45000, stage: 'negotiation', owner: 'Sarah Johnson', closeDate: '2024-01-30' },
      { id: '2', company: 'TechStart', value: 25000, stage: 'proposal', owner: 'Mike Brown', closeDate: '2024-02-15' },
      { id: '3', company: 'BigCo Inc', value: 80000, stage: 'closed-won', owner: 'Sarah Johnson', closeDate: '2024-01-10' },
      { id: '4', company: 'StartupCo', value: 15000, stage: 'discovery', owner: 'James Lee', closeDate: '2024-03-01' },
    ],
  },
};

const scenarios: Record<string, { schema: any; goal: string; title: string }> = {
  crm: {
    schema: crmSchema,
    goal: 'Create a mini CRM dashboard showing a list of contacts with their company and status. Include ability to click a contact to see their details and upcoming meetings. Add a button to schedule a new meeting.',
    title: 'Mini CRM - Contacts & Meetings',
  },
  sales: {
    schema: salesSchema,
    goal: 'Create a sales manager dashboard showing team performance. Display a list of team members with their name, quota, achieved amount, and percentage to goal. Allow clicking on a team member to see their individual deals pipeline.',
    title: 'Sales Dashboard - Team Performance',
  },
};

export default function TestPage() {
  const searchParams = useSearchParams();
  const scenario = searchParams.get('scenario') || 'crm';
  const config = scenarios[scenario] || scenarios.crm;

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">{config.title}</h1>
      <p className="text-gray-600 mb-4 text-sm">Scenario: {scenario}</p>
      <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700 min-h-[600px]">
        <AutoUI
          schema={config.schema}
          goal={config.goal}
          apiKey={process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ''}
          debugMode={true}
          componentAdapter="shadcn"
          userContext={{
            id: '1',
            name: 'Test User',
            role: 'manager',
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
