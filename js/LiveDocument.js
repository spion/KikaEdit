/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

function fullClone(obj) { // obj instanceof Array
    var newObj = (obj.constructor == Array) ? [] : {};
    for (var i in obj) {
        if (obj[i] && typeof obj[i] == 'object') {
            newObj[i] = fullClone(obj[i]);
        }
        else newObj[i] = obj[i];
    }
    return newObj;

}

var LiveDocument = function(editor) {
    var self = this;
    self.editor = editor;
    self.editor.insertRemote(0, "\n");
    self.editor.removeRemote(0, 1);

    var initVersion = 0,
    changeLog = [],
    deltaLog = [],
    changeTimeout = null,
    socket = new io.Socket('spion.sytes.net');

    var undoEdits = function(edits) {
        for (var i = edits.length - 1; i >= 0; --i) {
            if (edits[i].type == "del") {
                self.editor.insertRemote(edits[i].at, edits[i].text);
            }
            else if (edits[i].type == "ins") {
                self.editor.removeRemote(edits[i].at, edits[i].length);
            }
        }
    }

    var syncChains = function(chain, changelog) {
        //for each chain in the changelog
        for (var c = 0; c < changelog.length; ++c) {
            // for each action chain
            for (var k = 0; k < chain.length; ++k) {
                if (changelog[c].at <= chain[k].at) {
                    var cAt = changelog[c].at;
                    for (var e = 0; e < changelog[c].edits.length; ++e) {
                        if (changelog[c].edits[e].ins) {
                            chain[k].at += changelog[c].edits[e].ins.length;
                            cAt += changelog[c].edits[e].ins.length;
                        }
                        else if (changelog[c].edits[e].del) {
                            //chain[k].at -= Math.abs(changelog[c].edits[e].del);
                            if (changelog[c].edits[e].del < 0) {
                                cAt += changelog[c].edits[e].del;
                            }
                            chain[k].at =
                                Math.max(cAt, chain[k].at - Math.abs(changelog[c].edits[e].del));
                        }
                    }

                }
            }
        }
    }

    var execChain = function(at, chain) {
        for (k = 0; k < chain.length; ++k) {
            if (chain[k].ins) {
                self.editor.insertRemote(at, chain[k].ins);
                at += chain[k].ins.length;
            }
            else if (chain[k].del > 0) {
                self.editor.removeRemote(at, chain[k].del);
            }
            else if (chain[k].del < 0) {
                at += chain[k].del;
                self.editor.removeRemote(at, 0 - chain[k].del);
            }
        }
    }

    this.applyEdits = function(edits) {
        // Undo our edits, sync them to the server.
        var oldLog = fullClone(deltaLog);
        undoEdits(oldLog);

        var myChains = chainDeltaLog(oldLog);
        syncChains(myChains, edits);

        for (var j = 0; j < edits.length; ++j) {
            execChain(edits[j].at, edits[j].edits);
        }
        changeLog = changeLog.concat(edits);
        // clear delta log. its full of undos and remote edits.
        deltaLog = []; 
        // we can now re-apply out old edits
        for (var k = 0; k < myChains.length; ++k) {
            execChain(myChains[k].at, myChains[k].edits);
        }
        // which fills deltaLog. We can now dump it to socket and reset it.
        self.dumpDeltaLog();
        
    }

    var chainDeltaLog = function(log) {
        var makeChain = function(edit1, edit2) {
            var nextPos;
            var e1;
            if (edit1.type == "ins") {
                nextPos = edit1.at + edit1.text.length;
                e1 = {
                    ins: edit1.text
                };
            }
            else {
                nextPos = edit1.at;
                e1 = {
                    del:edit1.length
                };
            }
            if (edit2.type == "ins" && nextPos == edit2.at) {
                return {
                    ins: edit2.text
                };
            }
            else if (edit2.type == "del") {
                if (nextPos == edit2.at) { //del
                    return {
                        del: edit2.length
                    }
                }
                else if (nextPos == edit2.at + edit2.length) { //backspace
                    return {
                        del: 0 - edit2.length
                    };
                }
            }
            return null;
        }

        var chainedLog = [], k = 0;
        while (k < log.length) {
            var chain = {
                at: log[k].at,
                edits:[
                (log[k].type == "ins"?{
                    ins:log[k].text
                }:

                {
                    del:log[k].length
                })
                ]
            };
            while (k + 1 < log.length) {
                var chainedEdit = makeChain(log[k], log[k+1]);
                if (chainedEdit == null) break;
                chain.edits.push(chainedEdit);
                ++k;
            }
            chainedLog.push(chain);
            ++k;
        }
        return chainedLog;
    };

    this.dumpDeltaLog = function() {
        if (deltaLog.length > 0) {
            // Chaining the delta log causes edits which are a continuation
            // of the cursor to become atomic. This is very desireable.
            deltaLog = chainDeltaLog(deltaLog);
            var jsonStr = $.toJSON({
                version: initVersion + changeLog.length,
                actions:deltaLog
            });
            //console.log("Send: " + jsonStr);
            socket.send(jsonStr);
            changeLog.push(deltaLog);
            deltaLog = [];
        }
    }

    this.changeLog = function() {
        return changeLog;
    }
   
    self.editor.addOnChange(function(delta) {
        deltaLog.push(delta);
        if (changeTimeout) {
            clearTimeout(changeTimeout);
        }
        changeTimeout = setTimeout(self.dumpDeltaLog, 2333);
    });

    socket.connect();
    socket.on('message', function(json) {
        //console.log("Recv: " + json);
        var data = $.parseJSON(json);
        if (data.version) {
            initVersion = data.version;
            self.editor.insertRemote(0, data.text);
            deltaLog = []; // clear deltalog created by insertRemote
        }
        else {
            self.applyEdits(data);
        }
    });


    return true;
}