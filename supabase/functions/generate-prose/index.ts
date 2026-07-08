// Supabase Edge Function: generate-prose
// Generates chapter prose from scene card + entity context
// Also detects entity updates + foreshadow progress in one call

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const DAILY_LIMIT = 1500;

interface RequestBody {
  chapter_id: string;
  work_id: string;
  mode?: "generate" | "combine_scenes";
  scene_ids?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    // 1. Verify JWT
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

    // 2. Parse request
    const { chapter_id, work_id, mode, scene_ids } = (await req.json()) as RequestBody;
    if (!chapter_id || !work_id) return jsonError("Missing chapter_id or work_id");

    // 3. Check quota
    const today = new Date().toISOString().split("T")[0];
    const { data: usageRow } = await supabase
      .from("api_usage")
      .select("request_count")
      .eq("user_id", userId)
      .eq("provider", "gemini")
      .eq("model", GEMINI_MODEL)
      .eq("date", today)
      .single();

    const used = usageRow?.request_count ?? 0;
    if (used >= DAILY_LIMIT) {
      return jsonError("quota_exceeded", 429, {
        message: `Daily limit reached (${DAILY_LIMIT}). Resets tomorrow at 00:00 UTC.`,
      });
    }

    // 4. Fetch chapter + scene card
    const { data: chapter } = await supabase
      .from("chapters")
      .select("*")
      .eq("id", chapter_id)
      .single();
    if (!chapter) return jsonError("Chapter not found", 404);

    // 5. Fetch entities for context
    const { data: entities } = await supabase
      .from("entities")
      .select("*")
      .eq("work_id", work_id);

    const sceneCard = chapter.scene_card || {};
    const brief = chapter.writing_brief || {};

    // Build entity context
    let characters, locations, foreshadows;
    let combinePrompt = "";

    if (mode === "combine_scenes" && scene_ids && scene_ids.length > 0) {
      // === COMBINE SCENES MODE ===
      // Fetch all scene children
      const { data: sceneChapters } = await supabase
        .from("chapters")
        .select("*")
        .in("id", scene_ids)
        .order("sort_order", { ascending: true });

      const scenesToCombine = (sceneChapters || []) as any[];

      // Build combined scene info
      const combinedSceneInfo = scenesToCombine.map((sc, i) => {
        const scCard = sc.scene_card || {};
        const scBrief = sc.writing_brief || {};
        return `--- Scene ${i + 1}: ${sc.title} ---
Summary: ${scCard.summary || "No summary"}
Characters: ${(scCard.characters || []).join(", ")}
Location: ${(scCard.locations || []).join(", ")}
Foreshadows: ${(scCard.foreshadows || []).join(", ")}
Writing Brief:
- POV: ${scBrief.pov || "Third person limited"}
- Tone: ${scBrief.tone || "Mysterious"}
- Pacing: ${scBrief.pacing || "Balanced"}
- Transition hint: ${scBrief.transition_hint || "—"}
- Next scene hint: ${scBrief.next_scene_hint || "Continue to next scene"}
- Target word count: ${scBrief.target_word_count || 500}
- Author notes: ${scBrief.author_notes || ""}`;
      }).join("\n\n");

      characters = (entities || [])
        .filter((e: any) => [].concat(...scenesToCombine.map((s: any) => s.scene_card?.characters || [])).includes(e.id))
        .slice(0, 10)
        .map((e: any) => ({ name: e.name, description: e.description, mood: e.metadata?.current_state?.mood || "unknown", status: e.status || "unknown" }));

      combinePrompt = `
【Full Chapter Context - ${scenesToCombine.length} scenes】

${combinedSceneInfo}

【All Related Characters】
${JSON.stringify(characters, null, 2)}

【Instructions for combining scenes】
Write a complete chapter that includes ALL scenes listed above in order.
- Use the transition hint between each scene (e.g., "—", "## Meanwhile...", "镜头一转")
- Each scene should follow its own POV and tone
- Generate natural transitions between scenes
- Include appropriate scene break markers (---, ***, ##)

After the prose, list entity updates and foreshadow progress.
Respond in JSON format:
{
  "prose_text": "the complete chapter prose with all scenes and transitions...",
  "entity_updates": [
    { "entity_name": "...", "field": "mood", "old_value": "...", "new_value": "..." }
  ],
  "foreshadow_progress": [
    { "name": "...", "progress": 50, "note": "..." }
  ]
}`;

    } else {
      // === SINGLE SCENE MODE ===
      characters = (entities || [])
        .filter((e: any) => sceneCard.characters?.includes(e.id))
        .map((e: any) => ({
          name: e.name,
          description: e.description,
          mood: e.metadata?.current_state?.mood || "unknown",
          status: e.status || "unknown",
        }));

      locations = (entities || [])
        .filter((e: any) => sceneCard.locations?.includes(e.id))
        .map((e: any) => ({
          name: e.name,
          description: e.description,
          category: e.metadata?.category,
        }));

      foreshadows = (entities || [])
        .filter((e: any) => sceneCard.foreshadows?.includes(e.id))
        .map((e: any) => ({
          name: e.name,
          description: e.description,
          status: e.status || "planted",
          importance: e.metadata?.importance || 3,
        }));
    }

