/**
 * Access Project for the Web via Dataverse
 * Using Org ID to construct Dataverse URL
 */

const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs').promises;

// From URL: https://planner.cloud.microsoft/webui/premiumplan/fe864a34-8a67-4ed4-bdaf-806faaccc9c3/org/54ad8b05-ea0b-ef11-9f85-002248c656a2
// Org ID: 54ad8b05-ea0b-ef11-9f85-002248c656a2
// This org ID is used to construct the Dataverse URL

const config = {
    projectId: 'fe864a34-8a67-4ed4-bdaf-806faaccc9c3',
    orgIdRaw: '54ad8b05-ea0b-ef11-9f85-002248c656a2',
    // Convert org ID to Dataverse URL format
    dataverseUrl: 'https://org54ad8b05ea0bef119f85002248c656a2.crm.dynamics.com'
};

async function getAccessToken() {
    console.log('🔐 Getting Dataverse access token...');
    try {
        const cmd = `m365 util accesstoken get --resource ${config.dataverseUrl} --output text`;
        const token = execSync(cmd, { encoding: 'utf-8' }).trim();
        console.log('✅ Token obtained\n');
        return token;
    } catch (error) {
        console.error('❌ Failed to get token');
        console.error('Error:', error.message);
        throw error;
    }
}

async function testConnection(token) {
    console.log('🔗 Testing Dataverse connection...\n');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };

    try {
        const response = await axios.get(
            `${config.dataverseUrl}/api/data/v9.2/WhoAmI`,
            { headers }
        );
        console.log('✅ Connected to Dataverse!');
        console.log(`   User ID: ${response.data.UserId}`);
        console.log(`   Org ID: ${response.data.OrganizationId}\n`);
        return true;
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Details:', error.response.data);
        }
        return false;
    }
}

async function getProject(token) {
    console.log('📋 Fetching project by ID...\n');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };

    try {
        // Query for the specific project
        const url = `${config.dataverseUrl}/api/data/v9.2/msdyn_projects(${config.projectId})`;
        console.log(`Querying: ${url}\n`);

        const response = await axios.get(url, { headers });
        const project = response.data;

        console.log('✅ Project found!');
        console.log(`   Name: ${project.msdyn_subject || project.msdyn_name || 'N/A'}`);
        console.log(`   ID: ${project.msdyn_projectid}`);
        console.log();

        return project;
    } catch (error) {
        console.error('❌ Failed to get project:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            if (error.response.status === 404) {
                console.log('\n💡 Project not found with this ID. Trying to list all projects...\n');
                return await listAllProjects(token);
            }
        }
        return null;
    }
}

async function listAllProjects(token) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };

    try {
        const response = await axios.get(
            `${config.dataverseUrl}/api/data/v9.2/msdyn_projects`,
            { headers }
        );

        const projects = response.data.value || [];
        console.log(`✅ Found ${projects.length} project(s):\n`);

        projects.forEach((project, index) => {
            console.log(`${index + 1}. ${project.msdyn_subject || project.msdyn_name || 'Unnamed'}`);
            console.log(`   ID: ${project.msdyn_projectid}`);
            console.log();
        });

        return projects;
    } catch (error) {
        console.error('❌ Failed to list projects:', error.message);
        return [];
    }
}

async function getProjectTasks(token, projectId) {
    console.log('📝 Fetching project tasks...\n');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };

    try {
        const response = await axios.get(
            `${config.dataverseUrl}/api/data/v9.2/msdyn_projecttasks?$filter=_msdyn_project_value eq ${projectId}`,
            { headers }
        );

        const tasks = response.data.value || [];
        console.log(`✅ Found ${tasks.length} tasks:\n`);

        tasks.forEach((task, index) => {
            console.log(`${index + 1}. ${task.msdyn_subject || 'Unnamed task'}`);
            if (task.msdyn_start) console.log(`   Start: ${task.msdyn_start}`);
            if (task.msdyn_finish) console.log(`   Finish: ${task.msdyn_finish}`);
            if (task.msdyn_progress !== undefined) console.log(`   Progress: ${task.msdyn_progress}%`);
            console.log();
        });

        return tasks;
    } catch (error) {
        console.error('❌ Failed to get tasks:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Details:', error.response.data);
        }
        return [];
    }
}

async function main() {
    console.log('='.repeat(70));
    console.log('Dataverse - Project for the Web Access');
    console.log('='.repeat(70));
    console.log();
    console.log(`Dataverse URL: ${config.dataverseUrl}`);
    console.log(`Project ID: ${config.projectId}`);
    console.log();

    try {
        const token = await getAccessToken();

        const connected = await testConnection(token);
        if (!connected) {
            console.log('\n❌ Cannot proceed without valid connection');
            return;
        }

        const project = await getProject(token);

        let tasks = [];
        if (project && !Array.isArray(project)) {
            tasks = await getProjectTasks(token, project.msdyn_projectid);

            const data = {
                timestamp: new Date().toISOString(),
                project,
                tasks
            };

            await fs.writeFile('project_dataverse_data.json', JSON.stringify(data, null, 2));
            console.log('💾 Data saved to: project_dataverse_data.json\n');
        } else if (Array.isArray(project)) {
            await fs.writeFile('all_projects_dataverse.json', JSON.stringify(project, null, 2));
            console.log('💾 All projects saved to: all_projects_dataverse.json\n');
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
