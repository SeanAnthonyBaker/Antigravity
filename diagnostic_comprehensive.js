/**
 * Comprehensive Dataverse Diagnostic
 * Find out what entities exist and where Project data might be
 */

const { execSync } = require('child_process');
const axios = require('axios');

const config = {
    dataverseUrl: 'https://orgdcbce74b.crm11.dynamics.com'
};

async function comprehensiveDiagnostic() {
    console.log('🔍 Comprehensive Dataverse Diagnostic\n');
    console.log('='.repeat(70));

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
            'OData-Version': '4.0',
            'Prefer': 'odata.include-annotations="*"'
        };

        // Test connection with WhoAmI
        console.log('2️⃣ Testing connection (WhoAmI)...');
        try {
            const whoAmI = await axios.get(`${config.dataverseUrl}/api/data/v9.2/WhoAmI`, { headers });
            console.log('✅ Connected successfully!');
            console.log(`   User ID: ${whoAmI.data.UserId}`);
            console.log(`   Organization ID: ${whoAmI.data.OrganizationId}\n`);
        } catch (error) {
            console.log('❌ WhoAmI failed:', error.message, '\n');
            return;
        }

        // Try different project entity variations
        console.log('3️⃣ Searching for Project entities...\n');

        const projectEntities = [
            'msdyn_projects',
            'msdyn_project',
            'projects',
            'project',
            'msdynce_projects'
        ];

        for (const entityName of projectEntities) {
            try {
                const response = await axios.get(
                    `${config.dataverseUrl}/api/data/v9.2/${entityName}?$top=5`,
                    { headers }
                );

                const count = response.data.value?.length || 0;
                console.log(`✅ ${entityName}: Found ${count} records`);

                if (count > 0) {
                    console.log('   Sample record:');
                    const sample = response.data.value[0];
                    Object.keys(sample).slice(0, 5).forEach(key => {
                        console.log(`   - ${key}: ${sample[key]}`);
                    });
                }
                console.log();

            } catch (error) {
                if (error.response?.status === 404) {
                    console.log(`❌ ${entityName}: Entity not found`);
                } else {
                    console.log(`❌ ${entityName}: ${error.message}`);
                }
            }
        }

        // Try project tasks
        console.log('4️⃣ Searching for Task entities...\n');

        const taskEntities = [
            'msdyn_projecttasks',
            'msdyn_projecttask',
            'tasks'
        ];

        for (const entityName of taskEntities) {
            try {
                const response = await axios.get(
                    `${config.dataverseUrl}/api/data/v9.2/${entityName}?$top=5`,
                    { headers }
                );

                const count = response.data.value?.length || 0;
                console.log(`✅ ${entityName}: Found ${count} records`);

                if (count > 0) {
                    console.log('   Sample task:');
                    const sample = response.data.value[0];
                    console.log(`   - ${sample.msdyn_subject || sample.subject || 'No subject'}`);
                }
                console.log();

            } catch (error) {
                if (error.response?.status === 404) {
                    console.log(`❌ ${entityName}: Entity not found`);
                } else {
                    console.log(`❌ ${entityName}: ${error.message}`);
                }
            }
        }

        // List all available entity sets
        console.log('5️⃣ Listing all available entity sets...\n');
        try {
            const metadata = await axios.get(`${config.dataverseUrl}/api/data/v9.2/`, { headers });
            const allEntities = metadata.data.value || [];

            const projectRelated = allEntities.filter(entity => {
                const name = entity.name || '';
                return name.toLowerCase().includes('project') ||
                    name.toLowerCase().includes('task') ||
                    name.toLowerCase().includes('msdyn');
            });

            console.log(`✅ Found ${projectRelated.length} potentially relevant entities:`);
            projectRelated.slice(0, 20).forEach(entity => {
                console.log(`   - ${entity.name}`);
            });

            if (projectRelated.length > 20) {
                console.log(`   ... and ${projectRelated.length - 20} more`);
            }

        } catch (error) {
            console.log('❌ Could not list entity sets:', error.message);
        }

        console.log('\n' + '='.repeat(70));
        console.log('📊 Diagnostic Complete');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Details:', error.response.data);
        }
    }
}

comprehensiveDiagnostic();
