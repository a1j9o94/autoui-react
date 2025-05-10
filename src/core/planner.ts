import { useChat } from '@ai-sdk/react';
import { PlannerInput, UISpecNode, uiSpecNode } from '../schema/ui';
import { 
  createSystemEvent, 
  systemEvents, 
  SystemEventType 
} from './system-events';
import { env } from '../env';

// Define types for the chat response
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatResponse {
  messages: ChatMessage[];
  append: (message: { content: string; role: string }) => Promise<void>;
}

/**
 * Builds the prompt for the LLM planner
 * @param input - Planner input including schema, goal, and history
 * @param targetNodeId - Optional target node ID for partial updates
 * @param customPrompt - Optional custom prompt
 * @returns Formatted prompt string
 */
export function buildPrompt(input: PlannerInput, targetNodeId?: string, customPrompt?: string): string {
  const { schema, goal, history, userContext } = input;
  
  // Extract schema information without actual data rows
  const schemaInfo = Object.entries(schema)
    .map(([tableName, tableSchema]) => {
      return `Table: ${tableName}\nSchema: ${JSON.stringify(tableSchema)}`;
    })
    .join('\n\n');
  
  // Format recent events for context
  const recentEvents = history?.slice(-5).map(event => 
    `Event: ${event.type} on node ${event.nodeId}${
      event.payload ? ` with payload ${JSON.stringify(event.payload)}` : ''
    }`
  ).join('\n') || 'No recent events';
  
  // Build user context section if provided
  const userContextSection = userContext 
    ? `\n\nUser Context:\n${JSON.stringify(userContext)}`
    : '';
  
  // Assemble the full prompt
  return `
You are an expert UI generator. 
Create a user interface that achieves the following goal: "${goal}"

Available data schema:
${schemaInfo}

Recent user interactions:
${recentEvents}${userContextSection}

Generate a complete UI specification in JSON format that matches the following TypeScript type:
type UISpecNode = {
  id: string;
  type: string;
  props?: Record<string, any>;
  bindings?: Record<string, any>;
  events?: Record<string, { action: string; target?: string; payload?: Record<string, any>; }>;
  children?: UISpecNode[];
};

UI Guidance:
1. Create a focused interface that directly addresses the goal
2. Use appropriate UI patterns (lists, forms, details, etc.)
3. Include navigation between related views when needed
4. Keep the interface simple and intuitive
5. Bind to schema data where appropriate
6. Provide event handlers for user interactions

Respond ONLY with the JSON UI specification and no other text.
  `;
}

/**
 * Mock planner for development and testing
 * @param input - Planner input
 * @param targetNodeId - Optional target node ID for partial updates
 * @param customPrompt - Optional custom prompt
 * @returns Promise resolving to a UISpecNode
 */
export function mockPlanner(
  input: PlannerInput, 
  targetNodeId?: string,
  customPrompt?: string
): UISpecNode {
  // Create a simple mock node example
  const mockNode: UISpecNode = {
    id: targetNodeId || 'root',
    type: 'Container',
    props: { title: 'Mock UI' },
    children: [
      {
        id: 'text-1',
        type: 'Text',
        props: { text: 'This is a mock UI for testing' }
      }
    ]
  };
  
  return mockNode;
}

/**
 * Calls the LLM planner to generate a UI specification
 * @param input - Planner input
 * @returns Promise resolving to a UISpecNode
 */
export async function callPlannerLLM(
  input: PlannerInput,
  chatHook = useChat
): Promise<UISpecNode> {
  // Emit planning start event
  await systemEvents.emit(
    createSystemEvent(SystemEventType.PLAN_START, { plannerInput: input })
  );
  
  // Use mock planner if environment variable is set
  if (env.MOCK_PLANNER === '1') {
    return mockPlanner(input);
  }
  
  const startTime = Date.now();
  const prompt = buildPrompt(input);
  
  // Emit prompt created event
  await systemEvents.emit(
    createSystemEvent(SystemEventType.PLAN_PROMPT_CREATED, { prompt })
  );
  
  try {
    const { append, messages } = chatHook({
      api: '/api/ai',
      headers: {
        'Content-Type': 'application/json',
      },
      onFinish: async (message) => {
        // Emit final chunk event
        await systemEvents.emit(
          createSystemEvent(SystemEventType.PLAN_RESPONSE_CHUNK, { 
            chunk: message.content,
            isComplete: true
          })
        );
      }
    }) as ChatResponse;
    
    // Send the prompt to the LLM
    await append({
      content: prompt,
      role: 'user',
    });

    if (!messages || messages.length === 0) {
      throw new Error('No response from LLM');
    }
    
    // Parse the LLM response
    const responseText = messages[messages.length - 1]?.content;
    
    if (!responseText) {
      throw new Error('Empty response from LLM');
    }
    
    // Extract JSON from the response (handling potential markdown code blocks)
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, responseText];
    const jsonStr = jsonMatch[1].trim();
    
    try {
      const parsedJson = JSON.parse(jsonStr);
      // Validate the response using Zod
      const validatedNode = uiSpecNode.parse(parsedJson);
      
      // Emit planning complete event
      await systemEvents.emit(
        createSystemEvent(SystemEventType.PLAN_COMPLETE, { 
          layout: validatedNode,
          executionTimeMs: Date.now() - startTime
        })
      );
      
      return validatedNode;
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', parseError);
      
      // Emit error event
      await systemEvents.emit(
        createSystemEvent(SystemEventType.PLAN_ERROR, { 
          error: new Error('Invalid JSON response from LLM')
        })
      );
      
      throw new Error('Invalid JSON response from LLM');
    }
  } catch (error) {
    console.error('Error calling LLM planner:', error);
    
    // Emit error event
    await systemEvents.emit(
      createSystemEvent(SystemEventType.PLAN_ERROR, { 
        error: error instanceof Error ? error : new Error(String(error))
      })
    );
    
    throw error;
  }
}