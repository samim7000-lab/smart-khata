// Supabase Edge Function: gemini-ocr
// Deploy via: supabase functions deploy gemini-ocr --no-verify-jwt
// Set secret via: supabase secrets set GEMINI_API_KEY=your_key_here
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // 1. EXPLICIT CORS PREFLIGHT OPTION HANDLING
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // 2. PARSE REQUEST BODY WITH EXPLICIT LOGGING
    let imageBase64 = '';
    let mimeType = 'image/jpeg';
    try {
      const body = await req.json();
      imageBase64 = body.imageBase64 || '';
      mimeType = body.mimeType || 'image/jpeg';
    } catch (bodyErr: any) {
      console.error('[EDGE OCR ERROR] Failed to parse request JSON payload:', bodyErr);
      return new Response(
        JSON.stringify({
          is_valid_ledger: false,
          reason_if_invalid: 'Invalid JSON request payload sent to Edge Function.',
          error: 'Invalid JSON payload',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. READ SECRET STRICTLY FROM DENO ENVIRONMENT AND TRIM ACCIDENTAL SPACES
    const apiKey = Deno.env.get('GEMINI_API_KEY')?.trim();
    if (!apiKey || apiKey === '') {
      console.error('[EDGE OCR ERROR] GEMINI_API_KEY secret is missing in Supabase Edge Function environment!');
      return new Response(
        JSON.stringify({
          is_valid_ledger: false,
          reason_if_invalid: 'GEMINI_API_KEY secret is missing on Supabase Edge Function. Set it using: supabase secrets set GEMINI_API_KEY=your_key',
          error: 'GEMINI_API_KEY secret missing',
          isSecretMissing: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. INITIALIZE LATEST OFFICIAL GOOGLE GEN AI SDK (@google/genai)
    const activeModelIdentifier = "gemini-2.0-flash";
    console.log(`[EDGE OCR] Initializing @google/genai SDK request with model identifier: ${activeModelIdentifier}`);
    
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // Clean base64 string if data URL prefix exists
    let cleanBase64 = imageBase64;
    if (imageBase64.includes(';base64,')) {
      cleanBase64 = imageBase64.split(';base64,')[1];
    }

    const strict2StepPrompt = `You are a strict data extractor for handwritten ledgers, account books, shop receipts, and bills in Bangla, English, and Hindi.

Step 1: Analyze the image carefully. Is it a handwritten ledger, account book, shop receipt, or bill?
If it is a random photo (e.g., face, selfie, landscape, blank paper, unrelated object, animal, vehicle) or contains NO ledger/financial data, you MUST return "is_valid_ledger": false and provide a clear "reason_if_invalid". Set customer_name as "" and amount as 0.

Step 2: If and ONLY if it is a valid ledger/receipt, extract the customer name and amount. NEVER invent, guess, or hallucinate names or amounts. If no clear name is written, return "". If no clear amount is found, return 0.

Return STRICT JSON matching this schema:
{
  "is_valid_ledger": boolean,
  "reason_if_invalid": string,
  "customer_name": string,
  "amount": number,
  "type": "credit" | "payment" | "unknown",
  "confidence": number
}`;

    // 5. EXECUTE GENERATE CONTENT AND CAPTURE FULL API ERROR DETAILS ON FAILURE
    let responseText = '';
    try {
      const response = await ai.models.generateContent({
        model: activeModelIdentifier,
        contents: [
          strict2StepPrompt,
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64,
            },
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      responseText = response.text || '';
      console.log(`[EDGE OCR SUCCESS] Executed model ${activeModelIdentifier} via @google/genai. Status: HTTP 200 OK.`);
    } catch (genErr: any) {
      console.error(`[EDGE OCR ERROR] Google Gen AI API Error on model ${activeModelIdentifier}:`, genErr);
      const fullErrorBody = typeof genErr === 'object' ? JSON.stringify(genErr, Object.getOwnPropertyNames(genErr)) : String(genErr);
      return new Response(
        JSON.stringify({
          is_valid_ledger: false,
          reason_if_invalid: `Google Gen AI Error (${genErr.status || 'API Error'}): ${genErr.message || String(genErr)}`,
          error: genErr.message || String(genErr),
          full_response_body: fullErrorBody,
          model_identifier: activeModelIdentifier,
          sdk_version: "@google/genai",
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. PARSE GEMINI SDK RESPONSE WITH DETAILED LOGGING
    let parsed: any = {};
    try {
      const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (parseErr: any) {
      console.error('[EDGE OCR ERROR] Failed to parse JSON text from SDK output:', parseErr, 'Raw Text:', responseText);
      return new Response(
        JSON.stringify({
          is_valid_ledger: false,
          reason_if_invalid: 'Failed to parse JSON response from Gemini Vision API.',
          error: 'JSON parsing error',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. RETURN SANITIZED SUCCESS/VALIDATION RESPONSE
    const isValid = Boolean(parsed.is_valid_ledger);
    const reason = parsed.reason_if_invalid || (isValid ? '' : 'This photo does not contain a valid ledger or receipt.');

    console.log(`[EDGE OCR SUCCESS] Completed analysis via ${activeModelIdentifier}. Is valid ledger: ${isValid}`);

    return new Response(
      JSON.stringify({
        is_valid_ledger: isValid,
        reason_if_invalid: reason,
        customer_name: isValid ? (parsed.customer_name || '') : '',
        amount: isValid ? (Number(parsed.amount) || 0) : 0,
        type: parsed.type === 'payment' ? 'payment_received' : 'credit_given',
        confidence: Number(parsed.confidence) || (isValid ? 0.9 : 0),
        resolved_model: activeModelIdentifier,
        sdk_version: "@google/genai",
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[EDGE OCR ERROR] SDK Exception inside Edge Function:', err);
    return new Response(
      JSON.stringify({
        is_valid_ledger: false,
        reason_if_invalid: err.message || 'Gemini SDK Error',
        error: err.message || 'SDK Error',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
