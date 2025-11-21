import { Socket } from 'socket.io-client';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

export class VoiceManager {
  peers: Map<string, RTCPeerConnection> = new Map();
  localStream: MediaStream | null = null;
  socket: Socket;
  roomId: string;
  userId: string;
  onRemoteStream: (userId: string, stream: MediaStream) => void;

  constructor(socket: Socket, roomId: string, userId: string, onRemoteStream: (uid: string, s: MediaStream) => void) {
    this.socket = socket;
    this.roomId = roomId;
    this.userId = userId;
    this.onRemoteStream = onRemoteStream;
    
    // Listen for signals
    this.socket.on('signal', this.handleSignal.bind(this));
  }

  async initLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      return this.localStream;
    } catch (err) {
      console.error("Failed to get local stream", err);
      return null;
    }
  }

  // Called when we want to connect to a user (we are initiator)
  createPeer(userToSignal: string, initiator: boolean) {
    if (this.peers.has(userToSignal)) return this.peers.get(userToSignal)!;

    console.log(`Creating peer for ${userToSignal} (initiator: ${initiator})`);
    const peer = new RTCPeerConnection(ICE_SERVERS);
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => peer.addTrack(track, this.localStream!));
    }

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('signal', {
          userToSignal,
          callerId: this.userId,
          signal: { type: 'candidate', candidate: event.candidate }
        });
      }
    };

    peer.ontrack = (event) => {
      console.log(`Received track from ${userToSignal}`);
      this.onRemoteStream(userToSignal, event.streams[0]);
    };

    this.peers.set(userToSignal, peer);

    if (initiator) {
        peer.createOffer().then(offer => {
            peer.setLocalDescription(offer);
            this.socket.emit('signal', {
                userToSignal,
                callerId: this.userId,
                signal: { type: 'sdp', sdp: offer }
            });
        }).catch(e => console.error("Error creating offer", e));
    }

    return peer;
  }

  async handleSignal({ signal, callerId }: { signal: any, callerId: string }) {
     let peer = this.peers.get(callerId);
     
     // If we receive an offer and don't have a peer, create one (we are the receiver)
     if (!peer) {
         peer = this.createPeer(callerId, false);
     }

     try {
       if (signal.type === 'sdp') {
           const desc = new RTCSessionDescription(signal.sdp);
           await peer.setRemoteDescription(desc);
           if (desc.type === 'offer') {
               const answer = await peer.createAnswer();
               await peer.setLocalDescription(answer);
               this.socket.emit('signal', {
                   userToSignal: callerId,
                   callerId: this.userId,
                   signal: { type: 'sdp', sdp: answer }
               });
           }
       } else if (signal.type === 'candidate') {
           const candidate = new RTCIceCandidate(signal.candidate);
           await peer.addIceCandidate(candidate);
       }
     } catch (e) {
         console.error("Signaling error", e);
     }
  }

  toggleMute(enabled: boolean) {
      if (this.localStream) {
          this.localStream.getAudioTracks().forEach(track => track.enabled = enabled);
      }
  }
  
  cleanup() {
      this.peers.forEach(p => p.close());
      this.peers.clear();
      if (this.localStream) {
          this.localStream.getTracks().forEach(t => t.stop());
      }
      this.socket.off('signal');
  }
}
