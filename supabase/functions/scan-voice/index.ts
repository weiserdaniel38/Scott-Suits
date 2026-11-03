// scan-voice: records the phone body scan's spoken lines once with a
// natural male OpenAI voice (Daniel 2026-11-03: "I want it to be male and
// sound natural"). Returns the MP3s as base64; they are saved into the
// site at assets/voice/<slug>.mp3, so customers never call this.
// Only the fixed lines below can be spoken (no free text), and only these
// voices, so the endpoint can't be used as a general text-to-speech proxy.
// Needs the OPENAI_API_KEY Edge Function secret (already set).

const LINES: Record<string, string> = {
  lean: "Lean the phone at waist height. Then step back.",
  floor: "Lean the phone on the floor, against the wall. Then step back, about eight feet.",
  hold: "Hold the phone at waist height.",
  face: "Face the phone. Arms up.",
  perfect: "Perfect. Hold still.",
  "3": "Three.",
  "2": "Two.",
  "1": "One.",
  turn: "Now turn slowly, all the way around.",
  keep: "Keep turning, slowly.",
  half: "Halfway.",
  almost: "Almost there.",
  done: "Done.",
  armsup: "Arms up.",
  armspic: "Arms up, like the picture.",
  enter: "Step into the picture.",
  head: "Step back. Show your head.",
  feet: "Step back. Show your feet.",
  closer: "Come closer.",
  back: "Step back a little.",
  middle: "Move to the middle.",
  facephone: "Face the phone.",
  apart: "Feet a little apart.",
};
const VOICES = ["ash", "onyx", "echo", "ballad", "verse"];
const STYLE =
  "A warm, relaxed, confident man in his thirties: a friendly tailor guiding a client through a quick body scan. " +
  "Natural and conversational, like talking to someone in the room, never robotic or announcer-like. Calm, short and clear.";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return new Response(JSON.stringify({ error: "OPENAI_API_KEY missing" }), { status: 500, headers: cors });
  let body: { voice?: string; only?: string[] } = {};
  try { body = await req.json(); } catch (_) { /* defaults */ }
  const voice = VOICES.includes(body.voice || "") ? body.voice! : "ash";
  const slugs = (body.only && body.only.length ? body.only : Object.keys(LINES)).filter((s) => s in LINES).slice(0, 30);
  const out: Record<string, string> = {};
  const errors: Record<string, string> = {};
  await Promise.all(slugs.map(async (slug) => {
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, input: LINES[slug], instructions: STYLE, response_format: "mp3" }),
    });
    if (!r.ok) { errors[slug] = r.status + " " + (await r.text()).slice(0, 200); return; }
    out[slug] = b64(await r.arrayBuffer());
  }));
  return new Response(JSON.stringify({ voice, clips: out, errors }), { headers: { ...cors, "Content-Type": "application/json" } });
});
