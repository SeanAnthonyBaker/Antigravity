-- Migration: Add quiz_url column to documents table, update get_nodes_by_tags and urltype check constraint
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS quiz_url text;

ALTER TABLE public.documents 
DROP CONSTRAINT IF EXISTS documents_urltype_check;

ALTER TABLE public.documents 
ADD CONSTRAINT documents_urltype_check 
CHECK (urltype IS NULL OR urltype IN ('Video', 'Audio', 'Image', 'Markdown', 'PDF', 'PNG', 'Url', 'Loop', 'InfoGraphic', 'Specification', 'Quiz'));

CREATE OR REPLACE FUNCTION public.get_nodes_by_tags(p_tag_ids bigint[])
RETURNS SETOF public.documents
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
WITH RECURSIVE hierarchy AS (
    SELECT d."nodeID", d.created_at, d.title, d."order", d.selected, d.text, d."parentNodeID", d.docid, d.level, d.type, d.visible, d.children, d.url, d.urltype, d.quiz_url
    FROM public.documents d
    JOIN public.object_tags ot ON replace(substring(d.url from '[^/]+$'), '%20', ' ') = ot.file_path
    WHERE ot.tag_id = ANY(p_tag_ids)

    UNION
    
    SELECT d."nodeID", d.created_at, d.title, d."order", d.selected, d.text, d."parentNodeID", d.docid, d.level, d.type, d.visible, d.children, d.url, d.urltype, d.quiz_url
    FROM public.documents d
    JOIN hierarchy h ON d."nodeID" = h."parentNodeID"
)
SELECT DISTINCT * 
FROM hierarchy 
ORDER BY "order", "nodeID";
$$;
