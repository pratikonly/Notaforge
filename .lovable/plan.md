

# Remove Authentication & Make Public Notes Website

## Overview
Convert the website from a user-based authentication system (PAlock) to a simple public notes website where anyone can view, create, edit, and delete notes without signing in.

---

## Changes Summary

### 1. Database Migration - Update RLS Policies

**Current State**: The `notes` table has RLS policies that restrict access to authenticated users only (`auth.uid() = user_id`).

**New State**: Allow public access for all operations (SELECT, INSERT, UPDATE, DELETE) without requiring authentication.

```text
DROP existing policies:
- "Users can view own notes"
- "Users can create own notes"
- "Users can update own notes"
- "Users can delete own notes"

CREATE new public policies:
- "Anyone can view notes" (SELECT)
- "Anyone can create notes" (INSERT)
- "Anyone can update notes" (UPDATE)
- "Anyone can delete notes" (DELETE)
```

---

### 2. Files to Delete

| File | Reason |
|------|--------|
| `src/pages/Auth.tsx` | Login/signup page no longer needed |
| `src/pages/Settings.tsx` | User settings page no longer needed |
| `src/pages/Archive.tsx` | User-specific archive page |
| `src/pages/Bin.tsx` | User-specific bin page |
| `src/pages/FolderView.tsx` | User-specific folders |
| `src/pages/Index.tsx` | Not used (dashboard is main) |
| `src/hooks/useAuth.tsx` | Authentication hook no longer needed |
| `src/hooks/useNotes.tsx` | User-based notes hook (using usePublicNotes instead) |
| `src/hooks/useFolders.tsx` | User-based folders hook no longer needed |
| `src/components/MainLayout.tsx` | Auth-protected layout no longer needed |
| `src/components/PageHeader.tsx` | Has auth/account menu |
| `src/components/AppSidebar.tsx` | User sidebar no longer needed |
| `src/components/Dashboard.tsx` | Old dashboard component |
| `src/components/FolderCard.tsx` | User folders feature |
| `src/components/FolderEditor.tsx` | User folders feature |
| `src/components/FolderSelector.tsx` | User folders feature |
| `src/components/NavLink.tsx` | Navigation no longer needed |
| `src/components/NoteCard.tsx` | Old note card (not used) |
| `src/components/NoteEditor.tsx` | Old note editor (not used) |
| `supabase/functions/auth-signin/index.ts` | Auth edge function no longer needed |

---

### 3. Update usePublicNotes Hook

Make the hook work without user_id:

```text
Current: Inserts notes with no user_id specified
Update: Explicitly set user_id to null for clarity
```

The hook is already mostly correct for public use - just needs minor cleanup.

---

### 4. Keep These Files (No Changes Needed)

| File | Reason |
|------|--------|
| `src/App.tsx` | Already simplified - just shows NotaForgeDashboard |
| `src/components/NotaForgeDashboard.tsx` | Main dashboard - already works without auth |
| `src/components/BlurredBlobBackground.tsx` | Background animation |
| `src/components/NoteFormPanel.tsx` | Note creation form |
| `src/hooks/usePublicNotes.tsx` | Already designed for public access |
| `src/pages/NotFound.tsx` | 404 page still needed |

---

## Execution Order

1. **Database Migration**
   - Drop existing user-based RLS policies on `notes` table
   - Create new public access RLS policies

2. **Delete Files**
   - Remove all auth-related pages
   - Remove all user-specific hooks
   - Remove auth-protected components
   - Delete auth-signin edge function

3. **Final Result**
   - Simple public notes website
   - Anyone can view, create, edit, delete notes
   - No login/signup required
   - Clean, minimal codebase

---

## Files Summary

| Action | Count |
|--------|-------|
| Delete | 20 files |
| Modify | 1 (database RLS policies) |
| Keep | 7 core files |

