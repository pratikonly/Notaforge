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

    // Fetch accurate counts AND per-type byte sizes via Search API (sums via aggregation)
    const searchByType = async (type: 'image' | 'video' | 'raw') => {
      let totalCount = 0;
      let totalBytes = 0;
      let nextCursor: string | undefined;
      // Paginate to sum bytes (Cloudinary search returns max 500 per page)
      do {
        const body: Record<string, unknown> = {
          expression: `resource_type:${type}`,
          max_results: 500,
          fields: ['bytes'],
        };
        if (nextCursor) body.next_cursor = nextCursor;
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${credentials}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          }
        );
        if (!res.ok) break;
        const data = await res.json();
        totalCount = data.total_count ?? totalCount;
        for (const r of (data.resources ?? [])) totalBytes += r.bytes ?? 0;
        nextCursor = data.next_cursor;
      } while (nextCursor);
      return { count: totalCount, bytes: totalBytes };
    };

    const [imageStats, videoStats, rawStats] = await Promise.all([
      searchByType('image'),
      searchByType('video'),
      searchByType('raw'),
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
        images: imageStats.count,
        videos: videoStats.count,
        raw: rawStats.count,
      },
      bytes_by_type: {
        images: imageStats.bytes,
        videos: videoStats.bytes,
        raw: rawStats.bytes,
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
