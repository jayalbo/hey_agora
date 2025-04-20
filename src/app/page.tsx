import VoiceAssistant from "@/components/VoiceAssistant";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          Hey Agora Voice Assistant
        </h1>
        <p className="text-center text-gray-600">
          Say "Hey Agora" to start a conversation with the AI agent.
        </p>
      </div>
      <VoiceAssistant />
    </main>
  );
}
