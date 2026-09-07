/**
 * Discover Dataverse Environment URLs
 * Uses M365 CLI to query Power Platform environments
 */

const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs').promises;

async function discoverEnvironments() {
    console.log('🔍 Discovering Dataverse Environments...\n');

    try {
        // Step 1: Check M365 CLI authentication
        console.log('1️⃣ Checking M365 CLI authentication...');
        const statusCmd = 'm365 status --output json';
        const status = JSON.parse(execSync(statusCmd, { encoding: 'utf-8' }));
        console.log(`✅ Logged in as: ${status.connectedAs}\n`);

        // Step 2: Get access token for Power Platform
        console.log('2️⃣ Getting Power Platform access token...');
        const tokenCmd = 'm365 util accesstoken get --resource https://api.bap.microsoft.com --output text';
        const token = execSync(tokenCmd, { encoding: 'utf-8' }).trim();
        console.log('✅ Token obtained\n');

        // Step 3: Query environments
        console.log('3️⃣ Querying Power Platform environments...\n');

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const apiUrl = 'https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments?api-version=2020-10-01';
        const response = await axios.get(apiUrl, { headers });

        const environments = response.data.value || [];

        if (environments.length === 0) {
            console.log('⚠️  No environments found\n');
            return;
        }

        console.log(`✅ Found ${environments.length} environment(s):\n`);

        const results = [];

        environments.forEach((env, index) => {
            const name = env.properties?.displayName || 'Unnamed';
            const id = env.name;
            const url = env.properties?.linkedEnvironmentMetadata?.instanceUrl;
            const sku = env.properties?.environmentSku;
            const state = env.properties?.states?.management?.id;

            console.log(`📦 Environment ${index + 1}: ${name}`);
            console.log(`   ID: ${id}`);
            console.log(`   Type: ${sku}`);
            console.log(`   State: ${state}`);

            if (url) {
                console.log(`   🌐 Dataverse URL: ${url}`);
                console.log(`   📍 API Endpoint: ${url}/api/data/v9.2/`);

                results.push({
                    name,
                    id,
                    dataverseUrl: url,
                    apiEndpoint: `${url}/api/data/v9.2/`,
                    sku,
                    state
                });
            } else {
                console.log(`   ⚠️  No Dataverse URL (environment has no database)`);
            }
            console.log();
        });

        // Step 4: Save results
        if (results.length > 0) {
            const outputFile = 'dataverse_environments.json';
            await fs.writeFile(outputFile, JSON.stringify(results, null, 2));
            console.log(`💾 Results saved to: ${outputFile}\n`);

            // Print instructions
            console.log('='.repeat(70));
            console.log('📋 Next Steps:');
            console.log('='.repeat(70));
            console.log('1. Choose the environment containing your Project for the Web data');
            console.log('2. Copy the Dataverse URL');
            console.log('3. Update config.dataverseUrl in dataverse_api.js');
            console.log('4. Run: node dataverse_api.js');
            console.log('='.repeat(70));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);

        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Details:', error.response.data);
        }

        console.log('\n💡 Alternative: Manually find your Dataverse URL');
        console.log('   Visit: https://admin.powerplatform.microsoft.com/environments');
        console.log('   Look for "Environment URL" in environment details\n');
    }
}

discoverEnvironments();
