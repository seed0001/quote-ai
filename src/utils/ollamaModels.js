const OLLAMA_MODELS_URL = '/api/ollama/api/tags';

export async function fetchOllamaModels() {
  try {
    const response = await fetch(OLLAMA_MODELS_URL, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Ollama model request failed (${response.status}). Is Ollama running?`);
      return [];
    }

    const payload = await response.json();
    const models = Array.isArray(payload.models) ? payload.models : [];

    return models
      .map((model) => {
        const pricing = {
          prompt: 0,
          completion: 0,
          request: 0,
          image: 0,
          webSearch: 0,
          internalReasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
        };
        return {
          id: `ollama/${model.name}`, // Prefix to distinguish from OpenRouter
          name: `Ollama: ${model.name}`,
          contextLength: 8192, // Default or placeholder for local
          free: true,
          pricing,
          description: `Local model (${model.details?.parameter_size || 'unknown size'}) running on Ollama.`,
          supportedParameters: [],
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.warn('Failed to fetch Ollama models. Ensure Ollama is running locally.', error);
    return [];
  }
}
