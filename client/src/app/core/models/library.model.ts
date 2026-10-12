export interface LibraryResponse {
  id: string;
  parentLibraryId?: string | null;
  name: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  isOwner?: boolean;
  isShared?: boolean;
  ownerUserName?: string;
  ownerId?: string | null;
}

export interface LibraryTreeResponse {
  id: string;
  parentLibraryId?: string | null;
  name: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  children: LibraryTreeResponse[];
  notesCount?: number;
  isOwner?: boolean;
  isShared?: boolean;
  ownerUserName?: string;
  ownerId?: string | null;
}

export interface LibraryShareUserDto {
  userId: string;
  userName: string;
  sharedAtUtc: string;
}

export interface LibrarySharesResponse {
  libraryId: string;
  ownerId: string;
  ownerUserName: string;
  isOwner: boolean;
  shares: LibraryShareUserDto[];
}

export interface ShareLibraryRequest {
  userName?: string | null;
  userId?: string | null;
}

export interface CreateLibraryRequest {
  name: string;
  parentLibraryId?: string | null;
}

export interface RenameLibraryRequest {
  name: string;
}

export interface MoveLibraryRequest {
  newParentLibraryId?: string | null;
}

