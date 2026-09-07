/**
 * List Tasks from "Tulkah.AI 6 Week Value Roadmap"
 * Project ID: fe864a34-8a67-4ed4-bdaf-806faaccc9c3
 */

const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs').promises;

const config = {
    dataverseUrl: 'https://orgdbdcf748.crm11.dynamics.com',
    projectId: 'fe864a34-8a67-4ed4-bdaf-806faaccc9c3',
    projectName: 'Tulkah.AI 6 Week Value Roadmap'
};

async function getAccessToken() {
    console.log('🔐 Getting Dataverse access token...');
    const cmd = `m365 util accesstoken get --resource ${config.dataverseUrl} --output text`;
    const token = execSync(cmd, { encoding: 'utf-8' }).trim();
    console.log('✅ Token obtained\n');
    return token;
}

async function getProjectTasks(token) {
    console.log(`📋 Fetching tasks for "${config.projectName}"...\n`);

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        'Prefer': 'odata.include-annotations="*"'
    };

    try {
        const response = await axios.get(
            `${config.dataverseUrl}/api/data/v9.2/msdyn_projecttasks?$filter=_msdyn_project_value eq ${config.projectId}&$orderby=msdyn_wbsid`,
            { headers }
        );

        const tasks = response.data.value || [];

        if (tasks.length === 0) {
            console.log('⚠️  No tasks found in this project.');
            console.log('   The project may be empty or just created.\n');
            return [];
        }

        console.log(`✅ Found ${tasks.length} task(s):\n`);
        console.log('='.repeat(80));

        tasks.forEach((task, index) => {
            const taskName = task.msdyn_subject || task.msdyn_description || 'Unnamed Task';
            const wbs = task.msdyn_wbsid || 'N/A';
            const progress = task.msdyn_progress !== null ? (task.msdyn_progress * 100).toFixed(0) + '%' : 'N/A';
            const effort = task.msdyn_effort || 0;
            const effortCompleted = task.msdyn_effortcompleted || 0;
            const effortRemaining = task.msdyn_effortremaining || 0;
            const scheduledStart = task.msdyn_scheduledstart ? new Date(task.msdyn_scheduledstart).toLocaleDateString() : 'N/A';
            const scheduledEnd = task.msdyn_scheduledend ? new Date(task.msdyn_scheduledend).toLocaleDateString() : 'N/A';
            const duration = task.msdyn_duration || 0;

            console.log(`\n${index + 1}. ${taskName}`);
            console.log(`   WBS: ${wbs}`);
            console.log(`   Task ID: ${task.msdyn_projecttaskid}`);
            console.log(`   Progress: ${progress}`);
            console.log(`   Duration: ${duration} day(s)`);
            console.log(`   Schedule: ${scheduledStart} → ${scheduledEnd}`);
            console.log(`   Effort: ${effort} hours (${effortCompleted} done, ${effortRemaining} remaining)`);

            // Additional useful fields
            if (task._msdyn_assignedresources_value) {
                console.log(`   Assigned To: Resource ID ${task._msdyn_assignedresources_value}`);
            }

            if (task.msdyn_projectbucket) {
                console.log(`   Bucket: ${task.msdyn_projectbucket}`);
            }

            console.log('   ' + '-'.repeat(76));
        });

        console.log('\n' + '='.repeat(80));

        return tasks;

    } catch (error) {
        console.error('❌ Error fetching tasks:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Details:', error.response.data?.error?.message || error.response.statusText);
        }
        return [];
    }
}

async function getProjectBuckets(token) {
    console.log('\n📦 Fetching project buckets/phases...\n');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };

    try {
        const response = await axios.get(
            `${config.dataverseUrl}/api/data/v9.2/msdyn_projectbuckets?$filter=_msdyn_project_value eq ${config.projectId}`,
            { headers }
        );

        const buckets = response.data.value || [];

        if (buckets.length === 0) {
            console.log('   No buckets/phases defined\n');
            return [];
        }

        console.log(`✅ Found ${buckets.length} bucket(s):\n`);
        buckets.forEach((bucket, index) => {
            console.log(`${index + 1}. ${bucket.msdyn_name || 'Unnamed Bucket'}`);
            console.log(`   Bucket ID: ${bucket.msdyn_projectbucketid}`);
        });
        console.log();

        return buckets;

    } catch (error) {
        if (error.response?.status === 404) {
            console.log('   Buckets table not available\n');
        } else {
            console.error('   Error:', error.message);
        }
        return [];
    }
}

async function main() {
    console.log('='.repeat(80));
    console.log('Tasks in "Tulkah.AI 6 Week Value Roadmap"');
    console.log('='.repeat(80));
    console.log(`\nProject ID: ${config.projectId}\n`);

    try {
        const token = await getAccessToken();

        // Get buckets/phases
        const buckets = await getProjectBuckets(token);

        // Get tasks
        const tasks = await getProjectTasks(token);

        // Save to file
        const result = {
            project: {
                id: config.projectId,
                name: config.projectName
            },
            buckets: buckets,
            tasks: tasks,
            summary: {
                totalTasks: tasks.length,
                totalBuckets: buckets.length
            }
        };

        await fs.writeFile('roadmap_tasks.json', JSON.stringify(result, null, 2));
        console.log('\n💾 Full details saved to: roadmap_tasks.json');

        console.log('\n' + '='.repeat(80));
        console.log('SUMMARY');
        console.log('='.repeat(80));
        console.log(`\nTotal Tasks: ${tasks.length}`);
        console.log(`Total Buckets: ${buckets.length}`);

        if (tasks.length > 0) {
            const completedTasks = tasks.filter(t => t.msdyn_progress >= 1).length;
            const inProgressTasks = tasks.filter(t => t.msdyn_progress > 0 && t.msdyn_progress < 1).length;
            const notStartedTasks = tasks.filter(t => !t.msdyn_progress || t.msdyn_progress === 0).length;

            console.log(`\nTask Status:`);
            console.log(`  ✅ Completed: ${completedTasks}`);
            console.log(`  🔄 In Progress: ${inProgressTasks}`);
            console.log(`  ⏳ Not Started: ${notStartedTasks}`);
        }

        console.log('\n' + '='.repeat(80));

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    }
}

main();
