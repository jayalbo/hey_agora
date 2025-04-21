import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { message, agentUid } = await request.json();

    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const customerId = process.env.AGORA_CUSTOMER_ID;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET;

    if (!appId || !customerId || !customerSecret) {
      return NextResponse.json(
        { error: "Missing Agora credentials" },
        { status: 500 }
      );
    }

    const credentials = Buffer.from(`${customerId}:${customerSecret}`).toString(
      "base64"
    );

    const url = `https://api.agora.io/dev/v2/project/${appId}/rtm/users/Server/peer_messages`;
    const requestBody = {
      destination: process.env.AGORA_AGENT_UID!,
      payload: message,
      custom_type: "user.transcription",
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify(requestBody),
    });
    console.log(`URL: ${url}`);
    console.log(`Request body: ${JSON.stringify(requestBody)}`);
    console.log(`Response: ${JSON.stringify(response)}`);

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(errorData, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Error sending message to agent:", error);
    return NextResponse.json(
      { error: "Failed to send message to agent" },
      { status: 500 }
    );
  }
}
