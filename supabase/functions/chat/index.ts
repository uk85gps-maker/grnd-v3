import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const pathname = url.pathname

  // Macro estimation endpoint
  if (pathname.endsWith('/macro-estimate')) {
    try {
      const { items } = await req.json()

      if (!items || !Array.isArray(items) || items.length === 0) {
        return new Response(JSON.stringify({ error: 'items array required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const systemPrompt = "You are a macro estimation assistant. The user is in Australia. Estimate macros using Australian ingredients, Australian cooking oils, and standard Australian portion sizes. South Asian foods including roti, dal, sabzi, rice dishes, and curries are common — use realistic South Asian Australian portion sizes and cooking methods for these items. Return ONLY a raw JSON object. Do not wrap in markdown. Do not use backticks. Do not include any explanation, preamble, or formatting. The very first character of your response must be { and the very last must be }. Format: { calories: number, protein: number, carbs: number, fat: number, fibre: number }"
      
      const userMessage = items.join(', ')

      const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
      
      if (!apiKey) {
        console.error('ANTHROPIC_API_KEY not set')
        return new Response(JSON.stringify({ error: 'API key not configured', details: 'ANTHROPIC_API_KEY environment variable is missing' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 200,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Anthropic API error:', data)
        return new Response(JSON.stringify({ 
          error: 'anthropic_api_error', 
          status: response.status,
          details: data 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!data.content || !data.content[0]) {
        console.error('Unexpected response format:', data)
        return new Response(JSON.stringify({ 
          error: 'unexpected_response_format',
          details: data 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const textContent = data.content[0].text
      // Strip markdown code fences if the model wraps output despite instructions
      const cleaned = textContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      const macros = JSON.parse(cleaned)

      return new Response(JSON.stringify(macros), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error('Macro estimation error:', error)
      return new Response(JSON.stringify({ 
        error: 'estimation_failed',
        message: error.message,
        stack: error.stack 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // Default chat endpoint
  try {
    const { messages, system } = await req.json()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system,
        messages,
      }),
    })

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
