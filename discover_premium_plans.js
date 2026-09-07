/**
 * Discover All Premium Plans
 * Checks both Dataverse-backed and Teams-native Premium Plans
 */

const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs').promises;

const config = {
    dataverseUrl: 'https://orgdbdcf748.crm11.dynamics.com',
    knownTeamsNativePlan: {
        id: 'fe864a34-8a67-4ed4-bdaf-806faaccc9c3',
        name: 'Tulkah.AI 6 Week Value Roadmap',
        type: 'Teams-native Premium Plan',
        url: 'https://planner.cloud.microsoft/webui/premiumplan/fe864a34-8a67-4ed4-bdaf-806faaccc9c3/org/54ad8b05-ea0b-ef11-9f85-002248c656a2',
        accessible: false,
        note: 'Not accessible via API'
    }
};

async function getAccessToken() {
    console.log('🔐 Getting Dataverse access token...');
    const cmd = `m365 util accesstoken get --resource ${config.dataverseUrl} --output text`;
    const token = execSync(cmd, { encoding: 'utf-8' }).trim();
    console.log('✅ Token obtained\n');
    return token;
}

async function queryDataverseProjects(token) {
    console.log('📊 Querying Dataverse for Project for the Web plans...\n');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        'Prefer': 'odata.include-annotations="*"'
    };

    try {
        // Query the msdyn_project table
        const response = await axios.get(
            `${config.dataverseUrl}/api/data/v9.2/msdyn_projects`,
            { headers }
        );

        const projects = response.data.value || [];

        if (projects.length === 0) {
            console.log('⚠️  No Dataverse-backed Premium Plans found');
            console.log('   (Dataverse environment is new/empty)\n');
            return [];
        }

        console.log(`✅ Found ${projects.length} Dataverse-backed Premium Plan(s):\n`);

        projects.forEach((project, index) => {
            console.log(`${index + 1}. ${project.msdyn_subject || project.msdyn_name || 'Unnamed'}`);
            console.log(`   Project ID: ${project.msdyn_projectid}`);
            console.log(`   Created: ${project.createdon || 'Unknown'}`);
            console.log(`   Status: ${project.msdyn_projectstatus || 'Unknown'}`);
            console.log();
        });

        return projects;

    } catch (error) {
        if (error.response?.status === 404) {
            console.log('⚠️  msdyn_project table not found in Dataverse');
            console.log('   This means Project for the Web is not enabled in this environment\n');
            return [];
        }

        console.error('❌ Error querying Dataverse:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Details:', error.response.data?.error?.message || error.response.statusText);
        }
        return [];
    }
}

async function checkProjectTables(token) {
    console.log('🔍 Checking if Project for the Web tables exist...\n');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };

    const projectTables = [
        'msdyn_project',
        'msdyn_projecttask',
        'msdyn_projectteam',
        'msdyn_projectbucket'
    ];

    const existingTables = [];

    for (const tableName of projectTables) {
        try {
            const response = await axios.get(
                `${config.dataverseUrl}/api/data/v9.2/${tableName}s?$top=1`,
                { headers }
            );
            console.log(`✅ ${tableName} - exists`);
            existingTables.push(tableName);
        } catch (error) {
            if (error.response?.status === 404) {
                console.log(`❌ ${tableName} - not found`);
            } else {
                console.log(`⚠️  ${tableName} - error: ${error.message}`);
            }
        }
    }

    console.log();
    return existingTables;
}

async function main() {
    console.log('='.repeat(70));
    console.log('Premium Plans Discovery');
    console.log('='.repeat(70));
    console.log();

    const summary = {
        dataversePlans: [],
        teamsNativePlans: [config.knownTeamsNativePlan],
        totalCount: 1,
        accessible: 0,
        projectTablesExist: []
    };

    try {
        const token = await getAccessToken();

        // Check if Project tables exist
        summary.projectTablesExist = await checkProjectTables(token);

        // Query Dataverse for projects
        const dataverseProjects = await queryDataverseProjects(token);
        summary.dataversePlans = dataverseProjects;
        summary.totalCount += dataverseProjects.length;
        summary.accessible = dataverseProjects.length;

        // Display Teams-native plan
        console.log('📱 Known Teams-Native Premium Plans:\n');
        console.log(`1. ${config.knownTeamsNativePlan.name}`);
        console.log(`   Type: ${config.knownTeamsNativePlan.type}`);
        console.log(`   Project ID: ${config.knownTeamsNativePlan.id}`);
        console.log(`   URL: ${config.knownTeamsNativePlan.url}`);
        console.log(`   API Accessible: ❌ No (${config.knownTeamsNativePlan.note})`);
        console.log();

        // Summary
        console.log('='.repeat(70));
        console.log('SUMMARY');
        console.log('='.repeat(70));
        console.log(`\n📊 Total Premium Plans Found: ${summary.totalCount}`);
        console.log(`   - Dataverse-backed: ${summary.dataversePlans.length} (API accessible ✅)`);
        console.log(`   - Teams-native: ${summary.teamsNativePlans.length} (API accessible ❌)`);
        console.log();

        if (summary.projectTablesExist.length > 0) {
            console.log('✅ Project for the Web tables exist in Dataverse');
            console.log('   You can create new Dataverse-backed Premium Plans');
        } else {
            console.log('⚠️  Project for the Web tables NOT found in Dataverse');
            console.log('   To enable Project for the Web in Dataverse:');
            console.log('   1. Admin Center → Enable "Project for the Web"');
            console.log('   2. Or create a Premium Plan in this environment');
        }

        console.log();
        console.log('💡 Recommendations:');
        console.log();
        console.log('For "Tulkah.AI 6 Week Value Roadmap" (Teams-native):');
        console.log('  → Use Power Automate to export data');
        console.log('  → Or manually export via browser UI');
        console.log();

        if (summary.projectTablesExist.length > 0) {
            console.log('For NEW projects:');
            console.log('  → Create in Dataverse environment for API access');
            console.log('  → Use Dataverse MCP for programmatic control');
        }

        console.log('\n' + '='.repeat(70));

        // Save summary
        await fs.writeFile('premium_plans_summary.json', JSON.stringify(summary, null, 2));
        console.log('\n💾 Summary saved to: premium_plans_summary.json');

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    }
}

main();
