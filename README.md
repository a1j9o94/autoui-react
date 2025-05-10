# autoui-react

A React + TypeScript runtime that **generates goal-oriented UIs in real-time** using an LLM + your data schema.

> Import one component, declare your schema, give a goal, get a working multi-step UI with implicit shimmer fallbacks.

## Inspiration

This library was inspired by the paper ["Generative and Malleable User Interfaces with Generative and Evolving Task-Driven Data Model"](https://dl.acm.org/doi/10.1145/3706598.3713285) (CHI 2025), which proposes a model-driven approach to UI generation. The paper introduces the concept of using LLMs to interpret users' goals and generate data models that serve as the foundation for UI generation - a concept this library puts into practice.

As the paper states, "We adopt the canonical perspective that user interfaces are graphical representations of underlying data models that describe the intended tasks" and proposes "leveraging Large Language Models (LLMs) to interpret users' prompts and generate a task-driven data model—a structured representation of the essential entities, relationships, and data properties relevant to the intended task."

This library implements this approach, using LLMs to interpret a goal and schema to generate a UI specification that can be rendered with React components.

## Feature Highlights

- **Declarative input only** – supply schema + goal; runtime handles the rest
- **Incremental AI planning** – UI evolves one interaction at a time
- **Partial UI updates** – only refresh the parts of the UI that need updating
- **Zero-config fallbacks** – shimmer placeholders generated automatically
- **Adapter pattern** – map abstract nodes → any React component library (starting with shadcn)
- **Type-safety end-to-end** – all AI messages validated by Zod
- **Streaming UX** – uses @vercel/ai to stream planner output and render progressively
- **System events** – hook into the AI planning lifecycle to observe or extend behavior
- **Schema adapters** – connect to multiple database types with Drizzle support out of the box

## Installation

```bash
npm install autoui-react
```

## Quick Start

```jsx
import { AutoUI } from 'autoui-react';
import { emailsTable, usersTable } from './schema';

function App() {
  return (
    <AutoUI 
      schema={{ emails: emailsTable, users: usersTable }}
      goal="Create an email inbox with list and detail views"
    />
  );
}
```

That's it! AutoUI will:
1. Generate a UI based on your schema and goal
2. Show shimmer placeholders while loading
3. Handle data binding and events automatically

## API Reference

### `<AutoUI>` Component

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `schema` | `Record<string, unknown>` \| `AdapterConfig` | Yes | Your data schema or schema adapter config |
| `goal` | `string` | Yes | What you want the UI to do |
| `componentAdapter` | `'shadcn'` | No | UI component library to use (default: `'shadcn'`) |
| `userContext` | `Record<string, unknown>` | No | User information (id, role, etc.) |
| `onEvent` | `(evt: UIEvent) => void` | No | Callback for UI events |
| `eventHooks` | `{ [eventType]: EventHook[] }` | No | UI event hooks for interception |
| `systemEventHooks` | `{ [SystemEventType]: SystemEventHook[] }` | No | Hooks into internal system events |
| `enablePartialUpdates` | `boolean` | No | Only update parts of the UI that change (default: `true`) |
| `updatePatterns` | `{ enable* }` | No | Configure which partial update patterns to use |
| `debugMode` | `boolean` | No | Enable console logging of system events |
| `mockMode` | `boolean` | No | Use mock data for development (default: `true` in dev) |
| `planningConfig` | `{ prefetchDepth?, temperature?, streaming? }` | No | Configure the AI planning process |

### Partial UI Updates

AutoUI can selectively update only the portions of the UI that need to change, rather than regenerating the entire interface on each interaction. This results in:

- **Better performance**: Only updating what changes is more efficient
- **Improved UX**: Maintains UI state between interactions
- **Reduced LLM usage**: Smaller, more focused prompts

To use partial updates:

```jsx
<AutoUI 
  schema={mySchema}
  goal="Create a project dashboard with list and detail views"
  enablePartialUpdates={true}
  updatePatterns={{
    enableDetailViews: true,  // Show/hide details in a side panel
    enableDropdowns: true,    // Add dropdown menus to elements
    enableExpandCollapse: true, // Expand/collapse sections
    enableFormNavigation: true, // Navigate multi-step forms
  }}
/>
```

The AI will now intelligently determine which parts of the UI to update based on user interactions. For example, clicking on an item in a list will only update the detail view rather than regenerating the entire page.

### Schema Configuration

AutoUI supports different ways to provide your data schema:

#### 1. Direct Schema Object

```jsx
<AutoUI 
  schema={{
    users: {
      tableName: 'users',
      columns: {
        id: { type: 'serial', primaryKey: true },
        name: { type: 'text', notNull: true },
        email: { type: 'text', notNull: true },
      },
      sampleData: [
        { id: 1, name: 'John', email: 'john@example.com' }
      ]
    }
  }}
  goal="Create a user management interface"
/>
```

#### 2. Using Drizzle Adapter

```jsx
import { AutoUI } from 'autoui-react';
import { db } from './db';  // Your Drizzle instance
import { users, posts } from './schema';  // Drizzle schema

function MyApp() {
  return (
    <AutoUI 
      schema={{
        type: 'drizzle',
        options: {
          schema: { users, posts },
          client: { 
            client: db,
            // Optional custom query function
            queryFn: async (tableName, query) => {
              // Custom query logic here
              return [];
            }
          }
        }
      }}
      goal="Create a user management dashboard"
    />
  );
}
```

#### 3. Using Mock Data

```jsx
<AutoUI 
  schema={{
    type: 'drizzle',
    options: {
      schema: { users, posts },
      useMockData: true,
      mockData: {
        users: [
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' }
        ]
      }
    }
  }}
  goal="Create a user management dashboard"
/>
```

### System Events

AutoUI provides hooks into its internal planning and rendering process through system events. You can subscribe to these events to monitor or extend the functionality.

```jsx
import { AutoUI, SystemEventType } from 'autoui-react';

function MyApp() {
  return (
    <AutoUI 
      schema={mySchema}
      goal="Create a user management dashboard"
      systemEventHooks={{
        // Log when planning starts
        [SystemEventType.PLAN_START]: [(event) => {
          console.log('Planning started with input:', event.plannerInput);
        }],
        
        // Measure performance of data fetching
        [SystemEventType.DATA_FETCH_COMPLETE]: [(event) => {
          console.log(`Fetched ${event.results.length} rows from ${event.tableName} in ${event.executionTimeMs}ms`);
        }]
      }}
    />
  );
}
```

#### Available System Events

| Event Type | Description | Data Properties |
|------------|-------------|-----------------|
| `PLAN_START` | Planning process started | `plannerInput` |
| `PLAN_PROMPT_CREATED` | Prompt for LLM generated | `prompt` |
| `PLAN_RESPONSE_CHUNK` | Received chunk from LLM | `chunk`, `isComplete` |
| `PLAN_COMPLETE` | Planning process completed | `layout`, `executionTimeMs` |
| `PLAN_ERROR` | Error during planning | `error` |
| `BINDING_RESOLUTION_START` | Started resolving data bindings | `layout` |
| `BINDING_RESOLUTION_COMPLETE` | Completed binding resolution | `originalLayout`, `resolvedLayout` |
| `DATA_FETCH_START` | Started fetching data | `tableName`, `query` |
| `DATA_FETCH_COMPLETE` | Completed data fetch | `tableName`, `results`, `executionTimeMs` |
| `RENDER_START` | Started rendering | `layout` |
| `RENDER_COMPLETE` | Completed rendering | `layout`, `renderTimeMs` |

## Development

```bash
# Install dependencies
npm install

# Run development build with watch mode
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Run the example app
npm run example
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
## Component Adapters

### shadcn/ui (Default)

This library uses [shadcn/ui](https://ui.shadcn.com/) components by default. To set up these components in your project:

```bash
# Run the setup script to install required shadcn components
npm run setup-shadcn
```

This will:
1. Install Tailwind CSS if not already installed
2. Set up the necessary shadcn/ui components
3. Configure your project to use them

After setup, make sure to import the CSS in your application:

```jsx
// In your main entry file (e.g., main.tsx, index.tsx)
import "./src/tailwind.css";
```

### Custom Component Adapters

You can create custom adapters for other component libraries by implementing an adapter module:

```jsx
// Create a custom adapter (e.g., for Material UI)
import { Button, Table, Card } from '@mui/material';

const materialAdapter = {
  Button: (props) => <Button {...props} />,
  Table: (props) => <Table {...props} />,
  // ...
};

// Use your custom adapter
<AutoUI 
  schema={mySchema}
  goal="Create a user dashboard"
  componentAdapter="material" // Not yet supported in v0.1
/>
```

Support for custom component adapters is planned for future releases.
