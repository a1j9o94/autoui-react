#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Import the components we need from our schema
let shadcnComponents;
try {
  // Try to load components from the schema
  const componentsModule = require('../src/schema/components');
  shadcnComponents = componentsModule.shadcnComponents;
  console.log(`Found ${shadcnComponents.length} components in schema.`);
} catch (error) {
  // Fallback to default list
  console.log('Could not load components from schema, using default list.');
  shadcnComponents = [
    'button',
    'card',
    'dialog',
    'dropdown-menu',
    'form',
    'input',
    'label',
    'select',
    'table',
    'tabs',
    'textarea',
    'checkbox',
    'radio-group',
  ];
}

console.log('Setting up shadcn/ui components for @autoui/react...');

// Check if the project uses TypeScript
const usesTypeScript = fs.existsSync(path.join(process.cwd(), 'tsconfig.json'));
const fileExt = usesTypeScript ? '.tsx' : '.jsx';

// Helper function to download file from URL
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

// Setup Tailwind CSS
function setupTailwind() {
  if (fs.existsSync(path.join(process.cwd(), 'tailwind.config.js'))) {
    console.log('Tailwind CSS is already set up.');
    return;
  }

  console.log('Installing Tailwind CSS...');
  try {
    // Install dependencies
    execSync('npm install -D tailwindcss postcss autoprefixer', { stdio: 'inherit' });
    
    // Create tailwind.config.js manually
    console.log('Creating tailwind configuration...');
    
    // Create basic tailwind config
    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './app/**/*.{ts,tsx,js,jsx}',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
}`;
    
    fs.writeFileSync(path.join(process.cwd(), 'tailwind.config.js'), tailwindConfig);
    
    // Create postcss.config.js manually
    const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;
    
    fs.writeFileSync(path.join(process.cwd(), 'postcss.config.js'), postcssConfig);
    
    // Create CSS file with tailwind directives
    const tailwindCSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
 
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}`;
    
    if (!fs.existsSync(path.join(process.cwd(), 'src'))) {
      fs.mkdirSync(path.join(process.cwd(), 'src'));
    }
    
    fs.writeFileSync(path.join(process.cwd(), 'src/tailwind.css'), tailwindCSS);
    
    console.log('Tailwind CSS installed and configured!');
  } catch (error) {
    console.error('Error setting up Tailwind CSS:', error.message);
    process.exit(1);
  }
}

// Setup directories
function setupDirectories() {
  // Create components directory if it doesn't exist
  const componentsDir = path.join(process.cwd(), 'components');
  if (!fs.existsSync(componentsDir)) {
    fs.mkdirSync(componentsDir, { recursive: true });
  }

  // Create UI directory within components
  const uiDir = path.join(componentsDir, 'ui');
  if (!fs.existsSync(uiDir)) {
    fs.mkdirSync(uiDir, { recursive: true });
  }

  // Create lib directory if it doesn't exist
  const libDir = path.join(process.cwd(), 'lib');
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }
}

// Create utils.js/ts file
function createUtilsFile() {
  const utilsFileName = usesTypeScript ? 'utils.ts' : 'utils.js';
  const utilsContent = `import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs${usesTypeScript ? ': any[]' : ''}) {
  return twMerge(clsx(inputs));
}`;
  
  fs.writeFileSync(path.join(process.cwd(), 'lib', utilsFileName), utilsContent);
}

// Install dependencies
function installDependencies() {
  console.log('Installing shadcn dependencies...');
  try {
    // Install basic dependencies
    execSync('npm install clsx tailwind-merge class-variance-authority lucide-react', { stdio: 'inherit' });
    
    // Install additional dependencies based on components to be used
    execSync(`
      npm install @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
      @radix-ui/react-label @radix-ui/react-select @radix-ui/react-tabs @hookform/resolvers \
      react-hook-form zod
    `, { stdio: 'inherit' });
    
  } catch (error) {
    console.error('Error installing dependencies:', error.message);
  }
}

// Initialize shadcn
function initializeShadcn() {
  console.log('Initializing shadcn...');
  
  // Create components.json file with proper relative paths
  const componentsConfig = {
    $schema: "https://ui.shadcn.com/schema.json",
    style: "default",
    rsc: false,
    tsx: usesTypeScript,
    tailwind: {
      config: "tailwind.config.js",
      css: "src/tailwind.css",
      baseColor: "slate",
      cssVariables: true
    },
    aliases: {
      components: "components",
      utils: "lib/utils"
    }
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'components.json'),
    JSON.stringify(componentsConfig, null, 2)
  );
}

// Install shadcn components using the CLI
async function installComponents() {
  try {
    console.log(`Installing ${shadcnComponents.length} shadcn components...`);
    
    // First try to use the CLI
    for (const component of shadcnComponents) {
      console.log(`\nInstalling ${component} component...`);
      try {
        // Ensure components.json is being read correctly before executing the command
        if (!fs.existsSync(path.join(process.cwd(), 'components.json'))) {
          console.error('components.json file is missing. Re-initializing...');
          initializeShadcn();
        }
        
        // Define the path where components should be installed (UI directory)
        const componentsUIPath = path.join(process.cwd(), 'components', 'ui');
        
        // Run the CLI command with specific path parameter
        execSync(`npx shadcn@latest add ${component} --yes --path=${componentsUIPath.replace(/\\/g, '/')}`, { 
          stdio: 'inherit',
          env: { ...process.env, DEBUG: 'shadcn-ui:*' }  // Enable debug mode
        });
        console.log(`✅ ${component} installed successfully.`);
      } catch (error) {
        console.error(`❌ Error installing ${component}:`, error.message);
        console.log('Will try to copy the component manually on publish.');
        
        // Additional logging to help debugging
        console.log(`
If you want to install this component manually, run:
npx shadcn-ui@latest add ${component} --path=components/ui

Make sure your components.json file is correctly configured with proper paths.
        `);
      }
    }
  } catch (error) {
    console.error('Error installing components:', error.message);
    console.log(`
Troubleshooting tips:
1. Make sure your project structure matches the paths in components.json
2. Try installing components manually after setup using: npm run autoui:install-components [component-name] -- --path=components/ui
3. Check for any path issues in your project configuration
    `);
  }
}

// Create a helper script in package.json to install missing components
function createHelperScript() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Add a script to install shadcn components
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts['autoui:install-components'] = 'npx shadcn@latest add --path=components/ui';
    
    // Add documentation in the README
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    
    console.log('Added helper script for installing components: npm run autoui:install-components [component-name]');
  } catch (error) {
    console.error('Error creating helper script:', error.message);
  }
}

// Main execution
setupTailwind();
setupDirectories();
createUtilsFile();
installDependencies();
initializeShadcn();
installComponents();
createHelperScript();

console.log('\nsetup-shadcn completed!');
console.log('\nTo use AutoUI components:');
console.log('1. Import the CSS in your application:');
console.log('   import "./src/tailwind.css";');
console.log('2. To install additional shadcn components:');
console.log('   npm run autoui:install-components [component-name]');
console.log('   Components will be installed in: components/ui/');
console.log('\nIf you encountered "resolvedPaths: Required" errors:');
console.log('1. Delete the existing components.json file');
console.log('2. Run the setup script again: npm run setup-shadcn');
console.log('3. Try installing components manually:');
console.log('   npx shadcn-ui@latest add [component-name] --path=components/ui');
console.log('\nSee documentation for more details.\n');