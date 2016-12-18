// ==UserScript==
// @id             pth-yadg
// @name           PTH YADG
// @description    This script provides integration with online description generator YADG (http://yadg.cc) - Credit to Slack06
// @license        https://github.com/SavageCore/yadg-pth-userscript/blob/master/LICENSE
// @version        1.3.26
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

/*	global window	unsafeWindow document GM_xmlhttpRequest JSandbox formatName AddArtistField RemoveArtistField Blob alert $ Image */
/*	eslint max-depth: ['off'], block-scoped-var: 'off', no-loop-func: 'off', no-alert: 'off' */

/*
 Here you can set site specific default templates.
 You can find a list of available templates at: https://yadg.cc/api/v2/templates/
*/
var defaultPTHFormat = 5;
var defaultWafflesFormat = 9;
var	defaultPTHTarget = 'other';
var defaultPTHDescriptionTarget = 'album';
var yadg;
var factory;
var yadgRenderer;
var yadgTemplates;

// --------- USER SETTINGS END ---------

function fetchImage(target, callback) {
	var imgElement = document.getElementById('image');
	if (imgElement && imgElement.getAttribute('disabled') === 'disabled') {
		return;
	}
	var link;
	if (target === null) {
		link = $('#yadg_input').val();
	}	else {
		link = target;
	}
	switch (true) {
		case (/discogs/.test(link)):
			GM_xmlhttpRequest({ // eslint-disable-line new-cap
				method: 'GET',
				url: link,
				onload: function (response) {
					if (response.status === 200) {
						var container = document.implementation.createHTMLDocument().documentElement;
						container.innerHTML = response.responseText;
						if (typeof callback === 'function') {
							callback(JSON.parse(container.querySelectorAll('div.image_gallery.image_gallery_large')[0].getAttribute('data-images'))[0].full);
						}
					}
				}
			});
			break;
		case (/itunes/.test(link)):
			var regex = /id(\d+)/;
			var id = regex.exec(link)[1];
			GM_xmlhttpRequest({ // eslint-disable-line new-cap
				method: 'GET',
				url: 'https://itunes.apple.com/lookup?id=' + id,
				onload: function (response) {
					if (response.status === 200) {
						var data = JSON.parse(response.responseText);
						var hires = data.results[0].artworkUrl100.replace('100x100bb', '100000x100000-999');
						if (typeof callback === 'function') {
							callback(hires);
						}
					}
				}
			});
			break;
		case (/bandcamp/.test(link)):
		case (factory.getScraperSelect().value === 'bandcamp'):
			GM_xmlhttpRequest({ // eslint-disable-line new-cap
				method: 'GET',
				url: link,
				onload: function (response) {
					if (response.status === 200) {
						var container = document.implementation.createHTMLDocument().documentElement;
						container.innerHTML = response.responseText;
						var scaledImg = container.querySelectorAll('#tralbumArt > a > img')[0].src;
						var originalImg = scaledImg.replace(/_16/, '_10');
						var tempImg = new Image();
						tempImg.src = originalImg;
						tempImg.onload = function () {
							if (this.width === this.height) {
								var img = originalImg;
							} else {
								img = scaledImg;
							}
							if (typeof callback === 'function') {
								callback(img);
							}
						};
					}
				}
			});
			break;
		case (/beatport/.test(link)):
			GM_xmlhttpRequest({ // eslint-disable-line new-cap
				method: 'GET',
				url: link,
				onload: function (response) {
					if (response.status === 200) {
						var container = document.implementation.createHTMLDocument().documentElement;
						container.innerHTML = response.responseText;
						if (typeof callback === 'function') {
							callback(container.querySelectorAll('div.interior-release-chart-artwork-parent > img')[0].src);
						}
					}
				}
			});
			break;
		case (/musicbrainz/.test(link)):
			var regex = /release\/(.*)/;
			var id = regex.exec(link)[1];
			GM_xmlhttpRequest({ // eslint-disable-line new-cap
				headers: {
					'User-Agent': 'YADG/1.3.17 (yadg.cc)'
				},
				method: 'GET',
				url: 'http://coverartarchive.org/release/' + id + '/',
				onload: function (response) {
					if (response.status === 200) {
						var data = JSON.parse(response.responseText);
						if (typeof callback === 'function') {
							callback(data.images[0].image);
						}
					}
				}
			});
			break;
		case (/junodownload/.test(link)):
			GM_xmlhttpRequest({ // eslint-disable-line new-cap
				method: 'GET',
				url: link,
				onload: function (response) {
					if (response.status === 200) {
						var container = document.implementation.createHTMLDocument().documentElement;
						container.innerHTML = response.responseText;
						if (typeof callback === 'function') {
							callback(container.querySelectorAll('#product_image_front > a')[0].href);
						}
					}
				}
			});
			break;
		case (/metal-archives/.test(link)):
			GM_xmlhttpRequest({ // eslint-disable-line new-cap
				method: 'GET',
				url: link,
				onload: function (response) {
					if (response.status === 200) {
						var container = document.implementation.createHTMLDocument().documentElement;
						container.innerHTML = response.responseText;

						var parser = document.createElement('a');
						parser.href = container.querySelectorAll('#cover > img')[0].src;
						var imgLink = parser.protocol + '//' + parser.hostname + parser.pathname;
						if (typeof callback === 'function') {
							callback(imgLink);
						}
					}
				}
			});
			break;
		default:
			break;
	}
}

function pthImgIt() {
	var pthImgIt = document.getElementById('ptpimg_it_cover');

	switch (window.location.href) {
		case (window.location.href.match(/\/upload\.php/) || {}).input:
			var imgElement = document.getElementById('image').value;
			break;
		case (window.location.href.match(/torrents\.php\?action=editgroup/) || {}).input:
			var imgElement = document.querySelectorAll('#content > div > div:nth-child(2) > form > div > input[type="text"]:nth-child(5)')[0].value;
			break;
		default:
			break;
	}

	if (pthImgIt && imgElement) {
		pthImgIt.click();
	}
}

function insertImage(img, callback) {
	switch (window.location.href) {
		case (window.location.href.match(/\/upload\.php/) || {}).input:
			var input = document.getElementById('image');
			input.value = img;
			if (input.getAttribute('autorehost') === 'true') {
				var evt = document.createEvent('HTMLEvents');
				evt.initEvent('keyup', false, true);
				input.dispatchEvent(evt);
			}
			callback();
			break;
		case (window.location.href.match(/torrents\.php\?action=editgroup/) || {}).input:
			document.querySelectorAll('#content > div > div:nth-child(2) > form > div > input[type="text"]:nth-child(5)')[0].value = img;
			callback();
			break;
		default:
			break;
	}
}

// --------- THIRD PARTY CODE AREA START ---------

