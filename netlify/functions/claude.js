exports.handler = async function(event) {
  if(event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if(!GROQ_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({error: 'API key not configured'}) };
  }

  try {
    const body = JSON.parse(event.body);
    const prompt = body.messages?.[0]?.content || '';

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if(!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: data.error?.message || JSON.stringify(data) })
      };
    }

    const text = data?.choices?.[0]?.message?.content || 'לא הצלחתי לנתח, נסה שוב';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ content: [{ type: 'text', text: text }] })
    };

  } catch(e) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: e.message })
    };
  }
};
