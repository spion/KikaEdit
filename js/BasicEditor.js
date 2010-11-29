/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */


var BasicEditor = function(idElem) {

    var elem = document.getElementById(idElem);
    this.insertRemote = function(pos, text) {
        var selStart = elem.selectionStart;
        var selEnd = elem.selectionEnd;
        if (selStart > pos) {
            selStart += text.length;
            selEnd += text.length;
        }
        var strVal = $(elem).val();
        strVal = strVal.substr(0, pos) + text + strVal.substr(pos);
        $(elem).val(strVal);
        elem.setSelectionRange(selStart, selEnd);

    }
    this.removeRemote = function(start, length) {
        var selStart = elem.selectionStart;
        var selEnd = elem.selectionEnd;
        if (selStart > start) {
            var delta = Math.min(selStart - start, length);
            selStart -= delta;
            selEnd -= delta;
        }
        var strVal = $(elem).val();
        strVal = strVal.substr(0, start) + strVal.substr(start + length);
        $(elem).val(strVal);
        elem.setSelectionRange(selStart, selEnd);
    }
    this.addOnChange = function(callback) {
        $(elem).keyup(callback);
    }
    this.getCode = function() {
        return $(elem).val();
    }
}