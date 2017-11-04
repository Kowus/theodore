const express = require('express'),
    bodyParser = require('body-parser'),
    app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));


app.get('/webhook', (req, res)=>{
    if(req.query['hub.mode']&& req.query['hub.verify_token'] === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN){
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
//sendMessage
            });
        })
    }
})



























const server = app.listen(process.env.PORT || 3000, ()=>{
   console.log('Now my watch has began Lord %d of House %s', server.address().port, app.settings.env);
});