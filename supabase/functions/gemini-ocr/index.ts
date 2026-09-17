// Supabase Edge Function: gemini-ocr
// Deploy via: supabase functions deploy gemini-ocr
// Set secret via: supabase secrets set GEMINI_API_KEY=your_key_here
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    // 2. CALLER AUTHENTICATION (Mandatory Security Gate)
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[EDGE OCR SECURITY] Missing or malformed Authorization header');
      return new Response(
        JSON.stringify({
          is_valid_ledger: false,
          status: 'unauthorized',
          reason_if_invalid: 'Authentication required. Please sign in to Smart Khata.',
          error: 'Unauthorized: Missing Bearer token',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    let authenticatedUser: any = null;
    let supabaseClient: any = null;

    if (supabaseUrl && supabaseAnonKey) {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authErr } = await supabaseClient.auth.getUser(token);
      if (authErr || !user) {
        console.warn('[EDGE OCR SECURITY] Invalid session token:', authErr?.message);
        return new Response(
          JSON.stringify({
            is_valid_ledger: false,
            status: 'unauthorized',
            reason_if_invalid: 'Your session has expired. Please sign in again.',
            error: 'Unauthorized: Invalid token',
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      authenticatedUser = user;
      console.log(`[EDGE OCR SECURITY] Verified authenticated user: ${user.id}`);
    }

    // 3. PARSE REQUEST BODY WITH EXPLICIT LOGGING
    let imageBase64 = '';
    let mimeType = 'image/jpeg';
    let shopId = '';
    try {
      const body = await req.json();
      imageBase64 = body.imageBase64 || '';
      mimeType = body.mimeType || 'image/jpeg';
      shopId = body.shopId || '';
    } catch (bodyErr: any) {
      console.error('[EDGE OCR ERROR] Failed to parse request JSON payload:', bodyErr);
      return new Response(
        JSON.stringify({
          is_valid_ledger: false,
          status: 'unreadable',
          reason_if_invalid: 'Invalid JSON request payload sent to Edge Function.',
          error: 'Invalid JSON payload',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!imageBase64) {
      return new Response(
        JSON.stringify({
          is_valid_ledger: false,
          status: 'unreadable',
          reason_if_invalid: 'No image data provided. Please upload or capture an image.',
          error: 'Missing imageBase64',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3b. OPTIONAL TENANT SHOP VERIFICATION
    if (shopId && authenticatedUser && supabaseClient) {
      const { data: shopRecord, error: shopErr } = await supabaseClient
        .from('shops')
        .select('id')
        .eq('id', shopId)
        .eq('owner_id', authenticatedUser.id)
        .maybeSingle();

      if (shopErr || !shopRecord) {
        console.warn(`[EDGE OCR SECURITY] Shop ${shopId} does not belong to user ${authenticatedUser.id}`);
        return new Response(
          JSON.stringify({
            is_valid_ledger: false,
            status: 'unauthorized',
            reason_if_invalid: 'Shop access denied. You do not have permission for this shop.',
            error: 'Forbidden: Invalid shop ownership',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`[EDGE OCR SECURITY] Verified shop tenant ownership: ${shopId}`);
    }

    // 4. READ SECRET STRICTLY FROM ENVIRONMENT
    const apiKey = Deno.env.get('GEMINI_API_KEY')?.trim();
    if (!apiKey || apiKey === '') {
      console.error('[EDGE OCR ERROR] GEMINI_API_KEY secret is missing in Supabase Edge Function environment!');
      return new Response(
        JSON.stringify({
          is_valid_ledger: false,
          status: 'unreadable',
          reason_if_invalid: 'GEMINI_API_KEY secret is missing on Supabase Edge Function. Set it using: supabase secrets set GEMINI_API_KEY=your_key',
          error: 'GEMINI_API_KEY secret missing',
          isSecretMissing: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. INITIALIZE GEMINI 3.6 FLASH SDK (@google/genai)
    const activeModelIdentifier = Deno.env.get('GEMINI_MODEL')?.trim() || "gemini-3.6-flash";
    console.log(`[EDGE OCR] Initializing @google/genai SDK request with model: ${activeModelIdentifier}`);
    
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // Clean base64 string if data URL prefix exists
    let cleanBase64 = imageBase64;
    if (imageBase64.includes(';base64,')) {
      cleanBase64 = imageBase64.split(';base64,')[1];
    }

    const strictExtractionPrompt = `You are a strict financial data extractor for handwritten khata books, paper receipts, cash memos, and ledger notebooks in Bengali (Bangla), Hindi (Devanagari), and English.

Step 1: Check if the photo is a valid ledger page, bill, notebook entry, or receipt.
If it is a selfie, face, landscape, blank paper, unrelated object, animal, vehicle, or contains NO financial/ledger entries, set "is_valid_ledger": false, "status": "unreadable", and provide a clear "reason_if_invalid". Set customer_name to "" and amount to 0.

Step 2: If valid:
- Extract the customer name written on the entry. If unreadable, return "". NEVER invent names.
- Extract the numerical amount. Carefully interpret Bengali numerals (০, ১, ২, ৩, ৪, ৫, ৬, ৭, ৮, ৯), Hindi numerals (०, १, २, ३, ४, ५, ६, ৭, ৮, ९), or English digits. If ambiguous, set amount to 0 and status to "uncertain".
- Determine transaction type: "credit_given" if credit/due/baki/দেনা/বাকি/উধার/खाता, "payment_received" if payment/received/cash/জমা/পরিশোধ/নগদ/जमा/भुगतान, or "unknown".
- Provide confidence (0.0 to 1.0).
- If multiple entries exist, extract the primary/latest line entry.

Return STRICT JSON matching this schema:
{
  "is_valid_ledger": boolean,
  "status": "success" | "uncertain" | "unreadable",
  "reason_if_invalid": string,
  "customer_name": string,
  "amount": number,
  "transaction_type": "credit_given" | "payment_received" | "unknown",
  "currency": string,
  "confidence": number,
  "raw_text": string
}`;

    // 6. EXECUTE GENERATE CONTENT WITH BOUNDED RETRY & EXPONENTIAL BACKOFF
    let responseText = '';
    let lastGenErr: any = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: activeModelIdentifier,
          contents: [
            strictExtractionPrompt,
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
        console.log(`[EDGE OCR SUCCESS] Executed model ${activeModelIdentifier} on attempt ${attempt}.`);
        lastGenErr = null;
        break;
      } catch (genErr: any) {
        lastGenErr = genErr;
        const errMsg = genErr.message || String(genErr);
        console.warn(`[EDGE OCR] Attempt ${attempt}/${maxAttempts} failed with model ${activeModelIdentifier}:`, errMsg);

        const isRetryable =
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('500') ||
          errMsg.includes('502') ||
          errMsg.includes('504') ||
          errMsg.includes('fetch failed') ||
          errMsg.includes('overloaded');

        if (!isRetryable || attempt >= maxAttempts) {
          break;
        }

        const baseDelay = 800 * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * 300);
        const delayMs = baseDelay + jitter;
        console.log(`[EDGE OCR] Waiting ${delayMs}ms before retry attempt ${attempt + 1}...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    if (lastGenErr) {
      console.error(`[EDGE OCR ERROR] Google Gen AI API Error on model ${activeModelIdentifier} after attempts:`, lastGenErr);
      return new Response(
        JSON.stringify({
          is_valid_ledger: false,
          status: 'unreadable',
          reason_if_invalid: `Google Gen AI Error: ${lastGenErr.message || String(lastGenErr)}`,
          error: lastGenErr.message || String(lastGenErr),
          model_identifier: activeModelIdentifier,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. PARSE GEMINI SDK RESPONSE
    let parsed: any = {};
    try {
      const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (parseErr: any) {
      console.error('[EDGE OCR ERROR] Failed to parse JSON text from SDK output:', parseErr, 'Raw Text:', responseText);
      return new Response(
        JSON.stringify({
          is_valid_ledger: false,
          status: 'unreadable',
          reason_if_invalid: 'Failed to parse structured JSON from Gemini Vision API.',
          error: 'JSON parsing error',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. SANITIZATION AND TYPE SAFETY
    const isValid = Boolean(parsed.is_valid_ledger);
    const reason = parsed.reason_if_invalid || (isValid ? '' : 'This photo does not contain a valid ledger or receipt.');
    const rawStatus = parsed.status || (isValid ? 'success' : 'unreadable');
    const status = ['success', 'uncertain', 'unreadable'].includes(rawStatus) ? rawStatus : (isValid ? 'success' : 'unreadable');
    
    // Normalize transaction type to application canonical types
    let txType: 'credit_given' | 'payment_received' | 'unknown' = 'unknown';
    if (parsed.transaction_type === 'payment_received' || parsed.type === 'payment') {
      txType = 'payment_received';
    } else if (parsed.transaction_type === 'credit_given' || parsed.type === 'credit') {
      txType = 'credit_given';
    }

    const cleanAmount = Number(parsed.amount) || 0;

    return new Response(
      JSON.stringify({
        is_valid_ledger: isValid,
        status: status,
        reason_if_invalid: reason,
        customer_name: isValid ? String(parsed.customer_name || '').trim() : '',
        amount: isValid ? cleanAmount : 0,
        type: txType,
        transaction_type: txType,
        currency: parsed.currency || 'INR',
        confidence: Number(parsed.confidence) || (isValid ? 0.9 : 0),
        raw_text: parsed.raw_text || '',
        resolved_model: activeModelIdentifier,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[EDGE OCR ERROR] Fatal exception inside Edge Function:', err);
    return new Response(
      JSON.stringify({
        is_valid_ledger: false,
        status: 'unreadable',
        reason_if_invalid: err.message || 'Gemini SDK Server Error',
        error: err.message || 'SDK Error',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
