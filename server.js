
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
    this.execEdit = function(edit) {
        if (edit.type == "ins") {
            self.insertRemote(edit.at, edit.text);
        }
        else if (edit.type == "del") {
            self.removeRemote(edit.at,edit.length);
        }
    }

    var syncDeltas = function(deltas, changelog) {
        for (var i = 0; i < changelog.length; ++i) {
            for (var j = 0; j < changelog[i].length; ++j) {
                for (var k = 0; k < deltas.length; ++k) {
                    if (changelog[i][j].at <= deltas[k].at) {
                        if (changelog[i][j].type == "ins") {
                            deltas[k].at += changelog[i][j].text.length;
                        }
                        else if (changelog[i][j].type == "del") {
                            //deltas[k].at -= changelog[i][j].length;
                            deltas[k].at =
                                Math.min(deltas[k].at - changelog[i][j].length, changelog[i][j].at);
                        }

                    }
                }
            }
        }
    }

    this.push = function(change) {
        var ver = change.version;
        var act = change.actions;
        syncDeltas(act, log.slice(ver));
        log.push(act);
        for (var j = 0; j < act.length; ++j) {
            self.execEdit(act[j]);
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

