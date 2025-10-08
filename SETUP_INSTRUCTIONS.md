# Swap State Server - Setup Instructions

## Overview
This guide will help you set up the database-backed swap persistence feature that allows swaps to work across multiple browser tabs.

---

## 🔧 What Was Fixed

### Critical Issues Resolved:
1. **File Name Mismatch** - Renamed `SwapStateServer (1).aspx` → `SwapStateServer.aspx`
2. **Missing Database Objects** - Created table and stored procedures
3. **No Debugging** - Added comprehensive console logging

---

## 📋 Prerequisites

- SQL Server with `Middleware` database
- IIS or web server running ASP.NET
- Web.config with `SQLConnString` connection string configured

---

## 🚀 Setup Steps

### Step 1: Run the Database Setup Script

1. Open **SQL Server Management Studio (SSMS)**
2. Connect to your SQL Server instance
3. Open the file: `SwapStateDB_Setup.sql`
4. Execute the script (F5 or click Execute)

**What this creates:**
- `SwapState` table - stores swap mappings
- `usp_SwapState_GetLatest` - retrieves latest swap for a sortid
- `usp_SwapState_Save` - saves new swap state

**Verification:**
The script will output:
```
✓ Table: SwapState
✓ Stored Procedure: usp_SwapState_GetLatest
✓ Stored Procedure: usp_SwapState_Save
```

### Step 2: Verify Connection String

Check your `Web.config` file has the correct connection string:

```xml
<connectionStrings>
    <add name="SQLConnString"
         connectionString="Server=YOUR_SERVER;Database={0};Trusted_Connection=True;" />
</connectionStrings>
```

The `{0}` placeholder will be replaced with "Middleware" by the code.

### Step 3: Deploy Files to Web Server

Ensure these files are in your web application directory:
- `NewServerUpdate.txt` (or `.html/.aspx` depending on your setup)
- `SwapStateServer.aspx`
- `sortDataServer.aspx`
- `HourlyQuickLookserver_BLDG.aspx`

### Step 4: Test the Setup

1. **Open the application in your browser**
2. **Open browser console** (F12 → Console tab)
3. **Perform a swap** between two stations

**Expected Console Output:**

```
=== SAVE SWAP TO SERVER ===
SortID: 123
Swap Mapping (Map): [["S01", "S02"], ["S02", "S01"]]
Request Payload: {
  "sortid": 123,
  "mapping": {"S01": "S02", "S02": "S01"},
  "message": "Swap state updated at 10/8/2025, 3:30:00 PM"
}
Response Status: 200 OK
✅ SWAP SAVED SUCCESSFULLY: {ok: true}
```

4. **Open a NEW TAB** with the same application
5. **Check the console for load messages:**

```
=== LOAD SWAP FROM SERVER ===
SortID: 123
Fetching from URL: SwapStateServer.aspx?sortid=123
Response Status: 200 OK
Mapping Object: {S01: "S02", S02: "S01"}
✅ SWAP LOADED SUCCESSFULLY - Map size: 2
```

6. **Verify the swaps appear** in the new tab

---

## 🔍 Troubleshooting

### Issue: 404 Not Found Error

**Symptom:** Console shows `404` when fetching SwapStateServer.aspx

**Solution:**
- Verify `SwapStateServer.aspx` exists in the correct directory
- Check file permissions
- Ensure IIS is configured to serve .aspx files

### Issue: 500 Internal Server Error

**Symptom:** Console shows `500` error with database-related message

**Solution:**
1. Check SQL connection string in Web.config
2. Verify database objects exist:
   ```sql
   USE Middleware
   GO

   -- Check table exists
   SELECT * FROM sys.tables WHERE name = 'SwapState'

   -- Check stored procedures exist
   SELECT * FROM sys.procedures WHERE name LIKE 'usp_SwapState%'
   ```

3. Check SQL Server error logs
4. Add `?debug=1` to URL to see full error details

### Issue: 400 Bad Request - Missing sortid

**Symptom:** Console shows error: `missing or invalid sortid`

**Solution:**
- Check that `currentSortID` is being set correctly
- Verify sort dropdown is populated
- Look for this in console: `currentSortID = [number]`

### Issue: Swaps not persisting

**Symptom:** Swaps work in one tab but don't appear in other tabs

**Solution:**
1. Check browser console for error messages
2. Verify data is being saved to database:
   ```sql
   SELECT TOP 10 * FROM SwapState ORDER BY updated_at DESC
   ```
3. Check that `loadSwapFromServer()` is being called on page load
4. Verify `refreshSwapDisplay()` is updating the UI

---

## 🧪 Manual Database Testing

### Test Save Operation:
```sql
EXEC [dbo].[usp_SwapState_Save]
    @sortid = 999,
    @mapping_json = '{"S01":"S02","S02":"S01"}',
    @message = 'Manual test',
    @updated_by = 'test_user'
```

### Test Get Operation:
```sql
EXEC [dbo].[usp_SwapState_GetLatest] @sortid = 999
```

### View All Swap Records:
```sql
SELECT
    id,
    sortid,
    mapping_json,
    message,
    updated_by,
    updated_at
FROM SwapState
ORDER BY updated_at DESC
```

---

## 📊 Database Schema Reference

### SwapState Table Structure:

| Column       | Type            | Description                          |
|--------------|-----------------|--------------------------------------|
| id           | INT IDENTITY    | Primary key                          |
| sortid       | INT             | Foreign key to sort                  |
| mapping_json | NVARCHAR(MAX)   | JSON object with swap mappings       |
| message      | NVARCHAR(4000)  | Optional description                 |
| updated_by   | NVARCHAR(128)   | Username who created the swap        |
| updated_at   | DATETIME        | Timestamp of creation                |

### Example mapping_json:
```json
{
  "S01": "S02",
  "S02": "S01",
  "S15": "S20",
  "S20": "S15"
}
```

This represents:
- S01 swapped with S02
- S15 swapped with S20

---

## 🎯 How It Works

### Swap Flow:

1. **User performs swap** in browser
   - JavaScript calls `atomicSwapStations()`
   - Registers swap with `swapStateManager.registerSwap()`

2. **Save to database**
   - `saveSwapToServer()` called automatically
   - POSTs JSON to `SwapStateServer.aspx`
   - Stored procedure inserts record into `SwapState` table

3. **Load on page refresh/new tab**
   - `loadCurrentValues()` calls `loadSwapFromServer()`
   - GETs latest swap from `SwapStateServer.aspx`
   - Applies swaps to fresh data from server

4. **Display updates**
   - `refreshSwapDisplay()` shows active swaps
   - Swaps persist through hour changes and auto-refresh

---

## 🔒 Security Notes

- The `updated_by` field captures the Windows username
- Connection uses Windows Authentication by default
- Consider adding data retention policy (uncomment cleanup in stored procedure)

---

## 📞 Support

If you encounter issues:

1. Check browser console for detailed error logs
2. Check SQL Server logs
3. Review the database query results
4. Verify all files are deployed correctly
5. Test database connectivity separately

---

## ✅ Success Checklist

- [ ] SQL script executed successfully
- [ ] Database objects verified (table + 2 stored procedures)
- [ ] SwapStateServer.aspx file exists and accessible
- [ ] Browser console shows successful save/load messages
- [ ] Swaps appear in database table
- [ ] Swaps persist when opening new tab
- [ ] Clear All Swaps button works
- [ ] Swaps survive page refresh

---

**Last Updated:** October 8, 2025
**Version:** 1.0
