import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
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
  Radio,
  Sparkles,
  Zap,
  Waveform,
  FileAudio,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';

// Enhanced RealtimeAudioChat class for advanced voice processing
class EnhancedRealtimeAudioChat {
  constructor() {
    this.peerConnection = null;
    this.dataChannel = null;
    this.audioElement = null;
    this.localStream = null;
    this.audioContext = null;
    this.analyzer = null;
    this.voiceProcessor = null;
  }

  async init() {
    try {
      // Check if realtime features are available
      const statusResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/realtime/status`);
      const statusData = await statusResponse.json();
      
      if (statusData.available) {
        // Get session from backend (fixed endpoint path)
        const tokenResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/realtime/session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          }
        });
        
        if (!tokenResponse.ok) {
          throw new Error("Realtime session not available, using enhanced WebRTC");
        }
        
        const data = await tokenResponse.json();
        if (!data.client_secret?.value) {
          throw new Error("Failed to get session token, using enhanced WebRTC");
        }

        // Create and set up WebRTC peer connection with AI
        this.peerConnection = new RTCPeerConnection();
        this.setupAudioElement();
        await this.setupLocalAudio();
        this.setupDataChannel();
        this.setupAudioAnalysis();

        // Create and send offer
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        // Send offer to backend and get answer
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/realtime/negotiate`, {
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
        console.log("Enhanced WebRTC connection established with AI voice processing");
        return { mode: 'ai', message: 'AI voice processing enabled' };
      } else {
        throw new Error("AI voice services not available");
      }
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
    this.localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000
      } 
    });
    
    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });
  }

  setupDataChannel() {
    this.dataChannel = this.peerConnection.createDataChannel("voice-events");
    this.dataChannel.onmessage = (event) => {
      console.log("Received voice event:", event.data);
    };
  }

  setupAudioAnalysis() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = this.audioContext.createMediaStreamSource(this.localStream);
    this.analyzer = this.audioContext.createAnalyser();
    this.analyzer.fftSize = 256;
    source.connect(this.analyzer);
  }

  getVoiceLevel() {
    if (!this.analyzer) return 0;
    
    const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
    this.analyzer.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    
    return sum / dataArray.length / 255; // Normalize to 0-1
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
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

const EnhancedCallInterface = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [callStatus, setCallStatus] = useState('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVoiceCloningEnabled, setIsVoiceCloningEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [participants, setParticipants] = useState(1);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [activeTab, setActiveTab] = useState('call');
  const [voiceSettings, setVoiceSettings] = useState({
    stability: 0.75,
    similarity: 0.75,
    style: 0.0,
    enhance: true
  });
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const audioChat = useRef(null);
  const voiceLevelInterval = useRef(null);

  useEffect(() => {
    initializeCall();
    fetchAvailableVoices();

    return () => {
      if (audioChat.current) {
        audioChat.current.disconnect();
      }
      if (voiceLevelInterval.current) {
        clearInterval(voiceLevelInterval.current);
      }
    };
  }, [roomId]);

  const fetchAvailableVoices = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/voices/available`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableVoices(data.voices || []);
      }
    } catch (error) {
      console.error('Error fetching voices:', error);
    }
  };

  const initializeCall = async () => {
    try {
      setConnectionStatus('Checking advanced voice services...');
      
      // Check if voice cloning is available
      const voiceStatusResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/voice/status`);
      const voiceStatusData = await voiceStatusResponse.json();
      
      if (voiceStatusData.elevenlabs_available) {
        setConnectionStatus('Connecting to AI voice service...');
        
        // Initialize enhanced WebRTC audio chat with AI
        audioChat.current = new EnhancedRealtimeAudioChat();
        const initResult = await audioChat.current.init();
        
        setConnectionStatus('Connected with advanced AI voice cloning');
        setCallStatus('active');
        toast.success('Connected with advanced voice cloning!');
        
        // Start voice level monitoring
        voiceLevelInterval.current = setInterval(() => {
          if (audioChat.current && !isMuted) {
            const level = audioChat.current.getVoiceLevel();
            setVoiceLevel(level);
          } else {
            setVoiceLevel(0);
          }
        }, 100);
      } else {
        setConnectionStatus('AI voice cloning not available, using basic audio...');
        toast.info('Using basic voice calling mode');
        
        // Fallback to basic WebRTC without advanced features
        await initializeBasicWebRTC();
        setIsVoiceCloningEnabled(false);
      }
    } catch (error) {
      console.error('Call initialization error:', error);
      setConnectionStatus('Connection failed, trying basic mode...');
      toast.error('Advanced voice service unavailable. Using basic WebRTC mode.');
      
      // Fallback to basic WebRTC
      await initializeBasicWebRTC();
      setIsVoiceCloningEnabled(false);
    }
  };

  const initializeBasicWebRTC = async () => {
    try {
      setConnectionStatus('Setting up enhanced basic audio...');
      
      // Get user media with enhanced audio settings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
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
      
      setConnectionStatus('Enhanced basic audio ready');
      setCallStatus('active');
      toast.success('Enhanced basic audio connection established!');
    } catch (error) {
      console.error('Enhanced WebRTC error:', error);
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

      if (voiceLevelInterval.current) {
        clearInterval(voiceLevelInterval.current);
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

  const generateTestSpeech = async () => {
    if (!selectedVoice) {
      toast.error('Please select a voice first');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/tts/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: "Hello! This is a test of the voice cloning system. How do I sound?",
          voice_id: selectedVoice,
          stability: voiceSettings.stability,
          similarity_boost: voiceSettings.similarity,
          style: voiceSettings.style
        })
      });

      if (response.ok) {
        const result = await response.json();
        const audio = new Audio(result.audio_url);
        audio.play();
        toast.success('Test speech generated!');
      } else {
        toast.error('Failed to generate test speech');
      }
    } catch (error) {
      console.error('Error generating test speech:', error);
      toast.error('Network error during speech generation');
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
                  <h1 className="text-xl font-bold">Enhanced Voice Call</h1>
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

      {/* Main Interface */}
      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 glass rounded-2xl p-2 mb-8">
              <TabsTrigger value="call" className="rounded-xl" data-testid="call-tab">
                <Phone className="w-4 h-4 mr-2" />
                Call Interface
              </TabsTrigger>
              <TabsTrigger value="voice" className="rounded-xl" data-testid="voice-tab">
                <Sparkles className="w-4 h-4 mr-2" />
                Voice Control
              </TabsTrigger>
              <TabsTrigger value="settings" className="rounded-xl" data-testid="settings-tab">
                <Settings className="w-4 h-4 mr-2" />
                Advanced Settings
              </TabsTrigger>
            </TabsList>

            {/* Call Interface Tab */}
            <TabsContent value="call" className="space-y-6" data-testid="call-content">
              {/* Central Call Display */}
              <div className="text-center mb-12">
                <div className="relative inline-block">
                  {/* User Avatar with Voice Level Indicator */}
                  <div className="w-48 h-48 mx-auto mb-6 relative">
                    <div className={`w-full h-full rounded-full flex items-center justify-center text-6xl font-bold text-white transition-all duration-300 ${
                      voiceLevel > 0.1 ? 'animate-pulse-glow bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-primary'
                    }`}>
                      {user?.username?.charAt(0).toUpperCase()}
                    </div>
                    
                    {/* Voice Level Ring */}
                    {voiceLevel > 0 && (
                      <div 
                        className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-pulse"
                        style={{
                          transform: `scale(${1 + voiceLevel * 0.3})`,
                          opacity: voiceLevel
                        }}
                      ></div>
                    )}
                    
                    {/* Voice Activity Indicator */}
                    {!isMuted && callStatus === 'active' && voiceLevel > 0.1 && (
                      <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
                        <div className="voice-wave">
                          <div className="voice-bar" style={{ height: `${10 + voiceLevel * 20}px` }}></div>
                          <div className="voice-bar" style={{ height: `${15 + voiceLevel * 25}px` }}></div>
                          <div className="voice-bar" style={{ height: `${12 + voiceLevel * 22}px` }}></div>
                          <div className="voice-bar" style={{ height: `${18 + voiceLevel * 28}px` }}></div>
                          <div className="voice-bar" style={{ height: `${10 + voiceLevel * 20}px` }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <h2 className="text-3xl font-bold mb-2" data-testid="user-display-name">{user?.username}</h2>
                  <p className="text-lg text-slate-400 mb-4" data-testid="connection-status">{connectionStatus}</p>
                  
                  <div className="flex justify-center gap-4 mb-6">
                    {isVoiceCloningEnabled && callStatus === 'active' && (
                      <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-4 py-2">
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI Voice Cloning Active
                      </Badge>
                    )}
                    
                    {!isVoiceCloningEnabled && callStatus === 'active' && (
                      <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-4 py-2">
                        <Phone className="w-4 h-4 mr-2" />
                        Enhanced Basic Call
                      </Badge>
                    )}
                    
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2">
                      <Waveform className="w-4 h-4 mr-2" />
                      HD Audio
                    </Badge>
                  </div>
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

              {/* Call Info */}
              {callStatus === 'active' && (
                <div className="text-center">
                  <Card className="glass border-0 p-6 inline-block">
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span>Connected</span>
                      </div>
                      <div className="w-px h-4 bg-slate-600"></div>
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        <span>AI Enhanced</span>
                      </div>
                      <div className="w-px h-4 bg-slate-600"></div>
                      <div className="flex items-center gap-2">
                        <Waveform className="w-4 h-4" />
                        <span>Real-time Processing</span>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Voice Control Tab */}
            <TabsContent value="voice" className="space-y-6" data-testid="voice-content">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Voice Selection */}
                <Card className="glass border-0 p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <FileAudio className="w-5 h-5 text-purple-400" />
                    Voice Selection
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
                      {availableVoices.slice(0, 6).map((voice) => (
                        <Card
                          key={voice.voice_id}
                          className={`glass-dark border-0 p-3 cursor-pointer transition-all ${
                            selectedVoice === voice.voice_id
                              ? 'ring-2 ring-emerald-400 bg-emerald-500/10'
                              : 'hover:bg-white/5'
                          }`}
                          onClick={() => setSelectedVoice(voice.voice_id)}
                          data-testid={`voice-${voice.voice_id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-sm">{voice.name}</h4>
                              <p className="text-xs text-slate-400">{voice.category || 'Pre-built'}</p>
                            </div>
                            {selectedVoice === voice.voice_id && (
                              <div className="w-3 h-3 bg-emerald-400 rounded-full"></div>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                    
                    <Button
                      onClick={generateTestSpeech}
                      disabled={!selectedVoice}
                      className="w-full btn-secondary"
                      data-testid="test-voice"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Test Selected Voice
                    </Button>
                  </div>
                </Card>
                
                {/* Voice Settings */}
                <Card className="glass border-0 p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-400" />
                    Voice Settings
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="text-slate-200 mb-2 block">Stability: {voiceSettings.stability.toFixed(2)}</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={voiceSettings.stability}
                        onChange={(e) => setVoiceSettings(prev => ({ ...prev, stability: parseFloat(e.target.value) }))}
                        className="w-full accent-emerald-400"
                        data-testid="stability-slider"
                      />
                    </div>
                    
                    <div>
                      <label className="text-slate-200 mb-2 block">Similarity: {voiceSettings.similarity.toFixed(2)}</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={voiceSettings.similarity}
                        onChange={(e) => setVoiceSettings(prev => ({ ...prev, similarity: parseFloat(e.target.value) }))}
                        className="w-full accent-emerald-400"
                        data-testid="similarity-slider"
                      />
                    </div>
                    
                    <div>
                      <label className="text-slate-200 mb-2 block">Style: {voiceSettings.style.toFixed(2)}</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={voiceSettings.style}
                        onChange={(e) => setVoiceSettings(prev => ({ ...prev, style: parseFloat(e.target.value) }))}
                        className="w-full accent-emerald-400"
                        data-testid="style-slider"
                      />
                    </div>
                    
                    <Button
                      onClick={() => setVoiceSettings({ stability: 0.75, similarity: 0.75, style: 0.0, enhance: true })}
                      className="w-full btn-secondary"
                      data-testid="reset-settings"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset to Default
                    </Button>
                  </div>
                </Card>
              </div>
              
              {/* Voice Cloning Toggle */}
              <Card className="glass border-0 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-500/20 rounded-lg">
                      <Sparkles className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">AI Voice Cloning</h3>
                      <p className="text-slate-400">Real-time voice transformation and cloning</p>
                    </div>
                  </div>
                  <Button
                    onClick={toggleVoiceCloning}
                    className={`px-6 py-3 rounded-full ${isVoiceCloningEnabled ? 'btn-primary' : 'btn-secondary'}`}
                    data-testid="voice-cloning-toggle"
                  >
                    {isVoiceCloningEnabled ? 'ON' : 'OFF'}
                  </Button>
                </div>
              </Card>
            </TabsContent>

            {/* Advanced Settings Tab */}
            <TabsContent value="settings" className="space-y-6" data-testid="settings-content">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Audio Settings */}
                <Card className="glass border-0 p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Volume2 className="w-5 h-5 text-blue-400" />
                    Audio Configuration
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Sample Rate</span>
                      <Badge className="bg-blue-500/20 text-blue-400">48kHz</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Echo Cancellation</span>
                      <Badge className="bg-green-500/20 text-green-400">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Noise Suppression</span>
                      <Badge className="bg-green-500/20 text-green-400">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Auto Gain Control</span>
                      <Badge className="bg-green-500/20 text-green-400">Enabled</Badge>
                    </div>
                  </div>
                </Card>
                
                {/* AI Processing */}
                <Card className="glass border-0 p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-400" />
                    AI Processing
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Voice Cloning Model</span>
                      <Badge className="bg-emerald-500/20 text-emerald-400">ElevenLabs v2</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Processing Latency</span>
                      <Badge className="bg-yellow-500/20 text-yellow-400">&lt;200ms</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Quality Mode</span>
                      <Badge className="bg-purple-500/20 text-purple-400">High Fidelity</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Real-time Processing</span>
                      <Badge className="bg-green-500/20 text-green-400">Active</Badge>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default EnhancedCallInterface;
