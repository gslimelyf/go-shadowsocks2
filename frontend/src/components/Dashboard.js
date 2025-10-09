import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { useAuth } from '../App';
import { toast } from 'sonner';
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
  Volume2
} from 'lucide-react';

const Dashboard = () => {
  const [calls, setCalls] = useState([]);
  const [voiceProfiles, setVoiceProfiles] = useState([]);
  const [newCallEmail, setNewCallEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('calls');
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCalls();
    fetchVoiceProfiles();
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
                  VoiceMirror
                </h1>
                <p className="text-sm text-slate-400">Welcome back, {user?.username}!</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Quick Actions */}
            <div className="glass rounded-3xl p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Zap className="w-6 h-6 text-emerald-400" />
                Quick Actions
              </h2>
              
              <div className="space-y-4">
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
            </div>

            {/* Tabs */}
            <div className="glass rounded-3xl overflow-hidden">
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setActiveTab('calls')}
                  className={`px-6 py-4 font-semibold transition-colors ${
                    activeTab === 'calls'
                      ? 'bg-emerald-500/20 text-emerald-400 border-b-2 border-emerald-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  data-testid="calls-tab"
                >
                  <PhoneCall className="w-4 h-4 mr-2 inline" />
                  Recent Calls
                </button>
                <button
                  onClick={() => setActiveTab('profiles')}
                  className={`px-6 py-4 font-semibold transition-colors ${
                    activeTab === 'profiles'
                      ? 'bg-emerald-500/20 text-emerald-400 border-b-2 border-emerald-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  data-testid="profiles-tab"
                >
                  <Volume2 className="w-4 h-4 mr-2 inline" />
                  Voice Profiles
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'calls' && (
                  <div className="space-y-4" data-testid="calls-list">
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
                )}

                {activeTab === 'profiles' && (
                  <div className="space-y-4" data-testid="voice-profiles-list">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Your Voice Profiles</h3>
                      <Button
                        onClick={createVoiceProfile}
                        className="btn-secondary flex items-center gap-2"
                        data-testid="create-voice-profile"
                      >
                        <Plus className="w-4 h-4" />
                        Create Profile
                      </Button>
                    </div>
                    
                    {voiceProfiles.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Volume2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No voice profiles yet. Create your first one!</p>
                      </div>
                    ) : (
                      voiceProfiles.map((profile) => (
                        <Card key={profile.id} className="glass-dark border-0 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-purple-500/20 rounded-full">
                                <Volume2 className="w-5 h-5 text-purple-400" />
                              </div>
                              <div>
                                <h3 className="font-semibold">{profile.name}</h3>
                                <p className="text-sm text-slate-400">
                                  Voice: {profile.voice_data.voice || 'Default'}
                                </p>
                              </div>
                            </div>
                            
                            <Badge className="bg-emerald-500/20 text-emerald-400">
                              {profile.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* User Profile */}
            <Card className="glass border-0 p-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-1" data-testid="user-name">{user?.username}</h3>
                <p className="text-slate-400 text-sm" data-testid="user-email">{user?.email}</p>
                
                <div className="mt-4 flex items-center justify-center gap-2">
                  <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-emerald-400 font-medium">Online</span>
                </div>
              </div>
            </Card>

            {/* Stats */}
            <Card className="glass border-0 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-400" />
                Statistics
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Total Calls</span>
                  <span className="font-semibold" data-testid="total-calls">{calls.length}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Voice Profiles</span>
                  <span className="font-semibold" data-testid="total-profiles">{voiceProfiles.length}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Active Calls</span>
                  <span className="font-semibold text-emerald-400" data-testid="active-calls">
                    {calls.filter(call => call.status === 'active').length}
                  </span>
                </div>
              </div>
            </Card>

            {/* Quick Tips */}
            <Card className="glass border-0 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-400" />
                Quick Tips
              </h3>
              
              <div className="space-y-3 text-sm text-slate-400">
                <p>• Create voice profiles for different scenarios</p>
                <p>• Share your email with others to receive calls</p>
                <p>• Use high-quality microphone for best results</p>
                <p>• Test your voice settings before important calls</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
