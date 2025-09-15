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

// Retry function with exponential backoff
async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            
            // If rate limited, wait and retry
            if (response.status === 429) {
                console.log(`Rate limited. Retrying in ${delay * Math.pow(2, i)}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
                continue;
            }
            
            // If response is OK, return it
            if (response.ok) {
                return response;
            }
            
            // For other errors, throw
            throw new Error(`HTTP error! status: ${response.status}`);
        } catch (error) {
            // If this is the last retry, throw the error
            if (i === retries - 1) throw error;
            
            // Otherwise, wait and retry
            console.log(`Request failed. Retrying in ${delay * Math.pow(2, i)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
    }
}

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
    const { prompt, language, taskType } = req.body;
    
    if (!prompt || !language || !taskType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: prompt, language, or taskType' 
      });
    }

    // Generate enhanced prompt using OpenAI with retry logic
    const openAIResponse = await fetchWithRetry(
      'https://api.openai.com/v1/chat/completions',
      {
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
      },
      3, // retry up to 3 times
      1000 // initial delay of 1000ms
    );

    const openAIData = await openAIResponse.json();
    const enhancedPrompt = openAIData.choices[0].message.content.trim();

    // Generate code using DeepSeek with retry logic
    const deepSeekResponse = await fetchWithRetry(
      `${process.env.DEEPSEEK_BASE_URL}/chat/completions`,
      {
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
      },
      3, // retry up to 3 times
      1000 // initial delay of 1000ms
    );

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
