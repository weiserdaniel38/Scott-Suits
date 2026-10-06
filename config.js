const SUPABASE_URL = "https://nvlhngzycldysosvhglx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_DgJsqg-wXhNS6Cqg3QbvEw_H23sMgsS";

// Optional: automatically email the completed Client Form to the shop on every
// order submission. Leave this blank to skip emailing -- the order (and the
// full Client Form text) is always saved in Supabase either way.
//
// To turn this on (free, no coding required):
//   1. Go to https://formspree.io and create a free account.
//   2. Create a new form, and set its recipient email to the inbox you want
//      order notifications sent to (Formspree will send a one-time
//      confirmation link to that inbox -- click it).
//   3. Copy the form's endpoint URL (looks like "https://formspree.io/f/xxxxxxxx")
//      and paste it below between the quotes.
const CLIENT_FORM_EMAIL_ENDPOINT = "https://formspree.io/f/mvkoydbo";

// Optional: powers live address suggestions/autofill on the shipping address
// field on the Personal Info page (as you type, then fills in city/state/
// ZIP/country automatically when you pick one). Leave this blank to skip it
// -- the address field still works fine as a plain text field (and browsers
// will still offer their own saved-address autofill), you just won't get
// live suggestions as the customer types.
//
// Uses Geoapify instead of Google Maps -- it's genuinely free (3,000
// requests/day, no credit card required), unlike Google which requires a
// billing account with a card on file even to use its free tier.
//
// To turn this on:
//   1. Go to https://www.geoapify.com/ and click "Get Started" / "Sign Up" (free, no card).
//   2. Once logged in, go to "Projects" (or your default project) > "API keys".
//   3. Copy the API key shown there and paste it below between the quotes.
const GEOAPIFY_API_KEY = "54de71427a894bd9b19dba08c690512d";

// Optional: require payment via PayPal before an order is submitted. Leave
// this blank to keep accepting orders exactly as before, with no payment
// step -- the "Submit Order" button works the same way it always has.
//
// This is the simplest version of PayPal checkout -- it only needs an email
// address that can receive money, no developer account or API keys:
//   1. Make sure you have a PayPal account (personal or business) -- sign up
//      free at https://www.paypal.com if you don't have one yet.
//   2. Paste the email address for that account below between the quotes.
//
// How it works: once this is filled in, the button on the Personal Info page
// changes to "Pay $700 & Submit Order". Clicking it sends the customer to
// PayPal to pay, then brings them straight back here once they've paid --
// at which point their order saves and emails you automatically, same as
// today. One thing worth knowing: this simple version can't cryptographically
// verify a payment actually went through (real verification needs a paid
// integration with a server to receive PayPal's webhooks) -- it trusts the
// redirect PayPal sends back. That's a normal tradeoff for a small shop just
// getting started, but it's not fraud-proof.
const PAYPAL_BUSINESS_EMAIL = "";