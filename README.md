# @autoui/react

A React + TypeScript runtime that **generates goal-oriented UIs in real-time** using an LLM + your data schema.

> Import one component, declare your schema, give a goal, get a working multi-step UI with implicit shimmer fallbacks.

## Installation

```bash
npm install @autoui/react
```

## Quick Start

```jsx
import { AutoUI } from '@autoui/react';
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

## License

MIT
