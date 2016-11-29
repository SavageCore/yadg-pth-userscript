// ==UserScript==
// @id             pth-yadg
// @name           passtheheadphones.me - YADG
// @description    This script provides integration with online description generator YADG (http://yadg.cc) - Credit to Slack06
// @license        https://github.com/Slack06/yadg-userscript/blob/master/LICENSE
// @version        1.3.7
// @namespace      yadg
// @grant          GM_xmlhttpRequest
// @require        https://yadg.cc/static/js/jsandbox.min.js
// @include        http*://*passtheheadphones.me/upload.php*
// @include        http*://*passtheheadphones.me/requests.php*
// @include        http*://*passtheheadphones.me/torrents.php*
// @include        http*://*waffles.ch/upload.php*
// @include        http*://*waffles.ch/requests.php*
// @downloadURL    https://github.com/SavageCore/yadg-pth-userscript/raw/master/pth_yadg.user.js
// ==/UserScript==

// --------- USER SETTINGS START ---------

/*
 Here you can set site specific default templates.
 You can find a list of available templates at: https://yadg.cc/api/v2/templates/
*/
var defaultPTHFormat = 5,
    defaultWafflesFormat = 9;

// --------- USER SETTINGS END ---------



// --------- THIRD PARTY CODE AREA START ---------

//
// Creates an object which gives some helper methods to
// Save/Load/Remove data to/from the localStorage
//
// Source from: https://github.com/gergob/localstoragewrapper
//
function LocalStorageWrapper (applicationPrefix) {
    "use strict";

    if(applicationPrefix == undefined) {
        throw new Error('applicationPrefix parameter should be defined');
    }

    var delimiter = '_';

    //if the passed in value for prefix is not string, it should be converted
    var keyPrefix = typeof(applicationPrefix) === 'string' ? applicationPrefix : JSON.stringify(applicationPrefix);

    var localStorage = window.localStorage||unsafeWindow.localStorage;

    var isLocalStorageAvailable = function() {
        return typeof(localStorage) != undefined
    };

    var getKeyPrefix = function() {
        return keyPrefix;
    };

    //
    // validates if there is a prefix defined for the keys
    // and checks if the localStorage functionality is available or not
    //
    var makeChecks = function(key) {
        var prefix = getKeyPrefix();
        if(prefix == undefined) {
            throw new Error('No prefix was defined, data cannot be saved');
        }

        if(!isLocalStorageAvailable()) {
            throw new Error('LocalStorage is not supported by your browser, data cannot be saved');
        }

        //keys are always strings
        var checkedKey = typeof(key) === 'string' ? key : JSON.stringify(key);

        return checkedKey;
    };

    //
    // saves the value associated to the key into the localStorage
    //
    var addItem = function(key, value) {
        var that = this;
        try{
            var checkedKey = makeChecks(key);
            var combinedKey = that.getKeyPrefix() + delimiter + checkedKey;
            localStorage.setItem(combinedKey, JSON.stringify(value));
        }
        catch(error) {
            console.log(error);
            throw error;
        }
    };

    //
    // gets the value of the object saved to the key passed as parameter
    //
    var getItem = function(key) {
        var that = this;
        var result = undefined;
        try{
            var checkedKey = makeChecks(key);
            var combinedKey = that.getKeyPrefix() + delimiter + checkedKey;
            var resultAsJSON = localStorage.getItem(combinedKey);
            result = JSON.parse(resultAsJSON);
        }
        catch(error) {
            console.log(error);
            throw error;
        }
        return result;
    };

    //
    // returns all the keys from the localStorage
    //
    var getAllKeys = function() {
        var prefix = getKeyPrefix();
        var results = [];

        if(prefix == undefined) {
            throw new Error('No prefix was defined, data cannot be saved');
        }

        if(!isLocalStorageAvailable()) {
            throw new Error('LocalStorage is not supported by your browser, data cannot be saved');
        }

        for(var key in localStorage) {
            if(key.indexOf(prefix) == 0) {
                var keyParts = key.split(delimiter);
                results.push(keyParts[1]);
            }
        }

        return results;
    };

    //
    // removes the value associated to the key from the localStorage
    //
    var removeItem = function(key) {
        var that = this;
        var result = false;
        try{
            var checkedKey = makeChecks(key);
            var combinedKey = that.getKeyPrefix() + delimiter + checkedKey;
            localStorage.removeItem(combinedKey);
            result = true;
        }
        catch(error) {
            console.log(error);
            throw error;
        }
        return result;
    };

    //
    // removes all the values from the localStorage
    //
    var removeAll = function() {
        var that = this;

        try{
            var allKeys = that.getAllKeys();
            for(var i=0; i < allKeys.length; ++i) {
                var checkedKey = makeChecks(allKeys[i]);
                var combinedKey = that.getKeyPrefix() + delimiter + checkedKey;
                localStorage.removeItem(combinedKey);
            }
        }
        catch(error) {
            console.log(error);
            throw error;
        }
    };

    // make some of the functionalities public
    return {
        isLocalStorageAvailable : isLocalStorageAvailable,
        getKeyPrefix : getKeyPrefix,
        addItem : addItem,
        getItem : getItem,
        getAllKeys : getAllKeys,
        removeItem : removeItem,
        removeAll : removeAll
    }
}

// --------- THIRD PARTY CODE AREA END ---------

var yadg_util = {
    exec : function exec(fn) {
        var script = document.createElement('script');
        script.setAttribute("type", "application/javascript");
        script.textContent = '(' + fn + ')();';
        document.body.appendChild(script); // run the script
        document.body.removeChild(script); // clean up
    },

    // handle for updating page css, taken from one of hateradio's scripts
    addCSS : function(style) {
        if(!this.style) {
            this.style = document.createElement('style');
            this.style.type = 'text/css';
            (document.head || document.getElementsByTagName('head')[0]).appendChild(this.style);
        }
        this.style.appendChild(document.createTextNode(style+'\n'));
    },

    setValueIfSet: function(value,input,cond) {
        if (cond) {
            input.value = value;
        } else {
            input.value = '';
        }
    },

    // negative count will remove, positive count will add given number of artist boxes
    addRemoveArtistBoxes : function(count) {
        if (count != 0) {
            if (count < 0) {
                for (var i = 0; i < -count; i++) {
                    yadg_util.exec(function() {RemoveArtistField()});
                }
            } else {
                for (var i = 0; i < count; i++) {
                    yadg_util.exec(function() {AddArtistField()});
                }
            }
        }
    },

    getOptionOffsets : function(select) {
        var option_offsets = {};
        for (var j = 0; j < select.options.length; j++) {
            option_offsets[select.options[j].value] = select.options[j].index;
        }
        return option_offsets;
    },

    storage : new LocalStorageWrapper("yadg"),

    settings : new LocalStorageWrapper("yadgSettings")
};

