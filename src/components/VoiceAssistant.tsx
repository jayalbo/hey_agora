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

const StatusIndicator = ({
  status,
}: {
  status: "idle" | "listening" | "connecting" | "error";
}) => {
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      {/* Outer ring */}
      <div className="absolute inset-0 rounded-full border-2 border-gray-600"></div>

      {/* Circle with subtle gradient */}
      <div
        className={`absolute inset-0 rounded-full
        ${
          status === "idle"
            ? "bg-[radial-gradient(circle_at_center,rgba(75,75,75,0.2)_0%,rgba(45,45,45,0.4)_100%)]"
            : status === "listening"
            ? "bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2)_0%,rgba(37,99,235,0.4)_100%)] animate-pulse"
            : status === "connecting"
            ? "bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.2)_0%,rgba(217,119,6,0.4)_100%)] animate-pulse"
            : "bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.2)_0%,rgba(220,38,38,0.4)_100%)]"
        }`}
      ></div>
    </div>
  );
};

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
  const [status, setStatus] = useState<
    "idle" | "listening" | "connecting" | "error"
  >("idle");

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
        onError: (error: string) => {
          console.error("Wake word detection error:", error);
          setError(`Wake word detection error: ${error}`);
          // Don't automatically restart on errors
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
      // Don't automatically restart on errors
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

  // Update status based on state changes
  useEffect(() => {
    if (error) {
      setStatus("error");
    } else if (isConnecting) {
      setStatus("connecting");
    } else if (isListening) {
      setStatus("listening");
    } else {
      setStatus("idle");
    }
  }, [isListening, isConnecting, error]);

  if (!isClient) {
    return (
      <main className="grid place-items-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold text-white">Voice Assistant</h1>
          <p className="text-gray-400">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="grid place-items-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold text-white">Voice Assistant</h1>
        <StatusIndicator status={status} />
        <p className="text-gray-400 text-sm">
          {message || "Say 'Hey Agora' to start a conversation"}
        </p>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    </main>
  );
}
