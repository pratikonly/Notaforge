

# Admin Mode for NotaForge

## Overview

Add a role-based system where anyone can add notes, but only an admin can edit or delete them. A toggle button on the right side of the navbar (mirroring the "Made by Pratik" button on the left) lets users switch between "Public" and "Admin" mode via an email/password login popup.

---

## How It Works

- **Public mode (default)**: Users can view and add notes. Edit/delete buttons are hidden.
- **Admin mode**: After logging in with email + password, edit/delete buttons appear. Admin can also log out to return to public mode.
- The role toggle button sits on the right side of the navbar with a green default color.

---

## Changes Required

### 1. Create Admin Auth Hook

**New file**: `src/hooks/useAdminAuth.ts`

- Uses the existing authentication system (Supabase Auth)
- Provides `isAdmin`, `login(email, password)`, `logout()`, and `loading` state
- Listens to auth state changes
- Admin = any authenticated user (since the app is public-first, logging in itself grants admin privileges)

### 2. Create Admin Login Popup

**New file**: `src/components/AdminLoginModal.tsx`

- A modal/dialog with email and password fields
- Submit button to log in
- Error handling for wrong credentials
- Closes on successful login

### 3. Update Navbar - Add Role Toggle Button

**File**: `src/components/NotaForgeDashboard.tsx`

- Replace the right spacer (`w-[200px] mr-16`) with a role toggle button
- **Desktop**: Pill-shaped button similar to "Made by Pratik" on the left
  - Default state: Green background, shows "Public" text
  - Hover: Slightly lighter green
  - When clicked (not admin): Opens login popup
  - When admin: Shows "Admin" with a logout option
- **Mobile**: Same button replaces the right blank spacer

### 4. Hide Edit/Delete for Non-Admins

**File**: `src/components/NotaForgeDashboard.tsx`

- Pass `isAdmin` state throughout the component
- On note cards: Hide the Pencil (edit) and Trash (delete) icon buttons when not admin
- In the popup modal: Hide the edit button when not admin
- The "Add Note" form remains available to everyone

### 5. Ensure Auth Works with Existing Setup

The authentication system is already configured in the Supabase client. The notes table has public RLS policies (anyone can CRUD), so:
- Public users can still INSERT (add notes)
- Edit/delete restrictions are enforced at the UI level (buttons hidden for non-admins)
- The existing public RLS policies remain unchanged

---

## Technical Details

### Button Design (Right Side)

```text
Default (Public):
- Background: bg-green-600/80 with backdrop-blur
- Text: "Public" in white
- Border: border-green-500/50
- Hover: bg-green-500/80

Admin (Logged In):
- Background: bg-amber-600/80 with backdrop-blur  
- Text: "Admin" in white
- Border: border-amber-500/50
- Click: Shows logout option
```

### Admin Login Modal

```text
- Dark themed modal matching the app
- Email input field
- Password input field
- "Login as Admin" button
- Error message area
- Close/cancel button
```

### File Summary

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useAdminAuth.ts` | Create | Auth hook with login/logout/isAdmin |
| `src/components/AdminLoginModal.tsx` | Create | Email/password login popup |
| `src/components/NotaForgeDashboard.tsx` | Modify | Add role button to navbar, conditionally show edit/delete |

---

## User Flow

1. User visits site -- sees "Public" green button on right, can only add notes
2. User clicks "Public" button -- login popup appears
3. User enters admin email/password -- logs in
4. Button changes to "Admin" (amber color) -- edit/delete buttons now visible on all notes
5. Admin clicks "Admin" button -- gets logout option
6. Admin logs out -- back to public mode, edit/delete hidden again