// very simple wrapper for XmlHttpRequest
function requester(url, method, callback, data, error_callback) {
    this.data = data;
    this.url = url;
    this.method = method;
    if (!error_callback) {
        error_callback = yadg.failed_callback;
    }

    this.send = function() {
        var details = {
            url : this.url,
            method : this.method,
            onload : function(response) {
                if (response.status === 200) {
                    callback(JSON.parse(response.responseText));
                } else if (response.status === 401) {
                    yadg.failed_authentication_callback();
                } else {
                    error_callback();
                }
            },
            onerror : error_callback
        };
        if (method == "POST") {
            details.data = JSON.stringify(this.data);
        }

        var headers = {
            "Accept" : "application/json",
            "Content-Type" : "application/json"
        };

        if (yadg_util.settings.getItem(factory.KEY_API_TOKEN)) {
            headers.Authorization = "Token " + yadg_util.settings.getItem(factory.KEY_API_TOKEN);
        }

        details.headers = headers;

        GM_xmlhttpRequest(details);
    };
}

var yadg_sandbox = {

    KEY_LAST_WARNING : "templateLastWarning",

    init : function(callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: yadg.yadgHost + '/static/js/jsandbox-worker.js',
            onload: function(response) {
                var script, dataURL = null;
                if (response.status === 200) {
                    script = response.responseText;
                    var blob = new Blob([script], {type: 'application/javascript'});
                    var URL = window.URL || window.webkitURL;
                    if (!URL || !URL.createObjectURL) {
                        throw new Error('No no valid implementation of window.URL.createObjectURL found.');
                    }
                    dataURL = URL.createObjectURL(blob);
                    yadg_sandbox.initCallback(dataURL);
                    yadg_sandbox.loadSwig(callback);
                } else {
                    yadg_sandbox.initCallbackError();
                }
            },
            onerror: function() {
                yadg_sandbox.initCallbackError();
            }
        });

    },

    loadSwig : function(callback) {
        // importScripts for the web worker will not work in Firefox with cross-domain requests
        // see: https://bugzilla.mozilla.org/show_bug.cgi?id=756589
        // so download the Swig files manually with GM_xmlhttpRequest
        GM_xmlhttpRequest({
            method: 'GET',
            url: yadg.yadgHost + "/static/js/swig.min.js",
            onload: function(response) {
                if (response.status === 200) {
                    yadg_sandbox.swig_script = response.responseText;

                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: yadg.yadgHost + "/static/js/swig.custom.js",
                        onload: function(response) {
                            if (response.status === 200) {
                                yadg_sandbox.swig_custom_script = response.responseText;
                                callback();
                            }
                        }
                    });
                }
            }
        });
    },

    initializeSwig : function(dependencies) {
        if (!(this.swig_script && this.swig_custom_script)) {
            yadg.failed_callback();
            return
        }

        yadg_sandbox.exec({data: this.swig_script, onerror: yadg.failed_callback});
        yadg_sandbox.exec({data: this.swig_custom_script, onerror: yadg.failed_callback});
        yadg_sandbox.exec({data: "var myswig = new swig.Swig({ loader: swig.loaders.memory(input.templates), autoescape: false }), i=0; yadg_filters.register_filters(myswig);", input: {templates: dependencies}});
    },

    renderTemplate : function(template, data, callback, error) {
        var eval_string = "myswig.render(input.template, { locals: input.data, filename: 'scratchpad' + (i++) })";
        this.eval({data: eval_string, callback: function(out) {callback(out);}, input: {template: template, data: data}, onerror: function(err){error(err);}});
    },

    initCallback : function(dataUrl) {
        JSandbox.url = dataUrl;
        this.jsandbox = new JSandbox();
        this.initError = false;
    },

    resetSandbox : function() {
        this.jsandbox.terminate();
        this.jsandbox = new JSandbox();
    },

    load : function(options) {
        this.jsandbox.load(options);
    },

    exec : function(options) {
        this.jsandbox.exec(options);
    },

    eval : function(options) {
        this.jsandbox.eval(options);
    },

    initCallbackError : function() {
        this.initError = true;

        var last_warning = yadg_util.storage.getItem(this.KEY_LAST_WARNING),
            now = new Date();
        if (last_warning === null || now.getTime() - (new Date(last_warning)).getTime() > factory.CACHE_TIMEOUT) {
            alert("Could not load the necessary script files for executing YADG. If this error persists you might need to update the user script. You will only get this message once a day.");
            yadg_util.storage.addItem(this.KEY_LAST_WARNING, now);
        }
    }
};

