import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Video, Users, Pencil, MessageSquare, Shield, Zap, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: Video,
    title: 'HD Video Conferencing',
    description: 'Crystal clear video calls with up to 100 participants',
  },
  {
    icon: Pencil,
    title: 'Air Drawing',
    description: 'Annotate in real-time using gesture recognition',
  },
  {
    icon: MessageSquare,
    title: 'Live Chat',
    description: 'Instant messaging with all participants',
  },
  {
    icon: Users,
    title: 'Collaboration',
    description: 'Work together seamlessly in real-time',
  },
  {
    icon: Shield,
    title: 'Secure Meetings',
    description: 'End-to-end encryption for all your sessions',
  },
  {
    icon: Zap,
    title: 'Low Latency',
    description: 'Ultra-fast connections for smooth interactions',
  },
];

export default function Index() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px]" style={{ background: 'var(--gradient-glow)' }} />

        {/* Navigation */}
        <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Video className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-display font-bold gradient-text">GestureLearn</span>
          </div>
          <Link to="/auth">
            <Button variant="glass">Sign In</Button>
          </Link>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-12 py-24 lg:py-32 text-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-sm text-muted-foreground">Now with AI-powered gesture recognition</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-display font-bold mb-6 leading-tight">
              Learn Together with{' '}
              <span className="gradient-text">Air Drawing</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
              The next-generation video conferencing platform that lets you annotate,
              draw, and collaborate in real-time using just your hand gestures.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button variant="gradient" size="xl" className="group">
                  Get Started Free
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              {/* <Button variant="glass" size="xl">
                Watch Demo
              </Button> */}
            </div>
          </div>

          {/* Preview Image */}
          <div className="mt-20 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="relative rounded-2xl overflow-hidden glass-strong p-1 glow-effect">
              <div className="aspect-video rounded-xl overflow-hidden bg-muted/50 flex items-center justify-center">
                <div className="grid grid-cols-2 gap-4 p-8 w-full max-w-3xl">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="video-tile">
                      <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-xl font-semibold text-primary">
                          {String.fromCharCode(64 + i)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section className="py-24 lg:py-32 px-6 lg:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-display font-bold mb-4">
              Everything you need to{' '}
              <span className="gradient-text">collaborate</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed for modern learning and collaboration
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="glass rounded-2xl p-6 card-hover animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                  <feature.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 lg:px-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="glass-strong rounded-3xl p-12 lg:p-16 relative overflow-hidden">
            <div className="absolute inset-0" style={{ background: 'var(--gradient-glow)' }} />
            <div className="relative z-10">
              <h2 className="text-3xl lg:text-4xl font-display font-bold mb-4">
                Ready to transform your learning experience?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join thousands of educators and students using GestureLearn today.
              </p>
              <Link to="/auth">
                <Button variant="gradient" size="xl" className="group">
                  Start for Free
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6 lg:px-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Video className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold gradient-text">GestureLearn</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 GestureLearn. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
