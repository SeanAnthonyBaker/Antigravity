/**
 * Test Dataverse API Access
 * Diagnose connectivity and permissions
 */

const { execSync } = require('child_process');
const axios = require('axios');

const config = {
    dataverseUrl: 'https://orgdcbce74b.crm11.dynamics.com'
};

async function testDataverseAccess() {
    console.log('🔧 Testing Dataverse API Access\n');

    try {
        // Get token
        console.log('1️⃣ Getting access token...');
        const tokenCmd = `m365 util accesstoken get --resource ${config.dataverseUrl} --output text`;
        const token = execSync(tokenCmd, { encoding: 'utf-8' }).trim();
        console.log('✅ Token obtained\n');

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0'
        };

        // Test 1: WhoAmI
        console.log('2️⃣ Testing WhoAmI endpoint...');
        try {
            const whoAmI = await axios.get(`${config.dataverseUrl}/api/data/v9.2/WhoAmI`, { headers });
            console.log('✅ WhoAmI successful!');
            console.log('   User ID:', whoAmI.data.UserId);
            console.log('   Business Unit ID:', whoAmI.data.BusinessUnitId);
            console.log('   Organization ID:', whoAmI.data.OrganizationId);
            console.log();
        } catch (error) {
            console.log('❌ WhoAmI failed:', error.message);
            if (error.response) {
                console.log('   Status:', error.response.status);
                console.log('   Details:', error.response.data);
            }
            console.log();
        }

        // Test 2: List entity sets
        console.log('3️⃣ Checking available entity sets...');
        try {
            const metadata = await axios.get(`${config.dataverseUrl}/api/data/v9.2/`, { headers });
            const entitySets = Object.keys(metadata.data.value).filter(key => key.includes('msdyn'));
            console.log(`✅ Found ${entitySets.length} msdyn entity sets`);
            console.log('   Project-related entities:');
            entitySets.filter(e => e.includes('project')).forEach(e => console.log(`   - ${e}`));
            console.log();
        } catch (error) {
            console.log('❌ Entity sets check failed:', error.message);
            console.log();
        }

        // Test 3: Projects
        console.log('4️⃣ Querying msdyn_projects...');
        try {
            const response = await axios.get(
                `${config.dataverseUrl}/api/data/v9.2/msdyn_projects`,
                { headers }
            );
            console.log(`✅ Query successful! Found ${response.data.value.length} projects`);

            if (response.data.value.length > 0) {
                console.log('\n📋 Projects:');
                response.data.value.forEach(p => {
                    console.log(`   - ${p.msdyn_subject || 'Untitled'} (${p.msdyn_projectid})`);
                });
            } else {
                console.log('⚠️  No projects found in this Dataverse environment');
                console.log('   This could mean:');
                console.log('   1. No projects exist yet in Project for the Web');
                console.log('   2. Projects are in a different Dataverse environment');
                console.log('   3. User doesn\'t have permission to view projects');
            }
            console.log();
        } catch (error) {
            console.log('❌ Projects query failed:', error.message);
            if (error.response) {
                console.log('   Status:', error.response.status);
                console.log('   Details:', JSON.stringify(error.response.data, null, 2));
            }
            console.log();
        }

        // Test 4: Project Tasks
        console.log('5️⃣ Querying msdyn_projecttasks...');
        try {
            const response = await axios.get(
                `${config.dataverseUrl}/api/data/v9.2/msdyn_projecttasks`,
                { headers }
            );
            console.log(`✅ Query successful! Found ${response.data.value.length} tasks`);
            console.log();
        } catch (error) {
            console.log('❌ Tasks query failed:', error.message);
            if (error.response) {
                console.log('   Status:', error.response.status);
            }
            console.log();
        }

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
    }
}

testDataverseAccess();
