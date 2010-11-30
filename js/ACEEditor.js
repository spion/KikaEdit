/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */


var ACEEditor = function(idEd, idDoc, 
    event, Editor, Renderer, theme, Document, JavaScriptMode, CssMode, HtmlMode, XmlMode, TextMode, UndoManager, Range) {
        
    
    var container = document.getElementById(idEd);
    var editor = new Editor(new Renderer(container, theme));
    var doc = new Document(document.getElementById(idDoc).innerHTML);
    doc.setMode(new JavaScriptMode());
    doc.setUndoManager(new UndoManager());
    editor.setDocument(doc);
    editor.focus();
    container.style.width = (document.documentElement.clientWidth - 40) + "px";
    container.style.height = (document.documentElement.clientHeight - 55 - 4) + "px";
    editor.resize();

    var toOffset = function(position) {
        var sum = 0;
        for (var k = 0; k < position.row; ++k) {
            sum += doc.lines[k].length + 1;
        }
        return sum + position.column;
    }

    var toPosition = function(offset) {
        var row = 0, column = 0, sum = 0;
        for (row = 0; row < doc.lines.length; ++row) {
            if (sum + doc.lines[row].length + 1 > offset) {
                column = offset - sum;
                break;
            }
            else {
                sum += doc.lines[row].length + 1;
            }
        }
        return {
            row:row,
            column:column
        };
    }

    var getContent = function(from, length) {
        return lines.join("\n").substr(from, length);
    }
    var countSubStr = function (string, substr) {
        return string.split(substr).length - 1;
    }

    this.insertRemote = function(offset, text) {
        var insert = toPosition(offset);
        var mypos = doc.getSelection().getRange();
        var shifts;
        if (mypos.start.row == insert.row && mypos.start.column >= insert.column) {
            mypos.start.column += text.length;
            mypos.end.column += text.length;
            shifts = countSubStr(text,"\n");
            mypos.start.row += shifts;
            mypos.end.row += shifts;
        }
        else if (mypos.start.row > insert.row) {
            shifts = countSubStr(text,"\n");
            mypos.start.row += shifts;
            mypos.end.row += shifts;
        }
        doc.insert(insert, text);
        doc.getSelection().setSelectionRange(Range.fromPoints(mypos.start, mypos.end));

    }
    this.removeRemote = function(offset, length) {
        var remove = {
            start: toPosition(offset),
            end: toPosition(offset + length)
        };
        console.log(remove);
        var mypos = doc.getSelection().getRange();
        var adjustCursor = function(cursor, remRange) {
            var posCursor = {
                row: cursor.row,
                column:cursor.column
            };
            console.log(posCursor)
            if (remRange.start.row < cursor.row) {
                posCursor.row -= Math.min(cursor.row, remRange.end.row) - remRange.start.row;
            }
            if (remRange.start.row < cursor.row && cursor.row < remRange.end.row) {
                console.log("cursor row between range rows")
                posCursor.column = 0;
            }
            if (remRange.end.row == cursor.row) { // remrange ends on cursor's row
                if (remRange.end.column < cursor.column) { /// ... and is before cursor...
                    posCursor.column -= (remRange.end.column - remRange.start.column);
                }
                else { // range ends after (or at) cursor's column...
                    posCursor.column = 0;
                }
            }
            
            return posCursor;
        }
        var newpos = {
            start: adjustCursor(mypos.start, remove),
            end: adjustCursor(mypos.end, remove)
            };
        doc.remove(Range.fromPoints(remove.start, remove.end));
        doc.getSelection().setSelectionRange(Range.fromPoints(newpos.start, newpos.end));
    }

    this.addOnChange = function(callback) {
        doc.addEventListener("edit", function(ev) {
            var delta = ev.data;
            if (delta.action == "insertText") {
                callback({
                    type:"ins",
                    at: toOffset(delta.range.start),
                    text: delta.text
                });
            }
            else {
                var at = toOffset(delta.range.start);
                callback({
                    type:"del",
                    at: at,
                    length: toOffset(delta.range.end) - at
                });
            }
        });
    }



    this.getCode = function() {
        return doc.lines.join("\n");
    }

    var insK = 0;



}

