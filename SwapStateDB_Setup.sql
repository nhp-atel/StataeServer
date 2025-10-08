-- =============================================
-- Swap State Database Schema
-- =============================================
-- This script creates the necessary database objects for
-- server-side swap state persistence across browser tabs
-- =============================================

USE [Middleware]
GO

-- =============================================
-- 1. CREATE TABLE: SwapState
-- =============================================
-- Stores swap mappings for each sort
-- Each record represents the swap state at a point in time

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SwapState]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[SwapState](
        [id] [int] IDENTITY(1,1) NOT NULL,
        [sortid] [int] NOT NULL,
        [mapping_json] [nvarchar](max) NULL,
        [message] [nvarchar](4000) NULL,
        [updated_by] [nvarchar](128) NULL,
        [updated_at] [datetime] NOT NULL DEFAULT GETDATE(),
        CONSTRAINT [PK_SwapState] PRIMARY KEY CLUSTERED ([id] ASC)
    )

    -- Create index on sortid for faster lookups
    CREATE NONCLUSTERED INDEX [IX_SwapState_SortID] ON [dbo].[SwapState]
    (
        [sortid] ASC
    )

    PRINT 'Table SwapState created successfully'
END
ELSE
BEGIN
    PRINT 'Table SwapState already exists'
END
GO

-- =============================================
-- 2. CREATE STORED PROCEDURE: usp_SwapState_GetLatest
-- =============================================
-- Returns the most recent swap state for a given sortid
-- Used when loading a page or switching sorts

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[usp_SwapState_GetLatest]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[usp_SwapState_GetLatest]
GO

CREATE PROCEDURE [dbo].[usp_SwapState_GetLatest]
    @sortid INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Get the most recent swap state for this sortid
    SELECT TOP 1
        [id],
        [sortid],
        [mapping_json],
        [message],
        [updated_by],
        [updated_at]
    FROM [dbo].[SwapState]
    WHERE [sortid] = @sortid
    ORDER BY [updated_at] DESC, [id] DESC

    -- If no record found, return empty result set (not an error)
END
GO

PRINT 'Stored Procedure usp_SwapState_GetLatest created successfully'
GO

-- =============================================
-- 3. CREATE STORED PROCEDURE: usp_SwapState_Save
-- =============================================
-- Saves a new swap state record for a given sortid
-- Keeps historical records for auditing

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[usp_SwapState_Save]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[usp_SwapState_Save]
GO

CREATE PROCEDURE [dbo].[usp_SwapState_Save]
    @sortid INT,
    @mapping_json NVARCHAR(MAX),
    @message NVARCHAR(4000) = NULL,
    @updated_by NVARCHAR(128) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Insert new swap state record
    INSERT INTO [dbo].[SwapState] (
        [sortid],
        [mapping_json],
        [message],
        [updated_by],
        [updated_at]
    )
    VALUES (
        @sortid,
        @mapping_json,
        @message,
        @updated_by,
        GETDATE()
    )

    -- Return the ID of the newly created record
    SELECT SCOPE_IDENTITY() AS NewID

    -- Optional: Clean up old records (keep last 10 per sortid)
    -- Uncomment if you want automatic cleanup
    /*
    DELETE FROM [dbo].[SwapState]
    WHERE [sortid] = @sortid
    AND [id] NOT IN (
        SELECT TOP 10 [id]
        FROM [dbo].[SwapState]
        WHERE [sortid] = @sortid
        ORDER BY [updated_at] DESC, [id] DESC
    )
    */
END
GO

PRINT 'Stored Procedure usp_SwapState_Save created successfully'
GO

-- =============================================
-- 4. VERIFICATION QUERY
-- =============================================
-- Run this to verify the objects were created

PRINT ''
PRINT '===== VERIFICATION ====='
PRINT 'Checking created objects...'
PRINT ''

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SwapState]') AND type in (N'U'))
    PRINT '✓ Table: SwapState'
ELSE
    PRINT '✗ Table: SwapState NOT FOUND'

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[usp_SwapState_GetLatest]') AND type in (N'P', N'PC'))
    PRINT '✓ Stored Procedure: usp_SwapState_GetLatest'
ELSE
    PRINT '✗ Stored Procedure: usp_SwapState_GetLatest NOT FOUND'

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[usp_SwapState_Save]') AND type in (N'P', N'PC'))
    PRINT '✓ Stored Procedure: usp_SwapState_Save'
ELSE
    PRINT '✗ Stored Procedure: usp_SwapState_Save NOT FOUND'

PRINT ''
PRINT '===== SETUP COMPLETE ====='
PRINT 'You can now use the swap persistence feature!'
PRINT ''

-- =============================================
-- 5. TEST QUERIES (OPTIONAL)
-- =============================================
-- Uncomment to test the stored procedures

/*
-- Test Save
EXEC [dbo].[usp_SwapState_Save]
    @sortid = 1,
    @mapping_json = '{"S01":"S02","S02":"S01"}',
    @message = 'Test swap',
    @updated_by = 'test_user'

-- Test Get Latest
EXEC [dbo].[usp_SwapState_GetLatest] @sortid = 1

-- View all records
SELECT * FROM [dbo].[SwapState] ORDER BY [updated_at] DESC
*/