var factory = {
    // storage keys for cache
    KEY_LAST_CHECKED : "lastChecked",
    KEY_SCRAPER_LIST : "scraperList",
    KEY_FORMAT_LIST : "formatList",

    // storage keys for settings
    KEY_API_TOKEN : "apiToken",
    KEY_DEFAULT_TEMPLATE : "defaultTemplate",
    KEY_DEFAULT_SCRAPER : "defaultScraper",
    KEY_REPLACE_DESCRIPTION : "replaceDescriptionOn",
    KEY_SETTINGS_INIT_VER : "settingsInitializedVer",

    CACHE_TIMEOUT : 1000*60*60*24, // 24 hours

    UPDATE_PROGRESS : 0,

    locations : new Array(
        {
            name : 'pth_upload',
            regex : /http(s)?\:\/\/(.*\.)?passtheheadphones\.me\/upload\.php.*/i
        },
        {
            name : 'pth_edit',
            regex : /http(s)?\:\/\/(.*\.)?passtheheadphones\.me\/torrents\.php\?action=editgroup&groupid=.*/i
        },
        {
            name : 'pth_request',
            regex : /http(s)?\:\/\/(.*\.)?passtheheadphones\.me\/requests\.php\?action=new/i
        },
        {
            name : 'pth_request_edit',
            regex : /http(s)?\:\/\/(.*\.)?passtheheadphones\.me\/requests\.php\?action=edit&id=.*/i
        },
        {
            name : 'pth_torrent_overview',
            regex : /http(s)?\:\/\/(.*\.)?passtheheadphones\.me\/torrents\.php\?id=.*/i
        },
        {
            name : 'waffles_upload',
//            regex : /http(s)?\:\/\/(.*\.)?waffles\.ch\/upload\.php\?legacy=1.*/i
//        },
//        {
//            TODO: reenable support for the new Waffles upload page once it is reactivated
//            name : 'waffles_upload_new',
            regex : /http(s)?\:\/\/(.*\.)?waffles\.ch\/upload\.php.*/i
        },
        {
            name : 'waffles_request',
            regex : /http(s)?\:\/\/(.*\.)?waffles\.ch\/requests\.php\?do=add/i
        }
    ),

    determineLocation : function(uri) {
        for (var i = 0; i < this.locations.length; i++) {
            if (this.locations[i].regex.test(uri)) {
                return this.locations[i].name;
            }
        }
        return null;
    },

    init : function() {
        this.currentLocation = this.determineLocation(document.URL);
        // only continue with the initialization if we found a valid location
        if (this.currentLocation !== null) {
            this.insertIntoPage(this.getInputElements());

            // set the necessary styles
            this.setStyles();

            // make sure we initialize the settings to the most recent version
            this.initializeSettings();

            // populate settings inputs
            this.populateSettings();

            // add the appropriate action for the button
            var button = document.getElementById('yadg_submit');
            button.addEventListener('click', function (e) {
                e.preventDefault();
                yadg.makeRequest();
            }, false);

            // add the action for the options toggle
            var toggleLink = document.getElementById('yadg_toggle_options');
            if (toggleLink !== null) {
                toggleLink.addEventListener('click', function (e) {
                    e.preventDefault();

                    var optionsDiv = document.getElementById('yadg_options'),
                        display = optionsDiv.style.display;

                    if (display == 'none' || display == '') {
                        optionsDiv.style.display = 'block';
                    } else {
                        optionsDiv.style.display = 'none';
                    }
                });
            }

            // add the action for the template select
            var formatSelect = this.getFormatSelect();
            if (formatSelect !== null) {
                formatSelect.addEventListener('change', function (e) {
                    if (yadg_renderer.hasCached()) {
                        yadg_renderer.renderCached(this.value, factory.setDescriptionBoxValue, factory.setDescriptionBoxValue);
                    }
                });
            }

            // add the action to the save settings link
            var saveSettingsLink = document.getElementById('yadg_save_settings');
            if (saveSettingsLink !== null) {
                saveSettingsLink.addEventListener('click', function (e) {
                    e.preventDefault();

                    factory.saveSettings();

                    alert("Settings saved successfully.");
                });
            }

            // add the action to the clear cache link
            var clearCacheLink = document.getElementById('yadg_clear_cache');
            if (clearCacheLink !== null) {
                clearCacheLink.addEventListener('click', function (e) {
                    e.preventDefault();

                    yadg_util.storage.removeAll();

                    alert("Cache cleared. Please reload the page for this to take effect.");
                });
            }

            var last_checked = yadg_util.storage.getItem(factory.KEY_LAST_CHECKED);
            if (last_checked === null || (new Date()).getTime() - (new Date(last_checked)).getTime() > factory.CACHE_TIMEOUT) {
                // update the scraper and formats list
                factory.UPDATE_PROGRESS = 1;
                yadg.getScraperList(factory.setScraperSelect);
                yadg.getFormatsList(factory.setFormatSelect);
            } else {
                factory.setScraperSelect(yadg_util.storage.getItem(factory.KEY_SCRAPER_LIST));
                factory.setFormatSelect(yadg_util.storage.getItem(factory.KEY_FORMAT_LIST));
            }

            return true;
        } else {
            return false;
        }
    },

    getApiTokenInput : function() {
        return document.getElementById('yadg_api_token');
    },

    getReplaceDescriptionCheckbox : function() {
        return document.getElementById('yadg_options_replace');
    },

    getReplaceDescriptionSettingKey : function() {
        return this.makeReplaceDescriptionSettingsKey(this.currentLocation);
    },

    makeReplaceDescriptionSettingsKey : function(subKey) {
        return this.KEY_REPLACE_DESCRIPTION + subKey.replace(/_/g, "");
    },

    initializeSettings : function() {
        var settings_ver = yadg_util.settings.getItem(factory.KEY_SETTINGS_INIT_VER),
            current_ver = 1;

        if (!settings_ver) {
            settings_ver = 0;
        }

        if (settings_ver < current_ver) {
            // replace descriptions on upload and new request pages
            var locations = [
                'pth_upload',
                'pth_request',
                'waffles_upload',
                'waffles_upload_new',
                'waffles_request'
            ];
            for (var i = 0; i < locations.length; i++) {
                var loc = locations[i],
                    replace_desc_setting_key = factory.makeReplaceDescriptionSettingsKey(loc);

                yadg_util.settings.addItem(replace_desc_setting_key, true);
            }
        }

        yadg_util.settings.addItem(factory.KEY_SETTINGS_INIT_VER, current_ver);
    },

    populateSettings : function() {
        var api_token = yadg_util.settings.getItem(factory.KEY_API_TOKEN),
            replace_desc = yadg_util.settings.getItem(factory.getReplaceDescriptionSettingKey());

        if (api_token) {
            var api_token_input = factory.getApiTokenInput();
            api_token_input.value = api_token;
        }

        if (replace_desc) {
            var replace_desc_checkbox = factory.getReplaceDescriptionCheckbox();
            replace_desc_checkbox.checked = true;
        }
    },

    saveSettings : function() {
        var scraper_select = factory.getScraperSelect(),
            template_select = factory.getFormatSelect(),
            api_token_input = factory.getApiTokenInput(),
            replace_desc_checkbox = factory.getReplaceDescriptionCheckbox();

        var current_scraper = null,
            current_template = null,
            api_token = api_token_input.value.trim(),
            replace_description = replace_desc_checkbox.checked;

        if (scraper_select.options.length > 0) {
            current_scraper = scraper_select.options[scraper_select.selectedIndex].value;
        }

        if (template_select.options.length > 0) {
            current_template = template_select.options[template_select.selectedIndex].value;
        }

        if (current_scraper !== null) {
            yadg_util.settings.addItem(factory.KEY_DEFAULT_SCRAPER, current_scraper);
        }

        if (current_template !== null) {
            yadg_util.settings.addItem(factory.KEY_DEFAULT_TEMPLATE, current_template);
        }

        if (api_token !== "") {
            yadg_util.settings.addItem(factory.KEY_API_TOKEN, api_token);
        } else {
            yadg_util.settings.removeItem(factory.KEY_API_TOKEN);
        }

        var replace_desc_setting_key = factory.getReplaceDescriptionSettingKey();
        if (replace_description) {
            yadg_util.settings.addItem(replace_desc_setting_key, true);
        } else {
            yadg_util.settings.removeItem(replace_desc_setting_key);
        }
    },

    setDescriptionBoxValue : function(value) {
        var desc_box = factory.getDescriptionBox(),
            replace_desc_checkbox = factory.getReplaceDescriptionCheckbox(),
            replace_desc = false;

        if (replace_desc_checkbox !== null) {
            replace_desc = replace_desc_checkbox.checked;
        }

        if (desc_box !== null) {
            if (!replace_desc && /\S/.test(desc_box.value)) { // check if the current description contains more than whitespace
                desc_box.value += "\n\n" + value;
            } else {
                desc_box.value = value;
            }
        }
    },

    getFormatSelect : function() {
        return document.getElementById('yadg_format');
    },

    setDefaultFormat : function() {
        var format_select = factory.getFormatSelect();
        var format_offsets = yadg_util.getOptionOffsets(format_select);

        var default_format = yadg_util.settings.getItem(factory.KEY_DEFAULT_TEMPLATE);
        if (default_format !== null && default_format in format_offsets) {
            format_select.selectedIndex = format_offsets[default_format];
        } else {
            // we have no settings so fall back to the hard coded defaults
            switch (this.currentLocation) {
                case "waffles_upload":
                case "waffles_upload_new":
                case "waffles_request":
                    format_select.selectedIndex = format_offsets[defaultWafflesFormat];
                    break;

                default:
                    format_select.selectedIndex = format_offsets[defaultPTHFormat];
                    break;
            }
        }
    },

    getScraperSelect : function() {
        return document.getElementById("yadg_scraper");
    },

    setDefaultScraper : function() {
        var default_scraper = yadg_util.settings.getItem(factory.KEY_DEFAULT_SCRAPER);
        if (default_scraper !== null) {
            var scraper_select = factory.getScraperSelect();
            var scraper_offsets = yadg_util.getOptionOffsets(scraper_select);

            if (default_scraper in scraper_offsets) {
                scraper_select.selectedIndex = scraper_offsets[default_scraper];
            }
        }
    },

    setScraperSelect : function(scrapers) {
        var scraper_select = factory.getScraperSelect();

        factory.setSelect(scraper_select, scrapers);
        factory.setDefaultScraper();

        if (factory.UPDATE_PROGRESS > 0) {
            yadg_util.storage.addItem(factory.KEY_SCRAPER_LIST, scrapers);
            factory.UPDATE_PROGRESS |= 1<<1;

            if (factory.UPDATE_PROGRESS === 7) {
                yadg_util.storage.addItem(factory.KEY_LAST_CHECKED, new Date());
            }
        }
    },

    setFormatSelect : function(templates) {
        var format_select = factory.getFormatSelect();

        var non_utility = [];
        var save_templates = [];
        for (var i = 0; i < templates.length; i++) {
            if (factory.UPDATE_PROGRESS > 0) {
                yadg_templates.addTemplate(templates[i]);

                save_templates.push({
                    id : templates[i]['id'],
                    url : templates[i]['url'],
                    name : templates[i]['name'],
                    nameFormatted : templates[i]['nameFormatted'],
                    owner : templates[i]['owner'],
                    default : templates[i]['default'],
                    isUtility : templates[i]['isUtility']
                });
            } else {
                yadg_templates.addTemplateUrl(templates[i]['id'], templates[i]['url']);
            }

            if (!templates[i]['isUtility']) {
                non_utility.push(templates[i]);
            }
        }

        factory.setSelect(format_select, non_utility);
        factory.setDefaultFormat();

        if (factory.UPDATE_PROGRESS > 0) {
            yadg_util.storage.addItem(factory.KEY_FORMAT_LIST, save_templates);
            factory.UPDATE_PROGRESS |= 1<<2;

            if (factory.UPDATE_PROGRESS === 7) {
                yadg_util.storage.addItem(factory.KEY_LAST_CHECKED, new Date());
            }
        }
    },

    setSelect : function(select, data) {
        select.options.length = data.length;

        for (var i = 0; i < data.length; i++) {
            // we are not using the javascript constructor to create an Option instance because this will create an
            // incompatibility with jQuery in Chrome which will make it impossible to add a new artist field on passtheheadphones.me
            var o = document.createElement("option");
            if ('nameFormatted' in data[i]) {
                o.text = data[i]['nameFormatted'];
            } else {
                o.text = data[i]['name'];
            }
            o.value = data[i]['value'] || data[i]['id'];
            o.selected = data[i]['default'];
            select.options[i] = o;
            if (data[i]['default']) {
                select.selectedIndex = i;
            }
            if (data[i]['url']) {
                o.setAttribute('data-url', data[i]['url']);
            }
        }
    },

    setStyles : function() {
        // general styles
        yadg_util.addCSS('div#yadg_options{ display:none; margin-top:3px; } input#yadg_input,input#yadg_submit,label#yadg_format_label,a#yadg_scraper_info { margin-right: 5px } div#yadg_response { margin-top:3px; } select#yadg_scraper { margin-right: 2px } #yadg_options_template,#yadg_options_api_token,#yadg_options_replace_div { margin-bottom: 3px; } .add_form[name="yadg"] input,.add_form[name="yadg"] select { width: 90%; margin: 2px 0 !important; }');

        // location specific styles will go here
        switch(this.currentLocation) {
            case "waffles_upload":
                yadg_util.addCSS('div#yadg_response ul { margin-left: 0 !important; padding-left: 0 !important; }');
                break;

            case "waffles_request":
                yadg_util.addCSS('div#yadg_response ul { margin-left: 0 !important; padding-left: 0 !important; }');
                break;

            default:

                break;
        }
    },

    getInputElements : function() {
        var buttonHTML = '<input type="submit" value="Fetch" id="yadg_submit"/>',
            scraperSelectHTML = '<select name="yadg_scraper" id="yadg_scraper"></select>',
            optionsHTML = '<div id="yadg_options"><div id="yadg_options_template"><label for="yadg_format" id="yadg_format_label">Template:</label><select name="yadg_format" id="yadg_format"></select></div><div id="yadg_options_api_token"><label for="yadg_api_token" id="yadg_api_token_label">API token (<a href="https://yadg.cc/api/token" target="_blank">Get one here</a>):</label> <input type="text" name="yadg_api_token" id="yadg_api_token" size="50" /></div><div id="yadg_options_replace_div"><input type="checkbox" name="yadg_options_replace" id="yadg_options_replace" /> <label for="yadg_options_replace" id="yadg_options_replace_label">Replace descriptions on this page</label></div><div id="yadg_options_links"><a id="yadg_save_settings" href="#" title="Save the currently selected scraper and template as default for this site and save the given API token.">Save settings</a> <span class="yadg_separator">|</span> <a id="yadg_clear_cache" href="#">Clear cache</a></div></div>',
            inputHTML = '<input type="text" name="yadg_input" id="yadg_input" size="60" />',
            responseDivHTML = '<div id="yadg_response"></div>',
            toggleOptionsLinkHTML = '<a id="yadg_toggle_options" href="#">Toggle options</a>',
            scraperInfoLink = '<a id="yadg_scraper_info" href="https://yadg.cc/available-scrapers" target="_blank" title="Get additional information on the available scrapers">[?]</a>';


        switch (this.currentLocation) {
            case "pth_upload":
                var tr = document.createElement('tr');
                tr.className = "yadg_tr";
                tr.innerHTML = '<td class="label">YADG:</td><td>' + inputHTML + scraperSelectHTML + scraperInfoLink + buttonHTML + toggleOptionsLinkHTML + optionsHTML + responseDivHTML + '</td>';
                return tr;

            case "pth_edit":
                var div = document.createElement('div');
                div.className = "yadg_div";
                div.innerHTML = '<h3 class="label">YADG:</h3>\n' + inputHTML + '\n'  + scraperSelectHTML + '\n'  + scraperInfoLink + '\n'  + buttonHTML + '\n'  + toggleOptionsLinkHTML + '\n'  + optionsHTML + '\n'  + responseDivHTML;
                return div;

            case "pth_torrent_overview":
                var div = document.createElement('div');
                div.id = 'yadg_div'
                div.className = 'box';
                div.innerHTML = '<div class="head"><strong>YADG</strong></div>\n<div class="body">\n<form class="add_form" name="yadg" method="post">\n<input type="text" name="yadg_input" id="yadg_input" />\n' + scraperSelectHTML + '\n' + scraperInfoLink + '\n' + buttonHTML + '\n' + toggleOptionsLinkHTML + '\n' + optionsHTML + '\n' + responseDivHTML;
                return div;

            case "pth_request":
            case "pth_request_edit":
                var tr = document.createElement('tr');
                tr.className = "yadg_tr";
                tr.innerHTML = '<td class="label">YADG:</td><td>' + inputHTML + scraperSelectHTML + scraperInfoLink + buttonHTML + toggleOptionsLinkHTML + optionsHTML + responseDivHTML + '</td>';
                return tr;

            case "waffles_upload":
                var tr = document.createElement('tr');
                tr.className = "yadg_tr";
                tr.innerHTML = '<td class="heading" valign="top" align="right"><label for="yadg_input">YADG:</label></td><td>' + inputHTML + scraperSelectHTML + scraperInfoLink + buttonHTML + toggleOptionsLinkHTML + optionsHTML + responseDivHTML + '</td>';
                return tr;

            case "waffles_upload_new":
                var p = document.createElement('p');
                p.className = "yadg_p";
                p.innerHTML = '<label for="yadg_input">YADG:</label>' + inputHTML + scraperSelectHTML + scraperInfoLink + buttonHTML + toggleOptionsLinkHTML + optionsHTML + responseDivHTML;
                return p;

            case "waffles_request":
                var tr = document.createElement('tr');
                tr.className = "yadg_tr";
                tr.innerHTML = '<td style="text-align:left;width:100px;">YADG:</td><td style="text-align:left;">' + inputHTML + scraperSelectHTML + scraperInfoLink + buttonHTML + toggleOptionsLinkHTML + optionsHTML + responseDivHTML + '</td>';
                return tr;

            default:
                // that should actually never happen
                return document.createElement('div');
        }
    },

    insertIntoPage : function(element) {
        switch (this.currentLocation) {
            case "pth_upload":
                var year_tr = document.getElementById('year_tr');
                year_tr.parentNode.insertBefore(element,year_tr);
                break;

            case "pth_edit":
                var summary_input = document.getElementsByName('summary')[0];
                summary_input.parentNode.insertBefore(element,summary_input.nextSibling.nextSibling);
                break;

            case "pth_torrent_overview":
                var add_artists_box = document.getElementsByClassName("box_addartists")[0];
                add_artists_box.appendChild(element);
                break;

            case "pth_request":
            case "pth_request_edit":
                var artist_tr = document.getElementById('artist_tr');
                artist_tr.parentNode.insertBefore(element,artist_tr);
                break;

            case "waffles_upload":
                var submit_button = document.getElementsByName('submit')[0];
                submit_button.parentNode.parentNode.parentNode.insertBefore(element,submit_button.parentNode.parentNode);
                break;

            case "waffles_upload_new":
                var h4s = document.getElementsByTagName('h4');
                var div;
                for (var i=0; i < h4s.length; i++) {
                    if (h4s[i].innerHTML.indexOf('read the rules') !== -1) {
                        div = h4s[i].parentNode;
                        break;
                    }
                }
                div.appendChild(element);
                break;

            case "waffles_request":
                var category_select = document.getElementsByName('category')[0];
                category_select.parentNode.parentNode.parentNode.insertBefore(element,category_select.parentNode.parentNode);
                break;

            default:
                break;
        }
    },

    getDescriptionBox : function() {
        switch (this.currentLocation) {
            case "pth_upload":
                return document.getElementById('album_desc');

            case "pth_edit":
                return document.getElementsByName('body')[0];

            case "pth_torrent_overview":
                if (!this.hasOwnProperty("dummybox")) {
                    this.dummybox = document.createElement('div');
                }
                return this.dummybox;

            case "pth_request":
            case "pth_request_edit":
                return document.getElementsByName('description')[0];

            case "waffles_upload":
                return document.getElementById('descr');

            case "waffles_upload_new":
                return document.getElementById('id_descr');

            case "waffles_request":
                return document.getElementsByName('information')[0];

            default:
                // that should actually never happen
                return document.createElement('div');
        }
    },

    getFormFillFunction : function() {
        switch (this.currentLocation) {
            case "pth_upload":
                var f = function(rawData) {
                    var artist_inputs = document.getElementsByName("artists[]"),
                        album_title_input = document.getElementById("title"),
                        year_input = document.getElementById("year"),
                        label_input = document.getElementById("record_label"),
                        catalog_input = document.getElementById("catalogue_number"),
                        tags_input = document.getElementById("tags"),
                        data = yadg.prepareRawResponse(rawData);

                    if (data.artists != false) {
                        var input_idx = 0;

                        yadg_util.addRemoveArtistBoxes(data.effective_artist_count - artist_inputs.length);

                        artist_inputs = document.getElementsByName("artists[]");

                        for (var i = 0; i < data.artist_keys.length; i++) {
                            var artist_key = data.artist_keys[i],
                                artist_types = data.artists[artist_key];

                            for (var j = 0; j < artist_types.length; j++) {
                                var artist_type = artist_types[j],
                                    artist_input = artist_inputs[input_idx],
                                    type_select = artist_input.nextSibling;

                                while (type_select.tagName != 'SELECT') {
                                    type_select = type_select.nextSibling;
                                }

                                artist_input.value = artist_key;

                                var option_offsets = yadg_util.getOptionOffsets(type_select);

                                if (artist_type === "main") {
                                    type_select.selectedIndex = option_offsets[1];
                                } else if (artist_type === "guest") {
                                    type_select.selectedIndex = option_offsets[2];
                                } else if (artist_type === "remixer") {
                                    type_select.selectedIndex = option_offsets[3];
                                } else {
                                    // we don't know this artist type, default to "main"
                                    type_select.selectedIndex = option_offsets[1];
                                }

                                // next artist input
                                input_idx += 1;
                            }
                        }
                    } else {
                        for (var i = 0; i < artist_inputs.length; i++) {
                            artist_inputs[i].value = '';
                        }
                    }

                    if (data.tags != false) {
                        tags_input.value = data.tag_string.toLowerCase();
                    } else {
                        tags_input.value = '';
                    }

                    yadg_util.setValueIfSet(data.year,year_input,data.year != false);
                    yadg_util.setValueIfSet(data.title,album_title_input,data.title != false);
                    yadg_util.setValueIfSet(data.label,label_input,data.label != false);
                    yadg_util.setValueIfSet(data.catalog,catalog_input,data.catalog != false);
                };
                return f;

            case "pth_edit":
                f = function(rawData) {
                    var year_input = document.getElementsByName("year")[0],
                        label_input = document.getElementsByName("record_label")[0],
                        catalog_input = document.getElementsByName("catalogue_number")[0],
                        data = yadg.prepareRawResponse(rawData);

                    yadg_util.setValueIfSet(data.year,year_input,data.year != false);
                    yadg_util.setValueIfSet(data.label,label_input,data.label != false);
                    yadg_util.setValueIfSet(data.catalog,catalog_input,data.catalog != false);
                };
                return f;

            case "pth_torrent_overview":
                f = function(rawData) {
                    var artist_inputs = document.getElementsByName("aliasname[]"),
                        data = yadg.prepareRawResponse(rawData);

                    if (data.artists != false) {
                        var input_idx = 0;

                        yadg_util.addRemoveArtistBoxes(data.effective_artist_count - artist_inputs.length);

                        artist_inputs = document.getElementsByName("aliasname[]");

                        for (var i = 0; i < data.artist_keys.length; i++) {
                            var artist_key = data.artist_keys[i],
                                artist_types = data.artists[artist_key];

                            for (var j = 0; j < artist_types.length; j++) {
                                var artist_type = artist_types[j],
                                    artist_input = artist_inputs[input_idx],
                                    type_select = artist_input.nextSibling;

                                while (type_select.tagName != 'SELECT') {
                                    type_select = type_select.nextSibling;
                                }

                                artist_input.value = artist_key;

                                var option_offsets = yadg_util.getOptionOffsets(type_select);

                                if (artist_type === "main") {
                                    type_select.selectedIndex = option_offsets[1];
                                } else if (artist_type === "guest") {
                                    type_select.selectedIndex = option_offsets[2];
                                } else if (artist_type === "remixer") {
                                    type_select.selectedIndex = option_offsets[3];
                                } else {
                                    // we don't know this artist type, default to "main"
                                    type_select.selectedIndex = option_offsets[1];
                                }

                                // next artist input
                                input_idx += 1;
                            }
                        }
                    } else {
                        for (var i = 0; i < artist_inputs.length; i++) {
                            artist_inputs[i].value = '';
                        }
                    }
                };
                return f;

            case "pth_request":
            case "pth_request_edit":
                var f = function(rawData) {
                    var artist_inputs = document.getElementsByName("artists[]"),
                        album_title_input = document.getElementsByName("title")[0],
                        year_input = document.getElementsByName("year")[0],
                        label_input = document.getElementsByName("recordlabel")[0],
                        catalog_input = document.getElementsByName("cataloguenumber")[0],
                        tags_input = document.getElementById("tags"),
                        data = yadg.prepareRawResponse(rawData);

                    if (data.artists != false) {
                        var input_idx = 0;

                        yadg_util.addRemoveArtistBoxes(data.effective_artist_count - artist_inputs.length);

                        artist_inputs = document.getElementsByName("artists[]");

                        for (var i = 0; i < data.artist_keys.length; i++) {
                            var artist_key = data.artist_keys[i],
                                artist_types = data.artists[artist_key];

                            for (var j = 0; j < artist_types.length; j++) {
                                var artist_type = artist_types[j],
                                    artist_input = artist_inputs[input_idx],
                                    type_select = artist_input.nextSibling;

                                while (type_select.tagName != 'SELECT') {
                                    type_select = type_select.nextSibling;
                                }

                                artist_input.value = artist_key;

                                var option_offsets = yadg_util.getOptionOffsets(type_select);

                                if (artist_type === "main") {
                                    type_select.selectedIndex = option_offsets[1];
                                } else if (artist_type === "guest") {
                                    type_select.selectedIndex = option_offsets[2];
                                } else if (artist_type === "remixer") {
                                    type_select.selectedIndex = option_offsets[3];
                                } else {
                                    // we don't know this artist type, default to "main"
                                    type_select.selectedIndex = option_offsets[1];
                                }

                                // next artist input
                                input_idx += 1;
                            }
                        }
                    } else {
                        for (var i = 0; i < artist_inputs.length; i++) {
                            artist_inputs[i].value = '';
                        }
                    }

                    if (data.tags != false) {
                        tags_input.value = data.tag_string.toLowerCase();
                    } else {
                        tags_input.value = '';
                    }

                    yadg_util.setValueIfSet(data.year,year_input,data.year != false);
                    yadg_util.setValueIfSet(data.title,album_title_input,data.title != false);
                    yadg_util.setValueIfSet(data.label,label_input,data.label != false);
                    yadg_util.setValueIfSet(data.catalog,catalog_input,data.catalog != false);
                };
                return f;

            case "waffles_upload":
                var f = function(rawData) {
                    var artist_input = document.getElementsByName("artist")[0],
                        album_title_input = document.getElementsByName("album")[0],
                        year_input = document.getElementsByName("year")[0],
                        va_checkbox = document.getElementById("va"),
                        tags_input = document.getElementById("tags"),
                        data = yadg.prepareRawResponse(rawData);

                    if (data.artists != false) {
                        if (data.is_various) {
                            artist_input.value = "";
                            va_checkbox.checked = true;
                        } else {
                            artist_input.value = data.flat_artist_string;
                            va_checkbox.checked = false;
                        }
                    } else {
                        va_checkbox.checked = false;
                        artist_input.value = "";
                    }

                    yadg_util.setValueIfSet(data.year,year_input,data.year != false);
                    yadg_util.setValueIfSet(data.title,album_title_input,data.title != false);

                    if (data.tags != false) {
                        tags_input.value = data.tag_string_nodots.toLowerCase();
                    } else {
                        tags_input.value = '';
                    }

                    yadg_util.exec(function() {formatName()});
                };
                return f;

            case "waffles_upload_new":
                var f = function(rawData) {
                    var artist_input = document.getElementById("id_artist"),
                        album_title_input = document.getElementById("id_album"),
                        year_input = document.getElementById("id_year"),
                        va_checkbox = document.getElementById("id_va"),
                        tags_input = document.getElementById("id_tags"),
                        data = yadg.prepareRawResponse(rawData);

                    if (data.artists != false) {
                        if (data.is_various) {
                            if (!va_checkbox.checked) {
                                va_checkbox.click();
                            }
                        } else {
                            if (va_checkbox.checked) {
                                va_checkbox.click();
                            }
                            artist_input.value = data.flat_artist_string;
                        }
                    } else {
                        if (va_checkbox.checked) {
                            va_checkbox.click();
                        }
                        artist_input.value = "";
                    }

                    yadg_util.setValueIfSet(data.year,year_input,data.year != false);
                    yadg_util.setValueIfSet(data.title,album_title_input,data.title != false);

                    if (data.tags != false) {
                        tags_input.value = data.tag_string_nodots.toLowerCase();
                    } else {
                        tags_input.value = '';
                    }
                };
                return f;

            case "waffles_request":
                var f = function(rawData) {
                    var artist_input = document.getElementsByName("artist")[0],
                        album_title_input = document.getElementsByName("title")[0],
                        year_input = document.getElementsByName("year")[0],
                        data = yadg.prepareRawResponse(rawData);

                    if (data.artists != false) {
                        if (data.is_various) {
                            artist_input.value = "Various Artists";
                        } else {
                            artist_input.value = data.flat_artist_string;
                        }
                    } else {
                        artist_input.value = "";
                    }

                    yadg_util.setValueIfSet(data.year,year_input,data.year != false);
                    yadg_util.setValueIfSet(data.title,album_title_input,data.title != false);
                };
                return f;

            default:
                // that should actually never happen
                return function(data) {};
        }
    }
};

