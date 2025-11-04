import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useAuth } from '../App';
import { toast } from 'sonner';
import VoiceCloning from './VoiceCloning';
import {
  Mic,
  Phone,
  Users,
  Settings,
  LogOut,
  Plus,
  Clock,
  PhoneCall,
  Zap,
  Volume2,
  Sparkles,
  Waveform,
  User,
  FileAudio,
  Play,
  Pause,
  BarChart3
} from 'lucide-react';

const EnhancedDashboard = () => {
  const [calls, setCalls] = useState([]);
  const [voiceProfiles, setVoiceProfiles] = useState([]);
  const [newCallEmail, setNewCallEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [voiceStatus, setVoiceStatus] = useState({ elevenlabs_available: false });
  const [recentGenerations, setRecentGenerations] = useState([]);
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCalls();
    fetchVoiceProfiles();
    fetchVoiceStatus();
  }, []);

  const fetchCalls = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calls`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCalls(data);
      }
    } catch (error) {
      console.error('Error fetching calls:', error);
    }
  };

  const fetchVoiceProfiles = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/voice-profiles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVoiceProfiles(data);
      }
    } catch (error) {
      console.error('Error fetching voice profiles:', error);
    }
  };

  const fetchVoiceStatus = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/voice/status`);
      if (response.ok) {
        const data = await response.json();
        setVoiceStatus(data);
      }
    } catch (error) {
      console.error('Error fetching voice status:', error);
    }
  };

  const createCall = async () => {
    if (!newCallEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calls`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          receiver_email: newCallEmail,
          call_type: 'voice_clone'
        })
      });

      if (response.ok) {
        const call = await response.json();
        toast.success('Call created! Redirecting to call interface...');
        navigate(`/call/${call.room_id}`);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create call');
      }
    } catch (error) {
      console.error('Error creating call:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const joinCall = async (roomId) => {
    navigate(`/call/${roomId}`);
  };

  const createVoiceProfile = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/voice-profiles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Default Voice Profile',
          voice_data: {
            model: 'nova',
            voice: 'alloy',
            response_format: 'pcm16',
            instructions: 'You are a helpful assistant that speaks clearly and naturally.'
          }
        })
      });

      if (response.ok) {
        toast.success('Voice profile created!');
        fetchVoiceProfiles();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create voice profile');
      }
    } catch (error) {
      console.error('Error creating voice profile:', error);
      toast.error('Network error. Please try again.');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      waiting: { color: 'bg-yellow-500', text: 'Waiting' },
      active: { color: 'bg-green-500', text: 'Active' },
      ended: { color: 'bg-gray-500', text: 'Ended' }
    };

    const config = statusConfig[status] || statusConfig.waiting;
    return (
      <Badge className={`${config.color} text-white`}>
        {config.text}
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="glass-dark border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Mic className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h1 data-testid="dashboard-title" className="text-2xl font-bold text-gradient font-['Space_Grotesk']">
                  VoiceMirror Pro
                </h1>
                <p className="text-sm text-slate-400">Welcome back, {user?.username}!</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {voiceStatus.elevenlabs_available && (
                <Badge className="bg-emerald-500/20 text-emerald-400 px-3 py-1">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Voice Ready
                </Badge>
              )}
              
              <Button
                onClick={logout}
                className="btn-secondary flex items-center gap-2"
                data-testid="logout-button"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Main Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 glass rounded-2xl p-2 mb-8">
            <TabsTrigger value="dashboard" className="rounded-xl" data-testid="dashboard-tab">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="voice-cloning" className="rounded-xl" data-testid="voice-cloning-tab">
              <Sparkles className="w-4 h-4 mr-2" />
              Voice Cloning
            </TabsTrigger>
            <TabsTrigger value="calls" className="rounded-xl" data-testid="calls-tab">
              <PhoneCall className="w-4 h-4 mr-2" />
              Calls
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl" data-testid="analytics-tab">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-8" data-testid="dashboard-content">
            {/* Hero Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="glass border-0 p-6 text-center">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Phone className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold" data-testid="total-calls-stat">{calls.length}</h3>
                <p className="text-slate-400">Total Calls</p>
              </Card>
              
              <Card className="glass border-0 p-6 text-center">
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileAudio className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold" data-testid="voice-profiles-stat">{voiceProfiles.length}</h3>
                <p className="text-slate-400">Voice Profiles</p>
              </Card>
              
              <Card className="glass border-0 p-6 text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold" data-testid="active-calls-stat">
                  {calls.filter(call => call.status === 'active').length}
                </h3>
                <p className="text-slate-400">Active Calls</p>
              </Card>
              
              <Card className="glass border-0 p-6 text-center">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Waveform className="w-6 h-6 text-yellow-400" />
                </div>
                <h3 className="text-2xl font-bold">98%</h3>
                <p className="text-slate-400">Voice Quality</p>
              </Card>
            </div>
            
            {/* Quick Actions */}
            <div className="glass rounded-3xl p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Zap className="w-6 h-6 text-emerald-400" />
                Quick Actions
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Start Call */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Start Voice Call</h3>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label htmlFor="call-email" className="text-slate-200 mb-2 block">
                        Invite someone to a call
                      </Label>
                      <Input
                        id="call-email"
                        type="email"
                        value={newCallEmail}
                        onChange={(e) => setNewCallEmail(e.target.value)}
                        placeholder="Enter email address"
                        className="form-input"
                        data-testid="call-email-input"
                      />
                    </div>
                    <Button
                      onClick={createCall}
                      disabled={loading}
                      className="btn-primary mt-7 px-6"
                      data-testid="create-call-button"
                    >
                      {loading ? (
                        <div className="spinner"></div>
                      ) : (
                        <>
                          <Phone className="w-4 h-4 mr-2" />
                          Start Call
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Voice Cloning */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Voice Cloning</h3>
                  <div className="flex items-center justify-between p-4 glass-dark rounded-xl">
                    <div>
                      <p className="font-medium">Create Custom Voice</p>
                      <p className="text-sm text-slate-400">Upload samples and clone your voice</p>
                    </div>
                    <Button
                      onClick={() => setActiveTab('voice-cloning')}
                      className="btn-primary"
                      data-testid="go-to-voice-cloning"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Clone Voice
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Calls */}
              <Card className="glass border-0 p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-slate-400" />
                  Recent Calls
                </h3>
                
                {calls.slice(0, 3).length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No recent calls</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {calls.slice(0, 3).map((call) => (
                      <div key={call.id} className="flex items-center justify-between p-3 glass-dark rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Phone className="w-4 h-4 text-blue-400" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {call.caller_id === user?.id ? 'Outgoing' : 'Incoming'}
                            </p>
                            <p className="text-xs text-slate-400">{formatDate(call.created_at)}</p>
                          </div>
                        </div>
                        {getStatusBadge(call.status)}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              
              {/* Voice Profiles */}
              <Card className="glass border-0 p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-slate-400" />
                  Voice Profiles
                </h3>
                
                {voiceProfiles.slice(0, 3).length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No voice profiles</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {voiceProfiles.slice(0, 3).map((profile) => (
                      <div key={profile.id} className="flex items-center justify-between p-3 glass-dark rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-white">
                              {profile.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-sm">{profile.name}</p>
                            <p className="text-xs text-slate-400">
                              {profile.samples_count} samples
                            </p>
                          </div>
                        </div>
                        <Badge className={`${
                          profile.training_status === 'ready' ? 'bg-green-500/20 text-green-400' :
                          profile.training_status === 'training' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {profile.training_status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Voice Cloning Tab */}
          <TabsContent value="voice-cloning" data-testid="voice-cloning-content">
            <VoiceCloning />
          </TabsContent>

          {/* Calls Tab */}
          <TabsContent value="calls" className="space-y-6" data-testid="calls-content">
            <Card className="glass border-0 p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <PhoneCall className="w-6 h-6 text-blue-400" />
                Call History
              </h2>
              
              <div className="space-y-4">
                {calls.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No calls yet. Start your first voice call!</p>
                  </div>
                ) : (
                  calls.map((call) => (
                    <Card key={call.id} className="glass-dark border-0 p-4 card-hover">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-blue-500/20 rounded-full">
                            <Phone className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold">
                              {call.caller_id === user?.id ? 'Outgoing Call' : 'Incoming Call'}
                            </h3>
                            <p className="text-sm text-slate-400 flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              {formatDate(call.created_at)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {getStatusBadge(call.status)}
                          {call.status === 'active' || call.status === 'waiting' ? (
                            <Button
                              onClick={() => joinCall(call.room_id)}
                              className="btn-primary px-4 py-2"
                              data-testid={`join-call-${call.id}`}
                            >
                              Join
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6" data-testid="analytics-content">
            <Card className="glass border-0 p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-slate-400" />
                Voice Analytics
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Usage Stats */}
                <Card className="glass-dark border-0 p-6">
                  <h3 className="text-lg font-semibold mb-4">Usage Statistics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Calls</span>
                      <span className="font-semibold">{calls.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Voice Profiles</span>
                      <span className="font-semibold">{voiceProfiles.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Active Sessions</span>
                      <span className="font-semibold text-emerald-400">
                        {calls.filter(call => call.status === 'active').length}
                      </span>
                    </div>
                  </div>
                </Card>
                
                {/* Voice Quality */}
                <Card className="glass-dark border-0 p-6">
                  <h3 className="text-lg font-semibold mb-4">Voice Quality</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Clarity Score</span>
                      <span className="font-semibold text-green-400">98%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Similarity</span>
                      <span className="font-semibold text-green-400">96%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Naturalness</span>
                      <span className="font-semibold text-green-400">94%</span>
                    </div>
                  </div>
                </Card>
                
                {/* Performance */}
                <Card className="glass-dark border-0 p-6">
                  <h3 className="text-lg font-semibold mb-4">Performance</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Avg Response</span>
                      <span className="font-semibold text-blue-400">1.2s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Success Rate</span>
                      <span className="font-semibold text-green-400">99.7%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Uptime</span>
                      <span className="font-semibold text-green-400">99.9%</span>
                    </div>
                  </div>
                </Card>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EnhancedDashboard;
