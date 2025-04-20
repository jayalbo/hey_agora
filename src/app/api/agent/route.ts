import { NextRequest, NextResponse } from "next/server";
import { RtcTokenBuilder, RtcRole } from "agora-token";

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    // Generate token for the agent
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID!;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE!;
    const channelName = "hey-agora-channel";
    const uid = "agent";

    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      privilegeExpiredTs
    );

    // Get credentials from environment variables
    const customerId = process.env.AGORA_CUSTOMER_ID!;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET!;
    const llmUrl = process.env.AGORA_LLM_URL!;
    const llmApiKey = process.env.AGORA_LLM_API_KEY!;
    const ttsVendor = process.env.AGORA_TTS_VENDOR!;
    const ttsApiKey = process.env.AGORA_TTS_API_KEY!;
    const ttsRegion = process.env.AGORA_TTS_REGION!;
    const ttsVoiceName = process.env.AGORA_TTS_VOICE_NAME!;

    // Send message to the agent
    const response = await fetch(
      `https://api.agora.io/dev/v2/project/${appId}/rtm/users/Server/peer_messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            `${customerId}:${customerSecret}`
          ).toString("base64")}`,
        },
        body: JSON.stringify({
          message,
          timeout: 30000, // 30 seconds timeout
          properties: {
            channel: channelName,
            token: token,
            agent_rtc_uid: uid,
            remote_rtc_uids: ["*"],
            enable_string_uid: true,
            idle_timeout: 30,
            advanced_features: {
              enable_aivad: true,
            },
          },
          llm: {
            url: llmUrl,
            api_key: llmApiKey,
            system_messages: [
              {
                role: "system",
                content: "You are a helpful AI assistant.",
              },
            ],
            max_history: 32,
            greeting_message: "Hello, how can I assist you today?",
            failure_message:
              "I'm having trouble processing your request right now.",
            params: {
              model: "gpt-4o-mini",
            },
          },
          tts: {
            vendor: ttsVendor,
            params: {
              key: ttsApiKey,
              region: ttsRegion,
              voice_name: ttsVoiceName,
            },
          },
          asr: {
            language: "en-US",
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error communicating with agent:", error);
    return NextResponse.json(
      { error: "Failed to communicate with agent" },
      { status: 500 }
    );
  }
}