//
// Creates an object which gives some helper methods to
// Save/Load/Remove data to/from the localStorage
//
// Source from: https://github.com/gergob/localstoragewrapper
//
function LocalStorageWrapper(applicationPrefix) {
	'use strict';

	if (applicationPrefix === undefined) {
		throw new Error('applicationPrefix parameter should be defined');
	}

	var delimiter = '_';

 // if the passed in value for prefix is not string, it should be converted
	var keyPrefix = typeof (applicationPrefix) === 'string' ? applicationPrefix : JSON.stringify(applicationPrefix);

	var localStorage = window.localStorage || unsafeWindow.localStorage;

	var isLocalStorageAvailable = function () {
		return typeof (localStorage) !== 'undefined';
	};

	var getKeyPrefix = function () {
		return keyPrefix;
	};

 //
 // validates if there is a prefix defined for the keys
 // and checks if the localStorage functionality is available or not
 //
	var makeChecks = function (key) {
		var prefix = getKeyPrefix();
		if (prefix === undefined) {
			throw new Error('No prefix was defined, data cannot be saved');
		}

		if (!isLocalStorageAvailable()) {
			throw new Error('LocalStorage is not supported by your browser, data cannot be saved');
		}

  // keys are always strings
		var checkedKey = typeof (key) === 'string' ? key : JSON.stringify(key);

		return checkedKey;
	};

 //
 // saves the value associated to the key into the localStorage
 //
	var addItem = function (key, value) {
		var that = this;
		try {
			var checkedKey = makeChecks(key);
			var combinedKey = that.getKeyPrefix() + delimiter + checkedKey;
			localStorage.setItem(combinedKey, JSON.stringify(value));
		}		catch (err) {
			console.log(err);
			throw err;
		}
	};

 //
 // gets the value of the object saved to the key passed as parameter
 //
	var getItem = function (key) {
		var that = this;
		var result;
		try {
			var checkedKey = makeChecks(key);
			var combinedKey = that.getKeyPrefix() + delimiter + checkedKey;
			var resultAsJSON = localStorage.getItem(combinedKey);
			result = JSON.parse(resultAsJSON);
		}		catch (err) {
			console.log(err);
			throw err;
		}
		return result;
	};

 //
 // returns all the keys from the localStorage
 //
	var getAllKeys = function () {
		var prefix = getKeyPrefix();
		var results = [];

		if (prefix === undefined) {
			throw new Error('No prefix was defined, data cannot be saved');
		}

		if (!isLocalStorageAvailable()) {
			throw new Error('LocalStorage is not supported by your browser, data cannot be saved');
		}

		for (var key in localStorage) {
			if (key.indexOf(prefix) === 0) {
				var keyParts = key.split(delimiter);
				results.push(keyParts[1]);
			}
		}

		return results;
	};

 //
 // removes the value associated to the key from the localStorage
 //
	var removeItem = function (key) {
		var that = this;
		var result = false;
		try {
			var checkedKey = makeChecks(key);
			var combinedKey = that.getKeyPrefix() + delimiter + checkedKey;
			localStorage.removeItem(combinedKey);
			result = true;
		}		catch (err) {
			console.log(err);
			throw err;
		}
		return result;
	};

 //
 // removes all the values from the localStorage
 //
	var removeAll = function () {
		var that = this;

		try {
			var allKeys = that.getAllKeys();
			for (var i = 0; i < allKeys.length; ++i) {
				var checkedKey = makeChecks(allKeys[i]);
				var combinedKey = that.getKeyPrefix() + delimiter + checkedKey;
				localStorage.removeItem(combinedKey);
			}
		}		catch (err) {
			console.log(err);
			throw err;
		}
	};

 // make some of the functionalities public
	return {
		isLocalStorageAvailable: isLocalStorageAvailable,
		getKeyPrefix: getKeyPrefix,
		addItem: addItem,
		getItem: getItem,
		getAllKeys: getAllKeys,
		removeItem: removeItem,
		removeAll: removeAll
	};
}

// --------- THIRD PARTY CODE AREA END ---------

var yadgUtil = {
	exec: function (fn) {
		var script = document.createElement('script');
		script.setAttribute('type', 'application/javascript');
		script.textContent = '(' + fn + ')();';
		document.body.appendChild(script); // run the script
		document.body.removeChild(script); // clean up
	},

 // handle for updating page css, taken from one of hateradio's scripts
	addCSS: function (style) {
		if (!this.style) {
			this.style = document.createElement('style');
			this.style.type = 'text/css';
			(document.head || document.getElementsByTagName('head')[0]).appendChild(this.style);
		}
		this.style.appendChild(document.createTextNode(style + '\n'));
	},

	setValueIfSet: function (value, input, cond) {
		if (cond) {
			input.value = value;
		} else {
			input.value = '';
		}
	},

  // negative count will remove, positive count will add given number of artist boxes
	addRemoveArtistBoxes: function (count) {
		if (count !== 0) {
			if (count < 0) {
				for (var i = 0; i < -count; i++) {
					yadgUtil.exec(function () {
						RemoveArtistField(); // eslint-disable-line new-cap
					});
				}
			} else {
				for (i = 0; i < count; i++) {
					yadgUtil.exec(function () {
						AddArtistField(); // eslint-disable-line new-cap
					});
				}
			}
		}
	},

	getOptionOffsets: function (select) {
		var optionOffsets = {};
		for (var j = 0; j < select.options.length; j++) {
			optionOffsets[select.options[j].value] = select.options[j].index;
		}
		return optionOffsets;
	},

	storage: new LocalStorageWrapper('yadg'),

	settings: new LocalStorageWrapper('yadgSettings')
};

// very simple wrapper for XmlHttpRequest
function requester(url, method, callback, data, errorCallback) { // eslint-disable-line max-params
	this.data = data;
	this.url = url;
	this.method = method;
	if (!errorCallback) {
		errorCallback = yadg.failedCallback;
	}

	this.send = function () {
		var details = {
			url: this.url,
			method: this.method,
			onload: function (response) {
				if (response.status === 200) {
					callback(JSON.parse(response.responseText));
				} else if (response.status === 401) {
					yadg.failedAuthenticationCallback();
				} else {
					errorCallback();
				}
			},
			onerror: errorCallback
		};
		if (method === 'POST') {
			details.data = JSON.stringify(this.data);
		}

		var headers = {
			Accept: 'application/json',
			'Content-Type': 'application/json'
		};

		if (yadgUtil.settings.getItem(factory.KEY_API_TOKEN)) {
			headers.Authorization = 'Token ' + yadgUtil.settings.getItem(factory.KEY_API_TOKEN);
		}

		details.headers = headers;

		GM_xmlhttpRequest(details); // eslint-disable-line new-cap
	};
}

var yadgSandbox = {

	KEY_LAST_WARNING: 'templateLastWarning',

	init: function (callback) {
		GM_xmlhttpRequest({ // eslint-disable-line new-cap
			method: 'GET',
			url: yadg.yadgHost + '/static/js/jsandbox-worker.js',
			onload: function (response) {
				var script;
				var dataURL = null;
				if (response.status === 200) {
					script = response.responseText;
					var blob = new Blob([script], {type: 'application/javascript'});
					var URL = window.URL || window.webkitURL;
					if (!URL || !URL.createObjectURL) {
						throw new Error('No no valid implementation of window.URL.createObjectURL found.');
					}
					dataURL = URL.createObjectURL(blob);
					yadgSandbox.initCallback(dataURL);
					yadgSandbox.loadSwig(callback);
				} else {
					yadgSandbox.initCallbackError();
				}
			},
			onerror: function () {
				yadgSandbox.initCallbackError();
			}
		});
	},

	loadSwig: function (callback) {
  // importScripts for the web worker will not work in Firefox with cross-domain requests
  // see: https://bugzilla.mozilla.org/show_bug.cgi?id=756589
  // so download the Swig files manually with GM_xmlhttpRequest
		GM_xmlhttpRequest({ // eslint-disable-line new-cap
			method: 'GET',
			url: yadg.yadgHost + '/static/js/swig.min.js',
			onload: function (response) {
				if (response.status === 200) {
					yadgSandbox.swigScript = response.responseText;

					GM_xmlhttpRequest({ // eslint-disable-line new-cap
						method: 'GET',
						url: yadg.yadgHost + '/static/js/swig.custom.js',
						onload: function (response) {
							if (response.status === 200) {
								yadgSandbox.swigCustomScript = response.responseText;
								callback();
							}
						}
					});
				}
			}
		});
	},

	initializeSwig: function (dependencies) {
		if (!(this.swigScript && this.swigCustomScript)) {
			yadg.failedCallback();
			return;
		}

		yadgSandbox.exec({data: this.swigScript, onerror: yadg.failedCallback});
		yadgSandbox.exec({data: this.swigCustomScript, onerror: yadg.failedCallback});
		yadgSandbox.exec({data: 'var myswig = new swig.Swig({ loader: swig.loaders.memory(input.templates), autoescape: false }), i=0; yadg_filters.register_filters(myswig);', input: {templates: dependencies}});
	},

	renderTemplate: function (template, data, callback, error) {
		var evalString = 'myswig.render(input.template, { locals: input.data, filename: \'scratchpad\' + (i++) })';
		this.eval({data: evalString, callback: function (out) {
			callback(out);
		}, input: {template: template, data: data}, onerror: function (err) {
			error(err);
		}});
	},

	initCallback: function (dataUrl) {
		JSandbox.url = dataUrl;
		this.jsandbox = new JSandbox();
		this.initError = false;
	},

	resetSandbox: function () {
		this.jsandbox.terminate();
		this.jsandbox = new JSandbox();
	},

	load: function (options) {
		this.jsandbox.load(options);
	},

	exec: function (options) {
		this.jsandbox.exec(options);
	},

	eval: function (options) {
		this.jsandbox.eval(options);
	},

	initCallbackError: function () {
		this.initError = true;

		var lastWarning = yadgUtil.storage.getItem(this.KEY_LAST_WARNING);
		var now = new Date();
		if (lastWarning === null || now.getTime() - (new Date(lastWarning)).getTime() > factory.CACHE_TIMEOUT) {
			console.log('Could not load the necessary script files for executing YADG. If this error persists you might need to update the user script. You will only get this message once a day.');
			yadgUtil.storage.addItem(this.KEY_LAST_WARNING, now);
		}
	}
};

