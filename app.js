const express = require('express'),
    bodyParser = require('body-parser'),
    request = require('request'),
    app = express();

app.set('port', (process.env.PORT || 3000));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));


app.get('/', (req, res)=>{
        res.send("Hello World");
});

app.get('/webhook', (req, res)=>{
    if(req.query['hub.verify_token'] === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN){
        res.status(200).send(req.query['hub.challenge']);
    }else {
        res.status(403).end();
    }
});

app.post('/webhook', (req, res)=>{
    console.log(req.body);
    if(req.body.object === 'page'){
        req.body.entry.forEach((entry)=>{
            entry.messaging.forEach((event)=>{
                if(event.message && event.message.text){
                    sendMessage(event);
                }
            });
        });
        res.status(200).end();
    }
});

const server = app.listen(app.get('port'), ()=>{
   console.log('Now my watch has began Lord %d of House %s', server.address().port, app.settings.env);
});


function sendMessage(event) {
    let sender = event.sender.id;
    let text = event.message.text;

    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs:{access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN},
        method:'POST',
        json:{
            recipient:{id:sender},
            message:{text:text}
        }
    },function (error, response) {
        if(error){
            console.error("Error sending message: ", error)
        }else if(response.body.error){
            console.error('Error: ', response.body.error)
        }
    })
}
