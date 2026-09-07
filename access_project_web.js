/**
 * Access Project for the Web - "Tulkah.AI 6 Week Value Roadmap"
 * Using Project ID from URL: fe864a34-8a67-4ed4-bdaf-806faaccc9c3
 */

const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs').promises;

// From URL: https://planner.cloud.microsoft/webui/premiumplan/fe864a34-8a67-4ed4-bdaf-806faaccc9c3/org/54ad8b05-ea0b-ef11-9f85-002248c656a2
const config = {
    projectId: 'fe864a34-8a67-4ed4-bdaf-806faaccc9c3',
    orgId: '54ad8b05-ea0b-ef11-9f85-002248c656a2',
    tenantId: '2bec83ec-133e-4dff-b5e4-45045d92b1c8'
};

async function getAccessToken() {
    console.log('🔐 Getting Microsoft Graph access token...');
    const cmd = 'm365 util accesstoken get --resource https://graph.microsoft.com --output text';
    const token = execSync(cmd, { encoding: 'utf-8' }).trim();
    console.log('✅ Token obtained\n');
    return token;
}

async function getProject(token) {
    console.log('📋 Fetching project details...\n');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'odata.include-annotations="*"'
    };

    // Try beta endpoint for Project
    const endpoints = [
        `https://graph.microsoft.com/beta/solutions/projectManagement/projects/${config.projectId}`,
        `https://graph.microsoft.com/v1.0/solutions/projectManagement/projects/${config.projectId}`,
        `https://graph.microsoft.com/beta/projects/${config.projectId}`,
    ];

    for (const url of endpoints) {
        try {
            console.log(`Trying: ${url}`);
            const response = await axios.get(url, { headers });
            console.log('✅ Success!\n');
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                console.log(`❌ Not found at this endpoint`);
                continue;
            } else {
                console.log(`❌ Error: ${error.message}`);
            }
        }
    }

    return null;
}

async function getProjectTasks(token) {
    console.log('📝 Fetching project tasks...\n');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const endpoints = [
        `https://graph.microsoft.com/beta/solutions/projectManagement/projects/${config.projectId}/tasks`,
        `https://graph.microsoft.com/beta/projects/${config.projectId}/tasks`,
    ];

    for (const url of endpoints) {
        try {
            console.log(`Trying: ${url}`);
            const response = await axios.get(url, { headers });
            const tasks = response.data.value || [];
            console.log(`✅ Found ${tasks.length} tasks!\n`);

            tasks.forEach((task, index) => {
                console.log(`${index + 1}. ${task.title || task.name}`);
                if (task.startDate) console.log(`   Start: ${task.startDate}`);
                if (task.dueDate) console.log(`   Due: ${task.dueDate}`);
                if (task.percentComplete !== undefined) console.log(`   Progress: ${task.percentComplete}%`);
                console.log();
            });

            return tasks;
        } catch (error) {
            if (error.response?.status === 404) {
                console.log(`❌ Not found at this endpoint`);
                continue;
            } else {
                console.log(`❌ Error: ${error.message}`);
            }
        }
    }

    return [];
}

async function main() {
    console.log('='.repeat(70));
    console.log('Project for the Web - Tulkah.AI 6 Week Value Roadmap');
    console.log('='.repeat(70));
    console.log();
    console.log(`Project ID: ${config.projectId}`);
    console.log(`Org ID: ${config.orgId}`);
    console.log(`Tenant ID: ${config.tenantId}`);
    console.log();

    try {
        const token = await getAccessToken();

        const project = await getProject(token);

        if (project) {
            console.log('📦 Project Details:');
            console.log(JSON.stringify(project, null, 2));
            console.log();
        }

        const tasks = await getProjectTasks(token);

        if (tasks.length > 0 || project) {
            const data = {
                timestamp: new Date().toISOString(),
                project,
                tasks,
                config
            };

            await fs.writeFile('project_roadmap_data.json', JSON.stringify(data, null, 2));
            console.log('💾 Data saved to: project_roadmap_data.json\n');
        }

        console.log('='.repeat(70));
        console.log(tasks.length > 0 ? '✅ Success!' : '⚠️  No data retrieved via Graph API');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

main();
