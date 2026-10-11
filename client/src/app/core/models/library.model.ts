export interface LibraryResponse {
  id: string;
  parentLibraryId?: string | null;
  name: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface LibraryTreeResponse {
  id: string;
  parentLibraryId?: string | null;
  name: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  children: LibraryTreeResponse[];
  notesCount?: number;
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