var yadg_templates = {
    _templates : {},
    _template_urls : {},

    getTemplate : function(id, callback) {
        if (id in this._templates) {
            callback(this._templates[id]);
        } else if (id in this._template_urls) {
            var request = new requester(this._template_urls[id], 'GET', function(template) {
                yadg_templates.addTemplate(template);
                callback(template);
            }, null, yadg_templates.errorTemplate);
            request.send();
        } else {
            this.errorTemplate();
        }
    },

    addTemplate : function(template) {
        this._templates[template.id] = template;
    },

    addTemplateUrl : function(id, url) {
        this._template_urls[id] = url;
    },

    errorTemplate : function() {
        yadg.printError("Could not get template. Please choose another one.", true);
    }
};

var yadg_renderer = {
    _last_data : null,
    _last_template_id : null,

    render : function(template_id, data, callback, error_callback) {
        this._last_data = data;
        var new_template = this._last_template_id !== template_id;
        this._last_template_id = template_id;

        yadg_templates.getTemplate(template_id, function(template) {
            // the new template might have different dependencies, so initialize Swig with those
            if (new_template) {
                yadg_sandbox.resetSandbox();
                yadg_sandbox.initializeSwig(template.dependencies);
            }
            yadg_sandbox.renderTemplate(template.code, data, callback, error_callback);
        });
    },

    renderCached : function(template_id, callback, error_callback) {
        if (this.hasCached()) {
            this.render(template_id, this._last_data, callback, error_callback);
        }
    },

    hasCached : function() {
        return this._last_data !== null;
    },

    clearCached : function() {
        this._last_data = null;
    }
};

