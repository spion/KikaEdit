/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */


var LiveDocument = function(editor) {
    var self = this;
    self.editor = editor;
    self.editor.insertRemote(0, "\n");
    self.editor.removeRemote(0, 1);

    var dmp = new diff_match_patch(),
        initVersion = 0,
        changeLog = [],
        changeTimeout = null,
        oldDoc = null,
        socket = new io.Socket('spion.sytes.net');




    this.applyEdits = function(edits) {
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
        oldDoc = self.editor.getCode();
    }

    this.dumpChangeLog = function() {
        var newDoc = new String(self.editor.getCode());
        var d = self.diff(oldDoc, newDoc);
        if (d.length > 0) {
            socket.send({
                version: initVersion + changeLog.length,
                actions:d
            });
            changeLog.push(d);
        }
        oldDoc = newDoc;
    }

    this.changeLog = function() {
        return changeLog;
    }

    this.diff = function(oldDoc, newDoc) {
        try {
            var raw = dmp.diff_main(oldDoc, newDoc);
        }
        catch (e) {
            return [];
        }
        var cmds = [];
        var at = 0;
        for (var k = 0; k < raw.length; ++k) {
            if (raw[k][0] == -1 && raw[k][1].length > 0) {
                cmds.push({
                    at:at,
                    type:"del",
                    length:raw[k][1].length
                });
            }
            else if (raw[k][0] == 1 && raw[k][1].length > 0) {
                cmds.push({
                    at: at,
                    type:"ins",
                    text:raw[k][1]
                });
                at += raw[k][1].length;
            }
            else if (raw[k][0] == 0) {
                at += raw[k][1].length;
            }
        }
        return cmds;
    }
    
    self.editor.addOnChange(function() {
        if (changeTimeout) {
            clearTimeout(changeTimeout);
        }
        changeTimeout = setTimeout(self.dumpChangeLog, 250);
    });

    socket.connect();
    socket.on('message', function(json) {
        var data = $.parseJSON(json);
        //console.log("Recv edits");
        //console.log(edits);
        if (data.version) {
            initVersion = data.version;
            self.editor.insertRemote(0, data.text);
            oldDoc = self.editor.getCode();
        }
        else {
            self.dumpChangeLog();
            self.applyEdits(data);
        }
    });

    oldDoc = self.editor.getCode();

    return true;
}