/**
 * Detailed Dataverse API Test with Full Error Output
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

async function testAPI() {
    console.log('Getting token...');
    const token = getToken();
    console.log('✅ Token obtained\n');
    console.log(`Token (first 50 chars): ${token.substring(0, 50)}...\n`);

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };

    const url = `${config.dataverseUrl}/api/data/v9.2/WhoAmI`;

    console.log(`Testing WhoAmI endpoint: ${url}\n`);

    try {
        const response = await axios.get(url, { headers });
        console.log('✅ WhoAmI Success!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ WhoAmI Failed');
        console.log('Status:', error.response?.status);
        console.log('Status Text:', error.response?.statusText);
        console.log('Error Data:', JSON.stringify(error.response?.data, null, 2));
        console.log('Full Error:', error.message);
    }

    // Try projects endpoint
    const projectsUrl = `${config.dataverseUrl}/api/data/v9.2/msdyn_projects`;
    console.log(`\nTesting Projects endpoint: ${projectsUrl}\n`);

    try {
        const response = await axios.get(projectsUrl, { headers });
        console.log('✅ Projects Success!');
        console.log(`Found ${response.data.value.length} projects`);
        if (response.data.value.length > 0) {
            console.log('First project:', JSON.stringify(response.data.value[0], null, 2));
        }
    } catch (error) {
        console.log('❌ Projects Failed');
        console.log('Status:', error.response?.status);
        console.log('Status Text:', error.response?.statusText);
        console.log('Error Data:', JSON.stringify(error.response?.data, null, 2));
    }
}

testAPI();
