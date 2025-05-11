/**
 * Checks if shadcn components are available in the project
 * @returns Boolean indicating whether shadcn components are available
 */
export function areShadcnComponentsAvailable(): boolean {
  try {
    // Try to require one of the shadcn components
    require("../../components/ui/button");
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Provides helpful guidance for missing components
 */
export function getMissingComponentsMessage(): string {
  return `Missing required shadcn components. Please run:
> npm run setup-shadcn`;
}
