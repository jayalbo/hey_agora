import { AGENT_UID, APP_ID, getChannelName } from "@/utils/agora";

export const joinAgent = async (channelName: string) => {
  try {
    console.log("Joining agent to channel:", channelName);

    const response = await fetch("/api/agent/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${JSON.stringify(
          errorData
        )}`
      );
    }

    const data = await response.json();
    console.log("Agent join response:", data);
    return data;
  } catch (error) {
    console.error("Error joining agent:", error);
    throw error;
  }
};

export const leaveAgent = async () => {
  try {
    const channelName = getChannelName();

    const response = await fetch("/api/agent/leave", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${JSON.stringify(
          errorData
        )}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error leaving agent:", error);
    throw error;
  }
};

export const sendMessageToAgent = async (message: string) => {
  try {
    const response = await fetch("/api/agent/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        agentUid: AGENT_UID,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${JSON.stringify(
          errorData
        )}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error sending message to agent:", error);
    throw error;
  }
};
