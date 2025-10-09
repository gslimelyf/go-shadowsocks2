import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { useAuth } from '../App';
import { toast } from 'sonner';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  Settings,
  ArrowLeft,
  Users,
  Radio
} from 'lucide-react';

// RealtimeAudioChat class for WebRTC integration
class RealtimeAudioChat {
  constructor() {
    this.peerConnection = null;
    this.dataChannel = null;
    this.audioElement = null;
    this.localStream = null;
  }

  async init() {
    try {
      // Get session from backend (fixed endpoint path)
      const tokenResponse = await fetch("/api/realtime/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      if (!tokenResponse.ok) {
        throw new Error("Realtime session not available, using basic WebRTC");
      }
      
      const data = await tokenResponse.json();
      if (!data.client_secret?.value) {
        throw new Error("Failed to get session token, using basic WebRTC");
      }

      // Create and set up WebRTC peer connection
      this.peerConnection = new RTCPeerConnection();
      this.setupAudioElement();
      await this.setupLocalAudio();
      this.setupDataChannel();

      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Send offer to backend and get answer
      const response = await fetch("/api/realtime/negotiate", {
        method: "POST",
        body: offer.sdp,
        headers: {
          "Content-Type": "application/sdp"
        }
      });

      if (!response.ok) {
        throw new Error("Failed to negotiate WebRTC connection");
      }

      const { sdp: answerSdp } = await response.json();
      const answer = {
        type: "answer",
        sdp: answerSdp
      };

      await this.peerConnection.setRemoteDescription(answer);
      console.log("WebRTC connection established with AI voice cloning");
      return true;
    } catch (error) {
      console.error("Failed to initialize AI audio chat:", error);
      throw error;
    }
  }

  setupAudioElement() {
    this.audioElement = document.createElement("audio");
    this.audioElement.autoplay = true;
    document.body.appendChild(this.audioElement);

    this.peerConnection.ontrack = (event) => {
      this.audioElement.srcObject = event.streams[0];
    };
  }

  async setupLocalAudio() {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });
  }

  setupDataChannel() {
    this.dataChannel = this.peerConnection.createDataChannel("oai-events");
    this.dataChannel.onmessage = (event) => {
      console.log("Received event:", event.data);
    };
  }

  toggleMicrophone(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  disconnect() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    if (this.audioElement) {
      document.body.removeChild(this.audioElement);
    }
  }
}

