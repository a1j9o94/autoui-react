#!/bin/bash

# Install dependencies
echo "Installing dependencies..."
npm install

# Setup UI components
echo "Setting up UI components..."
npm run setup-ui

echo "Setup complete! You can now run 'npm run dev' to start the development server." 