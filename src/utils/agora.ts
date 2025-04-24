export const AGENT_UID = 12345; // Integer UID for the agent
export const USER_UID = 67890; // Integer UID for the user
export const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID!;
const BASE_CHANNEL_NAME = "hey-agora-channel";

let client: any = null;
let AgoraRTC: any = null;
let isConnected = false;
let isInCall = false; // New flag to track if user is in an active call
let channelName: string | null = null;
let token: string | null = null;
let localAudioTrack: any = null;
let remoteAudioTracks: any[] = [];
let silenceTimeout: NodeJS.Timeout | null = null;
let silenceInterval: NodeJS.Timeout | null = null;
const SILENCE_THRESHOLD = 0.2; // Adjust this value based on testing
const SILENCE_TIMEOUT = 7000; // 5 seconds
const CHECK_INTERVAL = 200; // Check every second

// Track speech states
let isUserSpeaking = false;
let isAgentSpeaking = false;
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let dataArray: Uint8Array | null = null;
let cleanupLocalAudio: (() => void) | null = null;
let cleanupRemoteAudio: (() => void)[] = [];
let onDisconnect: (() => void) | null = null;
let onWakeWordReset: (() => void) | null = null;
let isTimeoutDisconnect = false;

const setupAudioAnalysis = (audioTrack: any) => {
  if (!audioContext) {
    audioContext = new AudioContext();
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048; // Increased for better time-domain analysis
    dataArray = new Uint8Array(analyserNode.fftSize);
  }

  const mediaStreamTrack = audioTrack.getMediaStreamTrack();
  const source = audioContext.createMediaStreamSource(
    new MediaStream([mediaStreamTrack])
  );
  source.connect(analyserNode!);

  return () => {
    source.disconnect();
  };
};

const getAudioLevel = () => {
  if (!analyserNode || !dataArray) return 0;

  // Get time-domain data instead of frequency data
  analyserNode.getByteTimeDomainData(dataArray);

  // Calculate the difference between consecutive samples
  let sum = 0;
  for (let i = 0; i < dataArray.length - 1; i++) {
    const diff = Math.abs(dataArray[i] - dataArray[i + 1]);
    sum += diff;
  }

  // Normalize and scale the result
  const averageDiff = sum / (dataArray.length - 1);
  const normalizedLevel = Math.min(1, averageDiff / 10); // Adjust divisor based on testing

  return normalizedLevel;
};

const startSilenceDetection = () => {
  if (!isInCall) return;

  // Clear any existing intervals
  if (silenceInterval) {
    clearInterval(silenceInterval);
  }

  let lastSpeechTime = Date.now();

  const checkAudioLevels = () => {
    if (!isInCall) return;

    const userLevel = getAudioLevel();
    const wasUserSpeaking = isUserSpeaking;
    isUserSpeaking = userLevel > SILENCE_THRESHOLD;

    if (isUserSpeaking !== wasUserSpeaking) {
      // Reset the last speech time when speech state changes
      lastSpeechTime = Date.now();
    }

    // Calculate agent speaking state based on remote audio tracks
    const wasAgentSpeaking = isAgentSpeaking;
    isAgentSpeaking = remoteAudioTracks.some((track) => {
      const level = track.getVolumeLevel();
      return level > SILENCE_THRESHOLD;
    });

    if (isAgentSpeaking !== wasAgentSpeaking) {
      lastSpeechTime = Date.now();
    }

    // Check if either user or agent is speaking
    const isAnyoneSpeaking = isUserSpeaking || isAgentSpeaking;
    if (isAnyoneSpeaking) {
      lastSpeechTime = Date.now();
    }

    const timeSinceLastSpeech = Date.now() - lastSpeechTime;
    if (timeSinceLastSpeech >= SILENCE_TIMEOUT) {
      console.log(
        `No speech detected from either party for ${
          SILENCE_TIMEOUT / 1000
        } seconds, disconnecting...`
      );
      disconnect(true); // Pass true to indicate this is a timeout disconnect
    }
  };

  // Start checking audio levels every second
  silenceInterval = setInterval(checkAudioLevels, CHECK_INTERVAL);

  // Initial check
  checkAudioLevels();
};

const stopSilenceDetection = () => {
  if (silenceInterval) {
    clearInterval(silenceInterval);
    silenceInterval = null;
  }
  if (silenceTimeout) {
    clearTimeout(silenceTimeout);
    silenceTimeout = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
    analyserNode = null;
    dataArray = null;
  }
  if (cleanupLocalAudio) {
    cleanupLocalAudio();
    cleanupLocalAudio = null;
  }
  cleanupRemoteAudio.forEach((cleanup) => cleanup());
  cleanupRemoteAudio = [];
  // Reset speech states
  isUserSpeaking = false;
  isAgentSpeaking = false;
};

// Generate a unique channel name with timestamp and random suffix
const generateChannelName = () => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `agent-${timestamp}-${randomSuffix}`;
};

// Initialize AgoraRTC engine when the page loads
if (typeof window !== "undefined") {
  import("agora-rtc-sdk-ng")
    .then(async (module) => {
      AgoraRTC = module.default;
      await initializeEngine();
    })
    .catch((error) => {
      console.error("Failed to initialize AgoraRTC:", error);
    });
}

