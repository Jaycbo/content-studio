export interface ScrapedPost {
 id: string; creatorHandle: string; originalVideoUrl: string;
 soundUrl: string | null; soundName: string; viewCount: number;
 caption: string; publishedAt: string;
}
/** Provider collects public metadata only. Baselines and briefs stay provider-independent. */
export interface ScraperProvider {
 name: string;
 collect(url: string): Promise<ScrapedPost[]>;
}
