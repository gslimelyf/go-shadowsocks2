import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card } from './ui/card';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { Mic, Phone, Users, Zap } from 'lucide-react';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin 
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        login({
          id: data.id,
          username: data.username,
          email: data.email,
          voice_profile_id: data.voice_profile_id
        }, data.token);
        toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
      } else {
        toast.error(data.detail || 'Authentication failed');
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-pattern opacity-20"></div>
      
      {/* Floating Elements */}
      <div className="absolute top-20 left-10 w-20 h-20 bg-emerald-500/20 rounded-full blur-xl animate-float"></div>
      <div className="absolute top-40 right-20 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl animate-float" style={{animationDelay: '1s'}}></div>
      <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-purple-500/20 rounded-full blur-xl animate-float" style={{animationDelay: '2s'}}></div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center justify-center min-h-screen gap-12">
          
          {/* Hero Section */}
          <div className="flex-1 max-w-2xl text-center lg:text-left">
            <div className="mb-8">
              <div className="inline-flex items-center gap-3 mb-6">
                <div className="p-3 bg-emerald-500/20 rounded-full">
                  <Mic className="w-8 h-8 text-emerald-400" />
                </div>
                <h1 data-testid="app-title" className="text-5xl lg:text-7xl font-bold text-gradient font-['Space_Grotesk']">
                  VoiceMirror
                </h1>
              </div>
              
              <p className="text-xl lg:text-2xl text-slate-300 mb-8 leading-relaxed">
                Experience the future of communication with real-time voice cloning and live call streaming
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="flex flex-col items-center p-6 glass rounded-2xl">
                  <Phone className="w-8 h-8 text-emerald-400 mb-3" />
                  <h3 className="font-semibold text-lg mb-2">Live Calls</h3>
                  <p className="text-sm text-slate-400 text-center">Make real-time voice calls with instant cloning</p>
                </div>
                
                <div className="flex flex-col items-center p-6 glass rounded-2xl">
                  <Zap className="w-8 h-8 text-blue-400 mb-3" />
                  <h3 className="font-semibold text-lg mb-2">AI-Powered</h3>
                  <p className="text-sm text-slate-400 text-center">Advanced AI technology for perfect voice synthesis</p>
                </div>
                
                <div className="flex flex-col items-center p-6 glass rounded-2xl">
                  <Users className="w-8 h-8 text-purple-400 mb-3" />
                  <h3 className="font-semibold text-lg mb-2">Multi-User</h3>
                  <p className="text-sm text-slate-400 text-center">Connect with friends and colleagues seamlessly</p>
                </div>
              </div>
            </div>
          </div>

          {/* Auth Form */}
          <div className="flex-1 max-w-md w-full">
            <Card className="glass-dark border-0 rounded-3xl overflow-hidden">
              <div className="p-8">
                <div className="text-center mb-8">
                  <h2 data-testid="auth-title" className="text-3xl font-bold mb-2">
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                  </h2>
                  <p className="text-slate-400">
                    {isLogin ? 'Sign in to your account' : 'Join VoiceMirror today'}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {!isLogin && (
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-slate-200">Username</Label>
                      <Input
                        id="username"
                        name="username"
                        type="text"
                        value={formData.username}
                        onChange={handleInputChange}
                        className="form-input h-12 text-lg"
                        placeholder="Enter your username"
                        data-testid="username-input"
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-200">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="form-input h-12 text-lg"
                      placeholder="Enter your email"
                      data-testid="email-input"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-200">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="form-input h-12 text-lg"
                      placeholder="Enter your password"
                      data-testid="password-input"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 text-lg font-semibold btn-primary rounded-xl"
                    data-testid="auth-submit-button"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="spinner"></div>
                        {isLogin ? 'Signing in...' : 'Creating account...'}
                      </div>
                    ) : (
                      isLogin ? 'Sign In' : 'Create Account'
                    )}
                  </Button>
                </form>

                <div className="mt-8 text-center">
                  <p className="text-slate-400">
                    {isLogin ? "Don't have an account?" : 'Already have an account?'}
                  </p>
                  <Button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="mt-2 text-emerald-400 hover:text-emerald-300 font-semibold bg-transparent border-0 p-0 h-auto"
                    data-testid="toggle-auth-mode"
                  >
                    {isLogin ? 'Create new account' : 'Sign in instead'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
