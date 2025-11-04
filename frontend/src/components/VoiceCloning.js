import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useAuth } from '../App';
import { toast } from 'sonner';
import {
  Mic,
  Upload,
  Play,
  Square,
  Download,
  Trash2,
  Copy,
  Settings,
  Volume2,
  Waves,
  Sparkles,
  Zap,
  User,
  FileAudio
} from 'lucide-react';

const VoiceCloning = () => {
  const [voices, setVoices] = useState([]);
  const [userVoices, setUserVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [activeTab, setActiveTab] = useState('clone');
  
  // Voice cloning state
  const [cloneData, setCloneData] = useState({
    name: '',
    description: '',
    files: []
  });
  
  // TTS state
  const [ttsData, setTtsData] = useState({
    text: '',
    voice_id: '',
    stability: 0.75,
    similarity_boost: 0.75,
    style: 0.0,
    use_speaker_boost: true
  });
  
  const [generatedAudio, setGeneratedAudio] = useState(null);
  const { token } = useAuth();

  useEffect(() => {
    fetchAvailableVoices();
    fetchUserVoices();
  }, []);

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
        setVoices(data.voices || []);
      } else {
        toast.error('Failed to fetch available voices');
      }
    } catch (error) {
      console.error('Error fetching voices:', error);
      toast.error('Network error fetching voices');
    }
  };

  const fetchUserVoices = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/voice-profiles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserVoices(data);
      }
    } catch (error) {
      console.error('Error fetching user voices:', error);
    }
  };

  // File drop handler
  const onDrop = useCallback((acceptedFiles) => {
    setCloneData(prev => ({
      ...prev,
      files: [...prev.files, ...acceptedFiles]
    }));
    toast.success(`${acceptedFiles.length} file(s) added`);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.flac']
    },
    maxFiles: 10
  });

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks(prev => [...prev, event.data]);
        }
      };
      
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };
      
      setMediaRecorder(recorder);
      recorder.start();
      setRecording(true);
      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setRecording(false);
      toast.success('Recording stopped');
    }
  };

  const saveRecording = () => {
    if (recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      const file = new File([blob], `recording_${Date.now()}.webm`, { type: 'audio/webm' });
      
      setCloneData(prev => ({
        ...prev,
        files: [...prev.files, file]
      }));
      
      setRecordedChunks([]);
      toast.success('Recording added to voice samples');
    }
  };

  // Voice cloning
  const cloneVoice = async () => {
    if (!cloneData.name.trim()) {
      toast.error('Please enter a voice name');
      return;
    }
    
    if (cloneData.files.length === 0) {
      toast.error('Please upload at least one audio sample');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('voice_name', cloneData.name);
      formData.append('description', cloneData.description || '');
      
      cloneData.files.forEach((file, index) => {
        formData.append('files', file);
      });

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/voices/clone`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Voice cloned successfully!');
        
        // Reset form
        setCloneData({ name: '', description: '', files: [] });
        
        // Refresh user voices
        await fetchUserVoices();
        
        // Switch to TTS tab
        setActiveTab('tts');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to clone voice');
      }
    } catch (error) {
      console.error('Error cloning voice:', error);
      toast.error('Network error during voice cloning');
    } finally {
      setLoading(false);
    }
  };

  // Text-to-Speech
  const generateTTS = async () => {
    if (!ttsData.text.trim()) {
      toast.error('Please enter text to synthesize');
      return;
    }
    
    if (!ttsData.voice_id) {
      toast.error('Please select a voice');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/tts/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ttsData)
      });

      if (response.ok) {
        const result = await response.json();
        setGeneratedAudio(result.audio_url);
        toast.success('Audio generated successfully!');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to generate audio');
      }
    } catch (error) {
      console.error('Error generating TTS:', error);
      toast.error('Network error during audio generation');
    } finally {
      setLoading(false);
    }
  };

  const removeFile = (index) => {
    setCloneData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  };

  const downloadAudio = () => {
    if (generatedAudio) {
      const link = document.createElement('a');
      link.href = generatedAudio;
      link.download = 'generated_speech.mp3';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gradient mb-4 font-['Space_Grotesk']" data-testid="voice-cloning-title">
          Advanced Voice Cloning
        </h1>
        <p className="text-lg text-slate-400 mb-6">
          Create realistic voice replicas and generate expressive speech synthesis
        </p>
        
        <div className="flex justify-center gap-4 mb-8">
          <Badge className="bg-emerald-500/20 text-emerald-400 px-4 py-2">
            <Sparkles className="w-4 h-4 mr-2" />
            AI-Powered Voice Cloning
          </Badge>
          <Badge className="bg-blue-500/20 text-blue-400 px-4 py-2">
            <Zap className="w-4 h-4 mr-2" />
            Real-time Synthesis
          </Badge>
          <Badge className="bg-purple-500/20 text-purple-400 px-4 py-2">
            <Waveform className="w-4 h-4 mr-2" />
            Natural Speech
          </Badge>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 glass rounded-2xl p-2">
          <TabsTrigger value="clone" className="rounded-xl" data-testid="clone-tab">
            <User className="w-4 h-4 mr-2" />
            Clone Voice
          </TabsTrigger>
          <TabsTrigger value="tts" className="rounded-xl" data-testid="tts-tab">
            <Volume2 className="w-4 h-4 mr-2" />
            Text-to-Speech
          </TabsTrigger>
          <TabsTrigger value="voices" className="rounded-xl" data-testid="voices-tab">
            <FileAudio className="w-4 h-4 mr-2" />
            My Voices
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl" data-testid="settings-tab">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Voice Cloning Tab */}
        <TabsContent value="clone" className="space-y-6" data-testid="clone-content">
          <Card className="glass border-0 p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <User className="w-6 h-6 text-emerald-400" />
              Create Voice Clone
            </h2>
            
            <div className="space-y-6">
              {/* Voice Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="voice-name" className="text-slate-200">Voice Name</Label>
                  <Input
                    id="voice-name"
                    value={cloneData.name}
                    onChange={(e) => setCloneData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter a name for your voice"
                    className="form-input mt-2"
                    data-testid="voice-name-input"
                  />
                </div>
                
                <div>
                  <Label htmlFor="voice-description" className="text-slate-200">Description (Optional)</Label>
                  <Input
                    id="voice-description"
                    value={cloneData.description}
                    onChange={(e) => setCloneData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the voice characteristics"
                    className="form-input mt-2"
                    data-testid="voice-description-input"
                  />
                </div>
              </div>
              
              {/* File Upload */}
              <div>
                <Label className="text-slate-200 mb-4 block">Upload Voice Samples (10-30 seconds each)</Label>
                
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    isDragActive
                      ? 'border-emerald-400 bg-emerald-500/10'
                      : 'border-slate-600 hover:border-slate-500'
                  }`}
                  data-testid="file-drop-zone"
                >
                  <input {...getInputProps()} />
                  <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-lg font-semibold text-slate-300 mb-2">
                    {isDragActive ? 'Drop files here' : 'Upload Audio Samples'}
                  </p>
                  <p className="text-slate-400">
                    Drag & drop audio files or click to browse
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    Supported: MP3, WAV, M4A, FLAC
                  </p>
                </div>
              </div>
              
              {/* Recording */}
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Record Voice Sample</h3>
                  <div className="flex items-center gap-2">
                    {!recording ? (
                      <Button
                        onClick={startRecording}
                        className="btn-secondary"
                        data-testid="start-recording"
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        Start Recording
                      </Button>
                    ) : (
                      <Button
                        onClick={stopRecording}
                        className="bg-red-500 hover:bg-red-600"
                        data-testid="stop-recording"
                      >
                        <Square className="w-4 h-4 mr-2" />
                        Stop Recording
                      </Button>
                    )}
                    
                    {recordedChunks.length > 0 && (
                      <Button
                        onClick={saveRecording}
                        className="btn-primary"
                        data-testid="save-recording"
                      >
                        Save Recording
                      </Button>
                    )}
                  </div>
                </div>
                
                {recording && (
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-red-400 font-medium">Recording in progress...</span>
                  </div>
                )}
              </div>
              
              {/* Uploaded Files */}
              {cloneData.files.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Uploaded Files ({cloneData.files.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cloneData.files.map((file, index) => (
                      <Card key={index} className="glass-dark border-0 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileAudio className="w-5 h-5 text-blue-400" />
                            <div>
                              <p className="font-medium text-sm truncate max-w-32">{file.name}</p>
                              <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <Button
                            onClick={() => removeFile(index)}
                            className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400"
                            data-testid={`remove-file-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Clone Button */}
              <Button
                onClick={cloneVoice}
                disabled={loading || !cloneData.name.trim() || cloneData.files.length === 0}
                className="w-full h-12 text-lg font-semibold btn-primary"
                data-testid="clone-voice-button"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="spinner"></div>
                    Cloning Voice...
                  </div>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Clone Voice
                  </>
                )}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Text-to-Speech Tab */}
        <TabsContent value="tts" className="space-y-6" data-testid="tts-content">
          <Card className="glass border-0 p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Volume2 className="w-6 h-6 text-blue-400" />
              Text-to-Speech Synthesis
            </h2>
            
            <div className="space-y-6">
              {/* Voice Selection */}
              <div>
                <Label className="text-slate-200 mb-4 block">Select Voice</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...userVoices, ...voices].map((voice) => (
                    <Card
                      key={voice.voice_id || voice.id}
                      className={`glass-dark border-0 p-4 cursor-pointer transition-all ${
                        ttsData.voice_id === (voice.voice_id || voice.id)
                          ? 'ring-2 ring-emerald-400 bg-emerald-500/10'
                          : 'hover:bg-white/5'
                      }`}
                      onClick={() => setTtsData(prev => ({ ...prev, voice_id: voice.voice_id || voice.id }))}
                      data-testid={`voice-${voice.voice_id || voice.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{voice.name}</h4>
                          <p className="text-sm text-slate-400">
                            {voice.user_id ? 'Custom Voice' : voice.category || 'Pre-built'}
                          </p>
                        </div>
                        {voice.user_id && (
                          <Badge className="bg-emerald-500/20 text-emerald-400">Mine</Badge>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
              
              {/* Text Input */}
              <div>
                <Label htmlFor="tts-text" className="text-slate-200 mb-2 block">Text to Synthesize</Label>
                <Textarea
                  id="tts-text"
                  value={ttsData.text}
                  onChange={(e) => setTtsData(prev => ({ ...prev, text: e.target.value }))}
                  placeholder="Enter the text you want to convert to speech..."
                  className="form-input min-h-32"
                  data-testid="tts-text-input"
                />
              </div>
              
              {/* Voice Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-slate-200 mb-2 block">Stability: {ttsData.stability.toFixed(2)}</Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={ttsData.stability}
                    onChange={(e) => setTtsData(prev => ({ ...prev, stability: parseFloat(e.target.value) }))}
                    className="w-full accent-emerald-400"
                    data-testid="stability-slider"
                  />
                </div>
                
                <div>
                  <Label className="text-slate-200 mb-2 block">Similarity: {ttsData.similarity_boost.toFixed(2)}</Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={ttsData.similarity_boost}
                    onChange={(e) => setTtsData(prev => ({ ...prev, similarity_boost: parseFloat(e.target.value) }))}
                    className="w-full accent-emerald-400"
                    data-testid="similarity-slider"
                  />
                </div>
                
                <div>
                  <Label className="text-slate-200 mb-2 block">Style: {ttsData.style.toFixed(2)}</Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={ttsData.style}
                    onChange={(e) => setTtsData(prev => ({ ...prev, style: parseFloat(e.target.value) }))}
                    className="w-full accent-emerald-400"
                    data-testid="style-slider"
                  />
                </div>
              </div>
              
              {/* Generate Button */}
              <Button
                onClick={generateTTS}
                disabled={loading || !ttsData.text.trim() || !ttsData.voice_id}
                className="w-full h-12 text-lg font-semibold btn-primary"
                data-testid="generate-tts-button"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="spinner"></div>
                    Generating Speech...
                  </div>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    Generate Speech
                  </>
                )}
              </Button>
              
              {/* Generated Audio */}
              {generatedAudio && (
                <Card className="glass-dark border-0 p-6">
                  <h3 className="text-lg font-semibold mb-4">Generated Audio</h3>
                  <div className="space-y-4">
                    <audio controls className="w-full" data-testid="generated-audio">
                      <source src={generatedAudio} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                    
                    <div className="flex gap-4">
                      <Button
                        onClick={downloadAudio}
                        className="btn-secondary flex items-center gap-2"
                        data-testid="download-audio"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </Button>
                      
                      <Button
                        onClick={() => navigator.clipboard.writeText(generatedAudio)}
                        className="btn-secondary flex items-center gap-2"
                        data-testid="copy-audio-url"
                      >
                        <Copy className="w-4 h-4" />
                        Copy URL
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* My Voices Tab */}
        <TabsContent value="voices" className="space-y-6" data-testid="voices-content">
          <Card className="glass border-0 p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <FileAudio className="w-6 h-6 text-purple-400" />
              My Voice Collection
            </h2>
            
            {userVoices.length === 0 ? (
              <div className="text-center py-12">
                <FileAudio className="w-16 h-16 mx-auto mb-4 text-slate-400 opacity-50" />
                <p className="text-lg text-slate-400 mb-4">No custom voices yet</p>
                <p className="text-slate-500">Create your first voice clone to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userVoices.map((voice) => (
                  <Card key={voice.id} className="glass-dark border-0 p-6 card-hover">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl font-bold text-white">
                          {voice.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-semibold mb-2">{voice.name}</h3>
                      
                      <div className="space-y-2 mb-4">
                        <Badge className={`${
                          voice.training_status === 'ready' ? 'bg-green-500/20 text-green-400' :
                          voice.training_status === 'training' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {voice.training_status.charAt(0).toUpperCase() + voice.training_status.slice(1)}
                        </Badge>
                        
                        <p className="text-sm text-slate-400">
                          {voice.samples_count} sample{voice.samples_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setTtsData(prev => ({ ...prev, voice_id: voice.voice_id || voice.id }))}
                          className="btn-primary flex-1"
                          data-testid={`use-voice-${voice.id}`}
                        >
                          Use Voice
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6" data-testid="settings-content">
          <Card className="glass border-0 p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Settings className="w-6 h-6 text-slate-400" />
              Voice Cloning Settings
            </h2>
            
            <div className="space-y-6">
              <div className="glass rounded-2xl p-4">
                <h3 className="text-lg font-semibold mb-4">Recording Quality</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Sample Rate</span>
                    <Badge className="bg-blue-500/20 text-blue-400">48kHz</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Bit Depth</span>
                    <Badge className="bg-blue-500/20 text-blue-400">16-bit</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Channels</span>
                    <Badge className="bg-blue-500/20 text-blue-400">Mono</Badge>
                  </div>
                </div>
              </div>
              
              <div className="glass rounded-2xl p-4">
                <h3 className="text-lg font-semibold mb-4">Voice Training</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Minimum Samples</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400">3 files</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Recommended Duration</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400">10-30 seconds</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Processing Time</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400">~2 minutes</Badge>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VoiceCloning;
