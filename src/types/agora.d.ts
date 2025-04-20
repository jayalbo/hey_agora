declare module "agora-rtc-sdk-ng" {
  export interface ClientConfig {
    mode: "live" | "rtc";
    codec: "vp8" | "h264";
  }

  export interface Client {
    join(
      appId: string,
      channel: string,
      token: string | null,
      uid: string | number | null
    ): Promise<void>;
    leave(): Promise<void>;
    on(event: string, callback: Function): void;
    off(event: string, callback: Function): void;
  }

  export function createClient(config: ClientConfig): Client;
}

declare module "agora-token" {
  export enum RtcRole {
    PUBLISHER = 1,
    SUBSCRIBER = 2,
  }

  export class RtcTokenBuilder {
    static buildTokenWithUid(
      appId: string,
      appCertificate: string,
      channelName: string,
      uid: string | number,
      role: RtcRole,
      privilegeExpiredTs: number
    ): string;
  }
}

declare module "wake-word-command" {
  export interface WakeWordOptions {
    wakeWord: string;
    onWakeWordDetected?: () => void;
    onCommand?: (command: string) => void;
  }

  export interface WakeWordDetection {
    start(): void;
    stop(): void;
    pause(): void;
    resume(): void;
  }

  export function createWakeWordDetection(
    options: WakeWordOptions
  ): WakeWordDetection;
}
