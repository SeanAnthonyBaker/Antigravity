
import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function run() {
    try {
        await client.connect();

        const sql = `
CREATE OR REPLACE FUNCTION get_nodes_by_tags(p_tag_ids bigint[])
RETURNS SETOF documents
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
WITH RECURSIVE hierarchy AS (
    -- Select documents that match the tags via their URL/file_path
    SELECT d."nodeID", d.created_at, d.title, d."order", d.selected, d.text, d."parentNodeID", d.docid, d.level, d.type, d.visible, d.children, d.url, d.urltype
    FROM documents d
    JOIN object_tags ot ON replace(substring(d.url from '[^/]+$'), '%20', ' ') = ot.file_path
    WHERE ot.tag_id = ANY(p_tag_ids)

    UNION
    
    -- Recursive step: get parents
    SELECT d."nodeID", d.created_at, d.title, d."order", d.selected, d.text, d."parentNodeID", d.docid, d.level, d.type, d.visible, d.children, d.url, d.urltype
    FROM documents d
    JOIN hierarchy h ON d."nodeID" = h."parentNodeID"
)
SELECT DISTINCT * 
FROM hierarchy 
ORDER BY "order", "nodeID";
$$;
        `;

        await client.query(sql);
        console.log("Function get_nodes_by_tags created successfully.");

    } catch (err) {
        console.error("Error creating function:", err);
    } finally {
        await client.end();
    }
}

run();