const CallInterface = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [callStatus, setCallStatus] = useState('connecting'); // connecting, active, ended
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVoiceCloningEnabled, setIsVoiceCloningEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [participants, setParticipants] = useState(1);
  const audioChat = useRef(null);

  useEffect(() => {
    initializeCall();

    return () => {
      if (audioChat.current) {
        audioChat.current.disconnect();
      }
    };
  }, [roomId]);

  const initializeCall = async () => {
    try {
      setConnectionStatus('Checking voice service...');
      
      // Check if realtime features are available
      const statusResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/realtime/status`);
      const statusData = await statusResponse.json();
      
      if (statusData.available) {
        setConnectionStatus('Connecting to AI voice service...');
        
        // Initialize WebRTC audio chat with AI
        audioChat.current = new RealtimeAudioChat();
        await audioChat.current.init();
        
        setConnectionStatus('Connected with AI voice cloning');
        setCallStatus('active');
        toast.success('Connected with AI voice cloning!');
      } else {
        setConnectionStatus('AI voice cloning not available, using basic audio...');
        toast.info('Using basic voice calling mode');
        
        // Fallback to basic WebRTC without OpenAI integration
        await initializeBasicWebRTC();
      }
    } catch (error) {
      console.error('Call initialization error:', error);
      setConnectionStatus('Connection failed, trying basic mode...');
      toast.error('AI voice service unavailable. Using basic WebRTC mode.');
      
      // Fallback to basic WebRTC without OpenAI integration
      await initializeBasicWebRTC();
    }
  };

  const initializeBasicWebRTC = async () => {
    try {
      setConnectionStatus('Setting up basic audio...');
      
      // Get user media for basic audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Store the stream for microphone control
      audioChat.current = {
        localStream: stream,
        toggleMicrophone: (enabled) => {
          stream.getAudioTracks().forEach(track => {
            track.enabled = enabled;
          });
        },
        disconnect: () => {
          stream.getTracks().forEach(track => track.stop());
        }
      };
      
      // Disable AI voice cloning since it's not available
      setIsVoiceCloningEnabled(false);
      
      setConnectionStatus('Basic audio ready');
      setCallStatus('active');
      toast.success('Basic audio connection established!');
    } catch (error) {
      console.error('Basic WebRTC error:', error);
      setConnectionStatus('Audio permission required');
      toast.error('Please allow microphone access to join the call.');
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioChat.current) {
      audioChat.current.toggleMicrophone(!isMuted);
    }
    toast.info(isMuted ? 'Microphone unmuted' : 'Microphone muted');
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    toast.info(isSpeakerOn ? 'Speaker off' : 'Speaker on');
  };

  const toggleVoiceCloning = () => {
    setIsVoiceCloningEnabled(!isVoiceCloningEnabled);
    toast.info(isVoiceCloningEnabled ? 'Voice cloning disabled' : 'Voice cloning enabled');
  };

  const endCall = async () => {
    try {
      // End call on backend
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calls/${roomId}/end`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (audioChat.current) {
        audioChat.current.disconnect();
      }

      setCallStatus('ended');
      toast.success('Call ended');
      
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('Error ending call:', error);
      toast.error('Error ending call');
    }
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'connecting': return 'bg-yellow-500';
      case 'active': return 'bg-green-500 animate-pulse';
      case 'ended': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-pattern opacity-10"></div>
      
      {/* Header */}
      <header className="glass-dark border-b border-white/10 relative z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate('/')}
                className="btn-secondary p-2"
                data-testid="back-button"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Radio className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Voice Call</h1>
                  <p className="text-sm text-slate-400" data-testid="room-id">Room: {roomId}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Badge className={`${getStatusColor()} text-white`} data-testid="call-status">
                {callStatus.charAt(0).toUpperCase() + callStatus.slice(1)}
              </Badge>
              
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Users className="w-4 h-4" />
                <span data-testid="participants-count">{participants} participant{participants > 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Call Interface */}
      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          
          {/* Central Call Display */}
          <div className="text-center mb-12">
            <div className="relative inline-block">
              {/* User Avatar */}
              <div className="w-48 h-48 mx-auto mb-6 relative">
                <div className="w-full h-full bg-gradient-primary rounded-full flex items-center justify-center text-6xl font-bold text-white animate-pulse-glow">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                
                {/* Voice Activity Indicator */}
                {!isMuted && callStatus === 'active' && (
                  <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
                    <div className="voice-wave">
                      <div className="voice-bar"></div>
                      <div className="voice-bar"></div>
                      <div className="voice-bar"></div>
                      <div className="voice-bar"></div>
                      <div className="voice-bar"></div>
                    </div>
                  </div>
                )}
              </div>
              
              <h2 className="text-3xl font-bold mb-2" data-testid="user-display-name">{user?.username}</h2>
              <p className="text-lg text-slate-400 mb-4" data-testid="connection-status">{connectionStatus}</p>
              
              {isVoiceCloningEnabled && callStatus === 'active' && (
                <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  🎭 Voice Cloning Active
                </Badge>
              )}
            </div>
          </div>

          {/* Call Controls */}
          <div className="flex justify-center items-center gap-6 mb-8">
            
            {/* Mute Button */}
            <Button
              onClick={toggleMute}
              className={`w-16 h-16 rounded-full ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'btn-secondary'} transition-all`}
              data-testid="mute-button"
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>

            {/* End Call Button */}
            <Button
              onClick={endCall}
              className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all transform hover:scale-110"
              data-testid="end-call-button"
            >
              <PhoneOff className="w-8 h-8" />
            </Button>

            {/* Speaker Button */}
            <Button
              onClick={toggleSpeaker}
              className={`w-16 h-16 rounded-full ${!isSpeakerOn ? 'bg-gray-500 hover:bg-gray-600' : 'btn-secondary'} transition-all`}
              data-testid="speaker-button"
            >
              {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </Button>
          </div>

          {/* Additional Controls */}
          <div className="flex justify-center gap-4">
            
            {/* Voice Cloning Toggle */}
            <Card className="glass-dark border-0 p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Settings className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Voice Cloning</p>
                <p className="text-sm text-slate-400">AI-powered voice transformation</p>
              </div>
              <Button
                onClick={toggleVoiceCloning}
                className={`px-4 py-2 rounded-full ${isVoiceCloningEnabled ? 'btn-primary' : 'btn-secondary'}`}
                data-testid="voice-cloning-toggle"
              >
                {isVoiceCloningEnabled ? 'ON' : 'OFF'}
              </Button>
            </Card>
          </div>

          {/* Call Info */}
          {callStatus === 'active' && (
            <div className="mt-8 text-center">
              <Card className="glass border-0 p-6 inline-block">
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span>Connected</span>
                  </div>
                  <div className="w-px h-4 bg-slate-600"></div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>High Quality</span>
                  </div>
                  <div className="w-px h-4 bg-slate-600"></div>
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    <span>Real-time Processing</span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallInterface;
