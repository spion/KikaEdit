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
        var mypos = doc.getSelection().getRange(); var shifts;
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
        var mypos = doc.getSelection().getRange();
        var adjustCursor = function(cursor, remRange) {
            if (remRange.start.row < cursor.row) {
                cursor.row -= Math.min(cursor.row, remRange.end.row) - remRange.start.row;
            }
            if (remRange.start.row < cursor.row && cursor.row < remRange.end.row) {
                cursor.column = 0;
            }
            if (remRange.end.row == cursor.row) {
                if (remRange.end.column < cursor.column) {
                    if (remRange.start.row != cursor.row) { // remRange is multi-row
                        cursor.column -= remRange.end.column;
                    }
                    else { // remRange is single-row
                        cursor.column -= (remRange.end.column - remRange.start.column);
                    }
                }
                else { // range ends after (or at) cursor...
                    cursor.column = 0;
                }
            }
            
            return cursor;
        }
        mypos.start = adjustCursor(mypos.start, remove);
        mypos.end = adjustCursor(mypos.end, remove);
        doc.remove(Range.fromPoints(remove.start, remove.end));
        doc.getSelection().setSelectionRange(Range.fromPoints(mypos.start, mypos.end));
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

