#!/bin/bash

# Ensure we're in the right directory
cd "$(dirname "$0")"

# Build the main library first
echo "Building the main autoui-react library..."
cd ../..
npm run build
cd examples/basic-demo

# Install dependencies
echo "Installing dependencies..."
npm install

# Link the local package
echo "Linking autoui-react package..."
npm link ../..

# Setup UI components
echo "Setting up UI components..."
npm run setup-ui

echo "Setup complete! You can now run 'npm run dev' to start the development server." 