    // 6. Get user's Gemini API key from vault
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: secretData } = await serviceClient
      .from("vault")
      .from("decrypted_secrets")
      .select("secret")
      .eq("name", `gemini_key_${userId}`)
      .single();

    if (!secretData?.secret) {
      return jsonError("No Gemini API key found. Add one in Settings.", 400);
    }
    const geminiKey = secretData.secret;

    // 7. Build prompt (all-in-one: generate prose + detect entity changes)
    const prompt = mode === "combine_scenes" && combinePrompt
      ? `You are a novel writing assistant. Combine the following scenes into a complete chapter with transitions.${combinePrompt}`
      : `You are a novel writing assistant. Based on the following scene card and story context, generate a complete chapter in prose form.

【Scene Summary】
${sceneCard.summary || "No summary provided."}

【Characters in this scene】
${JSON.stringify(characters, null, 2)}

【Locations】
${JSON.stringify(locations, null, 2)}

【Active Foreshadows】
${JSON.stringify(foreshadows, null, 2)}

【Writing Brief】
- POV: ${brief.pov || "Third person limited"}
- Tone: ${brief.tone || "Mysterious"}
- Pacing: ${brief.pacing || "Balanced"}
- Target word count: ${brief.target_word_count || 1500}
- Author notes: ${brief.author_notes || "None"}

【Instructions】
1. Generate the full prose for this scene. Write in a natural, immersive style.
2. After the prose, analyze what changed and list entity updates.
3. Estimate foreshadow progress (0-100%).

Respond in JSON format:
{
  "prose_text": "the full chapter prose...",
  "entity_updates": [
    { "entity_name": "...", "field": "mood", "old_value": "...", "new_value": "..." },
    { "entity_name": "...", "field": "status", "old_value": "...", "new_value": "..." }
  ],
  "foreshadow_progress": [
    { "name": "...", "progress": 40, "note": "..." }
  ]
}`;

    // 8. Call Gemini
    const geminiRes = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error:", errText);
      return jsonError("AI generation failed", 502);
    }

    const geminiData = await geminiRes.json();
    const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      // If not valid JSON, treat the whole thing as prose
      result = { prose_text: responseText, entity_updates: [], foreshadow_progress: [] };
    }

    // 9. Convert prose text to TipTap blocks (paragraphs)
    const proseBlocks = (result.prose_text || "")
      .split(/\n\n+/)
      .filter((p: string) => p.trim())
      .map((p: string) => ({
        type: "paragraph",
        content: [{ type: "text", text: p.trim() }],
      }));

    // 10. Apply entity updates to DB
    if (result.entity_updates && Array.isArray(result.entity_updates)) {
      for (const update of result.entity_updates) {
        const entity = (entities || []).find((e: any) => e.name === update.entity_name);
        if (!entity) continue;

        const patch: Record<string, unknown> = {};
        if (update.field === "mood") {
          const meta = { ...(entity.metadata || {}) };
          meta.current_state = { ...(meta.current_state || {}), mood: update.new_value };
          patch.metadata = meta;
        } else if (update.field === "status") {
          patch.status = update.new_value;
        }

        if (Object.keys(patch).length > 0) {
          await serviceClient.from("entities").update(patch).eq("id", entity.id);
        }
      }
    }

    // 11. Update foreshadow progress
    if (result.foreshadow_progress && Array.isArray(result.foreshadow_progress)) {
      for (const fp of result.foreshadow_progress) {
        const entity = (entities || []).find((e: any) => e.name === fp.name);
        if (!entity) continue;

        // Upsert anchor
        await serviceClient.from("anchors").upsert({
          entity_id: entity.id,
          chapter_id: chapter_id,
          relation_type: "progress",
          summary: fp.note || "",
          foreshadow_progress: fp.progress,
        }, { onConflict: "entity_id,chapter_id,relation_type" });

        // Update entity status if progress >= 100
        if (fp.progress >= 100) {
          await serviceClient.from("entities").update({ status: "resolved" }).eq("id", entity.id);
        } else if (fp.progress > 0 && entity.status === "planted") {
          await serviceClient.from("entities").update({ status: "in_progress" }).eq("id", entity.id);
        }
      }
    }

    // 12. Record usage
    await serviceClient.from("api_usage").upsert({
      user_id: userId,
      provider: "gemini",
      model: GEMINI_MODEL,
      date: today,
      request_count: used + 1,
    }, { onConflict: "user_id,provider,model,date" });

    // 13. Return result
    return new Response(
      JSON.stringify({
        prose: proseBlocks,
        entity_updates: result.entity_updates || [],
        foreshadow_progress: result.foreshadow_progress || [],
        quota: {
          used: used + 1,
          limit: DAILY_LIMIT,
          remaining: DAILY_LIMIT - used - 1,
        },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("generate-prose error:", err);
    return jsonError("Internal error", 500);
  }
});

function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({ error: message, ...extra }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
