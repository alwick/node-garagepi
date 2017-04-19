var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var GPIO = require("onoff").Gpio;
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var startTakingSnaps = true;
var Raspistill = require('node-raspistill').Raspistill;
var fs = require('fs');

require('console-stamp')(console, '[HH:MM:ss]');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res) {
    res.render('index.html');
});

var state = 'closed';
app.get('/api/clickbutton', function(req, res) {
    state = state == 'closed' ? 'open' : 'closed';

    // hardcode to closed for now until reed switch
    state = 'closed';
    res.setHeader('Content-Type', 'application/json');
    res.end(state);
    outputSequence(7, '10', 1000);
});

app.get('/api/status', function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ state: state }));
    console.log('returning state: ' + state);
});

function outputSequence(pin, seq, timeout) {
    var gpio = new GPIO(4, 'out');
    gpioWrite(gpio, pin, seq, timeout);
}

function gpioWrite(gpio, pin, seq, timeout) {
    if (!seq || seq.length <= 0) {
        console.log('closing pin:', pin);
        gpio.unexport();
        return;
    }

    var value = seq.substr(0, 1);
    seq = seq.substr(1);
    setTimeout(function() {
        console.log('gpioWrite, value:', value, ' seq:', seq);
        gpio.writeSync(value);
        gpioWrite(gpio, pin, seq, timeout);
    }, timeout);
}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

var takePhoto = function() {
    const photoDir = '/media/images/';
    const d = new Date();
    const photoFile = (d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
        ('0' + d.getDate()).slice(-2)) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) +
        ':' + ('0' + d.getSeconds()).slice(-2);

    var camera = new Raspistill({
        mode: 'photo',
        outputDir: photoDir,
        fileName: photoFile,
        width: 640,
        height: 480,
        quality: 80,
        encoding: 'jpg'
    });

    camera.takePhoto().then(function(photo) {
       console.log('File saved: ' + photoFile);

       if( startTakingSnaps ) {
           takeSnaps();
       }
    });
}

var takeSnaps = function() {
    setTimeout(function() {
        takePhoto();
    }, 15000);
}

io.on('connection', function(socket){
    console.log('a user connected');

    // startTakingSnaps = true;

    // socket.on('disconnect', function(){
    //   console.log('user disconnected');
    //   startTakingSnaps = false;
    // });
});

var port = process.env.PORT || 8000;
server.listen(port, function() {
    console.log('GaragePi listening on port:', port);
    takeSnaps();
});
