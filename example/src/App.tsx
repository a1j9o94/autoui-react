import React from 'react';
import { AutoUI } from '../../src';

function App() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">AutoUI Example</h1>
      
      <div className="p-4 border rounded">
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
                { id: 1, name: 'John Doe', email: 'john@example.com' }
              ]
            }
          }}
          goal="Create a user management interface"
          mockMode={true}
        />
      </div>
    </div>
  );
}

export default App;
