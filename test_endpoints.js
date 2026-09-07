/**
 * Test Dataverse API Endpoints
 * Diagnose what data is accessible
 */

const { execSync } = require('child_process');
const axios = require('axios');

const config = {
    dataverseUrl: 'https://org54ad8b05ea0bef119f85002248c656a2.crm.dynamics.com',
    projectId: 'fe864a34-8a67-4ed4-bdaf-806faaccc9c3'
};

function getToken() {
    const tokenCmd = `m365 util accesstoken get --resource ${config.dataverseUrl} --output text`;
    return execSync(tokenCmd, { encoding: 'utf-8' }).trim();
}

async function testEndpoint(token, endpoint, description) {
    console.log(`\nTesting: ${description}`);
    console.log(`Endpoint: ${endpoint}`);

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };

    try {
        const response = await axios.get(`${config.dataverseUrl}${endpoint}`, { headers });
        console.log(`✅ Success! Found ${response.data.value ? response.data.value.length : '?'} records`);

        if (response.data.value && response.data.value.length > 0) {
            console.log(`First record:`, JSON.stringify(response.data.value[0], null, 2).substring(0, 500));
        }

        return response.data;
    } catch (error) {
        console.log(`❌ Error: ${error.response?.status} - ${error.response?.statusText}`);
        if (error.response?.data?.error) {
            console.log(`   Message: ${error.response.data.error.message}`);
        }
        return null;
    }
}

async function main() {
    console.log('='.repeat(70));
    console.log('Dataverse API Endpoint Diagnostics');
    console.log('='.repeat(70));

    const token = getToken();
    console.log('\n✅ Got access token from M365 CLI');

    // Test various endpoints
    await testEndpoint(token, '/api/data/v9.2/msdyn_projects', 'All Projects');
    await testEndpoint(token, `/api/data/v9.2/msdyn_projects(${config.projectId})`, 'Specific Project');
    await testEndpoint(token, '/api/data/v9.2/msdyn_projecttasks', 'All Project Tasks');
    await testEndpoint(token, '/api/data/v9.2/msdyn_projectbuckets', 'Project Buckets/Phases');
    await testEndpoint(token, '/api/data/v9.2/msdyn_resourceassignments', 'Resource Assignments');

    // Try with expanded query
    await testEndpoint(token, '/api/data/v9.2/msdyn_projects?$expand=msdyn_project_msdyn_projecttask_ContainingProject', 'Projects with Tasks (expanded)');

    console.log('\n' + '='.repeat(70));
    console.log('Diagnostics Complete');
    console.log('='.repeat(70));
}

main();
