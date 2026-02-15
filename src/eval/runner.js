import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const RETRY_DELAYS = [1000, 2000, 4000];
const MODEL = "claude-sonnet-4-5-20250929";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Send a single prompt to Claude and get the text response. */
export async function callClaude(prompt) {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });
      return response.content[0].text;
    } catch (err) {
      if (attempt < RETRY_DELAYS.length && err.status === 429) {
        console.warn(`Rate limited, retrying in ${RETRY_DELAYS[attempt]}ms...`);
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Two-turn call for code+relabel condition:
 * Turn 1: relabel prompt → get relabeled code
 * Turn 2: task prompt with relabeled code
 */
export async function callClaudeTwoTurn(relabelPrompt, taskPromptFn) {
  const relabeled = await callClaude(relabelPrompt);
  const taskPrompt = taskPromptFn(relabeled);
  const answer = await callClaude(taskPrompt);
  return { relabeled, answer };
}
