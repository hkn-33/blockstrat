# 11: AI chat that builds the strategy

**What to build:** Users describe a strategy in plain language and the AI builds it as real blocks in the editor. Follow-up messages refine it. The AI's strategy replaces the current one only after the user confirms. If the description uses something the blocks cannot express, the AI says so. When the AI limit is reached, the user sees "AI is resting, build the blocks by hand". Per ADR 0001 the AI returns strategy JSON, never code.

**Blocked by:** 01 (works best after 05 and 06, since the AI can only use what the schema expresses)

**Status:** done

- [x] Backend sends the conversation, the current strategy and the strategy JSON Schema to Gemini via the google-genai SDK with structured output (dependency confirmed with the user before adding)
- [x] Reply validated against the schema; invalid replies are rejected and reported, never passed to the editor
- [x] Reply includes an explanation of anything that could not be expressed
- [x] Chat panel with conversation history; a returned strategy is shown as a pending replacement with confirm/discard
- [x] Gemini key only on the backend, read from the environment
- [x] Rate limits: 10 requests per hour per IP and a global daily cap (configurable, below the free-tier limit); exceeding either returns a rate-limit status and the UI shows "AI is resting, build the blocks by hand"
- [x] Chat UI tells users not to enter personal data
- [x] API seam tests with a fake Gemini client: valid reply returns a strategy; schema-invalid reply is rejected; per-IP and daily limits trigger

## Comments

Not tested against the real Gemini API (no key on the dev machine); covered by tests with a fake client. Open risk: Gemini's support for the recursive condition schema in response_json_schema. If Gemini rejects it, replies come back as status "invalid".
