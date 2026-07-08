// Supabase Edge Function: manage-api-key
// Securely stores/retrieves/deletes the user's Gemini API key in Vault

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RequestBody {
  action: "save" | "delete" | "check";
  key?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Unauthorized", 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData.user) return jsonError("Invalid token", 401);
    const userId = userData.user.id;

    const body = req.method === "GET" ? { action: "check" } : (await req.json()) as RequestBody;
    const action = body.action || "check";
    const keyName = `gemini_key_${userId}`;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "save") {
      if (!body.key || !body.key.trim()) return jsonError("Missing API key", 400);

      // Delete old key if exists, then create new
      const { data: existing } = await serviceClient
        .from("vault")
        .from("secrets")
        .select("id")
        .eq("name", keyName);

      if (existing && existing.length > 0) {
        await serviceClient.rpc("vault.delete_secret", { secret_id: existing[0].id });
      }

      // Create new secret
      await serviceClient.rpc("vault.create_secret", {
        new_secret: body.key.trim(),
        new_name: keyName,
        new_description: `Gemini API key for user ${userId}`,
      });

      return jsonResponse({ success: true, has_key: true });
    }

    if (action === "delete") {
      const { data: existing } = await serviceClient
        .from("vault")
        .from("secrets")
        .select("id")
        .eq("name", keyName);

      if (existing && existing.length > 0) {
        await serviceClient.rpc("vault.delete_secret", { secret_id: existing[0].id });
      }

      return jsonResponse({ success: true, has_key: false });
    }

    // action === "check"
    const { data: secrets } = await serviceClient
      .from("vault")
      .from("secrets")
      .select("id")
      .eq("name", keyName);

    return jsonResponse({ has_key: !!(secrets && secrets.length > 0) });
  } catch (err) {
    console.error("manage-api-key error:", err);
    return jsonError("Internal error", 500);
  }
});

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function jsonResponse(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
