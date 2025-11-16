// 첨부파일 타입
export interface Attachment {
  attachId: number;
  boardId: number;
  originalName: string;
  saveName: string;
  size: number;
  mimeType: string;
  createdAt: Date;
}

// 게시글 타입
export interface Board {
  boardId: number;
  boardType: string;
  title: string;
  content: string;
  viewCount: number;
  isImportant: boolean;
  author?: {
    userId: number;
    userNm: string;
  };
  attachments?: Attachment[];
  createdAt: Date;
  updatedAt: Date;
}

// 게시글 검색 파라미터
export interface BoardSearchParams {
  page?: number;
  limit?: number;
  keyword?: string;
  searchType?: 'title' | 'content' | 'author';
}
