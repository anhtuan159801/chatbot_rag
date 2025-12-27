import { GoogleGenAI } from '@google/genai';

export interface ModelConfig {
  id: string;
  provider: string;
  name: string;
  model_string: string;
  api_key: string;
  is_active: boolean;
}

export interface AIRequestOptions {
  provider: string;
  model: string;
  apiKey: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Unified AI Service that dynamically routes requests to configured models
 */
export class AIService {
  
  /**
   * Generate text completion using the specified model configuration
   */
  static async generateText(options: AIRequestOptions): Promise<string> {
    const { provider, model, apiKey, prompt, systemPrompt } = options;

    console.log(`[AIService] Generating text with ${provider}/${model}`);

    switch (provider.toLowerCase()) {
      case 'gemini':
        return this.generateGeminiText(model, apiKey, prompt, systemPrompt);
      case 'openai':
        return this.generateOpenAIText(model, apiKey, prompt, systemPrompt);
      case 'openrouter':
        return this.generateOpenRouterText(model, apiKey, prompt, systemPrompt);
      case 'huggingface':
        return this.generateHuggingFaceText(model, apiKey, prompt, systemPrompt);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Generate text using OpenAI API
   */
  private static async generateOpenAIText(
    model: string,
    apiKey: string,
    prompt: string,
    systemPrompt?: string
  ): Promise<string> {
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const messages: Array<{ role: string; content: string }> = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error: any) {
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate text using Google Gemini API
   */
  private static async generateGeminiText(
    model: string,
    apiKey: string,
    prompt: string,
    systemPrompt?: string
  ): Promise<string> {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const ai = new GoogleGenAI({ apiKey });

    let fullPrompt = prompt;
    if (systemPrompt) {
      fullPrompt = `${systemPrompt}\n\n${prompt}`;
    }

    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: fullPrompt,
      });

      const result = response.text;
      if (!result || result.trim().length === 0) {
        throw new Error('Empty response from Gemini API');
      }

      return result;
    } catch (error: any) {
      console.error('Gemini API error:', error);
      throw new Error(`Gemini API error: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate text using OpenRouter API
   */
  private static async generateOpenRouterText(
    model: string,
    apiKey: string,
    prompt: string,
    systemPrompt?: string
  ): Promise<string> {
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    const messages: Array<{ role: string; content: string }> = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:8080',
          'X-Title': 'RAGBot Admin Console'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenRouter API error: ${JSON.stringify(error)}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error: any) {
      console.error('OpenRouter API error:', error);
      throw new Error(`OpenRouter API error: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate text using HuggingFace Inference API
   */
  private static async generateHuggingFaceText(
    model: string,
    apiKey: string,
    prompt: string,
    systemPrompt?: string
  ): Promise<string> {
    if (!apiKey) {
      throw new Error('HUGGINGFACE_API_KEY not configured');
    }

    let fullPrompt = prompt;
    if (systemPrompt) {
      fullPrompt = `${systemPrompt}\n\nUser: ${prompt}\nAssistant:`;
    } else {
      fullPrompt = `User: ${prompt}\nAssistant:`;
    }

    try {
      const response = await fetch(`https://router.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          inputs: fullPrompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.7
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`HuggingFace API error: ${JSON.stringify(error)}`);
      }

      const data = await response.json();
      
      // Handle different response formats from HuggingFace
      if (Array.isArray(data)) {
        return data[0]?.generated_text || '';
      } else if (data.generated_text) {
        return data.generated_text;
      } else {
        throw new Error('Unexpected response format from HuggingFace API');
      }
    } catch (error: any) {
      console.error('HuggingFace API error:', error);
      throw new Error(`HuggingFace API error: ${error.message || 'Unknown error'}`);
    }
  }
}

export const aiService = new AIService();
