import Groq from 'groq-sdk';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { query, contextData, systemPrompt: clientSystemPrompt } = request.body;

    if (!query) {
        return response.status(400).json({ error: 'Query is required' });
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        return response.status(500).json({ error: 'Server configuration error: API Key missing' });
    }

    const groq = new Groq({ apiKey });

    // We construct the prompt here to be safe, or we can accept it from client.
    // Since the client already constructs a very specific prompt with the context, 
    // and we want to keep the logic in one place if possible, but for security, 
    // it's better if the system prompt structure is controlled here.
    // However, to minimize refactoring friction and keep the logic consistent with what we just built,
    // I will accept the system prompt from the client BUT ideally we should move prompt construction here.
    // Given the "Refactoring" nature, let's move the prompt construction logic here?
    // The plan said: "Instantiates the Groq client... Sends the prompt to the LLM."
    // The client calculates `contextData`.
    // Let's reconstruct the prompt here using the contextData passed from client.
    // This is cleaner and safer.

    try {
        // Reconstruct the system prompt here to ensure consistency and security
        // We need to match the logic exactly:
        // "You are the search engine for Project Hermes, created by Aryan Pahwani..."

        // Note: contextData is passed from client.

        const systemPrompt = `You are the search engine for Project Hermes, created by Aryan Pahwani.
        Here is the database context: ${JSON.stringify(contextData)}
        
        The user is searching for: "${query}"
        
        Return a CSV string of people from the provided database that match the query.
        - The CSV MUST have these headers: Name, Title, Twitter/Github, Website, Contact (mail), What am I building?, /whoami (description), AI_Description
        - For 'AI_Description', generate a short, punchy, 3rd-person summary (max 15 words) of who they are based on their info.
        - Return ONLY the CSV string. No other text.
        - CRITICAL: If the user asks "who made this", "who built this", or about the creator, YOU MUST return the entry for 'Aryan Pahwani' (or similar) from the database.
        - If no one matches, return nothing or just the headers.
        - Match loosely based on skills, roles, bio, and Site Keywords.
        - If the user asks for "everyone" or "all", return the context.`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: query }
            ],
            model: 'openai/gpt-oss-120b', // Keep the model consistent
            temperature: 0.1,
        });

        const content = chatCompletion.choices[0].message.content;
        return response.status(200).json({ content });

    } catch (error) {
        console.error('Error calling Groq:', error);
        return response.status(500).json({ error: 'Failed to fetch from Groq', details: error.message });
    }
}
