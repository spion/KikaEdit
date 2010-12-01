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

        for (var k = 0; k < edits.length; ++k) {
            for (var j = 0; j < edits[k].length; ++j) {
                for (var i = 0; i < deltaLog.length; ++i) {
                    if (deltaLog[i].at < edits[k][j].at) {
                        if (deltaLog[i].type == "ins") {
                            edits[k][j].at += deltaLog[i].text.length;
                        }
                        else if (deltaLog[i].type == "del") {
                            edits[k][j].at -= deltaLog[i].length;
                        }
                    }
                }
            }
        }

        // Subsequent "insertRemote/removeRemote" calls will trigger onChange
        // and fill the delta log. We will empty the deltaLog before the timeout
        // executes because remote edits should not be pushed to the deltaLog.
        // However, emptying the deltaLog will also remove our unsent edits,
        // thats why we dump them at this point
        self.dumpDeltaLog(); // dump our deltas to socket and reset them.
        
        for (var i = 0; i < edits.length; ++i) {
            for (var j = 0; j < edits[i].length; ++j) {
                if (edits[i][j].type == "ins") {
                    self.editor.insertRemote(edits[i][j].at, edits[i][j].text);
                }
                else if (edits[i][j].type == "del") {
                    try{
                        self.editor.removeRemote(edits[i][j].at, edits[i][j].length);
                    } catch (e) {
                    //console.log(e);
                    }
                }
            }
        }
        changeLog = changeLog.concat(edits);
        deltaLog = []; // clear delta log. these are not our edits.
    }

    var mergeDeltaLog = function(log) {
        var mergedLog = [], k = 0;
        while (k < log.length) {
            var merger = fullClone(log[k]);
            if (merger.type == "ins") {
                while (k + 1 < log.length && log[k+1].type == "ins"
                    && log[k+1].at == merger.at + merger.text.length ) {
                    merger.text += log[k+1].text;
                    ++k;
                    
                }
            }
            else if (merger.type == "del") {
                while (k + 1 < log.length && log[k + 1].type == "del" &&
                    (log[k+1].at == merger.at || log[k+1].at + log[k+1].length == merger.at)) {
                    merger.at = log[k+1].at;
                    merger.length += log[k+1].length;
                    ++k;
                }
            }
            mergedLog.push(merger);
            ++k;
        }
        return mergedLog;
    };

    this.dumpDeltaLog = function() {
        if (deltaLog.length > 0) {
            //Merging the delta log helps it become atomic.
            deltaLog = mergeDeltaLog(deltaLog);
            socket.send({
                version: initVersion + changeLog.length,
                actions:deltaLog
            });
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
        changeTimeout = setTimeout(self.dumpDeltaLog, 1250);
    });

    socket.connect();
    socket.on('message', function(json) {
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