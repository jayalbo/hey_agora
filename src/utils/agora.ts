export const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID!;
export const BASE_CHANNEL_NAME = "hey-agora-channel";
export const AGENT_UID = 12345; // Integer UID for the agent
export const USER_UID = 67890; // Integer UID for the user

let client: any = null;
let isConnected = false;
let channelName: string;

// Generate a unique channel name with timestamp and random suffix
const generateChannelName = () => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${BASE_CHANNEL_NAME}-${timestamp}-${randomSuffix}`;
};

// Initialize channel name only once when the module loads
channelName = generateChannelName();
console.log("Generated channel name:", channelName);

// Initialize client only on the client side
export const initializeClient = async () => {
  if (typeof window !== "undefined" && !client) {
    const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
    client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
  }
  return client;
};

// Get the current channel name
export const getChannelName = () => channelName;

// Fetch token from the server-side API
export const getAgentToken = async () => {
  try {
    const response = await fetch(
      `/api/agora/token?channel=${encodeURIComponent(channelName)}`
    );
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

export const joinChannel = async (uid: number) => {
  try {
    const agoraClient = await initializeClient();
    if (!agoraClient) throw new Error("Failed to initialize Agora client");

    if (isConnected) {
      console.log("Already connected to channel");
      return;
    }

    const token = await getAgentToken();
    await agoraClient.join(APP_ID, channelName, token, uid);
    isConnected = true;
    console.log("Joined channel successfully with UID:", uid);
  } catch (error) {
    console.error("Error joining channel:", error);
    throw error;
  }
};

export const leaveChannel = async () => {
  try {
    const agoraClient = await initializeClient();
    if (!agoraClient) throw new Error("Failed to initialize Agora client");

    if (!isConnected) {
      console.log("Not connected to channel");
      return;
    }

    await agoraClient.leave();
    isConnected = false;
    console.log("Left channel successfully");
  } catch (error) {
    console.error("Error leaving channel:", error);
    throw error;
  }
};
