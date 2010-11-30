/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */


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
        self.dumpChangeLog(); // dump changelog to socket and reset it.
        for (var i = 0; i < edits.length; ++i) {
            for (var j = 0; j < edits[i].length; ++j) {
                if (edits[i][j].type == "ins") {
                    self.editor.insertRemote(edits[i][j].at, edits[i][j].text);
                }
                else if (edits[i][j].type == "del") {
                    try{
                        self.editor.removeRemote(edits[i][j].at, edits[i][j].length);
                    } catch (e) {
                        console.log(e);
                    }
                }
            }
        }
        changeLog = changeLog.concat(edits);
        deltaLog = []; // clear delta log. these are not our edits.
    }

    this.dumpChangeLog = function() {
        if (deltaLog.length > 0) {
            socket.send({
                version: initVersion + changeLog.length,
                actions:deltaLog
            });
            changeLog.push(deltaLog);
        }
        deltaLog = [];
    }

    this.changeLog = function() {
        return changeLog;
    }
   
    self.editor.addOnChange(function(delta) {
        deltaLog.push(delta);
        if (changeTimeout) { clearTimeout(changeTimeout); }
        changeTimeout = setTimeout(self.dumpChangeLog, 250);
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