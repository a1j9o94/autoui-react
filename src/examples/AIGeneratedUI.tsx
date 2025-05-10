import React, { useState, useEffect } from 'react';
import { useCompletion } from 'ai/react';
import { openai } from '@ai-sdk/openai';

interface AIGeneratedUIProps {
  schema: any;
  onGenerated?: (component: string) => void;
}

const AIGeneratedUI: React.FC<AIGeneratedUIProps> = ({ schema, onGenerated }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedComponent, setGeneratedComponent] = useState<string>('');
  
  const { complete, completion } = useCompletion({
    api: '/api/generate',
    // You can also configure provider directly here
    // model: openai('gpt-4'),
  });

  const generateComponent = async () => {
    setIsGenerating(true);
    try {
      const prompt = `Generate a React component based on this data schema: ${JSON.stringify(schema)}`;
      await complete(prompt);
    } catch (error) {
      console.error('Error generating component:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (completion && !isGenerating) {
      setGeneratedComponent(completion);
      if (onGenerated) {
        onGenerated(completion);
      }
    }
  }, [completion, isGenerating, onGenerated]);

  return (
    <div className="ai-generated-ui">
      <button 
        onClick={generateComponent} 
        disabled={isGenerating}
      >
        {isGenerating ? 'Generating...' : 'Generate UI Component'}
      </button>
      
      {generatedComponent && (
        <div className="generated-output">
          <h3>Generated Component:</h3>
          <pre>{generatedComponent}</pre>
        </div>
      )}
    </div>
  );
};

export default AIGeneratedUI; 