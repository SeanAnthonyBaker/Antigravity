-- Migration: Cascade Delete Document Children
-- Automatically and recursively deletes all child nodes and attached artifacts when a parent node is deleted.

CREATE OR REPLACE FUNCTION public.cascade_delete_document_children()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Recursively delete all child documents
    -- This DELETE statement will recursively fire this trigger for each child,
    -- cascading all the way down the entire branch.
    DELETE FROM public.documents
    WHERE "parentNodeID" = OLD."nodeID";

    -- 2. Clean up any artifacts attached directly to this node
    DELETE FROM public.generated_artifacts
    WHERE node_id = OLD."nodeID";

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_delete_document_children ON public.documents;
CREATE TRIGGER trg_cascade_delete_document_children
AFTER DELETE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.cascade_delete_document_children();
