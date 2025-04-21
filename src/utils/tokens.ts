interface TokenResponse {
  rtmToken: string;
  rtcToken: string;
}

export async function getTokens(channelName: string): Promise<TokenResponse> {
  try {
    const response = await fetch("/api/tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channelName }),
    });

    if (!response.ok) {
      throw new Error("Failed to get tokens");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error getting tokens:", error);
    throw error;
  }
}

export async function leaveChannel(channelName: string): Promise<void> {
  try {
    const response = await fetch("/api/agent/leave", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channelName }),
    });

    if (!response.ok) {
      throw new Error("Failed to leave channel");
    }
  } catch (error) {
    console.error("Error leaving channel:", error);
    throw error;
  }
}
