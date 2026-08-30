import type { IncomingMessage, ServerResponse } from 'http';

// Interface for extended Node HTTP response in serverless environments
interface ServerlessResponse extends ServerResponse {
  status?: (code: number) => ServerlessResponse;
  json?: (body: any) => void;
  send?: (body: any) => void;
}

interface ServerlessRequest extends IncomingMessage {
  body?: any;
  query?: Record<string, string | string[]>;
  method?: string;
  url?: string;
}

/**
 * Vercel Serverless Function Handler for GET /api/youtube/search
 */
export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  // Always ensure JSON response
  res.setHeader('Content-Type', 'application/json');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 200;
    res.end();
    return;
  }

  // Enforce GET method
  if (req.method !== 'GET') {
    res.statusCode = 405;
    const errorBody = JSON.stringify({ error: 'Method Not Allowed. Use GET.' });
    if (typeof res.json === 'function') {
      res.json({ error: 'Method Not Allowed. Use GET.' });
    } else {
      res.end(errorBody);
    }
    return;
  }

  try {
    // Parse query params from URL if not already populated on req.query
    const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const query = (req.query?.query as string) || urlObj.searchParams.get('query') || '';
    const maxResultsParam = (req.query?.maxResults as string) || urlObj.searchParams.get('maxResults') || '6';
    const maxResults = Math.min(Math.max(parseInt(maxResultsParam, 10) || 6, 1), 20);

    if (!query.trim()) {
      res.statusCode = 200;
      const emptyPayload = { results: [] };
      if (typeof res.json === 'function') {
        res.json(emptyPayload);
      } else {
        res.end(JSON.stringify(emptyPayload));
      }
      return;
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      res.statusCode = 503;
      const noKeyPayload = {
        error: 'YouTube API Key is not configured on the server environment.',
        results: [],
      };
      if (typeof res.json === 'function') {
        res.json(noKeyPayload);
      } else {
        res.end(JSON.stringify(noKeyPayload));
      }
      return;
    }

    const searchQuery = encodeURIComponent(`${query} tutorial OR lecture`);
    const googleApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${maxResults}&q=${searchQuery}&type=video&videoEmbeddable=true&key=${apiKey}`;

    const googleRes = await fetch(googleApiUrl);

    if (!googleRes.ok) {
      const errorJson: any = await googleRes.json().catch(() => ({}));
      const errorMessage = errorJson?.error?.message || `YouTube API error: ${googleRes.status}`;
      console.warn('[YouTube API Search] Google API responded with error:', errorMessage);

      res.statusCode = googleRes.status >= 400 && googleRes.status < 600 ? googleRes.status : 500;
      const errResponse = { error: errorMessage, results: [] };
      if (typeof res.json === 'function') {
        res.json(errResponse);
      } else {
        res.end(JSON.stringify(errResponse));
      }
      return;
    }

    const data: any = await googleRes.json();
    const items = data.items || [];

    const videos = items.map((item: any) => ({
      id: item.id?.videoId || item.etag,
      title: item.snippet?.title || 'Educational Lecture',
      description: item.snippet?.description || '',
      channelTitle: item.snippet?.channelTitle || 'University Education',
      channelName: item.snippet?.channelTitle || 'University Education',
      thumbnailUrl:
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        '',
      publishedAt: item.snippet?.publishedAt || '',
      url: item.id?.videoId
        ? `https://www.youtube.com/watch?v=${item.id.videoId}`
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    }));

    res.statusCode = 200;
    const successPayload = { results: videos };
    if (typeof res.json === 'function') {
      res.json(successPayload);
    } else {
      res.end(JSON.stringify(successPayload));
    }
  } catch (error: any) {
    console.error('[Vercel API /youtube/search] Execution error:', error);
    res.statusCode = 500;
    const errorPayload = {
      error: error.message || 'Internal server error while searching YouTube videos.',
      results: [],
    };
    if (typeof res.json === 'function') {
      res.json(errorPayload);
    } else {
      res.end(JSON.stringify(errorPayload));
    }
  }
}
