import { NextRequest, NextResponse } from "next/server";
import { ChatCompletionRequest } from "@/types/chat";

export async function POST(request: NextRequest) {
  try {
    const chatRequest: ChatCompletionRequest = await request.json();

    if (!chatRequest.messages || chatRequest.messages.length === 0) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 }
      );
    }

    // Get the custom LLM wrapper URL from environment variables
    const llmUrl = process.env.AGORA_LLM_URL!;

    // Set default values if not provided
    const model = chatRequest.model || "gpt-4";
    const stream = chatRequest.stream !== undefined ? chatRequest.stream : true;

    // Make the inference request to your custom LLM wrapper
    const response = await fetch(llmUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: chatRequest.messages,
        response_format: chatRequest.response_format,
        modalities: chatRequest.modalities || ["text"],
        audio: chatRequest.audio,
        tools: chatRequest.tools,
        tool_choice: chatRequest.tool_choice,
        parallel_tool_calls: chatRequest.parallel_tool_calls,
        stream,
        stream_options: chatRequest.stream_options,
        context: chatRequest.context,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error from LLM wrapper: ${errorText}`);
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    // Handle streaming response
    if (stream) {
      // Create a TransformStream to process the response
      const { readable, writable } = new TransformStream();

      // Process the response in the background
      (async () => {
        const writer = writable.getWriter();
        const reader = response.body?.getReader();

        if (!reader) {
          throw new Error("Response body is not readable");
        }

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Send the [DONE] message
              await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
              break;
            }

            // Process the chunk and send it
            const chunk = new TextDecoder().decode(value);
            await writer.write(new TextEncoder().encode(`data: ${chunk}\n\n`));
          }
        } catch (error) {
          console.error("Error processing stream:", error);
          await writer.write(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                error: "Stream processing error",
              })}\n\n`
            )
          );
        } finally {
          await writer.close();
        }
      })();

      // Return the readable stream with the appropriate headers
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } else {
      // For non-streaming responses, return the JSON directly
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error("Error during inference:", error);
    return NextResponse.json(
      { error: "Failed to process inference request" },
      { status: 500 }
    );
  }
}