var yadg = {
    yadgHost : "https://yadg.cc",
    baseURI : "/api/v2/",

    standardError : "Sorry, an error occured. Please try again. If this error persists the user script might need updating.",
    authenticationError : "Your API token is invalid. Please provide a valid API token or remove the current one.",
    lastStateError : false,

    isBusy : false,

    init : function() {
        this.scraperSelect = document.getElementById('yadg_scraper');
        this.formatSelect = document.getElementById('yadg_format');
        this.input = document.getElementById('yadg_input');
        this.responseDiv = document.getElementById('yadg_response');
        this.button = document.getElementById('yadg_submit');
    },

    getBaseURL : function() {
        return this.yadgHost + this.baseURI;
    },

    getScraperList : function(callback) {
        var url = this.getBaseURL() + "scrapers/";

        var request = new requester(url, 'GET', callback);

        request.send();
    },

    getFormatsList : function(callback) {
        var url = this.getBaseURL() + "templates/";

        this.getTemplates(url, [], callback);
    },

    getTemplates : function(url, templates, callback) {
        var request = new requester(url, 'GET', function(data) {
            for (var i = 0; i < data.results.length; i++) {
                templates.push(data.results[i]);
            }
            if (data.next !== null) {
                yadg.getTemplates(data.next, templates, callback);
            } else {
                callback(templates);
            }
        });

        request.send();
    },

    makeRequest : function(params) {
        if (this.isBusy) return;

        var data;
        if (params) {
            data = params;
        } else {
            data = {
                scraper: this.scraperSelect.options[this.scraperSelect.selectedIndex].value,
                input: this.input.value
            };
        }
            var url = this.getBaseURL() + 'query/';

        if (data.input !== '') {
            var request = new requester(url, 'POST', function(result) {
                yadg.getResult(result.url);
            }, data);
            this.busyStart();
            request.send();
        }
    },

    getResult : function(result_url) {
        var request = new requester(result_url, 'GET', function(response) {
            if (response.status == "done") {
                if (response.data.type == 'ReleaseResult') {
                    var template_id = yadg.formatSelect.options[yadg.formatSelect.selectedIndex].value;
                    yadg_renderer.render(template_id, response, factory.setDescriptionBoxValue, factory.setDescriptionBoxValue);

                    if (yadg.lastStateError == true) {
                        yadg.responseDiv.innerHTML = "";
                        yadg.lastStateError = false;
                    }

                    var fillFunc = factory.getFormFillFunction();
                    fillFunc(response.data);
                } else if (response.data.type == 'ListResult') {
                    var ul = document.createElement('ul');
                    ul.id = "yadg_release_list";

                    var release_list = response.data.items;
                    for (var i = 0; i < release_list.length;i++) {
                        var name = release_list[i]['name'],
                            info = release_list[i]['info'],
                            query_params = release_list[i]['queryParams'],
                            release_url = release_list[i]['url'];

                        var li = document.createElement('li'),
                            a = document.createElement('a');

                        a.textContent = name;
                        a.params = query_params;
                        a.href = release_url;

                        a.addEventListener('click',function(e) { e.preventDefault(); yadg.makeRequest(this.params);},false);

                        li.appendChild(a);
                        li.appendChild(document.createElement('br'));
                        li.appendChild(document.createTextNode(info));

                        ul.appendChild(li);
                    }

                    if (ul.childNodes.length != 0) {
                        yadg.responseDiv.innerHTML = "";
                        yadg.responseDiv.appendChild(ul);
                        yadg.lastStateError = false;

                        // we got a ListResult so clear the last ReleaseResult from the render cache
                        yadg_renderer.clearCached();
                    } else {
                        yadg.printError('Sorry, there were no matches.');
                    }
                } else if (response.data.type == 'NotFoundResult') {
                    yadg.printError('I could not find the release with the given ID. You may want to try again with another one.');
                } else {
                    yadg.printError('Something weird happened. Please try again');
                }
                yadg.busyStop();
            } else if (response.status == 'failed') {
                yadg.failed_callback();
            } else  {
                var delay = function() { yadg.getResult(response.url); };
                window.setTimeout(delay, 1000);
            }
        });
        request.send();
    },

    printError : function(message, template_error) {
        this.responseDiv.innerHTML = "";
        this.responseDiv.appendChild(document.createTextNode(message));
        if (!template_error) {
            this.lastStateError = true;

            // there was a non template related error, so for consistencies sake clear the last ReleaseResult from the
            // render cache
            yadg_renderer.clearCached();
        }
    },

    failed_callback : function() {
        yadg.printError(yadg.standardError);
        yadg.busyStop();
    },

    failed_authentication_callback : function() {
        yadg.printError(yadg.authenticationError);
        yadg.busyStop();
    },

    busyStart : function() {
        this.isBusy = true;
        this.button.setAttribute('disabled',true);
        this.button.value = "Please wait...";
        this.input.setAttribute('disabled',true);
        this.scraperSelect.setAttribute('disabled',true);
        this.formatSelect.setAttribute('disabled',true);
    },

    busyStop : function() {
        this.button.removeAttribute('disabled');
        this.button.value = "Fetch";
        this.input.removeAttribute('disabled');
        this.scraperSelect.removeAttribute('disabled');
        this.formatSelect.removeAttribute('disabled');
        this.isBusy = false;
    },

    prepareRawResponse : function(rawData) {
        var result = {};

        result.artists = false;
        result.year = false;
        result.title = false;
        result.label = false;
        result.catalog = false;
        result.genre = false;
        result.style = false;
        result.tags = false;
        result.is_various = false;
        result.flat_artist_string = false;

        if (rawData.artists.length > 0) {
            result.artists = {};

            for (var i = 0; i < rawData.artists.length; i++) {
                var artist = rawData.artists[i];
                if (!artist["isVarious"]) {
                    result.artists[artist["name"]] = artist["types"];
                } else {
                    result.is_various = true;
                }
            }
        }
        if (rawData.discs.length > 0) {
            for (var k = 0; k < rawData.discs.length; k++) {
                var disc = rawData.discs[k];
                for (var l = 0; l < disc["tracks"].length; l++) {
                    var track = disc["tracks"][l];
                    for (var m = 0; m < track["artists"].length; m++) {
                        var name = track["artists"][m]["name"],
                            type = track["artists"][m]["types"];

                        var newTypes = null;
                        if (name in result.artists) {
                            newTypes = result.artists[name].concat(type);
                            // deduplicate new types array
                            for(var i = 0; i < newTypes.length; ++i) {
                                for(var j = i+1; j < newTypes.length; ++j) {
                                    if(newTypes[i] === newTypes[j])
                                        newTypes.splice(j--, 1);
                                }
                            }
                        } else {
                            newTypes = type;
                        }

                        result.artists[name] = newTypes;
                    }
                }
            }
        }
        for (var i = 0; i < rawData['releaseEvents'].length; i++) {
            var event = rawData['releaseEvents'][i];
            if (event.date) {
                result.year = event.date.match(/\d{4}/)[0];
                if (result.year.length != 4) {
                    result.year = false;
                } else {
                    break;
                }
            }
        }
        if (rawData.title) {
            result.title = rawData.title;
        }
        if (rawData.labelIds.length > 0) {
            var labelId = rawData['labelIds'][0];
            if (labelId.label) {
                result.label = labelId.label;
            }
            if (labelId.catalogueNrs.length > 0) {
                result.catalog = labelId.catalogueNrs[0];
            }
        }
        if (rawData.genres.length > 0) {
            result.genre = rawData.genres;
        }
        if (rawData.styles.length > 0) {
            result.style = rawData.styles;
        }
        if (result.genre != false && result.style != false) {
            result.tags = rawData.genres.concat(rawData.styles);
        } else if (result.genre != false) {
            result.tags = rawData.genres;
        } else if (result.style != false) {
            result.tags = rawData.styles;
        }

        if (result.tags != false) {
            result.tag_string = "";
            result.tag_string_nodots = "";

            for (var i = 0; i < result.tags.length; i++) {
                result.tag_string = result.tag_string + result.tags[i].replace(/\s+/g,'.');
                result.tag_string_nodots = result.tag_string_nodots + result.tags[i].replace(/\s+/g,' ');
                if (i != result.tags.length-1) {
                    result.tag_string = result.tag_string + ', ';
                    result.tag_string_nodots = result.tag_string_nodots + ', ';
                }
            }
        }

        if (result.artists != false) {
            // count the artists
            result.artists_length = 0;
            result.artist_keys = [];
            result.effective_artist_count = 0;

            for (var i in result.artists) {
                if (result.artists.hasOwnProperty(i)) {
                    result.artists_length++;
                    result.artist_keys.push(i);
                    result.effective_artist_count += result.artists[i].length;
                }
            }
        }

        if (result.artists_length == 0) {
            result.artists = false;
        } else {
            // create a flat string of all the main artists
            var artist_string = "";

            for (var i = 0; i < result.artists_length; i++) {
                if (result.artists[result.artist_keys[i]].indexOf("main") != -1) {
                    if (artist_string != "" && i < result.artists_length - 2) {
                        artist_string = artist_string + ", ";
                    } else if (artist_string != "" && i < result.artists_length - 1) {
                        artist_string = artist_string + " & ";
                    }
                    artist_string = artist_string + result.artist_keys[i];
                }
            }

            result.flat_artist_string = artist_string;
        }

        return result;
    }
};

yadg_sandbox.init(function() {
    if (factory.init()) { // returns true if we run on a valid location
        yadg.init();
    }
});
