export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  publishedAt: string;
}

export class YouTubeService {
  private static getApiKey(): string | null {
    const local = localStorage.getItem('helix_youtube_api_key');
    if (local) return local;

    // Fallback to environment variable
    return import.meta.env.VITE_YOUTUBE_API_KEY || null;
  }

  public static setApiKey(key: string) {
    localStorage.setItem('helix_youtube_api_key', key.trim());
  }
  
  public static hasApiKey(): boolean {
    return !!this.getApiKey();
  }

  public static async searchStudyVideos(query: string, maxResults: number = 6): Promise<YouTubeVideo[]> {
    const apiKey = this.getApiKey();
    
    if (!apiKey) {
      throw new Error("YouTube API Key not configured. Please add it to .env.local or settings.");
    }

    try {
      // We append "tutorial" or "lecture" or "course" to push for educational content
      const searchQuery = encodeURIComponent(`${query} tutorial OR lecture`);
      
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${maxResults}&q=${searchQuery}&type=video&videoEmbeddable=true&key=${apiKey}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `YouTube API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.items) return [];

      return data.items.map((item: any) => ({
        id: item.id.videoId,
        title: this.decodeHtml(item.snippet.title),
        description: item.snippet.description,
        thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt
      }));
    } catch (error) {
      console.error("YouTube search failed:", error);
      throw error;
    }
  }

  private static decodeHtml(html: string): string {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  }
}
