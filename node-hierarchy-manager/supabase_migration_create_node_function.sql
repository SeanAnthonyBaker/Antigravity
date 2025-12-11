-- Migration: Create the create_node RPC function
-- This function creates a new node with auto-generated ID, proper ordering, and level calculation

CREATE OR REPLACE FUNCTION public.create_node(
    title text,
    parentnodeid bigint DEFAULT NULL,
    text text DEFAULT 'New Node',
    userid uuid DEFAULT auth.uid()
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_node_id bigint;
    new_order integer;
    parent_level integer;
BEGIN
    -- Ensure user is authenticated
    IF userid IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;

    -- Calculate the next available NodeID
    SELECT COALESCE(MAX("nodeID"), 0) + 1 INTO new_node_id FROM public.documents;

    -- Calculate the order based on existing children
    SELECT COALESCE(COUNT(*), 0) INTO new_order FROM public.documents WHERE "parentNodeID" = parentnodeid;

    -- Get the level of the parent node (if parent exists)
    IF parentnodeid IS NOT NULL THEN
        SELECT "level" INTO parent_level FROM public.documents WHERE "nodeID" = parentnodeid;
    ELSE
        parent_level := -1; -- Root level nodes will be 0
    END IF;

    -- Insert the new node into the documents table with level and visible = true
    INSERT INTO public.documents (
        "nodeID", 
        "title", 
        "parentNodeID", 
        "selected", 
        "text", 
        "order", 
        "level", 
        "visible",
        "children",
        "user_id"
    )
    VALUES (
        new_node_id, 
        title, 
        parentnodeid, 
        false, 
        text, 
        new_order, 
        COALESCE(parent_level, -1) + 1, 
        true,
        false,
        userid
    );

    -- Update the parent node's children field to true (if parent exists)
    IF parentnodeid IS NOT NULL THEN
        UPDATE public.documents
        SET "children" = true
        WHERE "nodeID" = parentnodeid;
    END IF;

    RETURN new_node_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_node(text, bigint, text, uuid) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.create_node(text, bigint, text, uuid) IS 
'Creates a new node with auto-generated ID, proper ordering, level calculation, and updates parent children flag. Requires authenticated user.';
