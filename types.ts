export interface User {
  id: string;
  username: string;
  isSpeaker: boolean;
  handRaised: boolean;
  isHost: boolean;
  position: { x: number; y: number; z: number };
  color: string;
  micActive: boolean;
}

export interface ChatMessage {
  userId: string;
  text: string;
  timestamp: number;
}

export interface RoomInfo {
  id: string;
  title: string;
  language: string;
  topic: string;
  hostId: string;
  userCount: number;
  speakerCount: number;
}

export enum UserRole {
  SPEAKER = 'SPEAKER',
  AUDIENCE = 'AUDIENCE'
}
