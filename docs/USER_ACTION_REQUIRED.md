# 🔴 User Action Required - Clear Browser Cache

## Issue Fixed ✅
BFS-20260107-005 has been successfully moved from Dispatch to MRTD staging area, and the API has been updated to correctly filter BFS items.

## Why You Still See It in Wrong Tab
Your browser is showing **cached (old) data**. The database and API are correct, but your browser needs to refresh.

## How to Fix (Choose ONE method)

### Method 1: Hard Refresh (Recommended) ⚡
**Windows Users:**
- Press `Ctrl + Shift + R` OR `Ctrl + F5`

**Mac Users:**
- Press `Cmd + Shift + R`

### Method 2: Clear Cache via DevTools 🛠️
1. Press `F12` to open DevTools
2. Right-click on the refresh button (next to address bar)
3. Select "Empty Cache and Hard Reload"
4. Close DevTools

### Method 3: Incognito/Private Window 🕵️
1. Open a new Incognito/Private window
   - Chrome: `Ctrl + Shift + N` (Windows) or `Cmd + Shift + N` (Mac)
   - Firefox: `Ctrl + Shift + P` (Windows) or `Cmd + Shift + P` (Mac)
2. Navigate to the warehouse inventory page
3. Check if BFS-20260107-005 is now in the correct tab

## What You Should See After Refresh

### ❌ "จัดสินค้าเสร็จ (PK,FS)" Tab
- BFS-20260107-005 should **NOT** appear here

### ✅ "จัดสินค้าเสร็จ (BFS)" Tab
- BFS-20260107-005 **SHOULD** appear here
- Shows items at MRTD/PQTD staging areas

## Still Not Working?

If you still see BFS-20260107-005 in the wrong tab after clearing cache:

1. **Check browser console** (F12 → Console tab)
   - Look for any error messages
   - Take a screenshot

2. **Verify the URL**
   - Make sure you're on the correct environment
   - Check if you're using the latest deployed version

3. **Try a different browser**
   - Test in Chrome, Firefox, or Edge
   - This helps identify if it's browser-specific

4. **Contact support**
   - Provide screenshots of:
     - The wrong tab showing BFS-20260107-005
     - Browser console (F12)
     - Network tab showing API responses

## Technical Details (For Reference)

**What was fixed:**
1. ✅ Stock moved from Dispatch → MRTD (database)
2. ✅ API updated to filter BFS items at staging
3. ✅ BFS items with `storage_location = null` excluded from Dispatch tab

**Database verification:**
```
✅ B-BAP-C|KNP|030: 29 pieces at MRTD
✅ B-BEY-D|CNL|012: 48 pieces at MRTD
✅ NO stock at Dispatch
✅ Packages have storage_location = null (at staging)
```

---

**Date**: 2026-01-14  
**Status**: Fix deployed, waiting for user to clear cache  
**Next Step**: Clear browser cache using one of the methods above
