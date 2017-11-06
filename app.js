const express = require('express'),
    bodyParser = require('body-parser'),
    request = require('request'),
    app = express(),
    token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
    apiaiApp = require('apiai')(process.env.APIAI_CLIENT_ACCESS_TOKEN),
    GitHubApi = require('github'),

    github = new GitHubApi({
        debug: true,
        headers: {
            'accept': 'application/vnd.github.mercy-preview+json'
        },
        rejectUnauthorized: false
    });
github.authenticate({
    type: 'token',
    token: process.env.GITHUB_USER_TOKEN
});


app.set('port', (process.env.PORT || 3000));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());


app.get('/', (req, res) => {
    res.send("Hello World");
});

app.get('/webhook', (req, res) => {
    if (req.query['hub.verify_token'] === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
        res.status(200).send(req.query['hub.challenge']);
    } else {
        res.status(403).end();
    }
});

app.post('/webhook', (req, res) => {
    req.body.entry.forEach((entry) => {
        entry.messaging.forEach((event) => {
            if (event.message && event.message.text) {
                sendMessage(event);
            }
            if (event.postback) {

                if (event.postback.title === 'Stats') {
                    let pb = JSON.parse(event.postback.payload);
                    github.repos.get({
                        owner: pb.repo_owner,
                        repo: pb.repo_name,
                        path: ''
                    }, (err, res) => {
                        if (err) {
                            sendTextMessage(event.sender.id, `Sorry, couldn't get you info on this repository. Please try again later`);
                        }
                        else {
                            let messageData = {
                                attachment: {
                                    type: 'template',
                                    payload: {
                                        template_type: 'list',
                                        elements: [
                                            {
                                                title: res.data.full_name,
                                                subtitle: res.data.description,
                                                image_url: res.data.owner.avatar_url
                                            }, {
                                                "title": '📢',
                                                "subtitle": String(res.data.topics).split(',').join(', '),
                                            }, {
                                                "title": res.data.language,
                                                "subtitle": "language",
                                            }, {
                                                "title": `🌟    |    ⑂    |    🙊`,
                                                "subtitle": `${res.data.stargazers_count} Stars | ${res.data.forks_count} Forks | ${res.data.open_issues_count} Issues`,
                                            }
                                        ], "buttons": [
                                            {
                                                "title": "Go To",
                                                "type": "web_url",
                                                "url": res.data.clone_url
                                            }
                                        ]
                                    }
                                }
                            };
                            request({
                                url: 'https://graph.facebook.com/v2.6/me/messages',
                                qs: {access_token: token},
                                method: 'POST',
                                json: {
                                    recipient: {id: event.sender.id},
                                    message: messageData
                                }
                            }, function (error, response, body) {
                                if (error) {
                                    console.log('Error sending messages: ', error)
                                } else if (response.body.error) {
                                    console.log('Error: ', response.body.error)
                                }
                            });
                        }
                    })
                }
                else {
                    let text = JSON.stringify(event.postback);
                    sendTextMessage(event.sender.id, 'Postback received: ' + text.substring(0, 200));
                }
            }

        });
    });
    res.status(200).end();
});
app.post('/ai', (req, res) => {

    if (req.body.result.action === 'topic') {
        let topic = req.body.result.parameters['topic'];
        github.search.repos(
            {q: `topic:${topic}`}, (err, response) => {
                if (err) {
                    return res.status(400).json({
                        status: {
                            code: 400,
                            errorType: `I couldn't find ${topic} projects`
                        }
                    })
                }
                else {

                    let msg = `there are ${response.data.total_count} projects on ${topic}`;
                    return res.json({
                        speech: msg,
                        displayText: msg,
                        source: 'github'
                    });
                }
            });

    } else {
        return res.status(400).json({
            status: {
                code: 400,
                errorType: "Sorry, an error occurred while getting your data"
            }
        })
    }
});


const server = app.listen(app.get('port'), () => {
    console.log('Now my watch has began Lord %d of House %s', server.address().port, app.settings.env);
});


function sendMessage(event) {
    let sender = event.sender.id;
    let text = event.message.text;
    let apiai = apiaiApp.textRequest(text, {
        sessionId: 'tabby_cat'
    });
    let messageData = {
        type: "template",
        payload: {
            template_type: "generic",
            elements: []
        }
    };
    let quick_replies = [];

    apiai.on('response', (response) => {
        if (!response.result.actionIncomplete && response.result.action === 'topic') {
            let topic = response.result.parameters['topic'];
            github.search.repos({
                q: `topic:${topic}`,
                per_page: 5,
                page: 1
            }, (err, res) => {
                if (err) {
                    sendTextMessage(sender, `Sorry, I could not find any projects on ${topic}`);
                }
                else {

                    let total_count = Number(res.data.total_count) > 0 ? `I found ${res.data.total_count} projects on ${topic} here's the first batch of 5.` : `Sorry, I could not find any projects on ${topic}`;
                    if (res.data.total_count === 1) {
                        total_count = `I found only ${res.data.total_count} project on ${topic}`
                    }

                    if (res.data.total_count > 0) {
                        let has_next = res.data.total_count > 5;
                        if (has_next) {
                            quick_replies.push({
                                content_type: 'text',
                                title: "Next",
                                payload: "Winds hobble from halitosis like scurvy anchors.",
                                image_url: 'https://avatars3.githubusercontent.com/u/13987886?v=4'
                            });
                        }
                        sendTextMessage(sender, total_count);
                        res.data.items.forEach((repo) => {
                            messageData.payload.elements.push({
                                title: repo.full_name,
                                subtitle: repo.description,
                                image_url: repo.owner.avatar_url,
                                buttons: [
                                    {
                                        type: "web_url",
                                        url: repo.clone_url,
                                        title: 'View Project'
                                    }, {
                                        type: "postback",
                                        title: "Stats",
                                        payload: `{"repo_name": "${repo.name}", "repo_owner": "${repo.owner.login}"}`
                                    }
                                ]
                            })
                        });
                        request({
                            url: 'https://graph.facebook.com/v2.6/me/messages',
                            qs: {access_token: token},
                            method: 'POST',
                            json: {
                                recipient: {id: sender},
                                message: {
                                    attachment: messageData,
                                    quick_replies: quick_replies
                                }
                            }
                        }, function (error, response, body) {
                            if (error) {
                                console.log('Error sending messages: ', error)
                            } else if (response.body.error) {
                                console.log('Error: ', response.body.error)
                            }
                        });
                    }
                    else {
                        sendTextMessage(sender, `Sorry, I could not find any projects on ${topic}`);
                    }
                }
            });
        }
        else {
            let aiText = response.result.fulfillment.speech;
            request({
                url: 'https://graph.facebook.com/v2.6/me/messages',
                qs: {access_token: token},
                method: 'POST',
                json: {
                    recipient: {id: sender},
                    message: {text: aiText}
                }
            }, function (error, response) {
                if (error) {
                    console.error("Error sending message: ", error)
                } else if (response.body.error) {
                    console.error('Error: ', response.body.error)
                }
            });
        }
    });
    apiai.on('error', (error) => {
        console.log(error);
    });
    apiai.end();
}

function sendTextMessage(sender, text) {
    let messageData = {text: text};
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: token},
        method: 'POST',
        json: {
            recipient: {id: sender},
            message: messageData
        }
    }, function (error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}