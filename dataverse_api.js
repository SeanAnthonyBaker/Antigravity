/**
 * Programmatic Dataverse API Access
 * Uses M365 CLI browser authentication (which works) to get tokens
 * Then makes direct API calls to Dataverse
 */

const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs').promises;

// Configuration
const config = {
    dataverseUrl: 'https://orgdcbce74b.crm11.dynamics.com',
    projectId: 'fe864a34-8a67-4ed4-bdaf-806faaccc9c3'
};

/**
 * Get access token using M365 CLI (browser auth)
 */
function getAccessToken() {
    console.log('🔐 Getting access token via M365 CLI (browser auth)...\n');

    try {
        // Use M365 CLI to get token for Dataverse
        const tokenCmd = `m365 util accesstoken get --resource ${config.dataverseUrl} --output text`;
        const token = execSync(tokenCmd, { encoding: 'utf-8' }).trim();

        console.log('✅ Access token obtained!\n');
        return token;
    } catch (error) {
        console.error('❌ Failed to get token. Make sure M365 CLI is logged in:');
        console.error('   Run: m365 login --authType browser\n');
        throw error;
    }
}

/**
 * Get all projects
 */
async function getProjects(token) {
    console.log('📋 Fetching all projects...');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        'Prefer': 'odata.maxpagesize=500'
    };

    try {
        const response = await axios.get(
            `${config.dataverseUrl}/api/data/v9.2/msdyn_projects`,
            { headers }
        );

        const projects = response.data.value;
        console.log(`✅ Found ${projects.length} project(s):\n`);

        projects.forEach(project => {
            console.log(`  📌 ${project.msdyn_subject || 'Untitled'}`);
            console.log(`     ID: ${project.msdyn_projectid}`);
            if (project.createdon) {
                console.log(`     Created: ${new Date(project.createdon).toLocaleDateString()}`);
            }
            console.log();
        });

        return projects;
    } catch (error) {
        console.error(`❌ Error fetching projects: ${error.message}`);
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Details:`, error.response.data);
        }
        return [];
    }
}

/**
 * Get tasks for a specific project
 */
async function getProjectTasks(token, projectId) {
    console.log(`📝 Fetching tasks for project ${projectId}...\n`);

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };

    // Build filter URL
    const filterQuery = `_msdyn_project_value eq ${projectId}`;
    const url = `${config.dataverseUrl}/api/data/v9.2/msdyn_projecttasks?$filter=${filterQuery}&$orderby=msdyn_scheduledstart asc`;

    try {
        const response = await axios.get(url, { headers });
        const tasks = response.data.value;

        console.log(`✅ Found ${tasks.length} task(s):\n`);

        tasks.forEach((task, index) => {
            const progress = task.msdyn_progress || 0;
            const statusIcon = progress === 100 ? '✅' : progress > 0 ? '🔄' : '⏳';

            console.log(`${index + 1}. ${statusIcon} ${task.msdyn_subject || 'Untitled Task'}`);
            console.log(`   Progress: ${progress}%`);

            if (task.msdyn_scheduledstart) {
                console.log(`   Start: ${new Date(task.msdyn_scheduledstart).toLocaleDateString()}`);
            }
            if (task.msdyn_scheduledend) {
                console.log(`   End: ${new Date(task.msdyn_scheduledend).toLocaleDateString()}`);
            }
            if (task.msdyn_description) {
                console.log(`   Description: ${task.msdyn_description.substring(0, 100)}...`);
            }
            console.log();
        });

        return tasks;
    } catch (error) {
        console.error(`❌ Error fetching tasks: ${error.message}`);
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Details:`, error.response.data);
        }
        return [];
    }
}

/**
 * Create a new task
 */
async function createTask(token, projectId, taskData) {
    console.log(`➕ Creating new task: ${taskData.subject}...`);

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };

    const url = `${config.dataverseUrl}/api/data/v9.2/msdyn_projecttasks`;

    const payload = {
        'msdyn_subject': taskData.subject,
        'msdyn_description': taskData.description || '',
        'msdyn_progress': taskData.progress || 0,
        'msdyn_project@odata.bind': `/msdyn_projects(${projectId})`
    };

    if (taskData.startDate) {
        payload['msdyn_scheduledstart'] = taskData.startDate;
    }
    if (taskData.endDate) {
        payload['msdyn_scheduledend'] = taskData.endDate;
    }

    try {
        const response = await axios.post(url, payload, { headers });
        console.log(`✅ Task created successfully!`);
        return response.data;
    } catch (error) {
        console.error(`❌ Error creating task: ${error.message}`);
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Details:`, error.response.data);
        }
        return null;
    }
}

/**
 * Update a task
 */
async function updateTask(token, taskId, updates) {
    console.log(`📝 Updating task ${taskId}...`);

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };

    const url = `${config.dataverseUrl}/api/data/v9.2/msdyn_projecttasks(${taskId})`;

    try {
        await axios.patch(url, updates, { headers });
        console.log(`✅ Task updated successfully!`);
        return true;
    } catch (error) {
        console.error(`❌ Error updating task: ${error.message}`);
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Details:`, error.response.data);
        }
        return false;
    }
}

/**
 * Save data to JSON file
 */
async function saveToJson(data, filename = 'project_data.json') {
    await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`💾 Data saved to: ${filename}\n`);
}

/**
 * Main function
 */
async function main() {
    console.log('='.repeat(70));
    console.log('Microsoft Project for the web - Programmatic API Access');
    console.log('Using M365 CLI Browser Authentication');
    console.log('='.repeat(70));
    console.log();

    try {
        // Step 1: Get access token via M365 CLI
        const token = getAccessToken();

        // Step 2: Fetch projects
        const projects = await getProjects(token);

        if (projects.length === 0) {
            console.log('No projects found.');
            return;
        }

        // Step 3: Fetch tasks for your specific project
        const tasks = await getProjectTasks(token, config.projectId);

        // Step 4: Save to JSON
        const exportData = {
            timestamp: new Date().toISOString(),
            dataverseUrl: config.dataverseUrl,
            projectId: config.projectId,
            projects: projects,
            tasks: tasks
        };

        await saveToJson(exportData);

        // Success!
        console.log('='.repeat(70));
        console.log('🎉 Success! Programmatic access working!');
        console.log('='.repeat(70));
        console.log('\n📚 API Functions Available:');
        console.log('  - getProjects(token)');
        console.log('  - getProjectTasks(token, projectId)');
        console.log('  - createTask(token, projectId, taskData)');
        console.log('  - updateTask(token, taskId, updates)');
        console.log('\n💡 You can now integrate this into your Antigravity platform!');

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Export functions for reuse
module.exports = {
    getAccessToken,
    getProjects,
    getProjectTasks,
    createTask,
    updateTask,
    saveToJson,
    config
};

// Run if called directly
if (require.main === module) {
    main();
}
