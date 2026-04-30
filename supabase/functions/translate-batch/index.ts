// Translate an array of short UI strings between AR and EN via Lovable AI Gateway.
// Used by the admin auto-translator to localize all UI text on demand.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Body = {
  texts: string[];
  target: "en" | "ar";
  context?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { texts, target, context }: Body = await req.json();
    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ translations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const sourceLang = target === "en" ? "Arabic" : "English";
    const targetLang = target === "en" ? "English" : "Arabic";
    const sys =
      `You are a precise UI string translator for an admin dashboard of a luxury kids' boutique.
Translate each item from ${sourceLang} to ${targetLang}.
Rules:
- Keep numbers, dates, currency symbols, emojis, brand names (Le Petit Paradis, lppme), HTML/markup, and code unchanged.
- Preserve original casing style as much as possible. Keep it concise and natural for a dashboard UI.
- Do NOT add quotes, explanations, or punctuation that wasn't there.
- Return ONLY a JSON object via the tool call.`;

    const user = `${context ? `Context: ${context}\n\n` : ""}Items:\n${
      texts.map((t, i) => `${i}. ${t}`).join("\n")
    }`;

    const resp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_translations",
                description: "Return translated items in original order.",
                parameters: {
                  type: "object",
                  properties: {
                    translations: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Translated strings, same length and order as input.",
                    },
                  },
                  required: ["translations"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "return_translations" },
          },
        }),
      },
    );

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limited" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "credits_required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await resp.text();
      console.error("Gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "gateway_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : { translations: [] };
    const translations: string[] = Array.isArray(args.translations)
      ? args.translations
      : [];
    // Pad/truncate to match input length so client mapping stays correct.
    const out = texts.map((src, i) => translations[i] ?? src);
    return new Response(JSON.stringify({ translations: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-batch error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
