/* jshint esversion: 6 */
const fs = require('fs');
const puppeteer = require('puppeteer');
const Discord = require('discord.js');
const client = new Discord.Client();

const getPinnedTopics = async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto('https://robertsspaceindustries.com/spectrum/community/SC/forum/4?page=1&sort=hot');
        await page.waitFor('.thread');
        const pinnedTopics = await page.$$eval('.thread', topics => topics
            .filter(t => t.getElementsByClassName('pinned').length)
            .map(t => ({
                title: t.getElementsByClassName('thread-subject').item(0).innerText,
                link: `https://robertsspaceindustries.com${t.getElementsByClassName('thread-subject').item(0).getAttribute('href')}`,
                author: t.getElementsByClassName('displayname').item(0).innerText
            }))
        );
        await browser.close();
        return pinnedTopics;
    } catch(err) {
        return [];
    }
};

const getThreadContents = async (link) => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(link);
        await page.waitFor('.content-main');
        const contents = await page.$eval('.content-main', c => ({
            avatarUrl: c.getElementsByClassName('avatar').item(0).style.backgroundImage,
            text: c.getElementsByClassName('content-blocks').item(0).innerText,
            subject: c.getElementsByClassName('forum-thread-subject').item(0).innerText
        }));
        contents.avatarUrl = contents.avatarUrl.substring(5, contents.avatarUrl.length - 3);
        console.log(contents);
        return contents;
    } catch(err) {
        return {
            text: 'Unable to get thread',
            subject: 'Unable to get thread'
        }
    }
};

const wait = (ms) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {resolve()}, ms);
    });
};

let channels;

const announce = async (t) => {
    const contents = await getThreadContents(t.link);
    const embed = new Discord.RichEmbed()
        .setColor('#8bdfff')
        .setTitle(t.title)
        .setDescription(contents.text)
        .setURL(t.link)
        .setAuthor(t.author, contents.avatarUrl)
        .setTimestamp();
    channels.forEach((ch) => {
        try {
            client.channels.get(ch).send(embed);
        } catch(err) {
            console.log(`Failed to send message to ${ch} (${client.channels.get(ch).name})`);
        }
    });
};

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

fs.readFile('channels.txt', { encoding: 'utf8' }, (err, data) => {
    if(err) {
        process.exit();
    } else {
        channels = data.split('\n').filter(l => l.length > 0);
        client.login(fs.readFileSync('token.txt', { encoding: 'utf8' }));
    }
});

(async () => {
    let pinnedTopics = await getPinnedTopics();
    while(true) {
        await wait(60 * 1000);
        const freshTopics = await getPinnedTopics();
        freshTopics.forEach((t) => {
            if(!pinnedTopics.find(p => p.link === t.link)) {
                pinnedTopics.push(t);
                announce(t);
            }
        });
    }
})();