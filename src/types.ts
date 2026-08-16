export interface MangaItem {
  id: string;
  title: string;
  translatedTitle?: string;
  description: string;
  coverUrl: string;
  status: string;
  tags: string[];
  year?: number;
  author?: string;
  artist?: string;
  /** 'manga' (JP) | 'manhwa' (KR) | 'manhua' (CN) | 'webtoon' | 'other' */
  origin?: string;
  /** Where this series was found/loaded from: MangaDex API or the Consumet MangaPill provider. */
  source?: 'mangadex' | 'mangapill';
}

export interface ChapterItem {
  id: string;
  title: string;
  chapterNumber: string;
  volume: string;
  pages: number;
  scanlationGroup?: string;
  publishAt: string;
  language: string;
  externalUrl?: string;
  /** Source of this chapter's content: MangaDex API or the Consumet MangaPill provider. */
  source?: 'mangadex' | 'mangapill';
}

export interface ChapterPagesData {
  chapterId: string;
  baseUrl: string;
  hash: string;
  pages: string[];
  dataSaverPages: string[];
}
