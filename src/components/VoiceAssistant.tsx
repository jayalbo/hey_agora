"use client";

import { useEffect, useRef, useState } from "react";
import {
  setupVoiceConnection,
  disconnect,
  getConnectionInfo,
  setOnDisconnect,
  setOnWakeWordReset,
} from "@/utils/agora";
import { sendMessageToAgent, joinAgent } from "@/services/conversationalAI";

export default function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [isClient, setIsClient] = useState(false);
  const [initialCommand, setInitialCommand] = useState<string | null>(null);
  const commandRef = useRef<string | null>(null);
  const wakeWordDetectionRef = useRef<any>(null);
  const isAgentJoinedRef = useRef<boolean>(false);
  const isConnectingRef = useRef<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("");

  // Add effect to sync commandRef with initialCommand state
  useEffect(() => {
    commandRef.current = initialCommand;
  }, [initialCommand]);

  useEffect(() => {
    // Set up the disconnect callback
    setOnDisconnect(() => {
      setIsListening(false);
      setIsConnecting(false);
      setError(null);
      setConnectionStatus("");
      setMessage("Listening for 'Hey Agora'...");
    });

    // Set up the wake word reset callback
    setOnWakeWordReset(() => {
      startWakeWordDetection();
    });

    return () => {
      // Clean up the callbacks
      setOnDisconnect(() => {});
      setOnWakeWordReset(() => {});
    };
  }, []);

  const handleDisconnect = async () => {
    try {
      await disconnect();
      isAgentJoinedRef.current = false;
      setIsListening(false);
      setMessage("Listening for 'Hey Agora'...");
      isConnectingRef.current = false;
      startWakeWordDetection(); // Restart wake word detection
    } catch (err) {
      console.error("Error during disconnect:", err);
      setError(err instanceof Error ? err.message : "Failed to disconnect");
      isConnectingRef.current = false;
    }
  };

  const connectToVoice = async () => {
    // Prevent multiple simultaneous calls
    if (isConnectingRef.current) {
      console.log("Already connecting, ignoring additional call");
      return;
    }

    isConnectingRef.current = true;

    try {
      setIsConnecting(true);
      setError(null);
      setMessage("Connecting to AI agent...");

      // Reset agent joined state to ensure fresh connection
      isAgentJoinedRef.current = false;

      // Get connection info first
      const { channelName, token } = getConnectionInfo();

      // Run both connections concurrently
      await Promise.all([
        setupVoiceConnection({ channelName, token }),
        joinAgent(channelName).catch((err) => {
          console.error("Error joining agent:", err);
          // Don't throw here, let the agent join error be handled separately
        }),
      ]);

      console.log("Initial command:", commandRef.current);

      // Send the initial command to the agent if available
      if (commandRef.current) {
        console.log("Sending initial command to agent:", commandRef.current);
        await sendMessageToAgent(commandRef.current);
        setInitialCommand(null); // Clear the initial command after sending
      }

      isAgentJoinedRef.current = true;
      setMessage("Connected! AI agent is ready to help...");
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
          await connectToVoice();
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
      if (wakeWordDetectionRef.current) {
        wakeWordDetectionRef.current.stop();
      }
      // Only disconnect if we're actually unmounting and not just initializing
      if (isListening || isAgentJoinedRef.current) {
        handleDisconnect();
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
