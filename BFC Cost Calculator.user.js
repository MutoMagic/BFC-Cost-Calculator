// ==UserScript==
// @name         BFC Cost Calculator
// @namespace    https://osu.ppy.sh/u/6230892
// @version      2.4.7
// @description  基于pp+的osu炸翔杯cost计算器
// @author       muto
// @match        *://syrin.me/pp+/u/*
// @match        *://syrin.me/pp+/l/global/
// @match        *://syrin.me/pp+/l/c/*
// @match        *://osu.ppy.sh/u/*
// @match        *://osu.ppy.sh/p/pp
// @match        *://osu.ppy.sh/p/pp/?*m=0*
// @run-at       document-end
// @require      https://code.jquery.com/jquery-latest.js
// @grant        GM_xmlhttpRequest
// @connect      syrin.me
// ==/UserScript==

(function () {
    'use strict';

    // @require http://www.songho.ca/misc/logger/files/Logger.js
    //---------------------------------------------------------------------------------------------

    // utility function to print message with timestamp to log
    // e.g.: log("Hello")   : print Hello
    //       log(123)       : print 123
    //       log()          : print a blank line
    function log(msg) {
        if (arguments.length === 0) {
            Logger.print("");
        }// print a blank line
        else {
            Logger.print(msg);
        }
    }

    var Logger = (function () {

        ///////////////////////////////////////////////////////////////////////////
        // private members
        ///////////////////////////////////////////////////////////////////////////
        var version = "1.15";
        var containerDiv = null;
        var tabDiv = null;
        var logDiv = null;
        var visible = true;     // flag for visibility
        var opened = false;     // flag for toggle on/off
        var enabled = true;     // does not accept log messages any more if it is false
        var logHeight = 215;    // 204 + 2*padding + border-top
        var tabHeight = 20;
        // for animation
        var animTime = 0;
        var animDuration = 200; // ms
        var animFrameTime = 16;  // ms

        ///////////////////////////////////////////////////////////////////////////
        // get time and date as string with a trailing space
        var getTime = function () {
            var now = new Date();
            var hour = "0" + now.getHours();
            hour = hour.substring(hour.length - 2);
            var minute = "0" + now.getMinutes();
            minute = minute.substring(minute.length - 2);
            var second = "0" + now.getSeconds();
            second = second.substring(second.length - 2);
            return hour + ":" + minute + ":" + second;
        };
        var getDate = function () {
            var now = new Date();
            var year = "" + now.getFullYear();
            var month = "0" + (now.getMonth() + 1);
            month = month.substring(month.length - 2);
            var date = "0" + now.getDate();
            date = date.substring(date.length - 2);
            return year + "-" + month + "-" + date;
        };
        ///////////////////////////////////////////////////////////////////////////
        // return available requestAnimationFrame(), otherwise, fallback to setTimeOut
        var getRequestAnimationFrameFunction = function () {
            var requestAnimationFrame = window.requestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                window.oRequestAnimationFrame ||
                window.webkitRequestAnimationFrame;
            if (requestAnimationFrame) {
                return function (callback) {
                    return requestAnimationFrame(callback);
                };
            } else {
                return function (callback) {
                    return setTimeout(callback, 16);
                };
            }
        };

        ///////////////////////////////////////////////////////////////////////////
        // public members
        ///////////////////////////////////////////////////////////////////////////
        var self = {
            ///////////////////////////////////////////////////////////////////////
            // create a div for log and attach it to document
            init: function () {
                // avoid redundant call
                if (containerDiv) {
                    return true;
                }

                // check if DOM is ready
                if (!document || !document.createElement || !document.body ||
                    !document.body.appendChild) {
                    return false;
                }

                // constants
                var CONTAINER_DIV = "loggerContainer";
                var TAB_DIV = "loggerTab";
                var LOG_DIV = "logger";
                var Z_INDEX = 9999;

                // create logger DOM element
                containerDiv = document.getElementById(CONTAINER_DIV);
                if (!containerDiv) {
                    // container
                    containerDiv = document.createElement("div");
                    containerDiv.id = CONTAINER_DIV;
                    containerDiv.setAttribute("style", "width:100%; " +
                        "margin:0; " +
                        "padding:0; " +
                        "box-sizing:border-box; " +
                        "position:fixed; " +
                        "left:0; " +
                        "z-index:" + Z_INDEX + "; " +
                        "bottom:" + (-logHeight) + "px; ");
                    /* hide it initially */

                    // tab
                    tabDiv = document.createElement("div");
                    tabDiv.id = TAB_DIV;
                    tabDiv.appendChild(document.createTextNode("LOG"));
                    tabDiv.setAttribute("style", "width:40px; " +
                        "box-sizing:border-box; " +
                        "overflow:hidden; " +
                        "font:bold 10px verdana,helvetica,sans-serif; " +
                        "line-height:" + (tabHeight - 1) + "px; " + /* subtract top-border */
                        "color:#fff; " +
                        "position:absolute; " +
                        "left:20px; " +
                        "top:" + -tabHeight + "px; " +
                        "margin:0; padding:0; " +
                        "text-align:center; " +
                        "border:1px solid #aaa; " +
                        "border-bottom:none; " +
                        /*"background:#333; " + */
                        "background:rgba(0,0,0,0.8); " +
                        "-webkit-border-top-right-radius:8px; " +
                        "-webkit-border-top-left-radius:8px; " +
                        "-khtml-border-radius-topright:8px; " +
                        "-khtml-border-radius-topleft:8px; " +
                        "-moz-border-radius-topright:8px; " +
                        "-moz-border-radius-topleft:8px; " +
                        "border-top-right-radius:8px; " +
                        "border-top-left-radius:8px; ");
                    // add mouse event handlers
                    tabDiv.onmouseover = function () {
                        this.style.cursor = "pointer";
                        this.style.textShadow = "0 0 1px #fff, 0 0 2px #0f0, 0 0 6px #0f0";
                    };
                    tabDiv.onmouseout = function () {
                        this.style.cursor = "auto";
                        this.style.textShadow = "none";
                    };
                    tabDiv.onclick = function () {
                        Logger.toggle();
                    };

                    // log message
                    logDiv = document.createElement("div");
                    logDiv.id = LOG_DIV;
                    logDiv.setAttribute("style", "font:12px monospace; " +
                        "height: " + logHeight + "px; " +
                        "box-sizing:border-box; " +
                        "color:#fff; " +
                        "overflow-x:hidden; " +
                        "overflow-y:scroll; " +
                        "visibility:hidden; " +
                        "position:relative; " +
                        "bottom:0px; " +
                        "margin:0px; " +
                        "padding:5px; " +
                        /*"background:#333; " + */
                        "background:rgba(0, 0, 0, 0.8); " +
                        "border-top:1px solid #aaa; ");

                    // style for log message
                    var span = document.createElement("span");  // for coloring text
                    span.style.color = "#afa";
                    span.style.fontWeight = "bold";

                    // the first message in log
                    var msg = "===== Log Started at " +
                        getDate() + ", " + getTime() + ", " +
                        "(Logger version " + version + ") " +
                        "=====";

                    span.appendChild(document.createTextNode(msg));
                    logDiv.appendChild(span);
                    logDiv.appendChild(document.createElement("br"));   // blank line
                    logDiv.appendChild(document.createElement("br"));   // blank line

                    // add divs to document
                    containerDiv.appendChild(tabDiv);
                    containerDiv.appendChild(logDiv);
                    document.body.appendChild(containerDiv);
                }

                return true;
            },
            ///////////////////////////////////////////////////////////////////////
            // print log message to logDiv
            print: function (msg) {
                // ignore message if it is disabled
                if (!enabled) {
                    return;
                }

                // check if this object is initialized
                if (!containerDiv) {
                    var ready = this.init();
                    if (!ready) {
                        return;
                    }
                }

                var msgDefined = true;

                // convert non-string type to string
                if (typeof msg == "undefined")   // print "undefined" if param is not defined
                {
                    msg = "undefined";
                    msgDefined = false;
                }
                else if (msg === null)           // print "null" if param has null value
                {
                    msg = "null";
                    msgDefined = false;
                }
                else {
                    msg += ""; // for "object", "function", "boolean", "number" types
                }

                var lines = msg.split(/\r\n|\r|\n/);
                for (var i in lines) {
                    // format time and put the text node to inline element
                    var timeDiv = document.createElement("div");            // color for time
                    timeDiv.setAttribute("style", "color:#999;" +
                        "float:left;");

                    var timeNode = document.createTextNode(getTime() + "\u00a0");
                    timeDiv.appendChild(timeNode);

                    // create message span
                    var msgDiv = document.createElement("div");
                    msgDiv.setAttribute("style", "word-wrap:break-word;" +  // wrap msg
                        "margin-left:6.0em;");     // margin-left = 9 * ?
                    if (!msgDefined) {
                        msgDiv.style.color = "#afa";
                    } // override color if msg is not defined

                    // put message into a text node
                    var line = lines[i].replace(/ /g, "\u00a0");
                    var msgNode = document.createTextNode(line);
                    msgDiv.appendChild(msgNode);

                    // new line div with clearing css float property
                    var newLineDiv = document.createElement("div");
                    newLineDiv.setAttribute("style", "clear:both;");

                    logDiv.appendChild(timeDiv);            // add time
                    logDiv.appendChild(msgDiv);             // add message
                    logDiv.appendChild(newLineDiv);         // add message

                    logDiv.scrollTop = logDiv.scrollHeight; // scroll to last line
                }
            },
            ///////////////////////////////////////////////////////////////////////
            // slide log container up and down
            toggle: function () {
                if (opened)  // if opened, close the window
                {
                    this.close();
                } else        // if closed, open the window
                {
                    this.open();
                }
            },
            open: function () {
                if (!this.init()) {
                    return;
                }
                if (!visible) {
                    return;
                }
                if (opened) {
                    return;
                }

                logDiv.style.visibility = "visible";
                animTime = Date.now();
                var requestAnimationFrame = getRequestAnimationFrameFunction();
                requestAnimationFrame(slideUp);

                function slideUp() {
                    var duration = Date.now() - animTime;
                    if (duration >= animDuration) {
                        containerDiv.style.bottom = 0;
                        opened = true;
                        return;
                    }
                    var y = Math.round(-logHeight * (
                        1 - 0.5 * (1 - Math.cos(Math.PI * duration / animDuration))
                    ));
                    containerDiv.style.bottom = "" + y + "px";
                    requestAnimationFrame(slideUp);
                }
            },
            close: function () {
                if (!this.init()) {
                    return;
                }
                if (!visible) {
                    return;
                }
                if (!opened) {
                    return;
                }

                animTime = Date.now();
                var requestAnimationFrame = getRequestAnimationFrameFunction();
                requestAnimationFrame(slideDown);

                function slideDown() {
                    var duration = Date.now() - animTime;
                    if (duration >= animDuration) {
                        containerDiv.style.bottom = "" + -logHeight + "px";
                        logDiv.style.visibility = "hidden";
                        opened = false;
                        return;
                    }
                    var y = Math.round(-logHeight * 0.5 * (
                        1 - Math.cos(Math.PI * duration / animDuration)
                    ));
                    containerDiv.style.bottom = "" + y + "px";
                    requestAnimationFrame(slideDown);
                }
            },
            ///////////////////////////////////////////////////////////////////////
            // show/hide the logger window and tab
            show: function () {
                if (!this.init()) {
                    return;
                }

                containerDiv.style.display = "block";
                visible = true;
            },
            hide: function () {
                if (!this.init()) {
                    return;
                }

                containerDiv.style.display = "none";
                visible = false;
            },
            ///////////////////////////////////////////////////////////////////////
            // when Logger is enabled (default), log() method will write its message
            // to the console ("logDiv")
            enable: function () {
                if (!this.init()) {
                    return;
                }

                enabled = true;
                tabDiv.style.color = "#fff";
                logDiv.style.color = "#fff";
            },
            ///////////////////////////////////////////////////////////////////////
            // when it is diabled, subsequent log() calls will be ignored and
            // the message won't be written on "logDiv".
            // "LOG" tab and log text are grayed out to indicate it is disabled.
            disable: function () {
                if (!this.init()) {
                    return;
                }

                enabled = false;
                tabDiv.style.color = "#444";
                logDiv.style.color = "#444";
            },
            ///////////////////////////////////////////////////////////////////////
            // clear all messages from logDiv
            clear: function () {
                if (!this.init()) {
                    return;
                }

                logDiv.innerHTML = "";
            }
        };
        return self;
    })();

    // @require https://github.com/fitzgen/glob-to-regexp
    //---------------------------------------------------------------------------------------------

    function glob(glob, opts) {
        if (typeof glob !== 'string') {
            throw new TypeError('Expected a string');
        }

        var str = String(glob);

        // The regexp we are building, as a string.
        var reStr = "";

        // Whether we are matching so called "extended" globs (like bash) and should
        // support single character matching, matching ranges of characters, group
        // matching, etc.
        var extended = opts ? !!opts.extended : false;

        // When globstar is _false_ (default), '/foo/*' is translated a regexp like
        // '^\/foo\/.*$' which will match any string beginning with '/foo/'
        // When globstar is _true_, '/foo/*' is translated to regexp like
        // '^\/foo\/[^/]*$' which will match any string beginning with '/foo/' BUT
        // which does not have a '/' to the right of it.
        // E.g. with '/foo/*' these will match: '/foo/bar', '/foo/bar.txt' but
        // these will not '/foo/bar/baz', '/foo/bar/baz.txt'
        // Lastely, when globstar is _true_, '/foo/**' is equivelant to '/foo/*' when
        // globstar is _false_
        var globstar = opts ? !!opts.globstar : false;

        // If we are doing extended matching, this boolean is true when we are inside
        // a group (eg {*.html,*.js}), and false otherwise.
        var inGroup = false;

        // RegExp flags (eg "i" ) to pass in to RegExp constructor.
        var flags = opts && typeof( opts.flags ) === "string" ? opts.flags : "";

        var c;
        for (var i = 0, len = str.length; i < len; i++) {
            c = str[i];

            switch (c) {
                case "\\":
                case "/":
                case "$":
                case "^":
                case "+":
                case ".":
                case "(":
                case ")":
                case "=":
                case "!":
                case "|":
                    reStr += "\\" + c;
                    break;

                case "?":
                    if (extended) {
                        reStr += ".";
                        break;
                    }

                case "[":
                case "]":
                    if (extended) {
                        reStr += c;
                        break;
                    }

                case "{":
                    if (extended) {
                        inGroup = true;
                        reStr += "(";
                        break;
                    }

                case "}":
                    if (extended) {
                        inGroup = false;
                        reStr += ")";
                        break;
                    }

                case ",":
                    if (inGroup) {
                        reStr += "|";
                        break;
                    }
                    reStr += "\\" + c;
                    break;

                case "*":
                    // Move over all consecutive "*"'s.
                    // Also store the previous and next characters
                    var prevChar = str[i - 1];
                    var starCount = 1;
                    while (str[i + 1] === "*") {
                        starCount++;
                        i++;
                    }
                    var nextChar = str[i + 1];

                    if (!globstar) {
                        // globstar is disabled, so treat any number of "*" as one
                        reStr += ".*";
                    } else {
                        // globstar is enabled, so determine if this is a globstar segment
                        var isGlobstar = starCount > 1 &&                      // multiple "*"'s
                            (prevChar === "/" || prevChar === undefined) &&    // from the start of the segment
                            (nextChar === "/" || nextChar === undefined);      // to the end of the segment

                        if (isGlobstar) {
                            // it's a globstar, so match zero or more path segments
                            reStr += "((?:[^/]*(?:\/|$))*)";
                            i++; // move over the "/"
                        } else {
                            // it's not a globstar, so only match one path segment
                            reStr += "([^/]*)";
                        }
                    }
                    break;

                default:
                    reStr += c;
            }
        }

        // When regexp 'g' flag is specified don't
        // constrain the regular expression with ^ & $
        if (!flags || !~flags.indexOf('g')) {
            reStr = "^" + reStr + "$";
        }

        return new RegExp(reStr, flags);
    }

    // @require https://github.com/eligrey/FileSaver.js
    //---------------------------------------------------------------------------------------------

    var saveAs = (function (view) {
        // IE <10 is explicitly unsupported
        if (typeof view === "undefined" || typeof navigator !== "undefined" &&
            /MSIE [1-9]\./.test(navigator.userAgent)) {
            return;
        }
        var
            doc = view.document,
            // only get URL when necessary in case Blob.js hasn't overridden it yet
            get_URL = function () {
                return view.URL || view.webkitURL || view;
            },
            save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a"),
            can_use_save_link = "download" in save_link,
            click = function (node) {
                var event = new MouseEvent("click");
                node.dispatchEvent(event);
            },
            is_safari = /constructor/i.test(view.HTMLElement) || view.safari,
            is_chrome_ios = /CriOS\/[\d]+/.test(navigator.userAgent),
            throw_outside = function (ex) {
                (view.setImmediate || view.setTimeout)(function () {
                    throw ex;
                }, 0);
            },
            force_saveable_type = "application/octet-stream",
            // the Blob API is fundamentally broken as there is no "downloadfinished" event to subscribe to
            arbitrary_revoke_timeout = 1000 * 40, // in ms
            revoke = function (file) {
                var revoker = function () {
                    if (typeof file === "string") { // file is an object URL
                        get_URL().revokeObjectURL(file);
                    } else { // file is a File
                        file.remove();
                    }
                };
                setTimeout(revoker, arbitrary_revoke_timeout);
            },
            dispatch = function (filesaver, event_types, event) {
                event_types = [].concat(event_types);
                var i = event_types.length;
                while (i--) {
                    var listener = filesaver["on" + event_types[i]];
                    if (typeof listener === "function") {
                        try {
                            listener.call(filesaver, event || filesaver);
                        } catch (ex) {
                            throw_outside(ex);
                        }
                    }
                }
            },
            auto_bom = function (blob) {
                // prepend BOM for UTF-8 XML and text/* types (including HTML)
                // note: your browser will automatically convert UTF-16 U+FEFF to EF BB BF
                if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
                    return new Blob([String.fromCharCode(0xFEFF), blob], {type: blob.type});
                }
                return blob;
            },
            FileSaver = function (blob, name, no_auto_bom) {
                if (!no_auto_bom) {
                    blob = auto_bom(blob);
                }
                // First try a.download, then web filesystem, then object URLs
                var
                    filesaver = this,
                    type = blob.type,
                    force = type === force_saveable_type,
                    object_url,
                    dispatch_all = function () {
                        dispatch(filesaver, "writestart progress write writeend".split(" "));
                    },
                    // on any filesys errors revert to saving with object URLs
                    fs_error = function () {
                        if ((is_chrome_ios || (force && is_safari)) && view.FileReader) {
                            // Safari doesn't allow downloading of blob urls
                            var reader = new FileReader();
                            reader.onloadend = function () {
                                var url = is_chrome_ios ? reader.result : reader.result
                                    .replace(/^data:[^;]*;/, 'data:attachment/file;');
                                var popup = view.open(url, '_blank');
                                if (!popup) view.location.href = url;
                                url = undefined; // release reference before dispatching
                                filesaver.readyState = filesaver.DONE;
                                dispatch_all();
                            };
                            reader.readAsDataURL(blob);
                            filesaver.readyState = filesaver.INIT;
                            return;
                        }
                        // don't create more object URLs than needed
                        if (!object_url) {
                            object_url = get_URL().createObjectURL(blob);
                        }
                        if (force) {
                            view.location.href = object_url;
                        } else {
                            var opened = view.open(object_url, "_blank");
                            if (!opened) {
                                // Apple does not allow window.open
                                view.location.href = object_url;
                            }
                        }
                        filesaver.readyState = filesaver.DONE;
                        dispatch_all();
                        revoke(object_url);
                    };

                filesaver.readyState = filesaver.INIT;

                if (can_use_save_link) {
                    object_url = get_URL().createObjectURL(blob);
                    setTimeout(function () {
                        save_link.href = object_url;
                        save_link.download = name;
                        click(save_link);
                        dispatch_all();
                        revoke(object_url);
                        filesaver.readyState = filesaver.DONE;
                    });
                    return;
                }

                fs_error();
            },
            FS_proto = FileSaver.prototype,
            saveAs = function (blob, name, no_auto_bom) {
                return new FileSaver(blob, name || blob.name || "download", no_auto_bom);
            };

        // IE 10+ (native saveAs)
        if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
            return function (blob, name, no_auto_bom) {
                name = name || blob.name || "download";

                if (!no_auto_bom) {
                    blob = auto_bom(blob);
                }
                return navigator.msSaveOrOpenBlob(blob, name);
            };
        }

        FS_proto.abort = function () {
        };
        FS_proto.readyState = FS_proto.INIT = 0;
        FS_proto.WRITING = 1;
        FS_proto.DONE = 2;

        FS_proto.error = null;
        FS_proto.onwritestart = null;
        FS_proto.onprogress = null;
        FS_proto.onwrite = null;
        FS_proto.onabort = null;
        FS_proto.onerror = null;
        FS_proto.onwriteend = null;

        return saveAs;
    }(
        self || window || this.content
    ));

    // Utils
    //---------------------------------------------------------------------------------------------

    String.prototype.$match = function (callback) {
        const reg = glob(this);
        if (reg.test(window.location.href)) {
            async(callback);// callback this is undefined
            return true;
        }
        return false;
    };

    String.prototype.toInt = function () {
        return parseInt(this.replace(/,/g, ""));
    };

    // 源于C#中的string.Format()
    String.prototype.format = function (args) {
        let result = this;
        if (arguments.length === 1 && typeof (args) === "object") {
            for (const key of args) {
                result = result.replace("{" + key + "}", args[key]);
            }
        } else {
            for (let i = 0; i < arguments.length; i++) {
                result = result.replace("{" + i + "}", arguments[i]);
            }
        }
        return result;
    };

    String.prototype.log = function () {
        return log(this) || this;
    };

    // 支持负数的指数运算
    function pow(x, y) {
        return x < 0 ? -Math.pow(-x, y) : Math.pow(x, y);
    }

    function async(callback, delay) {
        return new Promise((resolve, reject) => {
            // 模拟异步操作
            setTimeout(() => {
                try {
                    const r = callback();
                    resolve(r);
                } catch (e) {
                    reject(e);
                }
            }, delay);
        });
    }

    $.fn.extend({
        // 由于每个 callback 都会被异步，回调本身的 return 只能终止当前操作，
        // 不能影响循环本身，因此将无法返回 false/true 来进行 break/continue
        asyncEach: function (callback) {
            // 异步的是回调函数，并非循环体
            return this.each(function (i) {
                async(_ => callback.apply(this, arguments), i);
            });
        },

        // 数据工厂，用于从 pp+/u 页面中获取 cost
        dataFactory: function () {
            const perform = {};

            // 构造数据
            $(".performance-table tbody tr", this).each(function () {
                let child = $(this).children(),
                    name = child.first().text().slice(0, -1);

                if (name.includes("Aim")) {
                    name = name.match("\\((.+?)\\)")[1];// 获取括号内的文本
                }
                perform[name] = child.last().text().toInt();
            });

            return new Cost(perform);
        }
    });

    $.extend({
        dataFactory: function () {
            return $(document).dataFactory();
        },

        // @grant GM_xmlhttpRequest
        http: function (details) {
            details.superOnload = details.onload || $.noop;
            return new Promise((resolve, reject) => {

                // 绑定处理事件
                details.onload = function (data) {
                    details.superOnload(data);// super();

                    // 200: "OK"
                    // 4: 请求已完成，且响应已就绪
                    if (data.status === 200 && data.readyState === 4) {
                        resolve(data.responseText);
                    } else {
                        // eg. GET url 404 Not Found
                        reject("{0} {1} {2} {3}".format(
                            details.method, data.finalUrl, data.status, data.statusText
                        ));
                    }
                };

                // 新增 delay 属性，用于延迟加载，以避免请求过于频繁
                setTimeout(_ => GM_xmlhttpRequest(details), details.delay);
            });
        },

        // Usually the advice for not extending Array.prototype or
        // other native prototypes might come down to one of these:
        // 1.for..in might not work properly
        // 2.Someone else might also want to extend Array with the same function name
        // 3.It might not work properly in every browser, even with the shim.
        random: function (array) {
            return array[Math.floor(Math.random() * array.length)];
        }
    });

    // 通用缓存
    function Buffer() {
        const that = this;
        // 对象本身用于存放数据
        return function (key, value) {
            // getter
            if (arguments.length === 1) {
                return that[key];
            }
            // setter
            if (arguments.length === 2) {
                that[key] = value;
                return value;
            }
            return that;
        };
    }

    Buffer.prototype.download = function (name) {
        const blob = new Blob([
            JSON.stringify(this, null, 4)
        ], {
            type: "application/json; charset=utf-8"
        });
        saveAs(blob, name);
    };

    // Algorithm
    //---------------------------------------------------------------------------------------------

    function Aim(p) {
        this.jump = pow(p.Jump / 1200 - 0.5, 0.8);
        this.flow = pow(1 + p.Flow / 3000, 0.8);
        this.precision = pow(1 + p.Precision / 3000, 0.8);

        const r = this.jump * this.flow * this.precision;
        return $.extend(Object(r), this);
    }

    function Cost(p) {
        this.aim = new Aim(p);
        this.spd = (p.Speed + p.Stamina) / 1500 - 0.5;
        this.acc = pow(1 + p.Accuracy / 5000, 0.8);

        this["[[pv]]"] = (this.aim + this.spd * 0.8) * this.acc / 1.4;// primitive value
    }

    Cost.logBuffer = new Buffer();// 等同于 new Buffer

    Cost.prototype = {
        valueOf: function () {
            return this["[[pv]]"];// 模拟Number对象的原始值
        },

        toString: function () {
            return String(this["[[pv]]"]);
        },

        // 四舍五入，并保留两位小数
        // 可通过 digits 设置 toFixed
        toFixed: function (digits) {
            return (this["[[pv]]"] < 0 ? 0 : this["[[pv]]"]).toFixed(digits || 2);
        },

        // [tag] cost
        log: function (tag) {
            Cost.logBuffer(
                tag || new Date().getTime(),
                this["[[pv]]"]
            );
            "{0} {1}".format(tag || "", this["[[pv]]"]).log();
            return this;
        }
    };

    // *://syrin.me/*
    //---------------------------------------------------------------------------------------------

    "*/pp+/u/*".$match(function () {
        $(".performance-table tbody").append(
            $(".performance-table .perform-acc").clone().attr("class", "perform-cost")
        );
        $(".perform-cost td:first").text("Cost v2:").next().text(
            $.dataFactory().log().toFixed() + " 円/次"
        );
    });

    "*/pp+/l/*".$match(function () {
        $(".static-row").asyncEach(function () {
            let tr = $(this),

                // 构造perform 并计算cost
                td = tr.children("td:gt(1)"),
                next = function () {
                    td = td.next();// 模拟线性指针
                    return td.text().toInt();
                },
                c = new Cost({
                    Total: next(),
                    Jump: next(),
                    Flow: next(),
                    Precision: next(),
                    Speed: next(),
                    Stamina: next(),
                    Accuracy: next()

                }).toFixed(1);

            tr.append("<td>{0}</td>".format(c));
        });

        $(".ranking-header").append("<th>Cost</th>");// add thead
    });

    // *://osu.ppy.sh/*
    //---------------------------------------------------------------------------------------------

    "*://osu.ppy.sh/u/*".$match(function () {
        const path = "/u/" + userId;// 页面自带 window.userId
        $.http({
            method: "GET",
            url: "https://syrin.me/pp+" + (userId ? path : window.location.pathname)
        }).then(data => {
            // $(".profile-username").after(
            //     "Cost v2: " + $(data).dataFactory().log().toFixed()
            // );

            // SE比赛用 - 分组
            let c = $(data).dataFactory().log().toFixed();
            if (c >= 7.6) {
                c = 11;
            } else if (c >= 6) {
                c = 9;
            } else if (c >= 5.6) {
                c = 7;
            } else if (c >= 4.5) {
                c = 6;
            } else if (c >= 3.8) {
                c = 5;
            } else if (c >= 3) {
                c = 4;
            } else if (c >= 2.5) {
                c = 3;
            } else if (c >= 2) {
                c = 2;
            } else {
                c = 1;
            }
            $(".profile-username").after("Cost SE Group: " + c);
        });

        // 彩蛋 (๑•̀ㅂ•́)و✧
        $('.footer_columns').append("<iframe id='player'></iframe>");
        $('#player').attr({
            frameborder: "no",
            border: "0",
            marginwidth: "0",
            marginheight: "0",
            width: 330,
            height: 450,

            // 71014486   〖osu!播放器〗音游电子狂欢•精整更新曲库
            // 616677063  『东方』幻想写景，来首纯音乐吧♡
            // ================================================================
            // type 播放器类型 0.歌单 2.单曲
            // auto 自动播放 1.true 0.false
            src: "//music.163.com/outchain/player?type={0}&id={1}&auto={2}&height=430".format(
                0, $.random([71014486, 616677063]), 0
            )
        });
    });

    "*/p/pp*".$match(function () {
        const tab = $("#tablist"),
            bSave = $("<li><a>!query save</a></li>"),
            bCost = $("<li><a>!query cost</a></li>");

        function bCost_handle() {
            let load = $("<div>少女祈祷中 0%</div>"),
                list = $(".beatmapListing a"),
                all = list.length,
                now = 0;

            list.each(function () {
                const a = $(this);
                $.http({
                    method: "GET",
                    url: "https://syrin.me/pp+" + a.attr("href"),
                    delay: Math.round(Math.random() * 1000 + 1000),// 随机延迟，预防502
                    onload: _ => {
                        const pre = parseInt(++now / all * 100);
                        load.text((i, t) => t.replace(/[\d]+/, pre));

                        // 加载完成
                        if (now === all) {
                            bSave.appendTo(tab);
                            load.hide();// 隐藏进度条
                        }
                    }

                }).then(data => {
                    const c = $(data).dataFactory().log(a.text()).toFixed();
                    a.append(" | Cost: {0}".format(c));
                });
            });

            load.insertBefore(tab);
            bCost.remove();// 阻止重放
        }

        const name = Date.now() + ".json";
        bSave.click(_ => Cost.logBuffer().download(name));
        bCost.appendTo(tab).click(bCost_handle);
    });

})();
