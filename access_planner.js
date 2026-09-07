/**
 * Access Tulkah.AI 6 Week Value Roadmap from Microsoft Planner
 * Uses M365 CLI (already authenticated) + Graph API
 */

const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs').promises;

// Known from screenshot: Plan name is "Tulkah.AI 6 Week Value Roadmap"
// Need to find the group ID first, then the plan ID

async function getAccessToken() {
    console.log('🔐 Getting Microsoft Graph access token...');
    const cmd = 'm365 util accesstoken get --resource https://graph.microsoft.com --output text';
    const token = execSync(cmd, { encoding: 'utf-8' }).trim();
    console.log('✅ Token obtained\n');
    return token;
}

async function findPlan(token, planName) {
    console.log(`🔍 Searching for plan: "${planName}"...\\n`);

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        // Get all groups (Planner plans are associated with M365 groups)
        const groupsResponse = await axios.get(
            'https://graph.microsoft.com/v1.0/groups',
            { headers }
        );

        const groups = groupsResponse.data.value;
        console.log(`Found ${groups.length} groups. Searching for plans...\\n`);

        const allFoundPlans = [];

        // Search each group for plans
        for (const group of groups) {
            try {
                const plansResponse = await axios.get(
                    `https://graph.microsoft.com/v1.0/groups/${group.id}/planner/plans`,
                    { headers }
                );

                const plans = plansResponse.data.value || [];

                for (const plan of plans) {
                    allFoundPlans.push(`- "${plan.title}" (Group: ${group.displayName})`);
                    if (plan.title === planName) {
                        console.log(`✅ Found plan!`);
                        console.log(`   Plan ID: ${plan.id}`);
                        console.log(`   Group: ${group.displayName}`);
                        console.log(`   Created: ${plan.createdDateTime}\\n`);
                        return { plan, group };
                    }
                }
            } catch (err) {
                // Skip groups without plans
                continue;
            }
        }

        console.log('\n❌ Exact plan not found. Here are all the plans we did find across these groups:');
        if (allFoundPlans.length > 0) {
            console.log(allFoundPlans.join('\n'));
        } else {
            console.log("  No plans found at all in any of the 13 groups!");
        }
        return null;

    } catch (error) {
        console.error('❌ Error searching for plan:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Details:', error.response.data);
        }
        return null;
    }
}

async function getPlanDetails(token, planId) {
    console.log('📋 Fetching plan details...\\n');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        // Get plan details
        const planResponse = await axios.get(
            `https://graph.microsoft.com/v1.0/planner/plans/${planId}/details`,
            { headers }
        );

        return planResponse.data;
    } catch (error) {
        console.error('❌ Error getting plan details:', error.message);
        return null;
    }
}

async function getPlanTasks(token, planId) {
    console.log('📝 Fetching all tasks...\\n');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        const tasksResponse = await axios.get(
            `https://graph.microsoft.com/v1.0/planner/plans/${planId}/tasks`,
            { headers }
        );

        const tasks = tasksResponse.data.value || [];
        console.log(`✅ Found ${tasks.length} tasks:\\n`);

        tasks.forEach((task, index) => {
            const status = task.percentComplete === 100 ? '✅' :
                task.percentComplete > 0 ? '🔄' : '⏳';

            console.log(`${index + 1}. ${status} ${task.title}`);
            console.log(`   Progress: ${task.percentComplete}%`);
            if (task.startDateTime) {
                console.log(`   Start: ${task.startDateTime}`);
            }
            if (task.dueDateTime) {
                console.log(`   Due: ${task.dueDateTime}`);
            }
            console.log();
        });

        return tasks;
    } catch (error) {
        console.error('❌ Error getting tasks:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Details:', error.response.data);
        }
        return [];
    }
}

async function getBuckets(token, planId) {
    console.log('🗂️  Fetching buckets...\\n');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        const bucketsResponse = await axios.get(
            `https://graph.microsoft.com/v1.0/planner/plans/${planId}/buckets`,
            { headers }
        );

        const buckets = bucketsResponse.data.value || [];
        console.log(`✅ Found ${buckets.length} buckets:\\n`);

        buckets.forEach(bucket => {
            console.log(`   📦 ${bucket.name}`);
        });
        console.log();

        return buckets;
    } catch (error) {
        console.error('❌ Error getting buckets:', error.message);
        return [];
    }
}

async function saveToJson(data, filename = '6_week_roadmap_data.json') {
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`💾 Data saved to: ${filename}\\n`);
}

async function main() {
    console.log('='.repeat(70));
    console.log('Tulkah.AI 6 Week Value Roadmap - Microsoft Planner Access');
    console.log('='.repeat(70));
    console.log();

    try {
        // Step 1: Get access token
        const token = await getAccessToken();

        // Step 2: Find the plan
        const result = await findPlan(token, 'Tulkah.AI 6 Week Value Roadmap');

        if (!result) {
            console.log('\\n❌ Could not find the plan. Please check the plan name.');
            return;
        }

        const { plan, group } = result;

        // Step 3: Get plan details
        const planDetails = await getPlanDetails(token, plan.id);

        // Step 4: Get buckets
        const buckets = await getBuckets(token, plan.id);

        // Step 5: Get all tasks
        const tasks = await getPlanTasks(token, plan.id);

        // Step 6: Save everything
        const exportData = {
            timestamp: new Date().toISOString(),
            plan: {
                id: plan.id,
                title: plan.title,
                createdDateTime: plan.createdDateTime,
                owner: group.displayName
            },
            details: planDetails,
            buckets: buckets,
            tasks: tasks
        };

        await saveToJson(exportData);

        console.log('='.repeat(70));
        console.log('🎉 Success! Your Planner data is now accessible!');
        console.log('='.repeat(70));
        console.log('\\nNext steps:');
        console.log('  - Check 6_week_roadmap_data.json for full data');
        console.log('  - Use this script as a base for automation');
        console.log('  - Integrate with your Antigravity platform');

    } catch (error) {
        console.error('\\n❌ Fatal error:', error.message);
        process.exit(1);
    }
}

main();
