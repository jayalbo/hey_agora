import { NextResponse } from "next/server";
import { RtcTokenBuilder, RtcRole } from "agora-token";

const getAgoraCredentials = () => {
  const customerId = process.env.AGORA_CUSTOMER_ID;
  const customerSecret = process.env.AGORA_CUSTOMER_SECRET;

  if (!customerId || !customerSecret) {
    throw new Error("Missing Agora credentials");
  }

  return Buffer.from(`${customerId}:${customerSecret}`).toString("base64");
};

export async function POST(request: Request) {
  try {
    const { channelName } = await request.json();
    console.log("Joining agent to channel:", channelName);

    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    const credentials = getAgoraCredentials();

    if (!appId || !appCertificate) {
      return NextResponse.json(
        { error: "Missing Agora credentials" },
        { status: 500 }
      );
    }

    // Generate token for the agent
    const expirationTimeInSeconds = 3600 * 24;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const agentToken = RtcTokenBuilder.buildTokenWithRtm(
      appId,
      appCertificate,
      channelName,
      process.env.AGORA_AGENT_UID!, // Use the same UID as specified in agent_rtc_uid
      RtcRole.PUBLISHER,
      privilegeExpiredTs,
      privilegeExpiredTs
    );
    const requestBody = {
      name: `agent-${Date.now()}`,
      properties: {
        channel: channelName,
        agent_rtc_uid: process.env.AGORA_AGENT_UID!,
        agent_rtm_uid: process.env.AGORA_AGENT_UID!,
        enable_string_uid: false,
        token: agentToken,
        remote_rtc_uids: ["*"],
        idle_timeout: 30,
        advanced_features: {
          enable_bhvs: true,
          enable_aivad: true,
          enable_rtm: true,
        },

        asr: {
          language: "en-US",
        },
        llm: {
          url: process.env.AGORA_LLM_URL!,
          api_key: process.env.AGORA_LLM_API_KEY!,
          output_modalities: ["text"],
          system_messages: [
            {
              role: "system",
              content: `You are a highly capable and conversational AI assistant embedded in a web app. 
Your role is to act like an intelligent personal assistant—similar to Alexa or Siri—but more advanced, natural, and context-aware thanks to your LLM capabilities.

You should:
- Respond in a helpful, friendly, and engaging tone.
- Understand voice-based commands, follow-up questions, and natural dialogue flow.
- Handle tasks like reminders, smart home control, weather, jokes, search, and general questions.
- Maintain short-term context across the current session to follow the conversation naturally.
- Never mention being an AI model or referencing OpenAI, GPT, or language models unless asked directly.
- Keep answers concise unless the user asks for more detail.

Behave like a real assistant. If you don’t know something, suggest a next step or how to help.
Keep your responses short and concise.

Your name is "Agora", and you are always ready to help.

`,
            },
          ],
          max_history: 32,
          greeting_message: "",
          failure_message:
            "I'm having trouble processing your request right now.",
          params: {
            model: process.env.AGORA_LLM_MODEL!,
          },
        },
        tts: {
          vendor: process.env.AGORA_TTS_VENDOR!,
          params: {
            key: process.env.AGORA_TTS_API_KEY!,
            region: process.env.AGORA_TTS_REGION!,
            voice_name: process.env.AGORA_TTS_VOICE_NAME!,
          },
        },
      },
    };

    console.log("Request body:", requestBody);
    const response = await fetch(
      `https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/join`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error joining agent:", errorData);
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${JSON.stringify(
          errorData
        )}`
      );
    }

    const data = await response.json();
    console.log("Agent join response:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error joining agent:", error);
    return NextResponse.json(
      { error: "Failed to join agent" },
      { status: 500 }
    );
  }
}
