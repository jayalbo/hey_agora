"use client";

import { useEffect, useRef, useState } from "react";
import { getTokens, leaveChannel } from "@/utils/tokens";
import { initializeClient } from "@/utils/agora";
import { sendMessageToAgent, joinAgent } from "@/services/conversationalAI";

interface TokenResponse {
  rtmToken: string;
  rtcToken: string;
}

export default function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [isClient, setIsClient] = useState(false);
  const [initialCommand, setInitialCommand] = useState<string | null>(null);
  const commandRef = useRef<string | null>(null);

  const clientRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const channelNameRef = useRef<string | null>(null);
  const wakeWordDetectionRef = useRef<any>(null);
  const isAgentJoinedRef = useRef<boolean>(false);
  const audioTrackInitializedRef = useRef<boolean>(false);
  const isConnectingRef = useRef<boolean>(false);
  const remoteAudioTracksRef = useRef<any[]>([]);

  // Add effect to sync commandRef with initialCommand state
  useEffect(() => {
    commandRef.current = initialCommand;
  }, [initialCommand]);

  const handleDisconnect = async () => {
    try {
      if (localAudioTrackRef.current) {
        // Don't close the audio track, just stop it
        localAudioTrackRef.current.stop();
      }

      // Stop and clean up remote audio tracks
      remoteAudioTracksRef.current.forEach((track) => {
        if (track) {
          track.stop();
        }
      });
      remoteAudioTracksRef.current = [];

      if (clientRef.current && channelNameRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }

      if (wakeWordDetectionRef.current) {
        wakeWordDetectionRef.current.stop();
        wakeWordDetectionRef.current = null;
      }

      channelNameRef.current = null;
      isAgentJoinedRef.current = false;
      setIsListening(false);
      setMessage("");
      isConnectingRef.current = false;
    } catch (err) {
      console.error("Error during disconnect:", err);
      setError(err instanceof Error ? err.message : "Failed to disconnect");
      isConnectingRef.current = false;
    }
  };

  const setupVoiceConnection = async () => {
    // Prevent multiple simultaneous calls
    if (isConnectingRef.current) {
      console.log("Already connecting, ignoring additional call");
      return;
    }

    isConnectingRef.current = true;

    try {
      // If we're already connected or connecting, disconnect first
      if (clientRef.current) {
        await handleDisconnect();
      }

      setIsConnecting(true);
      setError(null);

      // Generate a unique channel name and get token
      const channelName = `agent-${Date.now()}`;
      const tokenResponse = await getTokens(channelName);
      if (!tokenResponse.rtcToken) {
        throw new Error("Failed to get RTC token");
      }
      channelNameRef.current = channelName;

      // Initialize Agora client
      const client = await initializeClient();
      clientRef.current = client;

      // Set up event handlers for remote users
      client.on("user-published", async (user: any, mediaType: string) => {
        console.log("User published:", user.uid, mediaType);

        // Subscribe to the user
        await client.subscribe(user, mediaType);

        if (mediaType === "audio") {
          // Store the remote audio track
          const remoteAudioTrack = user.audioTrack;
          remoteAudioTracksRef.current.push(remoteAudioTrack);

          // Play the remote audio
          remoteAudioTrack.play();

          console.log("Subscribed to remote audio from:", user.uid);
        }
      });

      client.on("user-unpublished", (user: any, mediaType: string) => {
        console.log("User unpublished:", user.uid, mediaType);

        if (mediaType === "audio") {
          // Find and stop the remote audio track
          const index = remoteAudioTracksRef.current.findIndex(
            (track) => track === user.audioTrack
          );

          if (index !== -1) {
            remoteAudioTracksRef.current[index].stop();
            remoteAudioTracksRef.current.splice(index, 1);
          }
        }
      });

      // Join the channel
      await client.join(
        process.env.NEXT_PUBLIC_AGORA_APP_ID!,
        channelName,
        tokenResponse.rtcToken,
        null
      );

      // Use the existing audio track or create it if it doesn't exist
      if (!localAudioTrackRef.current) {
        // Dynamically import AgoraRTC only on client side
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;

        // Create and publish local audio track
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: "music_standard",
        });
        localAudioTrackRef.current = audioTrack;
        audioTrackInitializedRef.current = true;
      } else {
        // Resume the existing audio track
        localAudioTrackRef.current.play();
      }

      await client.publish([localAudioTrackRef.current]);

      // Join the agent to the call if not already joined
      if (!isAgentJoinedRef.current) {
        try {
          await joinAgent(channelName);
          console.log("Initial command:", commandRef.current);

          // Send the initial command to the agent if available
          if (commandRef.current) {
            console.log(
              "Sending initial command to agent:",
              commandRef.current
            );
            await sendMessageToAgent(commandRef.current);
            setInitialCommand(null); // Clear the initial command after sending
          }

          isAgentJoinedRef.current = true;
          setMessage("Connected! AI agent is ready to help...");
        } catch (err) {
          console.error("Error joining agent:", err);
          setMessage(
            "Connected! But AI agent failed to join. Please try again."
          );
        }
      }

      setIsListening(true);
    } catch (err) {
      console.error("Error setting up voice connection:", err);
      setError(
        err instanceof Error ? err.message : "Failed to setup voice connection"
      );
      await handleDisconnect();
    } finally {
      setIsConnecting(false);
      isConnectingRef.current = false;
    }
  };

  const startWakeWordDetection = async () => {
    if (!isClient) return;

    if (wakeWordDetectionRef.current) {
      wakeWordDetectionRef.current.stop();
    }

    try {
      const { createWakeWordDetection } = await import("wake-word-command");
      wakeWordDetectionRef.current = createWakeWordDetection({
        wakeWord: "hey agora",
        onWakeWordDetected: async () => {
          setMessage("Wake word detected! Connecting to AI agent...");
          await setupVoiceConnection();
        },
        onCommand: (command: string) => {
          console.log("Command received:", command);
          // Store the command to send to the agent once connected
          setInitialCommand(command);
        },
      });

      wakeWordDetectionRef.current.start();
      setMessage("Listening for 'Hey Agora'...");
    } catch (err) {
      console.error("Error starting wake word detection:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start wake word detection"
      );
    }
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      startWakeWordDetection();
    }
    return () => {
      if (channelNameRef.current) {
        leaveChannel(channelNameRef.current);
      }
      if (wakeWordDetectionRef.current) {
        wakeWordDetectionRef.current.stop();
      }
      // Clean up audio track when component unmounts
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
    };
  }, [isClient]);

  const stopListening = async () => {
    await handleDisconnect();
    startWakeWordDetection(); // Restart wake word detection after disconnecting
  };

  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-2">
        <h1 className="text-4xl font-bold mb-4">Voice Assistant</h1>
        <p className="mb-8 text-center max-w-md">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <h1 className="text-4xl font-bold mb-4">Voice Assistant</h1>
      <p className="mb-8 text-center max-w-md">
        {message || "Say 'Hey Agora' to start a conversation"}
      </p>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <button
        onClick={isListening ? stopListening : startWakeWordDetection}
        disabled={isConnecting}
        className={`px-6 py-3 rounded-lg text-white font-semibold ${
          isConnecting
            ? "bg-gray-400"
            : isListening
            ? "bg-red-500 hover:bg-red-600"
            : "bg-blue-500 hover:bg-blue-600"
        }`}
      >
        {isConnecting
          ? "Connecting..."
          : isListening
          ? "Stop Listening"
          : "Start Listening"}
      </button>
    </div>
  );
}
