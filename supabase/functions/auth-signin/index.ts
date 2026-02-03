import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { identifier, password, deviceInfo } = await req.json();

    // Validate input
    if (!identifier || typeof identifier !== 'string' || identifier.length > 255) {
      console.log('Invalid identifier provided');
      return new Response(
        JSON.stringify({ error: 'Invalid email or username' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      console.log('Invalid password provided');
      return new Response(
        JSON.stringify({ error: 'Invalid password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for profile lookup
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const trimmedIdentifier = identifier.trim();
    const isEmail = trimmedIdentifier.includes('@');
    let emailToUse = trimmedIdentifier;

    console.log(`Login attempt - isEmail: ${isEmail}, identifier: ${trimmedIdentifier}`);

    // If not an email, look up the username in profiles
    if (!isEmail) {
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .ilike('username', trimmedIdentifier)
        .maybeSingle();

      if (profileError) {
        console.error('Profile lookup error:', profileError);
        return new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!profileData?.email) {
        console.log('Username not found in profiles');
        return new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      emailToUse = profileData.email;
      console.log('Found email for username');
    }

    // Sign in with the resolved email
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    if (authError) {
      console.error('Auth error:', authError.message);
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Login successful for user:', authData.user?.id);

    // Record login history
    if (authData.user?.id && deviceInfo) {
      try {
        // Clear previous current session flags
        await supabaseAdmin
          .from('login_history')
          .update({ is_current_session: false })
          .eq('user_id', authData.user.id);

        // Insert new login record
        await supabaseAdmin
          .from('login_history')
          .insert({
            user_id: authData.user.id,
            device_info: deviceInfo.device || 'Unknown',
            browser: deviceInfo.browser || 'Unknown',
            os: deviceInfo.os || 'Unknown',
            ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'Unknown',
            is_current_session: true
          });
        
        console.log('Login history recorded');
      } catch (historyError) {
        console.error('Error recording login history:', historyError);
        // Don't fail the login if history recording fails
      }
    }

    // Return session tokens
    return new Response(
      JSON.stringify({
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
        user: authData.user,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
