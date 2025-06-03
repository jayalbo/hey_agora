# Unlock On-Demand AI: Build Your Own Voice Assistant with Agora

Imagine interacting with an AI assistant that responds to your voice in real-time, effortlessly translating your words into intelligent conversation and speaking back to you—all within your web browser. This isn't just a concept; it's what **Hey Agora** brings to life. More than just a simple example, this demo project showcases the seamless integration of **Agora's real-time communication** capabilities with the power of modern **Large Language Models (LLMs)** to create a compelling, on-demand AI assistant experience.

Hey Agora serves as a practical blueprint for developers eager to understand how real-time audio streams can be transformed into dynamic AI interactions. It's built to be immediately functional, allowing you to see and hear the magic of instant speech-to-text, LLM processing, and synthesized speech in action. By exploring this demo, you'll gain clear insights into the technical orchestration required to build responsive, voice-driven AI applications.

In this guide, we'll peel back the layers of Hey Agora to reveal how it works. We'll start by outlining the project's overall structure, giving you a comprehensive overview of its key components. Then, we'll dive into each individual file, detailing the essential functions and elements that drive this real-time AI conversation. Finally, we'll provide straightforward instructions on how to run and interact with the Hey Agora web app yourself, empowering you to experiment and build upon this powerful foundation.

---

## 🧱 Project Structure Overview

Hey Agora is a modern web application powered by **Next.js** with full TypeScript support and Agora RTC SDK integration. The app architecture is modular and optimized for developer clarity, making it easy to trace the data flow from UI interactions to Agora channel joining and AI response handling.

```
hey_agora/
├── public/                    # Static SVGs and icons
├── src/
│   ├── app/                  # Next.js routes and layout
│   │   └── api/              # Serverless functions for Agora tokens & AI
│   ├── components/           # The VoiceAssistant component (core UI)
│   ├── services/             # Handles interaction with the AI backend
│   ├── utils/                # Agora RTC setup, wake-word logic
├── .env.local                # Agora credentials and environment vars
├── package.json              # Project metadata and dependencies
```

---

## 🎤 `VoiceAssistant.tsx`: The Core Interaction Engine

The heart of the app lives in the **`VoiceAssistant.tsx`** component. It manages the connection lifecycle, assistant state, and interaction logic.

- **Stateful Status Management**: Uses `useState` to track the assistant's status, including `idle`, `connecting`, `listening`, and `error` states.
- **Auto-init on Mount**: The component triggers `setupVoiceConnection()` as soon as it loads.
- **Visual Feedback**: A `StatusIndicator` component provides a pulsing ring to reflect the app's state.

```tsx
useEffect(() => {
  setupVoiceConnection({
    onDisconnect: () => setIsListening(false),
    onWakeWordReset: () => setIsListening(true),
    onError: setError,
  });
}, []);
```

---

## 🎧 Real-Time Audio via Agora: `utils/agora.ts`

This file is responsible for configuring the **Agora RTC SDK** to stream audio between the user and a virtual "agent."

- **RTC Setup** using `AgoraRTC.createClient()`
- **Mic Track Publishing** using `createMicrophoneAudioTrack()`
- **Silence Detection** with `AnalyserNode` to disconnect idle users

---

## 🗣️ Wake Word Detection with `wake-word-command`

Instead of relying on external wake-word SDKs, Hey Agora uses the lightweight `wake-word-command` library to detect wake words and extract commands directly in the browser.

```ts
wakeWordDetectionRef.current = createWakeWordDetection({
  wakeWord: "hey agora",
  onWakeWordDetected: async () => {
    setMessage("Wake word detected! Connecting to AI agent...");
    await connectToVoice();
  },
  onCommand: (command: string) => {
    console.log("Command received:", command);
    // Store the command to send to the agent once connected
    setInitialCommand(command);
  },
  onError: (error: string) => {
    console.error("Wake word detection error:", error);
    setError(`Wake word detection error: ${error}`);
    // Don't automatically restart on errors
  },
});

wakeWordDetectionRef.current.start();
setMessage("Listening for 'Hey Agora'...");
```

---

## 🧠 Conversational AI: `services/conversationalAI.ts`

This module handles the backend interaction with Agora’s Conversational AI engine and integrates the AI agent lifecycle into the voice assistant.

### ✅ Agent Join Request

When the user says “Hey Agora” and their command is captured, the frontend joins the RTC channel and then sends a POST request to the serverless route `/api/agent/start`. This handler constructs and sends an HTTPS request directly to Agora’s Conversational AI API:

