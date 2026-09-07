const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs');

const config = {
    dataverseUrl: 'https://orgdbdcf748.crm11.dynamics.com',
    projectId: 'fe864a34-8a67-4ed4-bdaf-806faaccc9c3'
};

async function main() {
    try {
        // 1. Get Access Token
        const token = execSync(`m365 util accesstoken get --resource ${config.dataverseUrl} --output text`, { encoding: 'utf-8' }).trim();

        // 2. Fetch Project Details
        console.log('Fetching project details...');
        const projectRes = await axios.get(
            `${config.dataverseUrl}/api/data/v9.2/msdyn_projects(${config.projectId})`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const project = projectRes.data;

        // 3. Fetch All Tasks
        console.log('Fetching tasks...');
        const tasksRes = await axios.get(
            `${config.dataverseUrl}/api/data/v9.2/msdyn_projecttasks?$filter=_msdyn_project_value eq ${config.projectId}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const allTasks = tasksRes.data.value;

        // 4. Build Hierarchy
        const taskMap = new Map();
        const rootTasks = [];

        // Initialize map
        allTasks.forEach(task => {
            task.children = [];
            taskMap.set(task.msdyn_projecttaskid, task);
        });

        // Link parents and children
        allTasks.forEach(task => {
            if (task._msdyn_parenttask_value) {
                const parent = taskMap.get(task._msdyn_parenttask_value);
                if (parent) {
                    parent.children.push(task);
                } else {
                    // Parent might be missing or filtered out, treat as root for safety or log error
                    rootTasks.push(task);
                }
            } else {
                rootTasks.push(task);
            }
        });

        // 5. recursive helper to clean up the output object
        function formatTask(task) {
            const formatted = {
                id: task.msdyn_projecttaskid,
                name: task.msdyn_subject,
                wbs: task.msdyn_wbsid || null,
                start: task.msdyn_scheduledstart,
                end: task.msdyn_scheduledend,
                effort_hours: task.msdyn_effort,
                progress_percent: task.msdyn_progress ? (task.msdyn_progress * 100) : 0,
            };

            if (task.children && task.children.length > 0) {
                // Sort children by WBS or Start Date if WBS is missing
                task.children.sort((a, b) => {
                    const dateA = new Date(a.msdyn_scheduledstart || 0);
                    const dateB = new Date(b.msdyn_scheduledstart || 0);
                    return dateA - dateB;
                });
                formatted.subtasks = task.children.map(formatTask);
            }

            return formatted;
        }

        // 6. Construct Final JSON
        const output = {
            project: {
                id: project.msdyn_projectid,
                name: project.msdyn_subject,
                start: project.msdyn_scheduledstart,
                end: project.msdyn_scheduledend
            },
            tasks: rootTasks.map(formatTask)
        };

        // 7. Output result
        const jsonString = JSON.stringify(output, null, 2);
        fs.writeFileSync('roadmap_export.json', jsonString);
        console.log(jsonString);

    } catch (error) {
        console.error('Error:', error.response?.data?.error?.message || error.message);
        process.exit(1);
    }
}

main();
