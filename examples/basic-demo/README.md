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

## Schema Requirements

- Your schema should define all required fields for each table, including `props`, `bindings`, `events`, and `children` (these must always be present in the UI spec, and can be `null` if not used).
- If you use `mockMode={false}` (real LLM), you **must** provide an OpenAI API key in your environment (e.g., `VITE_OPENAI_API_KEY`).

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
- If you see errors about missing required fields or schema validation, ensure your schema and UI spec always include all required keys, using `null` where appropriate
- If you accidentally commit secrets (like API keys), use `git filter-repo` to remove them from your history. See [GitHub's docs](https://docs.github.com/code-security/secret-scanning/working-with-secret-scanning-and-push-protection/working-with-push-protection-from-the-command-line#resolving-a-blocked-push)
- The file `state_output.test` is now in `.gitignore` to prevent accidental commits of test output or secrets

## Next Steps

After exploring this basic example, you can:

1. Try different goals to see how the UI adapts
2. Modify the schema to see how the UI changes with different data structures
3. Implement real data fetching by setting `mockMode` to `false`
4. Add custom event hooks to handle user interactions
5. Set `mockMode={false}` and provide a valid OpenAI API key to use real LLM-powered UI generation 