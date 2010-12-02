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

    this.applyEdits = function(edits) {
        // reverse-modify edits to account for our yet-unsent deltas. The server
        // doesn't know about them, therefore we must syncronize them.

        //console.log(fullClone(edits));
        var myChains = chainDeltaLog(deltaLog);
        for (var k = 0; k < edits.length; ++k) {
            for (var i = 0; i < myChains.length; ++i) {
                if (myChains[i].at < edits[k].at) {
                    for (var e = 0; e < myChains[i].edits.length; ++e) {
                        if (myChains[i].edits[e].ins) {
                            edits[k].at += myChains[i].edits[e].ins.length;
                        }
                        else if (myChains[i].edits[e].del) {
                            edits[k].at -= Math.abs(myChains[i].length);
                        }
                    }
                }
            }
            
        }
        //console.log(fullClone(edits));

        // Subsequent "insertRemote/removeRemote" calls will trigger onChange
        // and fill the delta log. We will empty the deltaLog before the timeout
        // executes because remote edits should not be pushed to the deltaLog.
        // However, emptying the deltaLog will also remove our unsent edits,
        // thats why we dump them at this point
        self.dumpDeltaLog(); // dump our deltas to socket and reset them.
        
        for (var j = 0; j < edits.length; ++j) {
            //edits consist of at: position, chain: [list of actions]
            var at = edits[j].at, chain = edits[j].edits;
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
        
        changeLog = changeLog.concat(edits);
        deltaLog = []; // clear delta log. these are not our edits.
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
        changeTimeout = setTimeout(self.dumpDeltaLog, 2250);
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