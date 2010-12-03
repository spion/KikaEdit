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

    var syncDeltas = function(deltas, changelog) {
        for (var i = 0; i < changelog.length; ++i) {
            for (var j = 0; j < changelog[i].length; ++j) {
                for (var k = 0; k < deltas.length; ++k) {
                    if (changelog[i][j].at <= deltas[k].at) {
                        if (changelog[i][j].type == "ins") {
                            deltas[k].at += changelog[i][j].text.length;
                        }
                        else if (changelog[i][j].type == "del") {
                            deltas[k].at = 
                                Math.min(deltas[k].at - changelog[i][j].length, changelog[i][j].at);
                        }

                    }
                }
            }
        }
    }

    this.execEdit = function(edit) {
        if (edit.type == "ins") {
            self.editor.insertRemote(edit.at, edit.text);
        }
        else if (edit.type == "del") {
            self.editor.removeRemote(edit.at,edit.length);
        }
    }
    this.applyEdits = function(edits) {
        // remember, then undo our deltas,  then sync them.
        var syncedDeltas = fullClone(deltaLog);
        undoEdits(syncedDeltas);
        syncDeltas(syncedDeltas, edits);

        // Apply the other user's edits first
        // then sync the changeLog with server's changelog
        for (i = 0; i < edits.length; ++i) {
            for (j = 0; j < edits[i].length; ++j) {
                self.execEdit(edits[i][j]);
            }
        }
        changeLog = changeLog.concat(edits);

        // at this point the deltaLog is full of stuff we didn't do caused
        // by insertRemote and removeRemote usage. we need to reset it to nothing
        // and then re-apply our synced deltas
        deltaLog = [];
        for (j = 0; j < syncedDeltas.length; ++j) {
            self.execEdit(syncedDeltas[j]);
        }
        // which also re-fills deltaLog again. this is a good moment to
        // dump our edits to the server.
        self.dumpDeltaLog();

    }

    this.dumpDeltaLog = function() {
        if (deltaLog.length > 0) {
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
        changeTimeout = setTimeout(self.dumpDeltaLog, 2250);
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