let _client = null;

function getSupabase() {
  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_URL.includes("PASTE_YOUR") ||
    SUPABASE_ANON_KEY.includes("PASTE_YOUR")
  ) {
    throw new Error(
      "Supabase isn't configured yet — open config.js and paste in your Project URL and anon key."
    );
  }
  if (!_client) {
    _client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}