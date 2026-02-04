import { Outlet } from 'react-router-dom';
import { Link } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 text-primary-foreground">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary-foreground rounded-lg flex items-center justify-center">
              <span className="text-primary font-bold text-xl">AI</span>
            </div>
            <span className="font-bold text-2xl">Rank Tracker</span>
          </Link>
        </div>
        
        <div className="space-y-6">
          <h1 className="text-4xl font-bold">
            Track Your Brand Across AI Platforms
          </h1>
          <p className="text-lg text-primary-foreground/80">
            Monitor citations, analyze visibility, and optimize your content for 
            Google AI Overviews, Gemini, ChatGPT, Perplexity, and more.
          </p>
          
          <div className="flex gap-8 pt-4">
            <div>
              <div className="text-3xl font-bold">8+</div>
              <div className="text-sm text-primary-foreground/70">AI Platforms</div>
            </div>
            <div>
              <div className="text-3xl font-bold">Real-time</div>
              <div className="text-sm text-primary-foreground/70">Tracking</div>
            </div>
            <div>
              <div className="text-3xl font-bold">AI-Powered</div>
              <div className="text-sm text-primary-foreground/70">Insights</div>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-primary-foreground/60">
          © 2025 AI Rank Tracker. All rights reserved.
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">AI</span>
              </div>
              <span className="font-bold text-2xl">Rank Tracker</span>
            </Link>
          </div>
          
          <Outlet />
        </div>
      </div>
    </div>
  );
}