```ts
await fetch("https://api.agora.io/conversational-ai/agent/join", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Basic ${Buffer.from(
      `${customerId}:${customerSecret}`
    ).toString("base64")}`,
  },
  body: JSON.stringify({
    name: "demo_agent",
    properties: {
      channel: channelName,
      token: rtcToken,
      agent_rtc_uid: agentUid,
      remote_rtc_uids: ["*"],
      enable_string_uid: true,
      asr: { language: "en-US" },
    },
  }),
});
```

### ❌ Agent Leave Request

When the user goes silent or disconnects, the frontend requests the agent to leave via `/api/agent/stop`. That route sends a POST request to Agora like this:

```ts
await fetch("https://api.agora.io/conversational-ai/agent/leave", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Basic ${Buffer.from(
      `${customerId}:${customerSecret}`
    ).toString("base64")}`,
  },
  body: JSON.stringify({
    agent_id: "demo_agent",
  }),
});
```

---

### ✉️ Sending the Initial Message

After the wake word and command are detected and the intial command captured via `wake-word-command` library, the frontend sends a the initial command via POST request to:

```ts
await fetch("/api/agent/message", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: command, agentUid: AGORA_AGENT_UID }),
});
```

This triggers the serverless route `/api/agent/message`, which sends a peer message to the agent through Agora’s RTM infrastructure using the following request:

```ts
const url = `https://api.agora.io/dev/v2/project/${appId}/rtm/users/Server/peer_messages`;
const requestBody = {
  destination: process.env.AGORA_AGENT_UID!,
  payload: message,
  custom_type: "user.transcription",
};

await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Basic ${Buffer.from(
      `${customerId}:${customerSecret}`
    ).toString("base64")}`,
  },
  body: JSON.stringify(requestBody),
});
```

The message is routed from the `"Server"` RTM user to the Conversational AI agent, which interprets it as a user transcription due to the `custom_type: "user.transcription"` field.

Agora then takes care of the rest:

1. Processing the transcription with ASR
2. Forwarding it to your configured LLM provider.
3. Synthesizing a voice response using your selected TTS service.
4. Playing the response back to the user in the RTC channel.

This makes your server a lightweight bridge—offloading all the AI orchestration to Agora’s infrastructure.

---

## 🖼️ Visual Walkthrough

### 🎤 Assistant Idle vs Listening

![Idle State UI](/blog_static/idle-ui.png)  
_The assistant sits quietly in idle mode, waiting for your wake word._

![Listening State UI](/blog_static/listening-ui.png)  
_After detecting “Hey Agora,” the UI pulses to indicate active listening and streaming._

### 🗣️ Wake Word Detection & Command Logging

![Wake Word Detection Console](/blog_static/console-command.png)  
_Browser console logs show successful detection of the wake word and the full command passed to the AI._

### 🎧 Agora Customer ID & Secret Setup

![Agora Console](/blog_static/agora-console-setup.png)  
_Agora Console showing how to retrieve your customer Id and generate the secret._

### 🧠 AI Response in Action

[▶️ Watch AI Response Demo](/blog_static/ai-response.mp4)  
_The assistant responds with synthesized speech, completing the loop._

### 💻 Local Dev Success

![Local Dev Running](/blog_static/dev-terminal.png)  
_Terminal output after running `npm run dev` successfully._

---

## 🚀 Run It Yourself

### Step 1: Clone and Install

```bash
git clone https://github.com/jayalbo/hey_agora.git
cd hey_agora
npm install
```

### Step 2: Set Environment Variables

Create a `.env.local` file:

```
# Agora Configuration
NEXT_PUBLIC_AGORA_APP_ID=YOUR_AGORA_APP_ID
AGORA_APP_CERTIFICATE=YOUR_AGORA_APP_CERTIFICATE

# Agora Authentication
AGORA_CUSTOMER_ID=AGORA_CUSTOMER_ID
AGORA_CUSTOMER_SECRET=AGORA_CUSTOMER_SECRET

# Conversational AI Configuration
# AGORA_LLM_URL=https://api.groq.com/openai/v1/chat/completions # (or your LLM endpoint)
AGORA_LLM_URL=YOUR_LLM_URL
AGORA_AGENT_UID=123456
AGORA_LLM_API_KEY=YOUR_LLM_API_KEY
# AGORA_LLM_MODEL=llama-3.1-8b-instant
AGORA_LLM_MODEL=YOUR_LLM_MODEL

# TTS Configuration
# AGORA_TTS_VENDOR=microsoft
AGORA_TTS_VENDOR=YOUR_TTS_VENDOR
AGORA_TTS_API_KEY=YOUR_TTS_API_KEY
AGORA_TTS_REGION=YOUR_TTS_REGION
# AGORA_TTS_VOICE_NAME=en-US-AvaNeural
AGORA_TTS_VOICE_NAME=YOUR_TTS_VOICE_NAME


```

### Step 3: Start the Dev Server

```bash
npm run dev
```

Visit http://localhost:3000 in your browser.

---

## 🚀 Beyond the Demo: Endless Possibilities with Custom LLM Wrappers

What you’ve seen in Hey Agora is just the beginning. The architecture is designed to be extensible—and by plugging in your own custom LLM wrapper, you can go far beyond answering questions.

For instance, with just a bit of server-side logic, your assistant can act on structured outputs from the LLM to trigger real-world actions. Imagine:
• 🔌 Controlling smart home devices via IFTTT or Home Assistant
• 📅 Creating calendar events or reminders from natural language prompts
• 🔔 Sending alerts or messages to Slack, email, or SMS
• 🛠️ Triggering build/deploy pipelines or dev automations
• 🧠 Conversing in context with long-term memory via vector databases

By wrapping your LLM output in a simple function-calling schema or JSON command format, Hey Agora becomes a true multimodal interface—not just for information, but for interaction.

Whether you’re building a voice-powered dashboard, a home assistant, or a custom voicebot for enterprise workflows, this foundation gives you everything you need to bring voice-first AI to life.

- [Custom LLM](https://docs.agora.io/en/conversational-ai/develop/custom-llm)

---

## 🌟 Final Thoughts

Hey Agora isn't just a cool demo—it's a real, working blueprint for voice-first, AI-powered experiences in the browser. With local wake word + command detection, Agora-powered streaming, and responsive AI, it's a powerful hands-free assistant.

---

## 🔗 Resources

- [GitHub Repository](https://github.com/jayalbo/hey_agora)
- [Hey Agora Live Demo](https://hey-agora.vercel.app/)
- [Agora Documentation](https://docs.agora.io/)
- [Agora Conversational AI Documentation](https://docs.agora.io/en/conversational-ai/overview/product-overview)
- [OpenAI Documentation](https://platform.openai.com/docs/introduction)
