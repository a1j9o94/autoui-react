# shadcn/ui Integration for AutoUI

This guide explains how to use shadcn/ui components with AutoUI.

## Setup

To set up shadcn/ui integration in your project, run:

```bash
npm run setup-shadcn
```

This will:
1. Install and configure Tailwind CSS
2. Set up shadcn/ui components
3. Install necessary dependencies
4. Create a helper script for installing additional components

## Using Components

AutoUI comes with a predefined set of components mapped to shadcn/ui components. These components are defined in `src/schema/components.ts` and include:

- Button
- Card
- Input
- Select
- Textarea
- Container
- Header
- ListView (Table)
- Detail
- Dialog
- Tabs
- And more...

To use these components in your UI schemas, reference them by their type:

```tsx
const myUISchema: UISpecNode = {
  id: 'container1',
  type: 'Container',
  children: [
    {
      id: 'header1',
      type: 'Header',
      props: {
        title: 'User Dashboard'
      }
    },
    {
      id: 'button1',
      type: 'Button',
      props: {
        label: 'Click Me',
        variant: 'default'
      },
      events: {
        onClick: {
          action: 'DO_SOMETHING'
        }
      }
    }
  ]
};
```

## Installing Additional Components

If you need additional shadcn/ui components, you can install them with:

```bash
npm run autoui:install-components [component-name]
```

For example:
```bash
npm run autoui:install-components accordion
```

## Styling Components

All shadcn/ui components use Tailwind CSS for styling. You can customize the components by:

1. Modifying the tailwind.config.js file
2. Using the className prop (where available)
3. Extending the component or creating a variant

## Troubleshooting

If you encounter issues with component installation:

1. Make sure your project has a valid components.json file
2. Check if the component directory exists in components/ui
3. Ensure all dependencies are installed correctly

For more help, consult the [shadcn/ui documentation](https://ui.shadcn.com/docs). 