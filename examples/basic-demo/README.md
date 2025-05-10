# AutoUI React Basic Demo

This is a simple example of using the AutoUI React library to generate user interfaces with LLMs based on a schema and goal.

## Getting Started

Follow these steps to run the example:

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Set Up Shadcn UI Components**

   This step is required for the AutoUI component to work properly:

   ```bash
   npm run setup-ui
   ```

3. **Run the Development Server**

   ```bash
   npm run dev
   ```

4. **Open the Application**

   Navigate to [http://localhost:3000](http://localhost:3000) in your browser to see the application running.

## How It Works

The example demonstrates a simple task management dashboard. The AutoUI component generates a UI based on:

1. A schema that defines tasks and users
2. A goal that describes what the UI should help users accomplish
3. Sample data that populates the UI

You can modify the goal using the input field at the top of the page to see how the UI adapts to different requirements.

## Features Demonstrated

- Dynamic UI generation based on a goal
- Schema-based data binding
- Mock data mode for development
- Debug mode to see system events
- User context for personalization

## Troubleshooting

If you encounter any issues:

- Make sure you've run the `setup-ui` script to install the required UI components
- Check that you have an OpenAI API key set in your environment variables if not using mock mode
- Ensure all dependencies are installed correctly

## Next Steps

After exploring this basic example, you can:

1. Try different goals to see how the UI adapts
2. Modify the schema to see how the UI changes with different data structures
3. Implement real data fetching by setting `mockMode` to `false`
4. Add custom event hooks to handle user interactions 