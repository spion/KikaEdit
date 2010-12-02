
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

        //for each chain in the log from version ver
        for (var c = ver; c < log.length; ++c) {
            // for each action chain
            for (var k = 0; k < act.length; ++k) {
                if (log[c].at <= act[k].at) {
                    for (var e = 0; e < log[c].edits.length; ++e) {
                        if (log[c].edits[e].ins) {
                            act[k].at += log[c].edits[e].ins.length;
                        }
                        else if (log[c].edits[e].del) {
                            act[k].at -= Math.abs(log[c].edits[e].del);
                        }
                    }

                }
            }
        }

        for (var a = 0; a < act.length; ++a) {
            log.push(act[a]);
        }
        for (var j = 0; j < act.length; ++j) {
            var at = act[j].at, chain = act[j].edits;
            for (k = 0; k < chain.length; ++k) {
                if (chain[k].ins) {
                    self.insertRemote(at, chain[k].ins);
                    at += chain[k].ins.length;
                }
                else if (chain[k].del > 0) {
                    self.removeRemote(at, chain[k].del);
                }
                else if (chain[k].del < 0) {
                    at += chain[k].del;
                    self.removeRemote(at, 0 - chain[k].del);
                }
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
        //console.log(change);
        act = doc.push(JSON.parse(change));
        //console.log(doc.getText());
        client.broadcast(JSON.stringify(act), client.sessionId);

    });
});

