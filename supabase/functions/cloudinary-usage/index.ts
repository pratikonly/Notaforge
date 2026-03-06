import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CLOUDINARY_API_KEY = Deno.env.get('CLOUDINARY_API_KEY');
    const CLOUDINARY_API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET');
    const CLOUD_NAME = 'dilt6tl9q';

    if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary credentials not configured');
    }

    const credentials = btoa(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`);

    // Fetch usage stats
    const usageRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/usage`,
      {
        headers: { 'Authorization': `Basic ${credentials}` },
      }
    );

    if (!usageRes.ok) {
      const errText = await usageRes.text();
      throw new Error(`Cloudinary API error [${usageRes.status}]: ${errText}`);
    }

    const usage = await usageRes.json();

    // Fetch resource counts by type
    const [imageRes, videoRes, rawRes] = await Promise.all([
      fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image?max_results=0`, {
        headers: { 'Authorization': `Basic ${credentials}` },
      }),
      fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/video?max_results=0`, {
        headers: { 'Authorization': `Basic ${credentials}` },
      }),
      fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/raw?max_results=0`, {
        headers: { 'Authorization': `Basic ${credentials}` },
      }),
    ]);

    const [imageData, videoData, rawData] = await Promise.all([
      imageRes.json(),
      videoRes.json(),
      rawRes.json(),
    ]);

    return new Response(JSON.stringify({
      storage: {
        used_bytes: usage.storage?.usage ?? 0,
        limit_bytes: usage.storage?.limit ?? 25 * 1024 * 1024 * 1024, // 25GB free
        used_percent: usage.storage?.used_percent ?? 0,
      },
      bandwidth: {
        used_bytes: usage.bandwidth?.usage ?? 0,
        limit_bytes: usage.bandwidth?.limit ?? 0,
      },
      resources: {
        images: imageData.total_count ?? imageData.resources?.length ?? 0,
        videos: videoData.total_count ?? videoData.resources?.length ?? 0,
        raw: rawData.total_count ?? rawData.resources?.length ?? 0,
      },
      plan: usage.plan ?? 'Free',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching Cloudinary usage:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
