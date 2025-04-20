import AgoraRTC from "agora-rtc-sdk-ng";

export const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

export const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID!;
export const CHANNEL_NAME = "hey-agora-channel";
export const AGENT_UID = "agent"; // String UID for the agent

// Fetch token from the server-side API
export const getAgentToken = async () => {
  try {
    const response = await fetch("/api/agora/token");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error("Error fetching token:", error);
    throw error;
  }
};

export const joinChannel = async () => {
  try {
    const token = await getAgentToken();
    await client.join(APP_ID, CHANNEL_NAME, token, AGENT_UID);
    console.log("Joined channel successfully");
  } catch (error) {
    console.error("Error joining channel:", error);
    throw error;
  }
};

export const leaveChannel = async () => {
  try {
    await client.leave();
    console.log("Left channel successfully");
  } catch (error) {
    console.error("Error leaving channel:", error);
    throw error;
  }
};
