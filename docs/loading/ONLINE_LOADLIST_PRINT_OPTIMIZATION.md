# Online Loadlist Print Document Optimization

## Overview
Optimized the online loadlist print document to reduce spacing and ensure the table stays on the same page as the header, preventing pagination issues.

## Changes Made

### 1. Reduced Header Spacing
- **margin-bottom**: 20px → 8px
- **padding-bottom**: 10px → 8px

### 2. Reduced Document Title Spacing
- **font-size**: 20px → 18px
- **border**: 3px → 2px
- **padding**: 15px → 10px
- **margin**: 20px 0 → 8px 0

### 3. Reduced Loadlist Info Section Spacing
- **margin-bottom**: 10px → 8px
- **padding**: 10px → 8px
- **font-size**: 12px → 11px
- **line spacing**: 6px → 4px
- **fill-in line height**: 16px → 14px

### 4. Reduced Summary Box Spacing
- **border-radius**: 8px → 6px
- **padding**: 15px → 10px
- **margin-bottom**: 20px → 10px

### 5. Reduced Platform Section Spacing
- **margin-bottom**: 30px → 15px
- **platform-header padding**: 10px → 8px
- **platform-header font-size**: 16px → 14px
- **platform-header margin-bottom**: 10px → 8px

### 6. Reduced Table Spacing
- **margin-bottom**: 20px → 10px
- **font-size**: 12px → 11px
- **cell padding**: 8px → 6px 4px

### 7. Reduced Signature Section Spacing
- **gap**: 40px → 30px
- **margin**: 40px 0 → 20px 0
- **signature-title margin-bottom**: 15px → 10px
- **signature-title font-size**: 14px → 13px
- **signature-line margin**: 50px 20px 10px 20px → 40px 20px 8px 20px

### 8. Reduced Footer Spacing
- **font-size**: 11px → 10px
- **margin-top**: 30px → 15px
- **padding-top**: 15px → 10px

## Result
- The table now stays on the same page as the header
- Document is more compact and fits better on A4 paper
- All information remains readable and properly formatted
- Build passes without errors or warnings

## Files Modified
- `app/api/loadlists/online-delivery-document/route.ts`

## Testing
1. Navigate to http://localhost:3000/receiving/loadlists
2. Find loadlist LD-20260203-0018 (or any online loadlist)
3. Click the print button
4. Verify that:
   - The table appears immediately after the header
   - No page break occurs between header and table
   - All information is readable
   - Fill-in lines are visible for empty fields
   - Auto-print triggers correctly

## Date
February 3, 2026
