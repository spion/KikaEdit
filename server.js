
var express = require("express"),
io = require('socket.io');

var app = express.createServer();


app.use(express.methodOverride());
app.use(express.bodyDecoder());
app.use(app.router);

// Custom app.gets should go here, before the staticProvider
// app.get(...);

app.use(express.staticProvider(__dirname + '/'));

app.listen(8001);

var socket = io.listen(app);

var Document = function() {
    var log = [];
    var curText = "";
    var self = this;

    this.getText = function() {
        return curText;
    }
    this.getVersion = function() {
        return log.length;
    }
    this.insertRemote = function(at, text) {
        curText = curText.substr(0, at)
        + text + curText.substr(at);
    }
    
    this.removeRemote = function(at, len) {
        curText = curText.substr(0, at)
        + curText.substr(at + len);
    }
    
    this.push = function(change) {
        var ver = change.version;
        var act = change.actions;
        
        for (var i = ver; i < log.length; ++i) {
            for (var j = 0; j < log[i].length; ++j) {
                for (var k = 0; k < act.length; ++k) {
                    if (log[i][j].at <= act[k].at) {
                        if (log[i][j].type == "ins") {
                            act[k].at += log[i][j].text.length;
                        }
                        else if (log[i][j].type == "del") {
                            act[k].at -= log[i][j].length;
                        }

                    }
                }
            }
        }
        log.push(act);
        for (var j = 0; j < act.length; ++j) {
            if (act[j].type == "ins") {
                self.insertRemote(act[j].at, act[j].text);
            }
            else if (act[j].type == "del") {
                self.removeRemote(act[j].at, act[j].length);
            }
        }
        return act;
    }
    
}

var doc = new Document();


socket.on('connection', function(client){
    // new client is here!
    client.send(JSON.stringify({
        "version": doc.getVersion(),
        "text":doc.getText()
    }));
    client.on('message', function(change){
        act = doc.push(change);
        client.broadcast(JSON.stringify([act]), client.sessionId);

    });
});

