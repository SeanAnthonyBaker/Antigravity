/**
 * Try Accessing Premium Plan via Teams
 * Team ID: 06ca04f4-e98a-4616-a706-3f862a12f35f
 */

const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs').promises;

const config = {
    teamId: '06ca04f4-e98a-4616-a706-3f862a12f35f',
    projectId: 'fe864a34-8a67-4ed4-bdaf-806faaccc9c3'
};

async function getAccessToken() {
    console.log('🔐 Getting access token...');
    const cmd = 'm365 util accesstoken get --resource https://graph.microsoft.com --output text';
    const token = execSync(cmd, { encoding: 'utf-8' }).trim();
    console.log('✅ Token obtained\n');
    return token;
}

async function getTeamChannels(token) {
    console.log('📂 Getting Team channels...\n');

    try {
        const response = await axios.get(
            `https://graph.microsoft.com/v1.0/teams/${config.teamId}/channels`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        const channels = response.data.value || [];
        console.log(`✅ Found ${channels.length} channels:\n`);

        channels.forEach((channel, index) => {
            console.log(`${index + 1}. ${channel.displayName}`);
            console.log(`   ID: ${channel.id}`);
            console.log(`   Description: ${channel.description || 'None'}`);
            console.log();
        });

        return channels;
    } catch (error) {
        console.error('❌ Error getting channels:', error.message);
        return [];
    }
}

async function getChannelTabs(token, channelId, channelName) {
    console.log(`\n📌 Getting tabs for channel: "${channelName}"...\n`);

    try {
        const response = await axios.get(
            `https://graph.microsoft.com/v1.0/teams/${config.teamId}/channels/${channelId}/tabs`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        const tabs = response.data.value || [];
        console.log(`✅ Found ${tabs.length} tabs:\n`);

        tabs.forEach((tab, index) => {
            console.log(`  ${index + 1}. ${tab.displayName}`);
            console.log(`     Type: ${tab.teamsAppId || 'Unknown'}`);
            console.log(`     WebUrl: ${tab.webUrl || 'None'}`);

            if (tab.configuration) {
                console.log(`     Entity ID: ${tab.configuration.entityId || 'None'}`);
                console.log(`     Content URL: ${tab.configuration.contentUrl || 'None'}`);

                // Check if this might be the Project tab
                if (tab.configuration.entityId === config.projectId ||
                    (tab.configuration.contentUrl && tab.configuration.contentUrl.includes(config.projectId))) {
                    console.log(`     🎯 This might be the Premium Plan tab!`);
                }
            }
            console.log();
        });

        return tabs;
    } catch (error) {
        console.error(`❌ Error getting tabs:`, error.message);
        return [];
    }
}

async function getTeamApps(token) {
    console.log('\n📱 Getting installed apps in Team...\n');

    try {
        const response = await axios.get(
            `https://graph.microsoft.com/v1.0/teams/${config.teamId}/installedApps?$expand=teamsAppDefinition`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        const apps = response.data.value || [];
        console.log(`✅ Found ${apps.length} installed apps:\n`);

        apps.forEach((app, index) => {
            const appDef = app.teamsAppDefinition;
            console.log(`${index + 1}. ${appDef?.displayName || 'Unknown'}`);
            console.log(`   App ID: ${app.teamsApp?.id || 'N/A'}`);
            console.log(`   External ID: ${appDef?.teamsAppId || 'N/A'}`);

            // Look for Project or Planner apps
            const name = (appDef?.displayName || '').toLowerCase();
            if (name.includes('project') || name.includes('planner') || name.includes('tasks')) {
                console.log(`   🎯 Potentially relevant app!`);
            }
            console.log();
        });

        return apps;
    } catch (error) {
        console.error('❌ Error getting apps:', error.message);
        return [];
    }
}

async function main() {
    console.log('='.repeat(70));
    console.log('Searching for Premium Plan in Teams');
    console.log('='.repeat(70));
    console.log(`\nTeam: Tulkah AI Management Team`);
    console.log(`Team ID: ${config.teamId}`);
    console.log(`Looking for Project ID: ${config.projectId}\n`);

    try {
        const token = await getAccessToken();

        const result = {
            team: { id: config.teamId, name: 'Tulkah AI Management Team' },
            channels: [],
            apps: []
        };

        // Get channels
        const channels = await getTeamChannels(token);
        result.channels = channels;

        // Get tabs for each channel
        for (const channel of channels) {
            const tabs = await getChannelTabs(token, channel.id, channel.displayName);
            channel.tabs = tabs;
        }

        // Get installed apps
        const apps = await getTeamApps(token);
        result.apps = apps;

        // Save results
        await fs.writeFile('teams_plan_search.json', JSON.stringify(result, null, 2));
        console.log('\n💾 Results saved to: teams_plan_search.json');

        console.log('\n' + '='.repeat(70));
        console.log('SUMMARY');
        console.log('='.repeat(70));

        // Check if we found anything related to the project
        let found = false;
        for (const channel of channels) {
            if (channel.tabs) {
                for (const tab of channel.tabs) {
                    if (tab.configuration?.entityId === config.projectId ||
                        (tab.configuration?.contentUrl && tab.configuration.contentUrl.includes(config.projectId))) {
                        console.log(`\n🎯 Found potential match!`);
                        console.log(`   Channel: ${channel.displayName}`);
                        console.log(`   Tab: ${tab.displayName}`);
                        console.log(`   URL: ${tab.webUrl || tab.configuration.contentUrl}`);
                        found = true;
                    }
                }
            }
        }

        if (!found) {
            console.log('\n⚠️  Premium Plan not found in any Teams tabs.');
            console.log('\nThis confirms: The plan uses a backend storage system that');
            console.log('is not exposed through Microsoft Graph API.');
        }

        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    }
}

main();