factory = {
 // storage keys for cache
	KEY_LAST_CHECKED: 'lastChecked',
	KEY_SCRAPER_LIST: 'scraperList',
	KEY_FORMAT_LIST: 'formatList',

 // storage keys for settings
	KEY_API_TOKEN: 'apiToken',
	KEY_DEFAULT_TEMPLATE: 'defaultTemplate',
	KEY_DEFAULT_TARGET: 'defaultTarget',
	KEY_DESCRIPTION_TARGET: 'descriptionTarget',
	KEY_DEFAULT_SCRAPER: 'defaultScraper',
	KEY_REPLACE_DESCRIPTION: 'replaceDescriptionOn',
	KEY_SETTINGS_INIT_VER: 'settingsInitializedVer',
	KEY_FETCH_IMAGE: 'fetchImage',
	KEY_AUTO_PREVIEW: 'autoPreview',
	KEY_AUTO_REHOST: 'autoRehost',

	CACHE_TIMEOUT: 1000 * 60 * 60 * 24, // 24 hours

	UPDATE_PROGRESS: 0,
	locations: [
		{
			name: 'pth_upload',
			regex: /http(s)?:\/\/(.*\.)?passtheheadphones\.me\/upload\.php.*/i
		},
		{
			name: 'pth_edit',
			regex: /http(s)?:\/\/(.*\.)?passtheheadphones\.me\/torrents\.php\?action=editgroup&groupid=.*/i
		},
		{
			name: 'pth_request',
			regex: /http(s)?:\/\/(.*\.)?passtheheadphones\.me\/requests\.php\?action=new/i
		},
		{
			name: 'pth_request_edit',
			regex: /http(s)?:\/\/(.*\.)?passtheheadphones\.me\/requests\.php\?action=edit&id=.*/i
		},
		{
			name: 'pth_torrent_overview',
			regex: /http(s)?:\/\/(.*\.)?passtheheadphones\.me\/torrents\.php\?id=.*/i
		},
		{
			name: 'waffles_upload',
			regex: /http(s)?:\/\/(.*\.)?waffles\.ch\/upload\.php.*/i
		},
		{
			name: 'waffles_request',
			regex: /http(s)?:\/\/(.*\.)?waffles\.ch\/requests\.php\?do=add/i
		}
	],

	determineLocation: function (uri) {
		for (var i = 0; i < this.locations.length; i++) {
			if (this.locations[i].regex.test(uri)) {
				return this.locations[i].name;
			}
		}
		return null;
	},

	init: function () {
		this.currentLocation = this.determineLocation(document.URL);
  // only continue with the initialization if we found a valid location
		if (this.currentLocation === null) {
			return false;
		}
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
			if (factory.getFetchImageCheckbox().checked) {
				fetchImage(null, function (data) {
					insertImage(data, function () {
						if (factory.getAutoRehostCheckbox() && factory.getAutoRehostCheckbox().checked) {
							pthImgIt();
						}
					});
				});
			}
		}, false);

  // add the action for the options toggle
		var toggleLink = document.getElementById('yadg_toggle_options');
		if (toggleLink !== null) {
			toggleLink.addEventListener('click', function (e) {
				e.preventDefault();

				var optionsDiv = document.getElementById('yadg_options');
				var display = optionsDiv.style.display;

				if (display === 'none' || display === '') {
					optionsDiv.style.display = 'block';
				} else {
					optionsDiv.style.display = 'none';
				}
			});
		}

  // add the action for the template select
		var formatSelect = this.getFormatSelect();
		if (formatSelect !== null) {
			formatSelect.addEventListener('change', function () {
				if (yadgRenderer.hasCached()) {
					yadgRenderer.renderCached(this.value, factory.setDescriptionBoxValue, factory.setDescriptionBoxValue);
				}
			});
		}

  // // add the action for the target select
		// var targetSelect = this.getTargetSelect();
		// if (targetSelect !== null) {
		// 	targetSelect.addEventListener('change', function (e) {
		// 		var target = this.value;
		// 	});
		// }

  // add the action to the save settings link
		var saveSettingsLink = document.getElementById('yadg_save_settings');
		if (saveSettingsLink !== null) {
			saveSettingsLink.addEventListener('click', function (e) {
				e.preventDefault();

				factory.saveSettings();

				alert('Settings saved successfully.');
			});
		}

  // add the action to the clear cache link
		var clearCacheLink = document.getElementById('yadg_clear_cache');
		if (clearCacheLink !== null) {
			clearCacheLink.addEventListener('click', function (e) {
				e.preventDefault();

				yadgUtil.storage.removeAll();

				alert('Cache cleared. Please reload the page for this to take effect.');
			});
		}

		var lastChecked = yadgUtil.storage.getItem(factory.KEY_LAST_CHECKED);
		if (lastChecked === null || (new Date()).getTime() - (new Date(lastChecked)).getTime() > factory.CACHE_TIMEOUT) {
   // update the scraper and formats list
			factory.UPDATE_PROGRESS = 1;
			yadg.getScraperList(factory.setScraperSelect);
			yadg.getFormatsList(factory.setFormatSelect);
		} else {
			factory.setScraperSelect(yadgUtil.storage.getItem(factory.KEY_SCRAPER_LIST));
			factory.setFormatSelect(yadgUtil.storage.getItem(factory.KEY_FORMAT_LIST));
		}

		return true;
	},

	getApiTokenInput: function () {
		return document.getElementById('yadg_api_token');
	},

	getReplaceDescriptionCheckbox: function () {
		return document.getElementById('yadg_options_replace');
	},

	getFetchImageCheckbox: function () {
		return document.getElementById('yadg_options_image');
	},

	getAutoRehostCheckbox: function () {
		return document.getElementById('yadg_options_rehost');
	},

	getAutoPreviewCheckbox: function () {
		return document.getElementById('yadg_options_preview');
	},

	getReplaceDescriptionSettingKey: function () {
		return this.makeReplaceDescriptionSettingsKey(this.currentLocation);
	},

	makeReplaceDescriptionSettingsKey: function (subKey) {
		return this.KEY_REPLACE_DESCRIPTION + subKey.replace(/_/g, '');
	},

	initializeSettings: function () {
		var settingsVer = yadgUtil.settings.getItem(factory.KEY_SETTINGS_INIT_VER);
		var currentVer = 1;

		if (!settingsVer) {
			settingsVer = 0;
		}

		if (settingsVer < currentVer) {
   // replace descriptions on upload and new request pages
			var locations = [
				'pth_upload',
				'pth_request',
				'waffles_upload',
				'waffles_upload_new',
				'waffles_request'
			];
			for (var i = 0; i < locations.length; i++) {
				var loc = locations[i];
				var replaceDescSettingKey = factory.makeReplaceDescriptionSettingsKey(loc);

				yadgUtil.settings.addItem(replaceDescSettingKey, true);
			}
		}

		yadgUtil.settings.addItem(factory.KEY_SETTINGS_INIT_VER, currentVer);
	},

	populateSettings: function () {
		var apiToken = yadgUtil.settings.getItem(factory.KEY_API_TOKEN);
		var replaceDesc = yadgUtil.settings.getItem(factory.getReplaceDescriptionSettingKey());
		var fetchImage = yadgUtil.settings.getItem(factory.KEY_FETCH_IMAGE);
		var autoRehost = yadgUtil.settings.getItem(factory.KEY_AUTO_REHOST);
		var autoPreview = yadgUtil.settings.getItem(factory.KEY_AUTO_PREVIEW);
		var descriptionTarget = yadgUtil.settings.getItem(factory.KEY_AUTO_PREVIEW);

		if (apiToken) {
			var apiTokenInput = factory.getApiTokenInput();
			apiTokenInput.value = apiToken;
		}

		if (replaceDesc) {
			var replaceDescCheckbox = factory.getReplaceDescriptionCheckbox();
			replaceDescCheckbox.checked = true;
		}

		if (fetchImage) {
			var fetchImageCheckbox = factory.getFetchImageCheckbox();
			fetchImageCheckbox.checked = true;
		}

		if (autoRehost) {
			var autoRehostCheckbox = factory.getAutoRehostCheckbox();
			if (autoRehostCheckbox) {
				autoRehostCheckbox.checked = true;
			}
		}

		if (autoPreview && window.location.href.match(/\/upload\.php/)) {
			var autoPreviewCheckbox = factory.getAutoPreviewCheckbox();
			autoPreviewCheckbox.checked = true;
		}
	},

	saveSettings: function () {
		var scraperSelect = factory.getScraperSelect();
		var templateSelect = factory.getFormatSelect();
		var targetSelect = factory.getTargetSelect();
		var descriptionTargetSelect = factory.getDescriptionTargetSelect();
		var apiTokenInput = factory.getApiTokenInput();
		var replaceDescCheckbox = factory.getReplaceDescriptionCheckbox();
		var fetchImageCheckbox = factory.getFetchImageCheckbox();
		var autoRehostCheckbox = factory.getAutoRehostCheckbox();
		var autoPreviewCheckbox = factory.getAutoPreviewCheckbox();

		var currentScraper = null;
		var currentTemplate = null;
		var currentTarget = null;
		var currentDescriptionTarget = null;
		var apiToken = apiTokenInput.value.trim();
		var replaceDescription = replaceDescCheckbox.checked;
		var fetchImage = fetchImageCheckbox.checked;
		if (autoRehostCheckbox) {
			var autoRehost = autoRehostCheckbox.checked;
		}
		if (window.location.href.match(/\/upload\.php/)) {
			var autoPreview = autoPreviewCheckbox.checked;
		}

		if (scraperSelect.options.length > 0) {
			currentScraper = scraperSelect.options[scraperSelect.selectedIndex].value;
		}

		if (templateSelect.options.length > 0) {
			currentTemplate = templateSelect.options[templateSelect.selectedIndex].value;
		}

		if (targetSelect.options.length > 0) {
			currentTarget = targetSelect.options[targetSelect.selectedIndex].value;
		}

		if (descriptionTargetSelect.options.length > 0) {
			currentDescriptionTarget = descriptionTargetSelect.options[descriptionTargetSelect.selectedIndex].value;
		}

		if (currentScraper !== null) {
			yadgUtil.settings.addItem(factory.KEY_DEFAULT_SCRAPER, currentScraper);
		}

		if (currentTemplate !== null) {
			yadgUtil.settings.addItem(factory.KEY_DEFAULT_TEMPLATE, currentTemplate);
		}

		if (currentTarget !== null) {
			yadgUtil.settings.addItem(factory.KEY_DEFAULT_TARGET, currentTarget);
		}

		if (currentDescriptionTarget !== null) {
			yadgUtil.settings.addItem(factory.KEY_DESCRIPTION_TARGET, currentDescriptionTarget);
		}

		if (apiToken === '') {
			yadgUtil.settings.removeItem(factory.KEY_API_TOKEN);
		} else {
			yadgUtil.settings.addItem(factory.KEY_API_TOKEN, apiToken);
		}

		var replaceDescSettingKey = factory.getReplaceDescriptionSettingKey();
		if (replaceDescription) {
			yadgUtil.settings.addItem(replaceDescSettingKey, true);
		} else {
			yadgUtil.settings.removeItem(replaceDescSettingKey);
		}

		if (fetchImage) {
			yadgUtil.settings.addItem(factory.KEY_FETCH_IMAGE, true);
		} else {
			yadgUtil.settings.removeItem(factory.KEY_FETCH_IMAGE);
		}

		if (autoRehost) {
			yadgUtil.settings.addItem(factory.KEY_AUTO_REHOST, true);
		} else if (!autoRehost && autoRehostCheckbox) {
			yadgUtil.settings.removeItem(factory.KEY_AUTO_REHOST);
		}

		if (autoPreview) {
			yadgUtil.settings.addItem(factory.KEY_AUTO_PREVIEW, true);
		} else if (!autoPreview && window.location.href.match(/\/upload\.php/)) {
			yadgUtil.settings.removeItem(factory.KEY_AUTO_PREVIEW);
		}
	},

	setDescriptionBoxValue: function (value) {
		var descBox = factory.getDescriptionBox();
		var replaceDescCheckbox = factory.getReplaceDescriptionCheckbox();
		var replaceDesc = false;

		if (replaceDescCheckbox !== null) {
			replaceDesc = replaceDescCheckbox.checked;
		}

		if (descBox !== null && !Array.isArray(descBox)) {
			if (!replaceDesc && /\S/.test(descBox.value)) { // check if the current description contains more than whitespace
				descBox.value += '\n\n' + value;
			} else {
				descBox.value = value;
			}
			if (descBox.parentNode.nextSibling.nextSibling) {
				var previewBtn = descBox.parentNode.nextSibling.nextSibling.firstChild.nextSibling;
				if (previewBtn && previewBtn.value === 'Preview' && factory.getAutoPreviewCheckbox().checked) {
					previewBtn.click();
				}
			}
		} else if (Array.isArray(descBox)) {
			for (var i = 0; i < descBox.length; i++) {
				descBox[i].value = value;
				var previewBtn = descBox[i].parentNode.nextSibling.nextSibling.firstChild.nextSibling;
				if (previewBtn && previewBtn.value === 'Preview' && factory.getAutoPreviewCheckbox().checked) {
					previewBtn.click();
				}
			}
		}
	},

	getFormatSelect: function () {
		return document.getElementById('yadg_format');
	},

	setDefaultFormat: function () {
		var formatSelect = factory.getFormatSelect();
		var formatOffsets = yadgUtil.getOptionOffsets(formatSelect);

		var defaultFormat = yadgUtil.settings.getItem(factory.KEY_DEFAULT_TEMPLATE);
		if (defaultFormat !== null && defaultFormat in formatOffsets) {
			formatSelect.selectedIndex = formatOffsets[defaultFormat];
		} else {
   // we have no settings so fall back to the hard coded defaults
			switch (this.currentLocation) {
				case 'waffles_upload':
				case 'waffles_upload_new':
				case 'waffles_request':
					formatSelect.selectedIndex = formatOffsets[defaultWafflesFormat];
					break;

				default:
					formatSelect.selectedIndex = formatOffsets[defaultPTHFormat];
					break;
			}
		}
	},

	getTargetSelect: function () {
		return document.getElementById('yadg_target');
	},

	getDescriptionTargetSelect: function () {
		return document.getElementById('yadg_description_target');
	},

	setDefaultTarget: function () {
		var targetSelect = factory.getTargetSelect();
		var targetOffsets = yadgUtil.getOptionOffsets(targetSelect);

		var defaultTarget = yadgUtil.settings.getItem(factory.KEY_DEFAULT_TARGET);
		if (defaultTarget !== null && defaultTarget in targetOffsets) {
			targetSelect.selectedIndex = targetOffsets[defaultTarget];
		} else {
			targetSelect.selectedIndex = targetOffsets[defaultPTHTarget];
		}
	},

	setDefaultDescriptionTarget: function () {
		var targetDescriptionSelect = factory.getDescriptionTargetSelect();
		var targetDescriptionOffsets = yadgUtil.getOptionOffsets(targetDescriptionSelect);

		var defaultDescriptionTarget = yadgUtil.settings.getItem(factory.KEY_DESCRIPTION_TARGET);
		if (defaultDescriptionTarget !== null && defaultDescriptionTarget in targetDescriptionOffsets) {
			targetDescriptionSelect.selectedIndex = targetDescriptionOffsets[defaultDescriptionTarget];
		} else {
			targetDescriptionSelect.selectedIndex = targetDescriptionOffsets[defaultPTHDescriptionTarget];
		}
	},

	getScraperSelect: function () {
		return document.getElementById('yadg_scraper');
	},

	setDefaultScraper: function () {
		var defaultScraper = yadgUtil.settings.getItem(factory.KEY_DEFAULT_SCRAPER);
		if (defaultScraper !== null) {
			var scraperSelect = factory.getScraperSelect();
			var scraperOffsets = yadgUtil.getOptionOffsets(scraperSelect);

			if (defaultScraper in scraperOffsets) {
				scraperSelect.selectedIndex = scraperOffsets[defaultScraper];
			}
		}
	},

	setScraperSelect: function (scrapers) {
		var scraperSelect = factory.getScraperSelect();

		factory.setSelect(scraperSelect, scrapers);
		factory.setDefaultScraper();

		if (factory.UPDATE_PROGRESS > 0) {
			yadgUtil.storage.addItem(factory.KEY_SCRAPER_LIST, scrapers);
			factory.UPDATE_PROGRESS |= 1 << 1;

			if (factory.UPDATE_PROGRESS === 7) {
				yadgUtil.storage.addItem(factory.KEY_LAST_CHECKED, new Date());
			}
		}
	},

	setFormatSelect: function (templates) {
		var formatSelect = factory.getFormatSelect();

		var nonUtility = [];
		var saveTemplates = [];
		for (var i = 0; i < templates.length; i++) {
			if (factory.UPDATE_PROGRESS > 0) {
				yadgTemplates.addTemplate(templates[i]);

				saveTemplates.push({
					id: templates[i].id,
					url: templates[i].url,
					name: templates[i].name,
					nameFormatted: templates[i].nameFormatted,
					owner: templates[i].owner,
					default: templates[i].default,
					isUtility: templates[i].isUtility
				});
			} else {
				yadgTemplates.addTemplateUrl(templates[i].id, templates[i].url);
			}

			if (!templates[i].isUtility) {
				nonUtility.push(templates[i]);
			}
		}

		factory.setSelect(formatSelect, nonUtility);
		factory.setDefaultFormat();
		factory.setDefaultTarget();
		factory.setDefaultDescriptionTarget();

		if (factory.UPDATE_PROGRESS > 0) {
			yadgUtil.storage.addItem(factory.KEY_FORMAT_LIST, saveTemplates);
			factory.UPDATE_PROGRESS |= 1 << 2;

			if (factory.UPDATE_PROGRESS === 7) {
				yadgUtil.storage.addItem(factory.KEY_LAST_CHECKED, new Date());
			}
		}
	},

	setSelect: function (select, data) {
		select.options.length = data.length;

		for (var i = 0; i < data.length; i++) {
   // we are not using the javascript constructor to create an Option instance because this will create an
   // incompatibility with jQuery in Chrome which will make it impossible to add a new artist field on passtheheadphones.me
			var o = document.createElement('option');
			if ('nameFormatted' in data[i]) {
				o.text = data[i].nameFormatted;
			} else {
				o.text = data[i].name;
			}
			o.value = data[i].value || data[i].id;
			o.selected = data[i].default;
			select.options[i] = o;
			if (data[i].default) {
				select.selectedIndex = i;
			}
			if (data[i].url) {
				o.setAttribute('data-url', data[i].url);
			}
		}
	},

	setStyles: function () {
  // general styles
		yadgUtil.addCSS('div#yadg_options{ display:none; margin-top:3px; } input#yadg_input,input#yadg_submit,label#yadg_format_label,a#yadg_scraper_info { margin-right: 5px } div#yadg_response { margin-top:3px; } select#yadg_scraper { margin-right: 2px } #yadg_options_template,#yadg_options_api_token,#yadg_options_replace_div { margin-bottom: 3px; } .add_form[name="yadg"] input,.add_form[name="yadg"] select { width: 90%; margin: 2px 0 !important; }');

  // location specific styles will go here
		switch (this.currentLocation) {
			case 'waffles_upload':
				yadgUtil.addCSS('div#yadg_response ul { margin-left: 0 !important; padding-left: 0 !important; }');
				break;

			case 'waffles_request':
				yadgUtil.addCSS('div#yadg_response ul { margin-left: 0 !important; padding-left: 0 !important; }');
				break;

			default:

				break;
		}
	},

	getInputElements: function () {
		var buttonHTML = '<input type="submit" value="Fetch" id="yadg_submit"/>';
		var scraperSelectHTML = '<select name="yadg_scraper" id="yadg_scraper"></select>';
		var optionsHTML = '<div id="yadg_options"><div id="yadg_options_template"><label for="yadg_format" id="yadg_format_label">Template:</label><select name="yadg_format" id="yadg_format"></select></div><div id="yadg_options_target"><label for="yadg_target" id="yadg_target_label">Edition:</label><select name="yadg_target" id="yadg_target"><option value="original">Original</option><option value="other">Other</option></select></div><div id="yadg_options_description_target"><label for="yadg_description_target" id="yadg_description_target_label">Description:</label><select name="yadg_description_target" id="yadg_description_target"><option value="album">Album</option><option value="release">Release</option><option value="both">Both</option></select></div><div id="yadg_options_api_token"><label for="yadg_api_token" id="yadg_api_token_label">API token (<a href="https://yadg.cc/api/token" target="_blank">Get one here</a>):</label> <input type="text" name="yadg_api_token" id="yadg_api_token" size="50" /></div><div id="yadg_options_replace_div"><input type="checkbox" name="yadg_options_replace" id="yadg_options_replace" /> <label for="yadg_options_replace" id="yadg_options_replace_label">Replace descriptions on this page</label></div><div id="yadg_options_image_div"><input type="checkbox" name="yadg_options_image" id="yadg_options_image" /> <label for="yadg_options_image" id="yadg_options_image_label">Auto fetch Album Art (Bandcamp, Beatport, Discogs, iTunes, Junodownload, Metal-Archives, MusicBrainz)</label></div>';
		if (document.getElementById('ptpimg_it_cover')) {
			optionsHTML += '<div id="yadg_options_rehost_div"><input type="checkbox" name="yadg_options_rehost" id="yadg_options_rehost" /> <label for="yadg_options_rehost" id="yadg_options_rehost_label">Auto rehost with <a href="https://passtheheadphones.me/forums.php?action=viewthread&threadid=1992">[User Script] PTPIMG URL uploader</a></label></div>';
		}
		if (window.location.href.match(/\/upload\.php/)) {
			optionsHTML += '<div id="yadg_options_preview_div"><input type="checkbox" name="yadg_options_preview" id="yadg_options_preview" /> <label for="yadg_options_preview" id="yadg_options_preview_label">Auto preview description</label></div>';
		}
		optionsHTML += '<div id="yadg_options_links"><a id="yadg_save_settings" href="#" title="Save the currently selected scraper and template as default for this site and save the given API token.">Save settings</a> <span class="yadg_separator">|</span> <a id="yadg_clear_cache" href="#">Clear cache</a></div></div>';
		var inputHTML = '<input type="text" name="yadg_input" id="yadg_input" size="60" />';
		var responseDivHTML = '<div id="yadg_response"></div>';
		var toggleOptionsLinkHTML = '<a id="yadg_toggle_options" href="#">Toggle options</a>';
		var scraperInfoLink = '<a id="yadg_scraper_info" href="https://yadg.cc/available-scrapers" target="_blank" title="Get additional information on the available scrapers">[?]</a>';

		switch (this.currentLocation) {
			case 'pth_upload':
				var tr = document.createElement('tr');
				tr.className = 'yadg_tr';
				tr.innerHTML = '<td class="label">YADG:</td><td>' + inputHTML + scraperSelectHTML + scraperInfoLink + buttonHTML + toggleOptionsLinkHTML + optionsHTML + responseDivHTML + '</td>';
				return tr;

			case 'pth_edit':
				var div = document.createElement('div');
				div.className = 'yadg_div';
				div.innerHTML = '<h3 class="label">YADG:</h3>\n' + inputHTML + '\n' + scraperSelectHTML + '\n' + scraperInfoLink + '\n' + buttonHTML + '\n' + toggleOptionsLinkHTML + '\n' + optionsHTML + '\n' + responseDivHTML;
				return div;

			case 'pth_torrent_overview':
				div = document.createElement('div');
				div.id = 'yadg_div';
				div.className = 'box';
				div.innerHTML = '<div class="head"><strong>YADG</strong></div>\n<div class="body">\n<form class="add_form" name="yadg" method="post">\n<input type="text" name="yadg_input" id="yadg_input" />\n' + scraperSelectHTML + '\n' + scraperInfoLink + '\n' + buttonHTML + '\n' + toggleOptionsLinkHTML + '\n' + optionsHTML + '\n' + responseDivHTML;
				return div;

			case 'pth_request':
			case 'pth_request_edit':
				tr = document.createElement('tr');
				tr.className = 'yadg_tr';
				tr.innerHTML = '<td class="label">YADG:</td><td>' + inputHTML + scraperSelectHTML + scraperInfoLink + buttonHTML + toggleOptionsLinkHTML + optionsHTML + responseDivHTML + '</td>';
				return tr;

			case 'waffles_upload':
				tr = document.createElement('tr');
				tr.className = 'yadg_tr';
				tr.innerHTML = '<td class="heading" valign="top" align="right"><label for="yadg_input">YADG:</label></td><td>' + inputHTML + scraperSelectHTML + scraperInfoLink + buttonHTML + toggleOptionsLinkHTML + optionsHTML + responseDivHTML + '</td>';
				return tr;

			case 'waffles_upload_new':
				var p = document.createElement('p');
				p.className = 'yadg_p';
				p.innerHTML = '<label for="yadg_input">YADG:</label>' + inputHTML + scraperSelectHTML + scraperInfoLink + buttonHTML + toggleOptionsLinkHTML + optionsHTML + responseDivHTML;
				return p;

			case 'waffles_request':
				tr = document.createElement('tr');
				tr.className = 'yadg_tr';
				tr.innerHTML = '<td style="text-align:left;width:100px;">YADG:</td><td style="text-align:left;">' + inputHTML + scraperSelectHTML + scraperInfoLink + buttonHTML + toggleOptionsLinkHTML + optionsHTML + responseDivHTML + '</td>';
				return tr;

			default:
				// this should actually never happen
				return document.createElement('div');
		}
	},

	insertIntoPage: function (element) {
		switch (this.currentLocation) {
			case 'pth_upload':
				var yearTr = document.getElementById('year_tr');
				yearTr.parentNode.insertBefore(element, yearTr);
				break;

			case 'pth_edit':
				var summaryInput = document.getElementsByName('summary')[0];
				summaryInput.parentNode.insertBefore(element, summaryInput.nextSibling.nextSibling);
				break;

			case 'pth_torrent_overview':
				var addArtistsBox = document.getElementsByClassName('box_addartists')[0];
				addArtistsBox.parentNode.insertBefore(element, addArtistsBox.nextSibling.nextSibling);
				break;

			case 'pth_request':
			case 'pth_request_edit':
				var artistTr = document.getElementById('artist_tr');
				artistTr.parentNode.insertBefore(element, artistTr);
				break;

			case 'waffles_upload':
				var submitButton = document.getElementsByName('submit')[0];
				submitButton.parentNode.parentNode.parentNode.insertBefore(element, submitButton.parentNode.parentNode);
				break;

			case 'waffles_upload_new':
				var h4s = document.getElementsByTagName('h4');
				var div;
				for (var i = 0; i < h4s.length; i++) {
					if (h4s[i].innerHTML.indexOf('read the rules') !== -1) {
						div = h4s[i].parentNode;
						break;
					}
				}
				div.appendChild(element);
				break;

			case 'waffles_request':
				var categorySelect = document.getElementsByName('category')[0];
				categorySelect.parentNode.parentNode.parentNode.insertBefore(element, categorySelect.parentNode.parentNode);
				break;

			default:
				break;
		}
	},

	getDescriptionBox: function () {
		switch (this.currentLocation) {
			case 'pth_upload':
				if (factory.getDescriptionTargetSelect().value === 'album') {
					return document.getElementById('album_desc');
				} else if (factory.getDescriptionTargetSelect().value === 'release') {
					return document.getElementById('release_desc');
				}	else if (factory.getDescriptionTargetSelect().value === 'both') {
					return [document.getElementById('album_desc'), document.getElementById('release_desc')];
				}
				break;

			case 'pth_edit':
				return document.getElementsByName('body')[0];

			case 'pth_torrent_overview':
				if (!{}.hasOwnProperty.call(this, 'dummybox')) {
					this.dummybox = document.createElement('div');
				}
				return this.dummybox;

			case 'pth_request':
			case 'pth_request_edit':
				return document.getElementsByName('description')[0];

			case 'waffles_upload':
				return document.getElementById('descr');

			case 'waffles_upload_new':
				return document.getElementById('id_descr');

			case 'waffles_request':
				return document.getElementsByName('information')[0];

			default:
    // that should actually never happen
				return document.createElement('div');
		}
	},

	getFormFillFunction: function () {
		var currentTarget = factory.getTargetSelect().value;
		switch (this.currentLocation) {
			case 'pth_upload':
				var f = function (rawData) {
					if (currentTarget === 'other') {
						var remaster = document.getElementById('remaster');
						var albumTitleInput = document.getElementById('title');
						var yearInput = document.getElementById('remaster_year');
						var labelInput = document.getElementById('remaster_record_label');
						var catalogInput = document.getElementById('remaster_catalogue_number');
						remaster.checked = 'checked';
						unsafeWindow.Remaster(); // eslint-disable-line new-cap
						unsafeWindow.CheckYear(); // eslint-disable-line new-cap
					} else {
						albumTitleInput = document.getElementById('title');
						yearInput = document.getElementById('year');
						labelInput = document.getElementById('record_label');
						catalogInput = document.getElementById('catalogue_number');
					}

					if (/itunes/.test(rawData.url)) {
						var releaseTypeInput = document.getElementById('releasetype');
						switch (true) {
							case /.+ - Single$/.test(rawData.title):
								rawData.title = rawData.title.replace(/ - Single$/, '');
								releaseTypeInput.value = 9;
								break;
							case /.+ - EP$/.test(rawData.title):
								rawData.title = rawData.title.replace(/ - EP$/, '');
								releaseTypeInput.value = 5;
								break;
							default:
								break;
						}
						document.getElementById('releasetype_tr').insertAdjacentHTML('afterend', '<tr id="yadg_release_type_check_tr"><td class="label">YADG Confirm:</td><td><input type="checkbox" id="yadg_release_type_check" name="yadg_release_type_check" required=""><label for="yadg_release_type_check"> I confirm release type and Album title are correct. Form will not submit until you check this.</label></td></tr>');
					}

					var artistInputs = document.getElementsByName('artists[]');
					var tagsInput = document.getElementById('tags');
					var data = yadg.prepareRawResponse(rawData);

					if (artistInputs[0].getAttribute('disabled') !== 'disabled') {
						if (data.artists === false) {
							for (var i = 0; i < artistInputs.length; i++) {
								artistInputs[i].value = '';
							}
						} else {
							var inputIdx = 0;

							yadgUtil.addRemoveArtistBoxes(data.effective_artist_count - artistInputs.length);

							artistInputs = document.getElementsByName('artists[]');

							for (i = 0; i < data.artist_keys.length; i++) {
								var artistKey = data.artist_keys[i];
								var artistTypes = data.artists[artistKey];

								for (var j = 0; j < artistTypes.length; j++) {
									var artistType = artistTypes[j];
									var artistInput = artistInputs[inputIdx];
									var typeSelect = artistInput.nextSibling;

									while (typeSelect.tagName !== 'SELECT') {
										typeSelect = typeSelect.nextSibling;
									}

									artistInput.value = artistKey;

									var optionOffsets = yadgUtil.getOptionOffsets(typeSelect);

									if (artistType === 'main') {
										typeSelect.selectedIndex = optionOffsets[1];
									} else if (artistType === 'guest') {
										typeSelect.selectedIndex = optionOffsets[2];
									} else if (artistType === 'remixer') {
										typeSelect.selectedIndex = optionOffsets[3];
									} else {
									// we don't know this artist type, default to "main"
										typeSelect.selectedIndex = optionOffsets[1];
									}
        // next artist input
									inputIdx += 1;
								}
							}
						}
					}

					if (tagsInput.getAttribute('disabled') !== 'disabled') {
						if (data.tags === false) {
							tagsInput.value = '';
						} else {
							var tagsArray = data.tag_string.split(', ');
							var tagsUnique = tagsArray.filter(function (elem, index, self) {
								return index === self.indexOf(elem);
							});
							tagsInput.value = tagsUnique.join(',').toLowerCase();
						}
					}

					if (yearInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(data.year, yearInput, data.year !== false);
					}
					if (albumTitleInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(data.title, albumTitleInput, data.title !== false);
					}
					if (labelInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(data.label, labelInput, data.label !== false);
					}
					if (catalogInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(data.catalog, catalogInput, data.catalog !== false);
					}
				};
				return f;

			case 'pth_edit':
				f = function (rawData) {
					var summaryInput = document.getElementsByName('summary')[0];
					var yearInput = document.getElementsByName('year')[0];
					var labelInput = document.getElementsByName('record_label')[0];
					var catalogInput = document.getElementsByName('catalogue_number')[0];
					var data = yadg.prepareRawResponse(rawData);

					summaryInput.value = 'YADG Update';
					if (yearInput && yearInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(data.year, yearInput, data.year !== false);
					}
					if (labelInput && labelInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(data.label, labelInput, data.label !== false);
					}
					if (catalogInput && catalogInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(data.catalog, catalogInput, data.catalog !== false);
					}
				};
				return f;

			case 'pth_torrent_overview':
				f = function (rawData) {
					var artistInputs = document.getElementsByName('aliasname[]');
					var data = yadg.prepareRawResponse(rawData);

					if (data.artists === false) {
						for (var i = 0; i < artistInputs.length; i++) {
							artistInputs[i].value = '';
						}
					} else {
						var inputIdx = 0;

						yadgUtil.addRemoveArtistBoxes(data.effective_artist_count - artistInputs.length);

						artistInputs = document.getElementsByName('aliasname[]');

						for (i = 0; i < data.artist_keys.length; i++) {
							var artistKey = data.artist_keys[i];
							var artistTypes = data.artists[artistKey];

							for (var j = 0; j < artistTypes.length; j++) {
								var artistType = artistTypes[j];
								var artistInput = artistInputs[inputIdx];
								var typeSelect = artistInput.nextSibling;

								while (typeSelect.tagName !== 'SELECT') {
									typeSelect = typeSelect.nextSibling;
								}

								artistInput.value = artistKey;

								var optionOffsets = yadgUtil.getOptionOffsets(typeSelect);

								if (artistType === 'main') {
									typeSelect.selectedIndex = optionOffsets[1];
								} else if (artistType === 'guest') {
									typeSelect.selectedIndex = optionOffsets[2];
								} else if (artistType === 'remixer') {
									typeSelect.selectedIndex = optionOffsets[3];
								} else {
         // we don't know this artist type, default to "main"
									typeSelect.selectedIndex = optionOffsets[1];
								}

        // next artist input
								inputIdx += 1;
							}
						}
					}
				};
				return f;

			case 'pth_request':
			case 'pth_request_edit':
				f = function (rawData) {
					var artistInputs = document.getElementsByName('artists[]');
					var albumTitleInput = document.getElementsByName('title')[0];
					var yearInput = document.getElementsByName('year')[0];
					var labelInput = document.getElementsByName('recordlabel')[0];
					var catalogInput = document.getElementsByName('cataloguenumber')[0];
					var tagsInput = document.getElementById('tags');
					var data = yadg.prepareRawResponse(rawData);

					if (data.artists === false) {
						for (var i = 0; i < artistInputs.length; i++) {
							artistInputs[i].value = '';
						}
					} else {
						var inputIdx = 0;

						yadgUtil.addRemoveArtistBoxes(data.effective_artist_count - artistInputs.length);

						artistInputs = document.getElementsByName('artists[]');

						for (i = 0; i < data.artist_keys.length; i++) {
							var artistKey = data.artist_keys[i];
							var artistTypes = data.artists[artistKey];

							for (var j = 0; j < artistTypes.length; j++) {
								var artistType = artistTypes[j];
								var artistInput = artistInputs[inputIdx];
								var typeSelect = artistInput.nextSibling;

								while (typeSelect.tagName !== 'SELECT') {
									typeSelect = typeSelect.nextSibling;
								}

								artistInput.value = artistKey;

								var optionOffsets = yadgUtil.getOptionOffsets(typeSelect);

								if (artistType === 'main') {
									typeSelect.selectedIndex = optionOffsets[1];
								} else if (artistType === 'guest') {
									typeSelect.selectedIndex = optionOffsets[2];
								} else if (artistType === 'remixer') {
									typeSelect.selectedIndex = optionOffsets[3];
								} else {
         // we don't know this artist type, default to "main"
									typeSelect.selectedIndex = optionOffsets[1];
								}

        // next artist input
								inputIdx += 1;
							}
						}
					}

					if (data.tags === false) {
						tagsInput.value = '';
					} else {
						tagsInput.value = data.tag_string.toLowerCase();
					}

					yadgUtil.setValueIfSet(data.year, yearInput, data.year !== false);
					yadgUtil.setValueIfSet(data.title, albumTitleInput, data.title !== false);
					yadgUtil.setValueIfSet(data.label, labelInput, data.label !== false);
					yadgUtil.setValueIfSet(data.catalog, catalogInput, data.catalog !== false);
				};
				return f;

			case 'waffles_upload':
				f = function (rawData) {
					var artistInput = document.getElementsByName('artist')[0];
					var albumTitleInput = document.getElementsByName('album')[0];
					var yearInput = document.getElementsByName('year')[0];
					var vaCheckbox = document.getElementById('va');
					var tagsInput = document.getElementById('tags');
					var data = yadg.prepareRawResponse(rawData);

					if (data.artists === false) {
						vaCheckbox.checked = false;
						artistInput.value = '';
					} else if (data.is_various) {
						artistInput.value = '';
						vaCheckbox.checked = true;
					} else {
						artistInput.value = data.flat_artistString;
						vaCheckbox.checked = false;
					}

					yadgUtil.setValueIfSet(data.year, yearInput, data.year !== false);
					yadgUtil.setValueIfSet(data.title, albumTitleInput, data.title !== false);

					if (data.tags === false) {
						tagsInput.value = '';
					} else {
						tagsInput.value = data.tag_string_nodots.toLowerCase();
					}

					yadgUtil.exec(function () {
						formatName();
					});
				};
				return f;

			case 'waffles_upload_new':
				f = function (rawData) {
					var artistInput = document.getElementById('id_artist');
					var albumTitleInput = document.getElementById('id_album');
					var yearInput = document.getElementById('id_year');
					var vaCheckbox = document.getElementById('id_va');
					var tagsInput = document.getElementById('id_tags');
					var data = yadg.prepareRawResponse(rawData);

					if (data.artists === false) {
						if (vaCheckbox.checked) {
							vaCheckbox.click();
						}
						artistInput.value = '';
					} else if (data.is_various) {
						if (!vaCheckbox.checked) {
							vaCheckbox.click();
						}
					} else {
						if (vaCheckbox.checked) {
							vaCheckbox.click();
						}
						artistInput.value = data.flat_artistString;
					}

					yadgUtil.setValueIfSet(data.year, yearInput, data.year !== false);
					yadgUtil.setValueIfSet(data.title, albumTitleInput, data.title !== false);

					if (data.tags === false) {
						tagsInput.value = '';
					} else {
						tagsInput.value = data.tag_string_nodots.toLowerCase();
					}
				};
				return f;

			case 'waffles_request':
				f = function (rawData) {
					var artistInput = document.getElementsByName('artist')[0];
					var albumTitleInput = document.getElementsByName('title')[0];
					var yearInput = document.getElementsByName('year')[0];
					var data = yadg.prepareRawResponse(rawData);

					if (data.artists === false) {
						artistInput.value = '';
					} else if (data.is_various) {
						artistInput.value = 'Various Artists';
					} else {
						artistInput.value = data.flat_artistString;
					}

					yadgUtil.setValueIfSet(data.year, yearInput, data.year !== false);
					yadgUtil.setValueIfSet(data.title, albumTitleInput, data.title !== false);
				};
				return f;

			default:
    // that should actually never happen
				return function () {};
		}
	}
};

