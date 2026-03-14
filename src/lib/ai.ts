import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function getAIClient(): OpenAI {
    if (!_client) {
        _client = new OpenAI({
            apiKey: process.env.NEBUL_API_KEY ?? 'dummy',
            baseURL: process.env.NEBUL_BASE_URL,
        });
    }
    return _client;
}

export const NEBUL_MODEL = process.env.NEBUL_MODEL ?? 'Qwen/Qwen3.5-397B-A17B';
