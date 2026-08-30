import { AuthGuard, AUTH_REQUIRED_MESSAGE } from './authGuard';

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  publishedAt: string;
}

export class YouTubeService {
  private static getLocalApiKey(): string | null {
    const local = localStorage.getItem('helix_youtube_api_key');
    if (local && local.trim().length > 0) return local.trim();
    return import.meta.env.VITE_YOUTUBE_API_KEY || null;
  }

  public static setApiKey(key: string) {
    localStorage.setItem('helix_youtube_api_key', key.trim());
  }
  
  public static hasApiKey(): boolean {
    return true;
  }

  public static async searchStudyVideos(query: string, maxResults: number = 6): Promise<YouTubeVideo[]> {
    if (!query || !query.trim()) return [];

    // 1. Mandatory Centralized Authentication Check
    const auth = await AuthGuard.checkAuth();
    if (!auth.isAuthenticated) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }

    // 2. Client-side override if user provided their own key in Settings/LocalStorage
    const clientKey = this.getLocalApiKey();
    if (clientKey) {
      try {
        const searchQuery = encodeURIComponent(`${query} tutorial OR lecture`);
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${maxResults}&q=${searchQuery}&type=video&videoEmbeddable=true&key=${clientKey}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.items) {
            return data.items.map((item: any) => ({
              id: item.id?.videoId || item.etag,
              title: this.decodeHtml(item.snippet?.title || ''),
              description: item.snippet?.description || '',
              thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
              channelTitle: item.snippet?.channelTitle || '',
              publishedAt: item.snippet?.publishedAt || ''
            }));
          }
        }
      } catch (clientErr) {
        console.warn('[YouTubeService] Client direct key failed, falling back to server API:', clientErr);
      }
    }

    // 3. Default: Call secure server-side Vercel API endpoint
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(
        `${baseUrl}/api/youtube/search?query=${encodeURIComponent(query)}&maxResults=${maxResults}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `YouTube search failed: HTTP ${response.status}`);
      }

      const data = await response.json();
      const results: any[] = data.results || [];

      return results.map(item => ({
        id: item.id,
        title: this.decodeHtml(item.title || ''),
        description: item.description || '',
        thumbnailUrl: item.thumbnailUrl || '',
        channelTitle: item.channelTitle || item.channelName || '',
        publishedAt: item.publishedAt || ''
      }));
    } catch (error: any) {
      console.error('[YouTubeService] Search failed:', error);
      throw error;
    }
  }

  private static decodeHtml(html: string): string {
    if (typeof document === 'undefined') return html;
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  }
}