yadgTemplates = {
	_templates: {},
	_templateUrls: {},

	getTemplate: function (id, callback) {
		if (id in this._templates) {
			callback(this._templates[id]);
		} else if (id in this._templateUrls) {
			var request = new requester(this._templateUrls[id], 'GET', function (template) { // eslint-disable-line new-cap
				yadgTemplates.addTemplate(template);
				callback(template);
			}, null, yadgTemplates.errorTemplate);
			request.send();
		} else {
			this.errorTemplate();
		}
	},

	addTemplate: function (template) {
		this._templates[template.id] = template;
	},

	addTemplateUrl: function (id, url) {
		this._templateUrls[id] = url;
	},

	errorTemplate: function () {
		yadg.printError('Could not get template. Please choose another one.', true);
	}
};

yadgRenderer = {
	_lastData: null,
	_lastTemplateId: null,

	render: function (templateId, data, callback, errorCallback) {
		this._lastData = data;
		var newTemplate = this._lastTemplateId !== templateId;
		this._lastTemplateId = templateId;

		yadgTemplates.getTemplate(templateId, function (template) {
			// the new template might have different dependencies, so initialize Swig with those
			if (newTemplate) {
				yadgSandbox.resetSandbox();
				yadgSandbox.initializeSwig(template.dependencies);
			}
			yadgSandbox.renderTemplate(template.code, data, callback, errorCallback);
		});
	},

	renderCached: function (templateId, callback, errorCallback) {
		if (this.hasCached()) {
			this.render(templateId, this._lastData, callback, errorCallback);
		}
	},

	hasCached: function () {
		return this._lastData !== null;
	},

	clearCached: function () {
		this._lastData = null;
	}
};

