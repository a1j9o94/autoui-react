import React, { useState } from 'react';
import { AutoUI } from '../../src';

// Product schema for demonstration
const productsSchema = {
  tableName: 'products',
  columns: {
    id: { type: 'serial', primaryKey: true },
    name: { type: 'text', notNull: true },
    description: { type: 'text' },
    price: { type: 'numeric', notNull: true },
    category: { type: 'text', notNull: true },
    inventory: { type: 'integer', notNull: true },
    imageUrl: { type: 'text' },
  },
  sampleData: [
    {
      id: 1,
      name: 'Ergonomic Desk Chair',
      description: 'Adjustable office chair with lumbar support and breathable mesh back',
      price: 249.99,
      category: 'Furniture',
      inventory: 45,
      imageUrl: 'https://example.com/chair.jpg',
    },
    {
      id: 2,
      name: 'Wireless Keyboard',
      description: 'Low-profile mechanical keyboard with customizable RGB lighting',
      price: 89.99,
      category: 'Electronics',
      inventory: 120,
      imageUrl: 'https://example.com/keyboard.jpg',
    },
    {
      id: 3,
      name: 'Ultra-wide Monitor',
      description: '34-inch curved display with 3440x1440 resolution',
      price: 499.99,
      category: 'Electronics',
      inventory: 18,
      imageUrl: 'https://example.com/monitor.jpg',
    },
    {
      id: 4,
      name: 'Standing Desk Converter',
      description: 'Adjustable height desk converter that sits on top of your existing desk',
      price: 179.99,
      category: 'Furniture',
      inventory: 32,
      imageUrl: 'https://example.com/converter.jpg',
    },
    {
      id: 5,
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse with adjustable DPI',
      price: 59.99,
      category: 'Electronics',
      inventory: 85,
      imageUrl: 'https://example.com/mouse.jpg',
    },
  ],
};

function ComponentExample() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AutoUI Component Integration</h1>
        <p className="text-gray-600">
          This example shows how to use AutoUI components within an existing application
        </p>
      </header>
      
      {/* Standard application navigation */}
      <nav className="flex border-b border-gray-200 mb-8">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 ${activeTab === 'dashboard' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
        >
          Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 ${activeTab === 'products' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
        >
          Products
        </button>
        <button 
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 ${activeTab === 'analytics' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
        >
          Analytics
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 ${activeTab === 'settings' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
        >
          Settings
        </button>
      </nav>
      
      {/* Dashboard tab content */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Standard, manually created widget */}
          <div className="border rounded-lg p-4 shadow-sm">
            <h2 className="text-lg font-medium mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button className="w-full bg-blue-500 text-white px-4 py-2 rounded">Add New Product</button>
              <button className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded">View Reports</button>
              <button className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded">Manage Inventory</button>
            </div>
          </div>
          
          {/* AI-generated dashboard widget */}
          <div className="border rounded-lg shadow-sm overflow-hidden col-span-2">
            <AutoUI 
              schema={{ products: productsSchema }}
              goal="Show a summary of product inventory levels by category"
              integration={{
                mode: 'component',
                className: 'h-full',
              }}
              scope={{
                type: 'dashboard',
                focus: 'inventory metrics',
              }}
              mockMode={true}
            />
          </div>
        </div>
      )}
      
      {/* Products tab content */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar filter - manually created */}
          <div className="border rounded-lg p-4 shadow-sm">
            <h2 className="text-lg font-medium mb-4">Filters</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select className="w-full border rounded p-2">
                  <option>All Categories</option>
                  <option>Electronics</option>
                  <option>Furniture</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price Range</label>
                <div className="flex space-x-2">
                  <input type="text" placeholder="Min" className="w-1/2 border rounded p-2" />
                  <input type="text" placeholder="Max" className="w-1/2 border rounded p-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inventory Status</label>
                <div className="space-y-1">
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" />
                    In Stock
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" />
                    Low Stock
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" />
                    Out of Stock
                  </label>
                </div>
              </div>
              <button className="w-full bg-blue-500 text-white px-4 py-2 rounded">Apply Filters</button>
            </div>
          </div>
          
          {/* Main product listing - AI generated */}
          <div className="col-span-3 border rounded-lg shadow-sm overflow-hidden">
            <AutoUI 
              schema={{ products: productsSchema }}
              goal="Create a product listing with filtering and sorting capabilities"
              integration={{
                mode: 'component',
              }}
              scope={{
                type: 'list',
                focus: 'product information display',
              }}
              mockMode={true}
            />
          </div>
        </div>
      )}
      
      {/* Analytics tab content */}
      {activeTab === 'analytics' && (
        <div className="border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-6">Analytics Dashboard</h2>
          <p className="mb-4 text-gray-600">This would be your standard analytics dashboard...</p>
          
          {/* AI-generated analytics view */}
          <div className="border rounded-lg mt-6 overflow-hidden">
            <AutoUI 
              schema={{ products: productsSchema }}
              goal="Generate an analytics view showing product performance metrics"
              integration={{
                mode: 'component',
              }}
              scope={{
                type: 'dashboard',
                focus: 'performance metrics and charts',
              }}
              mockMode={true}
            />
          </div>
        </div>
      )}
      
      {/* Settings tab content */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border rounded-lg p-4 shadow-sm">
            <h2 className="text-lg font-medium mb-4">Settings Menu</h2>
            <ul className="space-y-2">
              <li className="p-2 bg-blue-50 text-blue-600 rounded">Account Settings</li>
              <li className="p-2 hover:bg-gray-50 rounded">Notification Preferences</li>
              <li className="p-2 hover:bg-gray-50 rounded">Security</li>
              <li className="p-2 hover:bg-gray-50 rounded">API Keys</li>
              <li className="p-2 hover:bg-gray-50 rounded">Team Management</li>
            </ul>
          </div>
          
          <div className="col-span-2 border rounded-lg shadow-sm overflow-hidden">
            <AutoUI 
              schema={{ products: productsSchema }}
              goal="Create a form for updating account settings"
              integration={{
                mode: 'component',
              }}
              scope={{
                type: 'form',
                focus: 'account settings',
              }}
              mockMode={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ComponentExample;