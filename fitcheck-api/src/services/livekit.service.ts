import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

export class LiveKitService {
  private roomService: RoomServiceClient;
  private apiKey: string;
  private apiSecret: string;
  private livekitHost: string;

  constructor() {
    this.apiKey = process.env.LIVEKIT_API_KEY || '';
    this.apiSecret = process.env.LIVEKIT_API_SECRET || '';
    this.livekitHost = process.env.LIVEKIT_HOST || 'wss://your-livekit-host.cloud';

    if (!this.apiKey || !this.apiSecret) {
      console.warn('⚠️  LiveKit credentials not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET');
    }

    this.roomService = new RoomServiceClient(this.livekitHost, this.apiKey, this.apiSecret);
  }

  /**
   * Create a LiveKit room for a live session
   */
  async createRoom(roomName: string): Promise<void> {
    try {
      await this.roomService.createRoom({
        name: roomName,
        emptyTimeout: 300, // Auto-delete after 5 minutes if empty
        maxParticipants: 100,
      });
      console.log(`✅ Created LiveKit room: ${roomName}`);
    } catch (error: any) {
      // Room may already exist, which is fine
      if (error.message?.includes('already exists')) {
        console.log(`Room ${roomName} already exists`);
      } else {
        console.error('Error creating LiveKit room:', error);
        throw error;
      }
    }
  }

  /**
   * Generate an access token for a participant
   */
  async generateToken(
    roomName: string,
    participantName: string,
    metadata?: string,
    canPublish: boolean = false
  ): Promise<string> {
    try {
      const token = new AccessToken(this.apiKey, this.apiSecret, {
        identity: participantName,
        name: participantName,
        metadata,
      });

      token.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish,
        canSubscribe: true,
        canPublishData: true,
      });

      const jwt = await token.toJwt();
      console.log(`✅ Generated LiveKit token for ${participantName} in room ${roomName}`);
      return jwt;
    } catch (error) {
      console.error('Error generating LiveKit token:', error);
      throw error;
    }
  }

  /**
   * End a live session (delete the room)
   */
  async endRoom(roomName: string): Promise<void> {
    try {
      await this.roomService.deleteRoom(roomName);
      console.log(`✅ Deleted LiveKit room: ${roomName}`);
    } catch (error) {
      console.error('Error deleting LiveKit room:', error);
      // Don't throw - room may already be deleted
    }
  }

  /**
   * List active participants in a room
   */
  async listParticipants(roomName: string): Promise<any[]> {
    try {
      const participants = await this.roomService.listParticipants(roomName);
      return participants;
    } catch (error) {
      console.error('Error listing participants:', error);
      return [];
    }
  }

  /**
   * Get LiveKit WebSocket URL for clients
   */
  getLivekitUrl(): string {
    return this.livekitHost;
  }
}

// Singleton instance
export const livekitService = new LiveKitService();
