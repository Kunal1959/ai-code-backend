/**
 * Vercel Serverless Function for AI Code Generation
 * 
 * This function:
 * 1. Handles CORS preflight requests
 * 2. Validates POST requests with user input
 * 3. Generates a prompt using OpenAI
 * 4. Uses the prompt to generate code with DeepSeek
 * 5. Returns the generated code with proper CORS headers
 * 
 * Environment Variables Required:
 * - OPENAI_API_KEY: Your OpenAI API key
 * - DEEPSEEK_API_KEY: Your DeepSeek API key
 * - DEEPSEEK_BASE_URL: DeepSeek API endpoint URL
 * 
 * Deployment:
 * 1. Set environment variables in Vercel dashboard
 * 2. Deploy to Vercel with `vercel --prod`
 * 3. Update frontend's BACKEND_URL to point to your Vercel domain
 */

export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    // Validate request body
    const enhancedPrompt = `Generate ${taskType} code in ${language} for the following requirement:
${prompt}`;
    
    if (!prompt || !language || !taskType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: prompt, language, or taskType' 
      });
    }

    // Generate enhanced prompt using OpenAI
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a prompt engineer specializing in code generation. Create clear, concise, and effective prompts for AI code generation based on user requirements.'
          },
          {
            role: 'user',
            content: `Create a prompt for generating code with these requirements:
            - Programming language: ${language}
            - Task type: ${taskType}
            - User description: ${prompt}
            
            Return only the prompt text without any additional explanation.`
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      })
    });

    if (!openAIResponse.ok) {
      throw new Error(`OpenAI API error: ${openAIResponse.statusText}`);
    }

    const openAIData = await openAIResponse.json();
    const enhancedPrompt = openAIData.choices[0].message.content.trim();

    // Generate code using DeepSeek
    const deepSeekResponse = await fetch(`${process.env.DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-coder',
        messages: [
          {
            role: 'system',
            content: 'You are an expert programmer. Generate clean, efficient, and well-commented code based on the provided requirements.'
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000
      })
    });

    if (!deepSeekResponse.ok) {
      throw new Error(`DeepSeek API error: ${deepSeekResponse.statusText}`);
    }

    const deepSeekData = await deepSeekResponse.json();
    const generatedCode = deepSeekData.choices[0].message.content;

    // Return success response
    return res.status(200).json({
      success: true,
      prompt: enhancedPrompt,
      code: generatedCode
    });

  } catch (error) {
    console.error('Error in generate API:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