const initializeEngine = async () => {
  if (!AgoraRTC) {
    throw new Error("AgoraRTC engine not loaded");
  }

  client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

  // Generate channel name and get token
  channelName = generateChannelName();
  const tokenResponse = await fetch("/api/tokens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channelName }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to get RTC token");
  }

  const data = await tokenResponse.json();
  token = data.rtcToken;

  // Preload channel
  await AgoraRTC.preload(APP_ID, channelName, token);
  console.log("Channel preloaded");

  // Set up event handlers for remote users
  client.on("user-published", async (user: any, mediaType: string) => {
    if (mediaType === "audio") {
      await client.subscribe(user, mediaType);
      const remoteAudioTrack = user.audioTrack;
      remoteAudioTracks.push(remoteAudioTrack);

      // Set up audio analysis for remote user
      const cleanup = setupAudioAnalysis(remoteAudioTrack);
      cleanupRemoteAudio.push(cleanup);

      remoteAudioTrack.play();
    }
  });

  client.on("user-unpublished", (user: any, mediaType: string) => {
    if (mediaType === "audio") {
      const index = remoteAudioTracks.findIndex(
        (track) => track === user.audioTrack
      );
      if (index !== -1) {
        remoteAudioTracks[index].stop();
        remoteAudioTracks.splice(index, 1);
        if (cleanupRemoteAudio[index]) {
          cleanupRemoteAudio[index]();
          cleanupRemoteAudio.splice(index, 1);
        }
        isAgentSpeaking = false;
      }
    }
  });

  console.log("AgoraRTC engine initialized with channel:", channelName);
};

// Get the current channel name and token
export const getConnectionInfo = () => {
  if (!channelName || !token) {
    throw new Error(
      "AgoraRTC not initialized. Please wait for the page to load."
    );
  }
  return { channelName, token };
};

// Initialize client only on the client side
export const initializeClient = async () => {
  if (!client || !channelName || !token) {
    if (!AgoraRTC) {
      throw new Error("AgoraRTC engine not loaded");
    }
    await initializeEngine();
  }
  return { client, channelName, token };
};

export const setupVoiceConnection = async (connectionInfo?: {
  channelName: string;
  token: string;
}) => {
  try {
    const { client } = await initializeClient();
    if (!client) throw new Error("Failed to initialize Agora client");

    if (isConnected) {
      console.log("Already connected to channel");
      return getConnectionInfo();
    }

    // Use provided connection info or get from initialization
    const { channelName: currentChannelName, token: currentToken } =
      connectionInfo || getConnectionInfo();

    // Join the channel
    await client.join(
      process.env.NEXT_PUBLIC_AGORA_APP_ID!,
      currentChannelName,
      currentToken,
      null
    );

    // Create and publish local audio track
    if (!localAudioTrack) {
      localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "music_standard",
      });
    } else {
      localAudioTrack.play();
    }

    // Set up audio analysis for local user
    cleanupLocalAudio = setupAudioAnalysis(localAudioTrack);

    await client.publish([localAudioTrack]);
    isConnected = true;
    isInCall = true; // Set call state to active

    // Start silence detection with a fresh timer
    startSilenceDetection();

    console.log("Joined channel successfully");
    return { channelName: currentChannelName, token: currentToken };
  } catch (error) {
    console.error("Error setting up voice connection:", error);
    throw error;
  }
};

export const setOnDisconnect = (callback: () => void) => {
  onDisconnect = callback;
};

export const setOnWakeWordReset = (callback: () => void) => {
  onWakeWordReset = callback;
};

export const disconnect = async (isTimeout: boolean = false) => {
  try {
    // Stop silence detection
    stopSilenceDetection();
    isInCall = false; // Reset call state

    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack = null;
    }

    remoteAudioTracks.forEach((track) => {
      if (track) {
        track.stop();
      }
    });
    remoteAudioTracks = [];

    if (client && isConnected) {
      await client.leave();
      isConnected = false;
    }

    if (!isTimeout) {
      // Only reset everything if it's a manual disconnect
      client = null;
      channelName = null;
      token = null;
      isConnected = false;
      isInCall = false;
    } else {
      // For timeout, just refresh the token and reinitialize the client
      if (channelName) {
        const tokenResponse = await fetch("/api/tokens", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ channelName }),
        });

        if (!tokenResponse.ok) {
          throw new Error("Failed to get RTC token");
        }

        const data = await tokenResponse.json();
        token = data.rtcToken;

        // Reinitialize the client with the new token
        if (AgoraRTC) {
          client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

          // Set up event handlers for remote users
          client.on("user-published", async (user: any, mediaType: string) => {
            if (mediaType === "audio") {
              await client.subscribe(user, mediaType);
              const remoteAudioTrack = user.audioTrack;
              remoteAudioTracks.push(remoteAudioTrack);

              // Set up audio analysis for remote user
              const cleanup = setupAudioAnalysis(remoteAudioTrack);
              cleanupRemoteAudio.push(cleanup);

              remoteAudioTrack.play();
            }
          });

          client.on("user-unpublished", (user: any, mediaType: string) => {
            if (mediaType === "audio") {
              const index = remoteAudioTracks.findIndex(
                (track) => track === user.audioTrack
              );
              if (index !== -1) {
                remoteAudioTracks[index].stop();
                remoteAudioTracks.splice(index, 1);
                if (cleanupRemoteAudio[index]) {
                  cleanupRemoteAudio[index]();
                  cleanupRemoteAudio.splice(index, 1);
                }
                isAgentSpeaking = false;
              }
            }
          });

          // Preload the channel with the new token
          await AgoraRTC.preload(APP_ID, channelName, token);
          console.log("Channel preloaded with new token");
        }
      }
    }

    // Reset UI state and trigger wake word detection reset
    if (onDisconnect) {
      onDisconnect();
    }
    if (onWakeWordReset) {
      onWakeWordReset();
    }

    console.log("Disconnected successfully");
  } catch (error) {
    console.error("Error during disconnect:", error);
    throw error;
  }
};
