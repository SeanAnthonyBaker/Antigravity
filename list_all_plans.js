/**
 * List ALL available Planner plans
 * Helps identify the correct plan and its ID
 */

const { execSync } = require('child_process');
const axios = require('axios');

async function listAllPlans() {
    console.log('📋 Listing All Available Planner Plans\n');
    console.log('='.repeat(70));

    try {
        // Get token
        console.log('🔐 Getting access token...');
        const cmd = 'm365 util accesstoken get --resource https://graph.microsoft.com --output text';
        const token = execSync(cmd, { encoding: 'utf-8' }).trim();
        console.log('✅ Token obtained\n');

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Get all groups
        console.log('📂 Fetching all groups...\n');
        const groupsResponse = await axios.get(
            'https://graph.microsoft.com/v1.0/groups',
            { headers }
        );

        const groups = groupsResponse.data.value;
        console.log(`Found ${groups.length} groups\n`);

        let totalPlans = 0;
        const allPlans = [];

        // For each group, try to get plans
        for (const group of groups) {
            try {
                const plansResponse = await axios.get(
                    `https://graph.microsoft.com/v1.0/groups/${group.id}/planner/plans`,
                    { headers }
                );

                const plans = plansResponse.data.value || [];

                if (plans.length > 0) {
                    console.log(`\n📦 Group: ${group.displayName}`);
                    console.log(`   ${plans.length} plan(s):`);

                    plans.forEach(plan => {
                        console.log(`\n   ✅ ${plan.title}`);
                        console.log(`      Plan ID: ${plan.id}`);
                        console.log(`      Created: ${new Date(plan.createdDateTime).toLocaleDateString()}`);

                        allPlans.push({
                            title: plan.title,
                            id: plan.id,
                            groupName: group.displayName,
                            groupId: group.id,
                            created: plan.createdDateTime
                        });
                    });

                    totalPlans += plans.length;
                }
            } catch (err) {
                // Skip groups without planner
                continue;
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log(`\n📊 Summary: Found ${totalPlans} total plan(s) across ${groups.length} groups\n`);

        if (allPlans.length > 0) {
            // Save to JSON
            const fs = require('fs').promises;
            await fs.writeFile('all_plans.json', JSON.stringify(allPlans, null, 2));
            console.log('💾 Full list saved to: all_plans.json\n');

            console.log('🔍 Plans matching "roadmap" or "6 week":');
            const matches = allPlans.filter(p =>
                p.title.toLowerCase().includes('roadmap') ||
                p.title.toLowerCase().includes('6 week') ||
                p.title.toLowerCase().includes('tulkah')
            );

            if (matches.length > 0) {
                matches.forEach(plan => {
                    console.log(`\n   ⭐ ${plan.title}`);
                    console.log(`      ID: ${plan.id}`);
                    console.log(`      Group: ${plan.groupName}`);
                });
            } else {
                console.log('   (No matches found - check all_plans.json for full list)');
            }
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Details:', error.response.data);
        }
    }
}

listAllPlans();
