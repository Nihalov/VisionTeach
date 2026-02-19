  import { useState } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { useAuth } from '@/hooks/useAuth';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Video, Users, LogOut } from 'lucide-react';
  import { api } from "@/services/api";
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from '@/components/ui/dialog';

  export default function Home() {
    const [joinMeetingId, setJoinMeetingId] = useState('');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [joinLoading, setJoinLoading] = useState(false);
    const [error, setError] = useState('');

    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const API_URL = import.meta.env.VITE_API_URL as string;
    const getToken = () => localStorage.getItem('token');

    // Using axios `api` instance; check HTTP status codes on the axios response

    const handleCreateMeeting = async () => {
      setError('');
      if (!getToken()) {
        setError('You must be logged in to create a meeting');
        navigate('/auth');
        return;
      }

      setCreateLoading(true);
      try {
        const res = await api.post("/api/rooms/create", {}, {
          headers: {
            Authorization: `Bearer ${getToken()}`
          }
        });
        const data = res.data;

        if (res.status < 200 || res.status >= 300) throw new Error(data?.message || `Failed to create meeting (status ${res.status})`);

        const rid = data.roomId || (data.room && data.room.roomId) || data._id || data.id;
        if (!rid) throw new Error('Invalid room data from server');

        setIsCreateDialogOpen(false);
        navigate(`/meeting?meetingId=${rid}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create meeting');
      } finally {
        setCreateLoading(false);
      }
    };

    const handleJoinMeeting = async () => {
      setError('');
      if (!joinMeetingId.trim()) {
        setError('Please enter a meeting ID');
        return;
      }
      if (!getToken()) {
        setError('You must be logged in to join a meeting');
        navigate('/auth');
        return;
      }

      setJoinLoading(true);
      try {
        const res = await api.get(`/api/rooms/join/${joinMeetingId}`, {
          headers: {
            Authorization: `Bearer ${getToken()}`
          }
        });
        const data = res.data;

        if (res.status < 200 || res.status >= 300) throw new Error(data?.message || `Room not found (status ${res.status})`);

        setIsJoinDialogOpen(false);
        setJoinMeetingId('');
        const rid = data.roomId || (data.room && data.room.roomId) || data._id || data.id || joinMeetingId;
        navigate(`/meeting?meetingId=${rid}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join meeting');
      } finally {
        setJoinLoading(false);
      }
    };

    const handleLogout = () => {
      logout();
      navigate('/');
    };

    return (
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 glass-strong border-b border-border z-40">
          <h1 className="text-2xl font-display font-bold gradient-text">GestureLearn</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-10 w-10"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl animate-fade-in">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-display font-bold mb-4 text-foreground">
                Welcome back, <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Start a new meeting or join an existing one
              </p>
              {error && (
                <div className="mt-6 bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm mx-auto max-w-md">
                  {error}
                </div>
              )}
            </div>

            {/* Action Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Create Meeting Card */}
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <div className="glass rounded-2xl p-8 cursor-pointer card-hover transition-all hover:border-primary/50 border border-transparent group">
                    <div className="flex flex-col items-center text-center">
                      <div className="p-4 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors mb-6">
                        <Video className="w-10 h-10 text-primary" />
                      </div>
                      <h3 className="text-2xl font-semibold text-foreground mb-2">
                        Create Meeting
                      </h3>
                      <p className="text-muted-foreground mb-6">
                        Start a new meeting and invite others to join
                      </p>
                      <Button variant="default" className="w-full">
                        Create
                      </Button>
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Meeting</DialogTitle>
                    <DialogDescription>
                      A new meeting will be created and you'll be redirected to it.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      onClick={handleCreateMeeting}
                      className="flex-1"
                    >
                      Create & Continue
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Join Meeting Card */}
              <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
                <DialogTrigger asChild>
                  <div className="glass rounded-2xl p-8 cursor-pointer card-hover transition-all hover:border-accent/50 border border-transparent group">
                    <div className="flex flex-col items-center text-center">
                      <div className="p-4 rounded-xl bg-accent/10 group-hover:bg-accent/20 transition-colors mb-6">
                        <Users className="w-10 h-10 text-accent" />
                      </div>
                      <h3 className="text-2xl font-semibold text-foreground mb-2">
                        Join Meeting
                      </h3>
                      <p className="text-muted-foreground mb-6">
                        Enter a meeting ID to join an existing meeting
                      </p>
                      <Button variant="outline" className="w-full">
                        Join
                      </Button>
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Join Meeting</DialogTitle>
                    <DialogDescription>
                      Enter the meeting ID you want to join
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Enter meeting ID"
                      value={joinMeetingId}
                      onChange={(e) => setJoinMeetingId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleJoinMeeting();
                        }
                      }}
                    />
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setIsJoinDialogOpen(false)}
                        className="flex-1"
                        disabled={joinLoading}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="default"
                        onClick={handleJoinMeeting}
                        className="flex-1"
                        disabled={joinLoading || !joinMeetingId.trim()}
                      >
                        {joinLoading ? (
                          <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full mx-auto animate-spin" />
                        ) : (
                          'Join'
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Info Section */}
            <div className="glass rounded-2xl p-8">
              <h3 className="text-lg font-semibold text-foreground mb-4">Getting Started</h3>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    1
                  </div>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Create a meeting</span> to start collaborating with others
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    2
                  </div>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Share the meeting ID</span> with participants
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    3
                  </div>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Use air drawing</span> with hand gestures to annotate
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
