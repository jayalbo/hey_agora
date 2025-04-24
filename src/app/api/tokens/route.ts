import { NextResponse } from "next/server";
import { RtcTokenBuilder, RtcRole } from "agora-token";

export async function POST(request: Request) {
  try {
    const { channelName } = await request.json();

    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      return NextResponse.json(
        { error: "Missing Agora credentials" },
        { status: 500 }
      );
    }

    // Generate RTC token
    const expirationTimeInSeconds = 3600 * 24; // 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const rtcToken = RtcTokenBuilder.buildTokenWithRtm(
      appId,
      appCertificate,
      channelName,
      0, // Use 0 for dynamic assignment
      RtcRole.PUBLISHER,
      privilegeExpiredTs,
      privilegeExpiredTs
    );

    // For RTM, we'll use the same token for now
    // In a production environment, you might want to generate a separate RTM token
    const rtmToken = rtcToken;

    return NextResponse.json({
      rtmToken,
      rtcToken,
    });
  } catch (error) {
    console.error("Error generating tokens:", error);
    return NextResponse.json(
      { error: "Failed to generate tokens" },
      { status: 500 }
    );
  }
}
