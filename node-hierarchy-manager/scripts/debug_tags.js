import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from parent directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Supabase URL or Service Key not found in .env');
    process.exit(1);
}

// Client with Service Role (Admin)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function debugTags() {
    console.log('--- Debugging Tag Creation ---');

    // 1. Check User existence
    const email = 'seanbaker513@gmail.com';
    const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers();

    if (userError) {
        console.error('Error listing users:', userError);
        return;
    }

    const user = users.find(u => u.email === email);

    if (!user) {
        console.error(`User ${email} NOT FOUND in auth.users!`);
    } else {
        console.log(`User found: ${user.id} (${user.email})`);

        // 2. Check User Role
        const { data: roles, error: roleError } = await supabaseAdmin
            .from('user_roles')
            .select('*')
            .eq('user_id', user.id);

        if (roleError) {
            console.error('Error checking user_roles:', roleError);
        } else {
            console.log('User Roles:', roles);
            if (roles.length === 0) {
                console.warn('WARNING: User has NO entry in public.user_roles!');
            }
        }
    }

    // 3. Try to insert a tag as Service Role (should succeed)
    console.log('Attempting to create tag as Service Role...');
    const { data: tag, error: tagError } = await supabaseAdmin
        .from('tags')
        .insert([{ name: 'Debug Tag ' + Date.now(), parent_id: null }])
        .select()
        .single();

    if (tagError) {
        console.error('Service Role Tag Insert Failed:', tagError);
    } else {
        console.log('Service Role Tag Insert Success:', tag);
        // Clean up
        await supabaseAdmin.from('tags').delete().eq('id', tag.id);
    }
}

debugTags();
