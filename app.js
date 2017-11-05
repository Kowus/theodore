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
        sessionId: 'tabby_cat' // use any arbitrary id
    });

    apiai.on('response', (response) => {
        // Got a response from api.ai. Let's POST to Facebook Messenger
        if(!response.result.actionIncomplete && response.result.action === 'topic'){
            let topic = response.result.parameters['topic'];
            github.search.repos(
                {q: `topic:${topic}`}, (err, res) => {
                    if(err){
                        request({
                            url: 'https://graph.facebook.com/v2.6/me/messages',
                            qs: {access_token: token},
                            method: 'POST',
                            json: {
                                recipient: {id: sender},
                                message: {
                                    text: `Sorry, I could not find any projects on ${topic}`
                                },
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
                        let total_count = Number(res.data.total_count)>0?`I found ${res.data.total_count} projects on ${topic}`:`Sorry, I could not find any projects on ${topic}`;
                        request({
                            url: 'https://graph.facebook.com/v2.6/me/messages',
                            qs: {access_token: token},
                            method: 'POST',
                            json: {
                                recipient: {id: sender},
                                message: {
                                    text: total_count
                                },
                            }
                        }, function (error, response, body) {
                            if (error) {
                                console.log('Error sending messages: ', error)
                            } else if (response.body.error) {
                                console.log('Error: ', response.body.error)
                            }
                        });
                    }
                });
        }
            /*let messageData = {
                "attachment":{
                    "type":"template",
                    "payload":{
                        "template_type":"generic",
                        "elements":[
                            {
                                "title": "Pushup",
                                "subtitle": "Perform 40 pushups",
                                "image_url":"http://vignette4.wikia.nocookie.net/parkour/images/e/e0/Push_Up.jpg/revision/latest?cb=20141122161108",
                                "buttons":[
                                    {
                                        "type": "web_url",
                                        "url":"http://www.bodybuilding.com/exercises/detail/view/name/pushups",
                                        "title":"Exercise Video"
                                    }
                                ]
                            },{
                                "title": "Benchpress",
                                "subtitle": "Perform 20 reps of benchpress",
                                "image_url":"http://www.bodybuilding.com/exercises/exerciseImages/sequences/360/Male/m/360_1.jpg",
                                "buttons":[
                                    {
                                        "type": "web_url",
                                        "url": "http://www.bodybuilding.com/exercises/detail/view/name/pushups",
                                        "title": "Excercise Video"
                                    }
                                ]
                            }
                        ]
                    }
                }
            };*/



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
