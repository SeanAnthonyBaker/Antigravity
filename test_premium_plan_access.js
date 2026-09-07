/**
 * Try Multiple API Endpoints to Access Premium Plan
 * Project ID: fe864a34-8a67-4ed4-bdaf-806faaccc9c3
 */

const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs').promises;

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

async function tryEndpoint(token, url, description) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 Trying: ${description}`);
    console.log(`   URL: ${url}`);
    console.log('='.repeat(70));

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    try {
        const response = await axios.get(url, { headers });
        console.log(`✅ SUCCESS! Status: ${response.status}`);
        console.log('\n📦 Response Data:');
        console.log(JSON.stringify(response.data, null, 2).substring(0, 1000));

        if (JSON.stringify(response.data).length > 1000) {
            console.log('\n... (truncated, full data saved to file)');
        }

        return {
            success: true,
            endpoint: description,
            url: url,
            data: response.data
        };
    } catch (error) {
        if (error.response) {
            console.log(`❌ Failed: ${error.response.status} ${error.response.statusText}`);
            console.log(`   Error: ${error.response.data?.error?.message || error.message}`);
        } else {
            console.log(`❌ Failed: ${error.message}`);
        }
        return {
            success: false,
            endpoint: description,
            url: url,
            error: error.response?.data || error.message
        };
    }
}

async function main() {
    console.log('='.repeat(70));
    console.log('Premium Plan Access - Multi-Endpoint Attempt');
    console.log('='.repeat(70));
    console.log(`\nProject ID: ${config.projectId}`);
    console.log(`Org ID: ${config.orgId}`);
    console.log(`Tenant ID: ${config.tenantId}\n`);

    try {
        const token = await getAccessToken();
        const results = [];

        // 1. Project for the Web API - Beta
        results.push(await tryEndpoint(
            token,
            `https://graph.microsoft.com/beta/solutions/projectManagement/projects/${config.projectId}`,
            'Project for the Web API (Beta)'
        ));

        // 2. Project API - Try alternative path
        results.push(await tryEndpoint(
            token,
            `https://graph.microsoft.com/beta/projects/${config.projectId}`,
            'Direct Project API (Beta)'
        ));

        // 3. Project for the Web - v1.0
        results.push(await tryEndpoint(
            token,
            `https://graph.microsoft.com/v1.0/solutions/projectManagement/projects/${config.projectId}`,
            'Project for the Web API (v1.0)'
        ));

        // 4. Planner Premium Plan
        results.push(await tryEndpoint(
            token,
            `https://graph.microsoft.com/beta/planner/plans/${config.projectId}`,
            'Planner Premium Plan API'
        ));

        // 5. Try as a Planner Roster Plan
        results.push(await tryEndpoint(
            token,
            `https://graph.microsoft.com/beta/planner/rosters/${config.projectId}/plans`,
            'Planner Roster Plans'
        ));

        // 6. Try Project Tasks
        results.push(await tryEndpoint(
            token,
            `https://graph.microsoft.com/beta/solutions/projectManagement/projects/${config.projectId}/tasks`,
            'Project Tasks API'
        ));

        // 7. Try Teams-based approach (if associated with a team)
        results.push(await tryEndpoint(
            token,
            `https://graph.microsoft.com/v1.0/me/joinedTeams`,
            'User Teams (to find team ID)'
        ));

        // 8. Try Project Buckets
        results.push(await tryEndpoint(
            token,
            `https://graph.microsoft.com/beta/planner/plans/${config.projectId}/buckets`,
            'Plan Buckets'
        ));

        // 9. Try Tasks directly
        results.push(await tryEndpoint(
            token,
            `https://graph.microsoft.com/beta/planner/plans/${config.projectId}/tasks`,
            'Plan Tasks'
        ));

        // 10. Try with org context
        results.push(await tryEndpoint(
            token,
            `https://graph.microsoft.com/beta/organization/${config.tenantId}/projects/${config.projectId}`,
            'Organization Projects'
        ));

        console.log('\n' + '='.repeat(70));
        console.log('SUMMARY');
        console.log('='.repeat(70));

        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        console.log(`\n✅ Successful endpoints: ${successful.length}`);
        successful.forEach(r => {
            console.log(`   - ${r.endpoint}`);
        });

        console.log(`\n❌ Failed endpoints: ${failed.length}`);

        if (successful.length > 0) {
            console.log('\n📦 Saving successful responses...');
            await fs.writeFile(
                'premium_plan_access_results.json',
                JSON.stringify({ successful, failed }, null, 2)
            );
            console.log('✅ Saved to: premium_plan_access_results.json');
        } else {
            console.log('\n⚠️  No endpoints returned data.');
            console.log('\nThis confirms the Premium Plan is NOT accessible via standard APIs.');
            console.log('The plan likely uses Teams-native storage without Graph API exposure.');
        }

        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    }
}

main();
