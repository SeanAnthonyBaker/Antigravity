/**
 * Access Microsoft To-Do / Tasks (newer Planner backend)
 * Uses Microsoft Graph To-Do API
 */

const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs').promises;

async function getAccessToken() {
    console.log('🔐 Getting Microsoft Graph access token...');
    const cmd = 'm365 util accesstoken get --resource https://graph.microsoft.com --output text';
    const token = execSync(cmd, { encoding: 'utf-8' }).trim();
    console.log('✅ Token obtained\n');
    return token;
}

async function getTaskLists(token) {
    console.log('📋 Fetching all task lists...\n');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        const response = await axios.get(
            'https://graph.microsoft.com/v1.0/me/todo/lists',
            { headers }
        );

        const lists = response.data.value || [];
        console.log(`✅ Found ${lists.length} task lists:\n`);

        lists.forEach((list, index) => {
            console.log(`${index + 1}. 📂 ${list.displayName}`);
            console.log(`   ID: ${list.id}`);
            console.log(`   WellknownListName: ${list.wellknownListName || 'custom'}`);
            console.log();
        });

        return lists;
    } catch (error) {
        console.error('❌ Error getting task lists:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Details:', error.response.data);
        }
        return [];
    }
}

async function getTasksFromList(token, listId, listName) {
    console.log(`📝 Fetching tasks from "${listName}"...\n`);

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        const response = await axios.get(
            `https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks`,
            { headers }
        );

        const tasks = response.data.value || [];
        console.log(`✅ Found ${tasks.length} tasks:\n`);

        tasks.forEach((task, index) => {
            const status = task.status === 'completed' ? '✅' :
                task.importance === 'high' ? '🔴' : '⏳';

            console.log(`${index + 1}. ${status} ${task.title}`);
            if (task.body?.content) {
                const preview = task.body.content.substring(0, 100);
                console.log(`   Note: ${preview}${task.body.content.length > 100 ? '...' : ''}`);
            }
            if (task.dueDateTime) {
                console.log(`   Due: ${task.dueDateTime.dateTime}`);
            }
            console.log();
        });

        return tasks;
    } catch (error) {
        console.error('❌ Error getting tasks:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Details:', error.response.data);
        }
        return [];
    }
}

async function main() {
    console.log('='.repeat(70));
    console.log('Microsoft To-Do / Task Lists Access');
    console.log('='.repeat(70));
    console.log();

    try {
        // Step 1: Get token
        const token = await getAccessToken();

        // Step 2: Get all task lists
        const lists = await getTaskLists(token);

        if (lists.length === 0) {
            console.log('No task lists found.');
            return;
        }

        // Step 3: Search for roadmap-related lists
        console.log('🔍 Looking for roadmap/6 week related lists...\n');
        const matches = lists.filter(list => {
            const name = list.displayName.toLowerCase();
            return name.includes('roadmap') ||
                name.includes('6 week') ||
                name.includes('tulkah') ||
                name.includes('value') ||
                name.includes('shaping');
        });

        if (matches.length > 0) {
            console.log(`Found ${matches.length} matching list(s):\n`);

            const allData = {};

            for (const list of matches) {
                console.log(`\n${'='.repeat(70)}`);
                console.log(`📦 ${list.displayName}`);
                console.log('='.repeat(70));

                const tasks = await getTasksFromList(token, list.id, list.displayName);

                allData[list.displayName] = {
                    listId: list.id,
                    tasks: tasks
                };
            }

            // Save all data
            await fs.writeFile('todo_tasks_data.json', JSON.stringify(allData, null, 2));
            console.log('\n💾 Data saved to: todo_tasks_data.json\n');

        } else {
            console.log('❌ No matching lists found. Here are all available lists:\n');

            const allData = {};

            // Get tasks from first 3 lists as examples
            for (const list of lists.slice(0, 3)) {
                const tasks = await getTasksFromList(token, list.id, list.displayName);
                allData[list.displayName] = {
                    listId: list.id,
                    tasks: tasks
                };
            }

            await fs.writeFile('todo_tasks_data.json', JSON.stringify(allData, null, 2));
            console.log('\n💾 Sample data saved to: todo_tasks_data.json\n');
        }

        console.log('='.repeat(70));
        console.log('✅ Complete!');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    }
}

main();
