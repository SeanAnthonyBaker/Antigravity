/**
 * Test Dataverse Connection
 * Using actual working Dataverse URL: https://orgdbdcf748.crm11.dynamics.com
 */

const { execSync } = require('child_process');
const axios = require('axios');

const config = {
    dataverseUrl: 'https://orgdbdcf748.crm11.dynamics.com'
};

async function getAccessToken() {
    console.log('🔐 Getting Dataverse access token...');
    const cmd = `m365 util accesstoken get --resource ${config.dataverseUrl} --output text`;
    const token = execSync(cmd, { encoding: 'utf-8' }).trim();
    console.log('✅ Token obtained\n');
    return token;
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

        console.log('✅ SUCCESS! Connected to Dataverse!');
        console.log(`   User ID: ${response.data.UserId}`);
        console.log(`   Business Unit ID: ${response.data.BusinessUnitId}`);
        console.log(`   Organization ID: ${response.data.OrganizationId}\n`);
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

async function listTables(token) {
    console.log('📊 Listing available tables...\n');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };

    try {
        const response = await axios.get(
            `${config.dataverseUrl}/api/data/v9.2/EntityDefinitions?$select=LogicalName,DisplayName&$top=20`,
            { headers }
        );

        const tables = response.data.value || [];
        console.log(`✅ Found ${tables.length} tables (showing first 20):\n`);

        tables.forEach((table, index) => {
            const displayName = table.DisplayName?.UserLocalizedLabel?.Label || 'N/A';
            console.log(`${index + 1}. ${table.LogicalName}`);
            console.log(`   Display: ${displayName}`);
        });

        return tables;
    } catch (error) {
        console.error('❌ Failed to list tables:', error.message);
        return [];
    }
}

async function main() {
    console.log('='.repeat(70));
    console.log('Dataverse Connection Test');
    console.log('='.repeat(70));
    console.log(`\nDataverse URL: ${config.dataverseUrl}\n`);

    try {
        const token = await getAccessToken();

        const connected = await testConnection(token);

        if (connected) {
            await listTables(token);

            console.log('\n' + '='.repeat(70));
            console.log('✅ Dataverse is FULLY OPERATIONAL!');
            console.log('='.repeat(70));
            console.log('\nYou can now use the Dataverse MCP to:');
            console.log('  - Query tables and records');
            console.log('  - Create/update/delete data');
            console.log('  - Manage schema');
            console.log('  - Access Project for the Web data (if migrated)');
        } else {
            console.log('\n' + '='.repeat(70));
            console.log('❌ Connection Failed');
            console.log('='.repeat(70));
        }

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    }
}

main();
