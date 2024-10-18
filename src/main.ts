import { parse } from "@std/flags";
import { readTextFile } from "@std/fs";
import { encodeBase64 } from "@std/encoding/base64";

/**
 * Main function to run the CLI tool
 */
async function main() {
  const args = parse(Deno.args);
  const inputFile = args.input as string;

  if (!inputFile) {
    console.error("Please provide an input file using --input flag");
    Deno.exit(1);
  }

  const text = await readTextFile(inputFile);
  const discussion = await generateDiscussion(text);
  const audio = await textToSpeech(discussion);

  await Deno.writeFile("output.mp3", audio);
  console.log("Audio file generated: output.mp3");
}

/**
 * Generate a discussion between two AI agents based on the input text
 * @param text The input text to discuss
 * @returns A string containing the generated discussion
 */
async function generateDiscussion(text: string): Promise<string> {
  const agent1 = await createAgent("agent1", text);
  const agent2 = await createAgent("agent2", text);

  let discussion = "";
  let turn = 0;
  const maxTurns = 10; // Adjust this to control discussion length

  while (turn < maxTurns) {
    const speaker = turn % 2 === 0 ? agent1 : agent2;
    const response = await getAgentResponse(speaker, discussion);
    discussion += `${speaker.name}: ${response}\n\n`;
    turn++;
  }

  return discussion;
}

/**
 * Create an AI agent with a specific role
 * @param name The name of the agent
 * @param text The input text for context
 * @returns An object representing the AI agent
 */
async function createAgent(name: string, text: string) {
  const system = name === "agent1"
    ? "You are an AI assistant tasked with discussing the main points of a given text. Be precise, informative, and engaging."
    : "You are an AI assistant tasked with commenting on and extending the discussion about a given text. Be insightful and promote further discussion.";

  return { name, system, context: text };
}

/**
 * Get a response from an AI agent
 * @param agent The AI agent object
 * @param discussion The current state of the discussion
 * @returns A string containing the agent's response
 */
async function getAgentResponse(
  agent: { name: string; system: string; context: string },
  discussion: string,
): Promise<string> {
  const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "mistral-nemo:latest",
      messages: [
        { role: "system", content: agent.system },
        {
          role: "user",
          content:
            `Context: ${agent.context}\n\nCurrent discussion: ${discussion}\n\nPlease continue the discussion.`,
        },
      ],
      stream: false,
    }),
  });

  const data = await response.json();
  return data.message.content;
}

/**
 * Convert text to speech using PipedTTS
 * @param text The text to convert to speech
 * @returns A Uint8Array containing the audio data
 */
async function textToSpeech(text: string): Promise<Uint8Array> {
  // This is a placeholder for the actual PipedTTS implementation
  // You would need to integrate with a TTS service or library here
  console.log("Text-to-speech conversion not implemented");
  return new Uint8Array();
}

// Run the main function
if (import.meta.main) {
  main();
}
