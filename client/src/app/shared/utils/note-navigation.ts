import { Router } from '@angular/router';

/**
 * Opens the full-page note editor (`/notes/:id`) with a return ticket, so
 * save, cancel, and trash navigate back to the exact calling view instead
 * of the dashboard. Shared by every universal pen entry point.
 */
export function openNoteEditor(router: Router, noteId: string): Promise<boolean> {
  return router.navigate(['/notes', noteId], {
    queryParams: { returnUrl: router.url },
  });
}
