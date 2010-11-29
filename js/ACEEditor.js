/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */


var ACEEditor = function(idEd, idDoc,
[event, Editor, Renderer, theme, Document, JavaScriptMode, CssMode, HtmlMode, XmlMode, TextMode, UndoManager, Range]) {
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

    this.insertRemote = function(pos, text) {
        var sel = doc.getSelection().getRange();
        var selstart = toOffset(sel.start),
        selend = toOffset(sel.end);
        if (selstart >= pos) {
            sel.start = toPosition(text.length + selstart);
            sel.end = toPosition(text.length + selend);
        }
        doc.insert(toPosition(pos), text);
        doc.getSelection().setSelectionRange(Range.fromPoints(sel.start, sel.end));

    }
    this.removeRemote = function(pos, length) {
        var sel = doc.getSelection().getRange();
        var selstart = toOffset(sel.start),
        selend = toOffset(sel.end);
        if (selstart >= pos) {
            var delta = Math.min(selstart - pos, length);
            sel.start = toPosition(selstart - delta);
            sel.end = toPosition(selend - delta);
        }
        doc.remove(Range.fromPoints(toPosition(pos), toPosition(pos + length)));
        doc.getSelection().setSelectionRange(Range.fromPoints(sel.start, sel.end));
    }
    this.addOnChange = function(callback) {
        doc.addEventListener("change", callback);
    }
    this.getCode = function() {
        return doc.lines.join("\n");
    }


}

