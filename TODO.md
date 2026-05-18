# TODO - finance-tracker

## Completed
- (Dashboard) Fixed syntax/duplication issues in `app/dashboard/page.tsx` by replacing with a clean single implementation.
- (Dashboard layout) Added mobile bottom padding in `app/dashboard/layout.tsx` so fixed bottom nav won’t clip content.

## Completed
- Add an auth recovery panel in `app/dashboard/layout.tsx` when `user` is missing/unauthorized:
  - show message: “Unauthorized / Session expired”
  - provide a button: “Clear session & return to login”
  - button clears `localStorage.ft_token` and `localStorage.ft_user` and redirects to `/`



