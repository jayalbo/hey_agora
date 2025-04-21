export interface TextContent {
  type: string;
  text: string;
}

export interface ImageContent {
  type: string;
  image_url: string;
}

export interface AudioContent {
  type: string;
  input_audio: Record<string, string>;
}

export interface ToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
  strict?: boolean;
}

export interface Tool {
  type: string;
  function: ToolFunction;
}

export interface ToolChoice {
  type: string;
  function?: Record<string, any>;
}

export interface ResponseFormat {
  type: string;
  json_schema?: Record<string, string>;
}

export interface SystemMessage {
  role: string;
  content: string | string[];
}

export interface UserMessage {
  role: string;
  content: string | Array<TextContent | ImageContent | AudioContent>;
}

export interface AssistantMessage {
  role: string;
  content?: string | TextContent[];
  audio?: Record<string, string>;
  tool_calls?: Record<string, any>[];
}

export interface ToolMessage {
  role: string;
  content: string | string[];
  tool_call_id: string;
}

export type Message =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolMessage;

export interface ChatCompletionRequest {
  context?: Record<string, any>;
  model?: string;
  messages: Message[];
  response_format?: ResponseFormat;
  modalities?: string[];
  audio?: Record<string, string>;
  tools?: Tool[];
  tool_choice?: string | ToolChoice;
  parallel_tool_calls?: boolean;
  stream?: boolean;
  stream_options?: Record<string, any>;
}
