import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { channelName } = await request.json();

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

    // Notify Agora that we're leaving the channel
    const response = await fetch(
      `https://api.agora.io/dev/v2/project/${appId}/rtm/users/Server/peer_messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({
          destination: channelName,
          enable_offline_messaging: false,
          enable_historical_messaging: false,
          payload: JSON.stringify({
            type: "leave",
            timestamp: Date.now(),
          }),
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(errorData, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error leaving agent channel:", error);
    return NextResponse.json(
      { error: "Failed to leave agent channel" },
      { status: 500 }
    );
  }
}
