import { Ollama } from "npm:ollama";
import process from "node:process";

const ollama = new Ollama();

const message = { role: "user", content: "Why is the sky blue?" };
const response = await ollama.chat({
    model: "mistral-nemo:latest",
    messages: [message],
    stream: true,
});

for await (const part of response) {
    process.stdout.write(part.message.content);
}
