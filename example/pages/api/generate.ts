import { NextRequest } from 'next/server';
import { StreamingTextResponse } from 'ai';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable');
}

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const { prompt } = await req.json();

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Missing prompt in request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Generate a stream using the AI SDK
    const { textStream } = await generateText({
      model: openai('gpt-4'),
      prompt,
      temperature: 0.7,
      maxTokens: 2000,
      stream: true,
    });

    // Return a streaming response
    return new StreamingTextResponse(textStream);
  } catch (error) {
    console.error('Error generating completion:', error);
    return new Response(JSON.stringify({ error: 'Error generating completion' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 