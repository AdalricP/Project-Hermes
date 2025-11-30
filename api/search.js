import Groq from 'groq-sdk';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { query, contextData } = request.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        return response.status(500).json({ error: 'Server configuration error: API Key missing' });
    }

    const groq = new Groq({ apiKey });

    try {
        // We now expect contextData to be the list of people found by Fuse.js
        // We want to generate a description for each of them relative to the query.

        const systemPrompt = `You are the AI oracle for Project Hermes.
        The user searched for: "${query}"
        
        You are provided with a list of people who matched this search.
        Your task is to generate a ONE-SENTENCE "AI Description" for each person, explaining why they match the query or highlighting their coolest work.
        
        - Keep it punchy, exciting, and under 15 words per person.
        - Use 3rd person.
        - Return ONLY a JSON object where the key is the person's "Name" and the value is the description.
        - Example format: { "Aryan Pahwani": "Building the future of search with Hermes.", "John Doe": "Crafting high-performance systems in Rust." }
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: JSON.stringify(contextData) }
            ],
            model: 'llama3-8b-8192', // Use a standard, fast model
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const content = chatCompletion.choices[0].message.content;
        return response.status(200).json({ content });

    } catch (error) {
        console.error('Error calling Groq:', error);
        return response.status(500).json({ error: 'Failed to fetch from Groq', details: error.message });
    }
}
