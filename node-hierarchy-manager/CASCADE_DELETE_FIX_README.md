# Fix for Insert Error After Cascade Delete Migration

## Problem
After adding cascade delete to the Supabase `documents` table structure, insert operations were failing because the `user_id` column was added as `NOT NULL` with a foreign key constraint, but the application code wasn't providing `user_id` values during inserts.

## Root Cause
The `documents` table schema was updated to include:
```sql
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
```

However, the application code had:
1. No `user_id` field in the `DocumentNode` TypeScript interface
2. No `user_id` being passed in any insert operations
3. The `create_node` RPC function didn't accept or use `user_id`

## Changes Made

### 1. TypeScript Interface (`src/types.ts`)
- ✅ Added `user_id: string` field to `DocumentNode` interface

### 2. Hierarchy Service (`src/services/HierarchyService.ts`)
- ✅ Updated `createHierarchyFromJson()` to get authenticated user ID
- ✅ Added `user_id` to all insert operations in root node creation
- ✅ Updated `createChildNodes()` to accept and use `userId` parameter
- ✅ Added `user_id` to all child node inserts
- ✅ Passed `userId` through recursive calls

### 3. Node Service (`src/services/NodeService.ts`)
- ✅ Updated `createNode()` to automatically get and include user_id if not provided
- ✅ Updated `createNodeWithRPC()` to get user ID and pass it to the RPC function

### 4. Database Function (`supabase_migration_create_node_function.sql`)
- ✅ Added `userid uuid DEFAULT auth.uid()` parameter to `create_node()` function
- ✅ Added user authentication check
- ✅ Added `user_id` to the INSERT statement
- ✅ Updated function signature in GRANT and COMMENT statements

### 5. New Migration File (`supabase_migration_documents_user_id.sql`)
- ✅ Created comprehensive migration to add `user_id` column with cascade delete
- ✅ Includes foreign key constraint setup
- ✅ Handles existing data by assigning to first user
- ✅ Sets up Row Level Security (RLS) policies for multi-tenant data isolation

## What You Need to Do

### Step 1: Run Database Migrations (in order)
Execute these SQL files in your Supabase SQL Editor:

1. **First** (if not already done): `supabase_migration_documents_user_id.sql`
   - This adds the `user_id` column with cascade delete
   - Sets up RLS policies
   - Handles existing data

2. **Second**: `supabase_migration_create_node_function.sql`
   - This updates the `create_node` RPC function to accept user_id

3. **Third** (if not already done): `supabase_migration_api_keys.sql`
   - This is for the API keys table (already has cascade delete)

### Step 2: Test the Application
After running the migrations, test these operations:
- ✅ Creating new nodes via the UI
- ✅ Creating hierarchies from images
- ✅ Updating existing nodes
- ✅ Deleting nodes

### Step 3: Verify RLS is Working
The migration enables Row Level Security, which means:
- Users can only see their own documents
- Users can only modify their own documents
- When a user is deleted, all their documents are automatically deleted (cascade)

## Important Notes

⚠️ **Existing Data**: The migration assigns all existing documents to the first user in your system. If you need different logic, modify the migration before running it.

⚠️ **RLS Policies**: The migration enables Row Level Security. This is a security best practice but means users will only see their own data. If you need different behavior (e.g., shared documents), you'll need to adjust the policies.

⚠️ **Testing**: Test thoroughly in a development environment before running in production.

## Verification Checklist
- [ ] All migration files executed successfully in Supabase
- [ ] No errors in browser console when creating nodes
- [ ] New nodes have `user_id` populated correctly
- [ ] Users can only see their own documents
- [ ] Deleting a test user deletes their documents (test in dev only!)

## If You Still Get Errors

If you still see insert errors after running the migrations, check:
1. The exact error message in the browser console
2. Whether the migrations ran successfully (check Supabase logs)
3. Whether RLS policies are blocking legitimate operations
4. Whether the authenticated user exists in `auth.users`
