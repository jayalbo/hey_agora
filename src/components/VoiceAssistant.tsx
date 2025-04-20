"use client";

import { useEffect, useState } from "react";
import { createWakeWordDetection } from "wake-word-command";
import { client, joinChannel, leaveChannel } from "@/utils/agora";
import { sendMessageToAgent } from "@/services/conversationalAI";

export default function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isAgentActive, setIsAgentActive] = useState(false);

  useEffect(() => {
    const wakeWordDetection = createWakeWordDetection({
      wakeWord: "hey agora",
      onWakeWordDetected: async () => {
        if (!isAgentActive) {
          setIsListening(true);
          try {
            await joinChannel();
            setIsAgentActive(true);
            wakeWordDetection.pause();
          } catch (error) {
            console.error("Error joining channel:", error);
            setIsListening(false);
          }
        }
      },
      onCommand: async (command) => {
        if (isAgentActive) {
          try {
            await sendMessageToAgent(command);
          } catch (error) {
            console.error("Error sending message to agent:", error);
          }
        }
      },
    });

    // Set up Agora event listeners
    client.on("user-left", async () => {
      setIsAgentActive(false);
      await leaveChannel();
      wakeWordDetection.resume();
      setIsListening(false);
    });

    // Start wake word detection
    wakeWordDetection.start();

    // Cleanup
    return () => {
      wakeWordDetection.stop();
      leaveChannel();
    };
  }, [isAgentActive]);

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-white rounded-lg shadow-lg">
      <div className="flex items-center space-x-2">
        <div
          className={`w-3 h-3 rounded-full ${
            isListening ? "bg-green-500" : "bg-gray-300"
          }`}
        />
        <span className="text-sm font-medium">
          {isListening ? "Listening..." : 'Say "Hey Agora"'}
        </span>
      </div>
    </div>
  );
}
