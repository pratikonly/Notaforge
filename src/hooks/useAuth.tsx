import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
  signIn: (identifier: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        }
        
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Session error:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes (keep callback synchronous to avoid deadlocks)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log('Auth event:', event);
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username,
        },
      },
    });

    if (!error && data.session) {
      setSession(data.session);
      setUser(data.session.user);

      // Ensure profile exists for username login
      await supabase
        .from('profiles')
        .upsert(
          {
            user_id: data.session.user.id,
            username,
            email,
          },
          { onConflict: 'user_id' }
        );
    }

    return { error: error as Error | null };
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    try {
      // Get device info for login history
      const userAgent = navigator.userAgent;
      const deviceInfo = {
        device: /Mobile|Android|iPhone|iPad/.test(userAgent) ? 'Mobile' : 'Desktop',
        browser: getBrowserName(userAgent),
        os: getOSName(userAgent),
      };

      // Use backend function to handle both email and username login
      const response = await supabase.functions.invoke('auth-signin', {
        body: { identifier: identifier.trim(), password, deviceInfo },
      });

      if (response.error) {
        console.error('Sign in function error:', response.error);
        return { error: new Error('Invalid email/username or password') };
      }

      const { access_token, refresh_token, error: responseError } = response.data;

      if (responseError) {
        return { error: new Error(responseError) };
      }

      if (!access_token || !refresh_token) {
        return { error: new Error('Invalid email/username or password') };
      }

      // Set the session with the tokens from the backend
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (sessionError) {
        console.error('Session error:', sessionError);
        return { error: new Error('Failed to establish session') };
      }

      return { error: null };
    } catch (err) {
      console.error('Sign in error:', err);
      return { error: new Error('An unexpected error occurred') };
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setSession(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Helper functions to parse user agent
function getBrowserName(ua: string): string {
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Opera')) return 'Opera';
  return 'Unknown';
}

function getOSName(ua: string): string {
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Unknown';
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
