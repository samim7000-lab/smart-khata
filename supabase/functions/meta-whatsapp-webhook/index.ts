// ====================================================================
// SMART KHATA — SUPABASE EDGE FUNCTION FOR META WHATSAPP CLOUD API
// Webhook Listener & Server-Side Secure Dispatch Endpoint
// ====================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const META_VERIFY_TOKEN = Deno.env.get("META_WHATSAPP_VERIFY_TOKEN") || "smart_khata_verify_secret_token";
const META_ACCESS_TOKEN = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // 1. GET Request: Meta Webhook Subscription Verification (Challenge Response)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
      console.log("[META WEBHOOK] Verification challenge successful.");
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }

    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // 2. POST Request: Outbound Dispatch or Webhook Event Processing
  if (req.method === "POST") {
    try {
      const body = await req.json();

      // Action A: Server-Side Outbound Message Sending (Protecting Meta Access Token)
      if (body.action === "send_message") {
        const { phone_number_id, recipient_phone, template_name, message_text, media_url } = body;

        if (!META_ACCESS_TOKEN) {
          console.warn("[META CLOUD DISPATCH] META_WHATSAPP_ACCESS_TOKEN secret not set on server.");
          return new Response(
            JSON.stringify({
              success: true,
              metaMessageId: `wamid.HBgM${Date.now()}SIM`,
              status: "QUEUED",
              note: "Simulated response: Add META_WHATSAPP_ACCESS_TOKEN to Supabase secrets for real delivery.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const metaApiUrl = `https://graph.facebook.com/v18.0/${phone_number_id}/messages`;
        const metaPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient_phone,
          type: "template",
          template: {
            name: template_name || "payment_reminder",
            language: { code: "en_US" },
          },
        };

        const res = await fetch(metaApiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${META_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metaPayload),
        });

        const resData = await res.json();
        if (!res.ok) {
          return new Response(
            JSON.stringify({ success: false, error: resData.error?.message || "Meta API error" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const metaMessageId = resData.messages?.[0]?.id || `wamid.${Date.now()}`;
        return new Response(
          JSON.stringify({ success: true, metaMessageId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Action B: Incoming Webhook Event (Status updates: sent, delivered, read, failed)
      if (body.entry && body.entry[0]?.changes) {
        const changes = body.entry[0].changes[0]?.value;
        const statuses = changes?.statuses;

        if (statuses && statuses.length > 0) {
          const statusEvent = statuses[0];
          console.log(`[META WEBHOOK STATUS UPDATE] Message: ${statusEvent.id}, Status: ${statusEvent.status}, Recipient: ${statusEvent.recipient_id}`);
          
          return new Response(
            JSON.stringify({ status: "success", received: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(JSON.stringify({ status: "ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
});
