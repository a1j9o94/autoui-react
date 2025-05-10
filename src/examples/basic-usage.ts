// Basic usage of the AI SDK
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Example function to generate text using the AI SDK
 * 
 * Note: You need to set OPENAI_API_KEY environment variable
 * or use another supported provider
 */
export async function generateComponent(schema: any) {
  try {
    // Basic text generation
    const { text } = await generateText({
      model: openai('gpt-4'),
      prompt: `Generate a React component based on this data schema: ${JSON.stringify(schema)}`,
    });
    
    return text;
  } catch (error) {
    console.error('Error generating component:', error);
    throw error;
  }
}

/**
 * Usage example:
 * 
 * ```ts
 * import { generateComponent } from './basic-usage';
 * 
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number' },
 *     email: { type: 'string', format: 'email' }
 *   },
 *   required: ['name', 'email']
 * };
 * 
 * // Call the function
 * const component = await generateComponent(schema);
 * console.log(component);
 * ```
 */ 