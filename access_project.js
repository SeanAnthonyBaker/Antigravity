/**
 * Access Microsoft Project for the web via Dataverse API
 * Using device code authentication (simpler for Node.js)
 */

const msal = require('@azure/msal-node');
const axios = require('axios');
const fs = require('fs').promises;

// Configuration
const config = {
    tenantId: '2bec83ec-133e-4dff-b5e4-45045d92b1c8',
    clientId: 'c88b1b1d-bd08-4007-be32-50d17e06f2a8',
    dataverseUrl: 'https://org54ad8b05ea0bef119f85002248c656a2.crm.dynamics.com',
    projectId: 'fe864a34-8a67-4ed4-bdaf-806faaccc9c3'
};

// MSAL configuration for device code flow
const msalConfig = {
    auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`
    }
};

const pca = new msal.PublicClientApplication(msalConfig);

async function getAccessTokenDeviceCode() {
    console.log('🔐 Authenticating with Microsoft (Device Code Flow)...\n');

    const tokenRequest = {
        scopes: [`${config.dataverseUrl}/user_impersonation`],
        deviceCodeCallback: (response) => {
            console.log('=======================================================');
            console.log('📱 DEVICE CODE AUTHENTICATION');
            console.log('=======================================================');
            console.log('');
            console.log(`1. Visit: ${response.verificationUri}`);
            console.log(`2. Enter code: ${response.userCode}`); console.log('');
            console.log('Waiting for you to complete authentication...');
            console.log('=======================================================\n');
        }
    };

    try {
        const response = await pca.acquireTokenByDeviceCode(tokenRequest);
        console.log('✅ Authentication successful!\n');
        return response.accessToken;
    } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        return null;
    }
}

async function getProjects(token) {
    console.log('📋 Fetching all projects...');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };

    const url = `${config.dataverseUrl}/api/data/v9.2/msdyn_projects`;

    try {
        const response = await axios.get(url, { headers });
        const projects = response.data.value;

        console.log(`✅ Found ${projects.length} project(s):\n`);

        projects.forEach(project => {
            console.log(`  📌 ${project.msdyn_subject || 'Untitled'}`);
            console.log(`     ID: ${project.msdyn_projectid}`);
            console.log(`     Created: ${project.createdon || 'N/A'}\n`);
        });

        return projects;
    } catch (error) {
        console.error(`❌ Error ${error.response?.status}:`, error.response?.statusText);
        if (error.response?.data) {
            console.error('Details:', JSON.stringify(error.response.data, null, 2));
        }
        return [];
    }
}

async function getProjectTasks(token, projectId) {
    console.log(`📝 Fetching tasks for project ${projectId}...`);

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };

    const filter = `_msdyn_project_value eq ${projectId}`;
    const url = `${config.dataverseUrl}/api/data/v9.2/msdyn_projecttasks?$filter=${filter}&$orderby=msdyn_scheduledstart asc`;

    try {
        const response = await axios.get(url, { headers });
        const tasks = response.data.value;

        console.log(`✅ Found ${tasks.length} task(s):\n`);

        tasks.forEach(task => {
            const progress = task.msdyn_progress || 0;
            const statusIcon = progress === 100 ? '✅' : progress > 0 ? '🔄' : '⏳';

            console.log(`${statusIcon} ${task.msdyn_subject || 'Untitled Task'}`);
            console.log(`   Progress: ${progress}%`);

            if (task.msdyn_scheduledstart) {
                console.log(`   Start: ${task.msdyn_scheduledstart}`);
            }
            if (task.msdyn_scheduledend) {
                console.log(`   End: ${task.msdyn_scheduledend}`);
            }
            console.log();
        });

        return tasks;
    } catch (error) {
        console.error(`❌ Error ${error.response?.status}:`, error.response?.statusText);
        if (error.response?.data) {
            console.error('Details:', JSON.stringify(error.response.data, null, 2));
        }
        return [];
    }
}

async function saveToJson(projects, tasks, filename = 'project_data.json') {
    const data = {
        timestamp: new Date().toISOString(),
        projects,
        tasks
    };

    await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`💾 Data saved to: ${filename}`);
}

async function main() {
    console.log('='.repeat(60));
    console.log('Microsoft Project for the web - Dataverse API Access');
    console.log('='.repeat(60));
    console.log();

    // Step 1: Authenticate
    const token = await getAccessTokenDeviceCode();
    if (!token) {
        console.log('\n❌ Authentication failed. Please try again.');
        return;
    }

    // Step 2: Get all projects
    const projects = await getProjects(token);

    if (projects.length > 0) {
        // Step 3: Get tasks for your specific project
        const tasks = await getProjectTasks(token, config.projectId);

        // Step 4: Save to JSON
        await saveToJson(projects, tasks);

        console.log();
        console.log('='.repeat(60));
        console.log('🎉 Success! Your Project for the web data is accessible!');
        console.log('='.repeat(60));
        console.log('\nNext steps:');
        console.log('  - Check project_data.json for the full data');
        console.log('  - Modify this script to create/update tasks');
        console.log('  - Integrate with your Antigravity platform');
    } else {
        console.log('No projects found or error occurred.');
    }
}

// Run the script
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
