
import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres:AlbieHerbie1!@db.ryeoceystuqrdynbtsvt.supabase.co:5432/postgres";

const client = new Client({
    connectionString,
});

async function inspectRoot() {
    try {
        await client.connect();
        const res = await client.query('SELECT * FROM public.documents ORDER BY "order" ASC');
        const nodes = res.rows;
        // Import and test buildTree directly
        const { buildTree: buildTreeFn } = await import('../src/utils/treeUtils.js').catch(() => import('../src/utils/treeUtils.ts'));
        const tree = buildTreeFn(nodes);

        console.log("=== Verified Tree Structure ===");
        const proposalsNode = nodes.find(n => n.nodeID == 178);
        console.log("Proposals Node in DB:", proposalsNode?.title);

        const findInTree = (items, id) => {
            for (const item of items) {
                if (item.nodeID == id) return item;
                if (item.childNodes) {
                    const found = findInTree(item.childNodes, id);
                    if (found) return found;
                }
            }
            return null;
        };

        const proposalsTree = findInTree(tree, 178);
        console.log("Proposals Tree Item found:", !!proposalsTree);
        if (proposalsTree) {
            console.log("Proposals children count:", proposalsTree.childNodes?.length);
            proposalsTree.childNodes?.forEach(c => {
                console.log(` - [${c.nodeID}] ${c.title} (childNodes: ${c.childNodes?.length})`);
            });
        }

        const clientsTree = findInTree(tree, 177);
        console.log("Clients Tree Item found:", !!clientsTree);
        if (clientsTree) {
            console.log("Clients children count:", clientsTree.childNodes?.length);
            clientsTree.childNodes?.forEach(c => {
                console.log(` - [${c.nodeID}] ${c.title} (childNodes: ${c.childNodes?.length})`);
            });
        }

        const personalSpacesTree = findInTree(tree, 254);
        console.log("Personal Spaces Tree Item found:", !!personalSpacesTree);
        if (personalSpacesTree) {
            console.log("Personal Spaces children count:", personalSpacesTree.childNodes?.length);
            personalSpacesTree.childNodes?.forEach(c => {
                console.log(` - [${c.nodeID}] ${c.title} (childNodes: ${c.childNodes?.length})`);
            });
        }

        await client.end();
        return;

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

inspectRoot();