yadg = {
	yadgHost: 'https://yadg.cc',
	baseURI: '/api/v2/',

	standardError: 'Sorry, an error occured. Please try again. If this error persists the user script might need updating.',
	authenticationError: 'Your API token is invalid. Please provide a valid API token or remove the current one.',
	lastStateError: false,

	isBusy: false,

	init: function () {
		this.scraperSelect = document.getElementById('yadg_scraper');
		this.formatSelect = document.getElementById('yadg_format');
		this.input = document.getElementById('yadg_input');
		this.targetSelect = document.getElementById('yadg_target');
		this.targetDescriptionSelect = document.getElementById('yadg_description_target');
		this.responseDiv = document.getElementById('yadg_response');
		this.button = document.getElementById('yadg_submit');
	},

	getBaseURL: function () {
		return this.yadgHost + this.baseURI;
	},

	getScraperList: function (callback) {
		var url = this.getBaseURL() + 'scrapers/';

		var request = new requester(url, 'GET', callback); // eslint-disable-line new-cap

		request.send();
	},

	getFormatsList: function (callback) {
		var url = this.getBaseURL() + 'templates/';

		this.getTemplates(url, [], callback);
	},

	getTemplates: function (url, templates, callback) {
		var request = new requester(url, 'GET', function (data) { // eslint-disable-line new-cap
			for (var i = 0; i < data.results.length; i++) {
				templates.push(data.results[i]);
			}
			if (data.next === null) {
				callback(templates);
			} else {
				yadg.getTemplates(data.next, templates, callback);
			}
		});

		request.send();
	},

	makeRequest: function (params) {
		if (this.isBusy) {
			return;
		}

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
			var request = new requester(url, 'POST', function (result) { // eslint-disable-line new-cap
				yadg.getResult(result.url);
			}, data);
			this.busyStart();
			request.send();
		}
	},

	getResult: function (resultUrl) {
		var request = new requester(resultUrl, 'GET', function (response) { // eslint-disable-line new-cap
			if (response.status === 'done') {
				if (response.data.type === 'ReleaseResult') {
					var templateId = yadg.formatSelect.options[yadg.formatSelect.selectedIndex].value;
					yadgRenderer.render(templateId, response, factory.setDescriptionBoxValue, factory.setDescriptionBoxValue);

					if (yadg.lastStateError === true) {
						yadg.responseDiv.innerHTML = '';
						yadg.lastStateError = false;
					}

					var fillFunc = factory.getFormFillFunction();
					fillFunc(response.data);
				} else if (response.data.type === 'ListResult') {
					var ul = document.createElement('ul');
					ul.id = 'yadg_release_list';

					var releaseList = response.data.items;
					for (var i = 0; i < releaseList.length; i++) {
						var name = releaseList[i].name;
						var info = releaseList[i].info;
						var queryParams = releaseList[i].queryParams;
						var releaseUrl = releaseList[i].url;

						var li = document.createElement('li');
						var a = document.createElement('a');

						a.textContent = name;
						a.params = queryParams;
						a.href = releaseUrl;

						a.addEventListener('click', function (e) {
							e.preventDefault();
							yadg.makeRequest(this.params);
							if (factory.getFetchImageCheckbox().checked) {
								fetchImage(this.href, function (data) {
									insertImage(data, function () {
										if (factory.getAutoRehostCheckbox() && factory.getAutoRehostCheckbox().checked) {
											pthImgIt();
										}
									});
								});
							}
						}, false);

						li.appendChild(a);
						li.appendChild(document.createElement('br'));
						li.appendChild(document.createTextNode(info));

						ul.appendChild(li);
					}

					if (ul.childNodes.length === 0) {
						yadg.printError('Sorry, there were no matches.');
					} else {
						yadg.responseDiv.innerHTML = '';
						yadg.responseDiv.appendChild(ul);
						yadg.lastStateError = false;

      // we got a ListResult so clear the last ReleaseResult from the render cache
						yadgRenderer.clearCached();
					}
				} else if (response.data.type === 'NotFoundResult') {
					yadg.printError('I could not find the release with the given ID. You may want to try again with another one.');
				} else {
					yadg.printError('Something weird happened. Please try again');
				}
				yadg.busyStop();
			} else if (response.status === 'failed') {
				yadg.failedCallback();
			} else {
				var delay = function () {
					yadg.getResult(response.url);
				};
				window.setTimeout(delay, 1000);
			}
		});
		request.send();
	},

	printError: function (message, templateError) {
		this.responseDiv.innerHTML = '';
		this.responseDiv.appendChild(document.createTextNode(message));
		if (!templateError) {
			this.lastStateError = true;

   // there was a non template related error, so for consistencies sake clear the last ReleaseResult from the
   // render cache
			yadgRenderer.clearCached();
		}
	},

	failedCallback: function () {
		yadg.printError(yadg.standardError);
		yadg.busyStop();
	},

	failedAuthenticationCallback: function () {
		yadg.printError(yadg.authenticationError);
		yadg.busyStop();
	},

	busyStart: function () {
		this.isBusy = true;
		this.button.setAttribute('disabled', true);
		this.button.value = 'Please wait...';
		this.input.setAttribute('disabled', true);
		this.scraperSelect.setAttribute('disabled', true);
		this.formatSelect.setAttribute('disabled', true);
		this.targetSelect.setAttribute('disabled', true);
	},

	busyStop: function () {
		this.button.removeAttribute('disabled');
		this.button.value = 'Fetch';
		this.input.removeAttribute('disabled');
		this.scraperSelect.removeAttribute('disabled');
		this.formatSelect.removeAttribute('disabled');
		this.targetSelect.removeAttribute('disabled');
		this.isBusy = false;
	},

	prepareRawResponse: function (rawData) { // eslint-disable-line complexity
		var result = {};

		result.artists = false;
		result.year = false;
		result.title = false;
		result.label = false;
		result.catalog = false;
		result.genre = false;
		result.style = false;
		result.tags = false;
		result.is_various = false; // eslint-disable-line camelcase
		result.flat_artistString = false; // eslint-disable-line camelcase

		if (rawData.artists.length > 0) {
			result.artists = {};

			for (var i = 0; i < rawData.artists.length; i++) {
				var artist = rawData.artists[i];
				if (artist.isVarious) {
					result.is_various = true; // eslint-disable-line camelcase
				} else {
					result.artists[artist.name] = artist.types;
				}
			}
		}
		if (rawData.discs.length > 0) {
			for (var k = 0; k < rawData.discs.length; k++) {
				var disc = rawData.discs[k];
				for (var l = 0; l < disc.tracks.length; l++) {
					var track = disc.tracks[l];
					for (var m = 0; m < track.artists.length; m++) {
						var name = track.artists[m].name;
						var type = track.artists[m].types;

						var newTypes = null;
						if (name in result.artists) {
							newTypes = result.artists[name].concat(type);
       // deduplicate new types array
							for (i = 0; i < newTypes.length; ++i) {
								for (var j = i + 1; j < newTypes.length; ++j) {
									if (newTypes[i] === newTypes[j]) {
										newTypes.splice(j--, 1);
									}
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
		for (i = 0; i < rawData.releaseEvents.length; i++) {
			var event = rawData.releaseEvents[i];
			if (event.date) {
				result.year = event.date.match(/\d{4}/)[0];
				if (result.year.length === 4) {
					break;
				} else {
					result.year = false;
				}
			}
		}
		if (rawData.title) {
			result.title = rawData.title;
		}
		if (rawData.labelIds.length > 0) {
			var labelId = rawData.labelIds[0];
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
		if (result.genre !== false && result.style !== false) {
			result.tags = rawData.genres.concat(rawData.styles);
		} else if (result.genre !== false) {
			result.tags = rawData.genres;
		} else if (result.style !== false) {
			result.tags = rawData.styles;
		}

		if (result.tags !== false) {
			result.tag_string = ''; // eslint-disable-line camelcase
			result.tag_string_nodots = ''; // eslint-disable-line camelcase

			for (i = 0; i < result.tags.length; i++) {
				result.tag_string += result.tags[i].replace(/\s+/g, '.'); // eslint-disable-line camelcase
				result.tag_string_nodots += result.tags[i].replace(/\s+/g, ' '); // eslint-disable-line camelcase
				if (i !== result.tags.length - 1) {
					result.tag_string += ', '; // eslint-disable-line camelcase
					result.tag_string_nodots += ', '; // eslint-disable-line camelcase
				}
			}
		}

		if (result.artists !== false) {
   // count the artists
			result.artists_length = 0; // eslint-disable-line camelcase
			result.artist_keys = []; // eslint-disable-line camelcase
			result.effective_artist_count = 0; // eslint-disable-line camelcase

			for (i in result.artists) {
				if ({}.hasOwnProperty.call(result.artists, i)) {
					result.artists_length++;
					result.artist_keys.push(i);
					result.effective_artist_count += result.artists[i].length; // eslint-disable-line camelcase
				}
			}
		}

		if (result.artists_length === 0) {
			result.artists = false;
		} else {
   // create a flat string of all the main artists
			var artistString = '';

			for (i = 0; i < result.artists_length; i++) {
				if (result.artists[result.artist_keys[i]].indexOf('main') !== -1) {
					if (artistString !== '' && i < result.artists_length - 2) {
						artistString += ', ';
					} else if (artistString !== '' && i < result.artists_length - 1) {
						artistString += ' & ';
					}
					artistString += result.artist_keys[i];
				}
			}

			result.flat_artistString = artistString; // eslint-disable-line camelcase
		}

		return result;
	}
};

yadgSandbox.init(function () {
	if (factory.init()) { // returns true if we run on a valid location
		yadg.init();
	}
});
