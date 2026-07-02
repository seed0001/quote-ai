const OPENROUTER_MODELS_URL = '/api/openrouter/api/v1/models/user';

export async function fetchOpenRouterModels(apiKey) {
  const response = await fetch(OPENROUTER_MODELS_URL, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error?.message || `OpenRouter model request failed (${response.status}).`);
  }

  const payload = await response.json();
  const models = Array.isArray(payload.data) ? payload.data : [];

  return models
    .filter((model) => model?.id && !model.id.includes('gemini-1.5-pro'))
    .map((model) => {
      const pricing = {
        prompt: Number(model.pricing?.prompt || 0),
        completion: Number(model.pricing?.completion || 0),
        request: Number(model.pricing?.request || 0),
        image: Number(model.pricing?.image || 0),
        webSearch: Number(model.pricing?.web_search || 0),
        internalReasoning: Number(model.pricing?.internal_reasoning || 0),
        cacheRead: Number(model.pricing?.input_cache_read || 0),
        cacheWrite: Number(model.pricing?.input_cache_write || 0),
      };
      const architecture = model.architecture || {};
      const inputModalities = model.input_modalities || architecture.input_modalities || [];
      const isVision = 
        (architecture.modality && architecture.modality.includes('image')) ||
        (Array.isArray(inputModalities) && inputModalities.includes('image')) ||
        (model.id && (
          model.id.includes('vision') || 
          model.id.includes('vl') || 
          model.id.includes('gpt-4o') || 
          model.id.includes('claude-3') || 
          model.id.includes('gemini-2.0') || 
          model.id.includes('pixtral') || 
          model.id.includes('llama-3.2-11b') || 
          model.id.includes('llama-3.2-90b')
        ));
      return {
        id: model.id,
        name: model.name || model.id,
        contextLength: model.context_length || 0,
        free: pricing.prompt === 0 && pricing.completion === 0 && pricing.request === 0,
        pricing,
        description: model.description || '',
        supportedParameters: model.supported_parameters || [],
        isVision: !!isVision,
      };
    })
    .sort((a, b) => {
      if (a.free !== b.free) return a.free ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}
