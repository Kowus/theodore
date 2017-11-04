const express = require('express'),
    bodyParser = require('body-parser'),
    request = require('request'),
    app = express(),
    token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
    apiaiApp = require('apiai')(process.env.APIAI_CLIENT_ACCESS_TOKEN);

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

app.post('/ai', (req, res)=>{
    console.log(req.body);
   if(req.body.result.action === 'topic'){
       let topic = req.body.result.parameters['topic'];
       let restUrl = `https://api.github.com/search/repositories?q=${topic}+topic:${topic}&sort=updated`;
       /*request.get(restUrl, (err, response, body)=>{
           if(!err && response.statusCode ==200){
               let json = body;
               let msg = `there are ${body.total_count} projects on ${topic}`;
               return res.json({
                   speech:msg,
                   displayText: msg,
                   source: 'github'
               });
           }else{
               return res.status(400).json({
                   status: {
                       code: 400,
                       errorType: `I couldn't find ${topic} projects`
                   }
               })
           }
       })*/

       request({
           url: restUrl,
           headers:{
               'Accept': 'application/vnd.github.mercy-preview+json'
           },
           method:'GET'
       },(err, response, body)=>{
           if(!err && response.statusCode ==200){
               let json = body;
               let msg = `there are ${body.total_count} projects on ${topic}`;
               return res.json({
                   speech:msg,
                   displayText: msg,
                   source: 'github'
               });
           }else{
               return res.status(400).json({
                   status: {
                       code: 400,
                       errorType: `I couldn't find ${topic} projects`
                   }
               })
           }
       })

   }else{
       return res.status(400).json({
           status: {
               code: 400,
               errorType: `Bad topic: ${topic}`
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
    });

    apiai.on('error', (error) => {
        console.log(error);
    });

    apiai.end();



}
