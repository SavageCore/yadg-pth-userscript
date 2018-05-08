// ==UserScript==
// @id             pth-yadg
// @name           RED YADG
// @description    This script provides integration with online description generator YADG (http://yadg.cc) - Credit to Slack06
// @license        https://github.com/SavageCore/yadg-pth-userscript/blob/master/LICENSE
// @version        1.4.40
// @namespace      yadg
// @grant          GM_xmlhttpRequest
// @grant          GM.xmlHttpRequest
// @require        https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @require        https://yadg.cc/static/js/jsandbox.min.js
// @include        http*://*redacted.ch/upload.php*
// @include        http*://*redacted.ch/requests.php*
// @include        http*://*redacted.ch/torrents.php*
// @include        http*://*waffles.ch/upload.php*
// @include        http*://*waffles.ch/requests.php*
// @downloadURL    https://github.com/SavageCore/yadg-pth-userscript/raw/master/pth_yadg.user.js
// ==/UserScript==

// --------- USER SETTINGS START ---------

/*	global window	unsafeWindow document GM JSandbox formatName AddArtistField RemoveArtistField Blob alert Image */
/*	eslint max-depth: ['off'], block-scoped-var: 'off', no-loop-func: 'off', no-alert: 'off' */

/*
 Here you can set site specific default templates.
 You can find a list of available templates at: https://yadg.cc/api/v2/templates/
*/
const defaultPTHFormat = 4;
const defaultWafflesFormat = 9;
const	defaultPTHTarget = 'other';
const defaultPTHDescriptionTarget = 'album';
let yadg; // eslint-disable-line prefer-const
let factory; // eslint-disable-line prefer-const
let yadgRenderer; // eslint-disable-line prefer-const
let yadgTemplates; // eslint-disable-line prefer-const
let autoRehost;
let autoPreview;
let descriptionTarget; // eslint-disable-line no-unused-vars

// --------- USER SETTINGS END ---------

function fetchImage(target, callback) {
	const imgElement = document.getElementById('image');
	if (imgElement && imgElement.getAttribute('disabled') === 'disabled') {
		return;
	}
	let link;
	if (target === null) {
		link = unsafeWindow.$('#yadg_input').val();
	}	else {
		link = target;
	}
	switch (true) {
		case (/discogs/.test(link)):
			GM.xmlHttpRequest({ // eslint-disable-line new-cap
				method: 'GET',
				url: link,
				onload(response) {
					if (response.status === 200) {
						const container = document.implementation.createHTMLDocument().documentElement;
						container.innerHTML = response.responseText;
						if (typeof callback === 'function') {
							callback(JSON.parse(container.querySelectorAll('div.image_gallery.image_gallery_large')[0].getAttribute('data-images'))[0].full);
						}
					}
				}
			});
			break;
		case (/itunes/.test(link)): {
			const regex = /apple\.com\/(?:([a-z]{2,3})\/)?.*\/(?:(\d+)|id(\d*))/;
			const res = regex.exec(link);
			const id = res[2] | res[3];
			let country = 'us';
			if (res[1]) {
				[country] = res;
			}
			GM.xmlHttpRequest({ // eslint-disable-line new-cap
				method: 'GET',
				url: 'https://itunes.apple.com/lookup?id=' + id + '&country=' + country,
				onload(response) {
					if (response.status === 200) {
						const data = JSON.parse(response.responseText);
						const hires = data.results[0].artworkUrl100.replace('100x100bb', '100000x100000-999');
						if (typeof callback === 'function') {
							callback(hires);
						}
					}
				}
			});
			break;
		}
		case (/bandcamp/.test(link)):
		case (factory.getScraperSelect().value === 'bandcamp'): {
			let img;
			GM.xmlHttpRequest({ // eslint-disable-line new-cap
				method: 'GET',
				url: link,
				onload(response) {
					if (response.status === 200) {
						const container = document.implementation.createHTMLDocument().documentElement;
						container.innerHTML = response.responseText;
						const scaledImg = container.querySelectorAll('#tralbumArt > a > img')[0].src;
						const originalImg = scaledImg.replace(/_16/, '_0');
						const tempImg = new Image();
						tempImg.src = originalImg;
						tempImg.addEventListener('load', function () {
							if (this.width === this.height) {
								img = originalImg;
							} else {
								img = scaledImg;
							}
							if (typeof callback === 'function') {
								callback(img);
							}
						});
					}
				}
			});
			break;
		}
		case (/beatport/.test(link)):
			GM.xmlHttpRequest({ // eslint-disable-line new-cap
				method: 'GET',
				url: link,
				onload(response) {
					if (response.status === 200) {
						const container = document.implementation.createHTMLDocument().documentElement;
						container.innerHTML = response.responseText;
						if (typeof callback === 'function') {
							callback(container.querySelectorAll('div.interior-release-chart-artwork-parent > img')[0].src);
						}
					}
				}
			});
			break;
		case (/musicbrainz/.test(link)): {
			const regex = /release\/(.*)/;
			const {1: id} = regex.exec(link);
			GM.xmlHttpRequest({ // eslint-disable-line new-cap
				headers: {
					'User-Agent': 'YADG/1.3.17 (yadg.cc)'
				},
				method: 'GET',
				url: 'http://coverartarchive.org/release/' + id + '/',
				onload(response) {
					if (response.status === 200) {
						const data = JSON.parse(response.responseText);
						if (typeof callback === 'function') {
							callback(data.images[0].image);
						}
					}
				}
			});
			break;
		}
		case (/junodownload/.test(link)):
			GM.xmlHttpRequest({ // eslint-disable-line new-cap
				method: 'GET',
				url: link,
				onload(response) {
					if (response.status === 200) {
						const container = document.implementation.createHTMLDocument().documentElement;
						container.innerHTML = response.responseText;
						if (typeof callback === 'function') {
							callback(container.querySelectorAll('#product_image_front > a')[0].href);
						}
					}
				}
			});
			break;
		case (/metal-archives/.test(link)):
			GM.xmlHttpRequest({ // eslint-disable-line new-cap
				method: 'GET',
				url: link,
				onload(response) {
					if (response.status === 200) {
						const container = document.implementation.createHTMLDocument().documentElement;
						container.innerHTML = response.responseText;

						const parser = document.createElement('a');
						parser.href = container.querySelectorAll('#cover > img')[0].src;
						const imgLink = parser.protocol + '//' + parser.hostname + parser.pathname;
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
	const [pthImgIt] = document.getElementsByClassName('rehost_it_cover');
	let imgElement;

	switch (window.location.href) {
		case (window.location.href.match(/\/upload\.php/) || {}).input: {
			imgElement = document.getElementById('image').value;
			break;
		}
		case (window.location.href.match(/torrents\.php\?action=editgroup/) || {}).input: {
			imgElement = document.querySelectorAll('#content > div > div:nth-child(2) > form > div > input[type="text"]:nth-child(5)')[0].value;
			break;
		}
		default:
			break;
	}

	if (pthImgIt && imgElement) {
		pthImgIt.click();
	}
}

function insertImage(img, callback) {
	switch (window.location.href) {
		case (window.location.href.match(/\/upload\.php/) || {}).input: {
			const input = document.getElementById('image');
			input.value = img;
			if (input.getAttribute('autorehost') === 'true') {
				const evt = document.createEvent('HTMLEvents');
				evt.initEvent('keyup', false, true);
				input.dispatchEvent(evt);
			}
			input.parentNode.parentNode.insertAdjacentHTML('beforebegin', '<tr id="yadg_image_preview_tr"><td class="label">Album Art Preview:</td><td><img id="yadg_image_preview" src="' + img + '" width="300px" /></tr></td>');
			callback();
			break;
		}
		case (window.location.href.match(/torrents\.php\?action=editgroup/) || {}).input: {
			const [imageInputElement] = document.querySelectorAll('#content > div > div:nth-child(2) > form > div > input[type="text"]:nth-child(5)');
			imageInputElement.value = img;
			imageInputElement.parentNode.insertAdjacentHTML('beforebegin', '<div id="yadg_image_preview_div"><img id="yadg_image_preview" src="' + img + '" width="300px" /></div>');
			callback();
			break;
		}
		case (window.location.href.match(/requests\.php\?/) || {}).input: {
			const [imageInputElement] = document.querySelectorAll('#image_tr > td:nth-child(2) > input[type="text"]:nth-child(1)');
			imageInputElement.value = img;
			imageInputElement.parentNode.parentNode.insertAdjacentHTML('beforebegin', '<tr id="yadg_image_preview_tr"><td class="label">Album Art Preview:</td><td><img id="yadg_image_preview" src="' + img + '" width="300px" /></tr></td>');
			callback();
			break;
		}
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

	const delimiter = '_';

	// If the passed in value for prefix is not string, it should be converted
	const keyPrefix = typeof (applicationPrefix) === 'string' ? applicationPrefix : JSON.stringify(applicationPrefix);

	const localStorage = window.localStorage || unsafeWindow.localStorage;

	const isLocalStorageAvailable = function () {
		return typeof (localStorage) !== 'undefined';
	};

	const getKeyPrefix = function () {
		return keyPrefix;
	};

	//
	// validates if there is a prefix defined for the keys
	// and checks if the localStorage functionality is available or not
	//
	const makeChecks = function (key) {
		const prefix = getKeyPrefix();
		if (prefix === undefined) {
			throw new Error('No prefix was defined, data cannot be saved');
		}

		if (!isLocalStorageAvailable()) {
			throw new Error('LocalStorage is not supported by your browser, data cannot be saved');
		}

		// Keys are always strings
		const checkedKey = typeof (key) === 'string' ? key : JSON.stringify(key);

		return checkedKey;
	};

	//
	// saves the value associated to the key into the localStorage
	//
	const addItem = function (key, value) {
		const that = this;
		try {
			const checkedKey = makeChecks(key);
			const combinedKey = that.getKeyPrefix() + delimiter + checkedKey;
			localStorage.setItem(combinedKey, JSON.stringify(value));
		}		catch (err) {
			console.log(err);
			throw err;
		}
	};

	//
	// gets the value of the object saved to the key passed as parameter
	//
	const getItem = function (key) {
		const that = this;
		let result;
		try {
			const checkedKey = makeChecks(key);
			const combinedKey = that.getKeyPrefix() + delimiter + checkedKey;
			const resultAsJSON = localStorage.getItem(combinedKey);
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
	const getAllKeys = function () {
		const prefix = getKeyPrefix();
		const results = [];

		if (prefix === undefined) {
			throw new Error('No prefix was defined, data cannot be saved');
		}

		if (!isLocalStorageAvailable()) {
			throw new Error('LocalStorage is not supported by your browser, data cannot be saved');
		}

		for (const key in localStorage) {
			if (key.indexOf(prefix) === 0) {
				const keyParts = key.split(delimiter);
				results.push(keyParts[1]);
			}
		}

		return results;
	};

	//
	// removes the value associated to the key from the localStorage
	//
	const removeItem = function (key) {
		const that = this;
		let result = false;
		try {
			const checkedKey = makeChecks(key);
			const combinedKey = that.getKeyPrefix() + delimiter + checkedKey;
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
	const removeAll = function () {
		const that = this;

		try {
			const allKeys = that.getAllKeys();
			for (let i = 0; i < allKeys.length; ++i) {
				const checkedKey = makeChecks(allKeys[i]);
				const combinedKey = that.getKeyPrefix() + delimiter + checkedKey;
				localStorage.removeItem(combinedKey);
			}
		}		catch (err) {
			console.log(err);
			throw err;
		}
	};

	// Make some of the functionalities public
	return {
		isLocalStorageAvailable,
		getKeyPrefix,
		addItem,
		getItem,
		getAllKeys,
		removeItem,
		removeAll
	};
}

// --------- THIRD PARTY CODE AREA END ---------

const yadgUtil = {
	exec(fn) {
		const script = document.createElement('script');
		script.setAttribute('type', 'application/javascript');
		script.textContent = '(' + fn + ')();';
		document.body.appendChild(script); // Run the script
		document.body.removeChild(script); // Clean up
	},

	// Handle for updating page css, taken from one of hateradio's scripts
	addCSS(style) {
		if (!this.style) {
			this.style = document.createElement('style');
			this.style.type = 'text/css';
			(document.head || document.getElementsByTagName('head')[0]).appendChild(this.style);
		}
		this.style.appendChild(document.createTextNode(style + '\n'));
	},

	setValueIfSet(value, input, cond) {
		if (cond) {
			input.value = value;
		} else {
			input.value = '';
		}
	},

	// Negative count will remove, positive count will add given number of artist boxes
	addRemoveArtistBoxes(count) {
		if (count !== 0) {
			if (count < 0) {
				for (let i = 0; i < -count; i++) {
					yadgUtil.exec(() => {
						RemoveArtistField(); // eslint-disable-line new-cap
					});
				}
			} else {
				for (let i = 0; i < count; i++) {
					yadgUtil.exec(() => {
						AddArtistField(); // eslint-disable-line new-cap
					});
				}
			}
		}
	},

	getOptionOffsets(select) {
		const optionOffsets = {};
		for (let j = 0; j < select.options.length; j++) {
			optionOffsets[select.options[j].value] = select.options[j].index;
		}
		return optionOffsets;
	},

	storage: new LocalStorageWrapper('yadg'),

	settings: new LocalStorageWrapper('yadgSettings')
};

// Very simple wrapper for XmlHttpRequest
function requester(url, method, callback, data, errorCallback) { // eslint-disable-line max-params
	this.data = data;
	this.url = url;
	this.method = method;
	if (!errorCallback) {
		errorCallback = yadg.failedCallback;
	}

	this.send = function () {
		const details = {
			url: this.url,
			method: this.method,
			onload(response) {
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

		const headers = {
			Accept: 'application/json',
			'Content-Type': 'application/json'
		};

		if (yadgUtil.settings.getItem(factory.KEY_API_TOKEN)) {
			headers.Authorization = 'Token ' + yadgUtil.settings.getItem(factory.KEY_API_TOKEN);
		}

		details.headers = headers;

		GM.xmlHttpRequest(details); // eslint-disable-line new-cap
	};
}

const yadgSandbox = {

	KEY_LAST_WARNING: 'templateLastWarning',

	init(callback) {
		GM.xmlHttpRequest({ // eslint-disable-line new-cap
			method: 'GET',
			url: yadg.yadgHost + '/static/js/jsandbox-worker.js',
			onload(response) {
				let script;
				let dataURL = null;
				if (response.status === 200) {
					script = response.responseText;
					const blob = new Blob([script], {type: 'application/javascript'});
					const URL = window.URL || window.webkitURL;
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
			onerror() {
				yadgSandbox.initCallbackError();
			}
		});
	},

	loadSwig(callback) {
		// ImportScripts for the web worker will not work in Firefox with cross-domain requests
		// see: https://bugzilla.mozilla.org/show_bug.cgi?id=756589
		// so download the Swig files manually with GM.xmlHttpRequest
		GM.xmlHttpRequest({ // eslint-disable-line new-cap
			method: 'GET',
			url: yadg.yadgHost + '/static/js/swig.min.js',
			onload(response) {
				if (response.status === 200) {
					yadgSandbox.swigScript = response.responseText;

					GM.xmlHttpRequest({ // eslint-disable-line new-cap
						method: 'GET',
						url: yadg.yadgHost + '/static/js/swig.custom.js',
						onload(response) {
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

	initializeSwig(dependencies) {
		if (!(this.swigScript && this.swigCustomScript)) {
			yadg.failedCallback();
			return;
		}

		yadgSandbox.exec({data: this.swigScript, onerror: yadg.failedCallback});
		yadgSandbox.exec({data: this.swigCustomScript, onerror: yadg.failedCallback});
		yadgSandbox.exec({data: 'var myswig = new swig.Swig({ loader: swig.loaders.memory(input.templates), autoescape: false }), i=0; yadg_filters.register_filters(myswig);', input: {templates: dependencies}});
	},

	renderTemplate(template, data, callback, error) {
		const evalString = 'myswig.render(input.template, { locals: input.data, filename: \'scratchpad\' + (i++) })';
		this.eval({data: evalString, callback(out) {
			callback(out);
		}, input: {template, data}, onerror(err) {
			error(err);
		}});
	},

	initCallback(dataUrl) {
		JSandbox.url = dataUrl;
		this.jsandbox = new JSandbox();
		this.initError = false;
	},

	resetSandbox() {
		this.jsandbox.terminate();
		this.jsandbox = new JSandbox();
	},

	load(options) {
		this.jsandbox.load(options);
	},

	exec(options) {
		this.jsandbox.exec(options);
	},

	eval(options) {
		this.jsandbox.eval(options);
	},

	initCallbackError() {
		this.initError = true;

		const lastWarning = yadgUtil.storage.getItem(this.KEY_LAST_WARNING);
		const now = new Date();
		if (lastWarning === null || now.getTime() - (new Date(lastWarning)).getTime() > factory.CACHE_TIMEOUT) {
			console.log('Could not load the necessary script files for executing YADG. If this error persists you might need to update the user script. You will only get this message once a day.');
			yadgUtil.storage.addItem(this.KEY_LAST_WARNING, now);
		}
	}
};

factory = {
	// Storage keys for cache
	KEY_LAST_CHECKED: 'lastChecked',
	KEY_SCRAPER_LIST: 'scraperList',
	KEY_FORMAT_LIST: 'formatList',

	// Storage keys for settings
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
			regex: /http(s)?:\/\/(.*\.)?redacted\.ch\/upload\.php.*/i
		},
		{
			name: 'pth_edit',
			regex: /http(s)?:\/\/(.*\.)?redacted\.ch\/torrents\.php\?action=editgroup&groupid=.*/i
		},
		{
			name: 'pth_request',
			regex: /http(s)?:\/\/(.*\.)?redacted\.ch\/requests\.php\?action=new/i
		},
		{
			name: 'pth_request_edit',
			regex: /http(s)?:\/\/(.*\.)?redacted\.ch\/requests\.php\?action=edit&id=.*/i
		},
		{
			name: 'pth_torrent_overview',
			regex: /http(s)?:\/\/(.*\.)?redacted\.ch\/torrents\.php\?id=.*/i
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

	determineLocation(uri) {
		for (let i = 0; i < this.locations.length; i++) {
			if (this.locations[i].regex.test(uri)) {
				return this.locations[i].name;
			}
		}
		return null;
	},

	init() {
		this.currentLocation = this.determineLocation(document.URL);
		// Only continue with the initialization if we found a valid location
		if (this.currentLocation === null) {
			return false;
		}
		this.insertIntoPage(this.getInputElements());

		// Set the necessary styles
		this.setStyles();

		// Make sure we initialize the settings to the most recent version
		this.initializeSettings();

		// Populate settings inputs
		this.populateSettings();

		// Add the appropriate action for the button
		const button = document.getElementById('yadg_submit');
		button.addEventListener('click', e => {
			e.preventDefault();
			yadg.makeRequest();
			if (factory.getFetchImageCheckbox().checked) {
				fetchImage(null, data => {
					insertImage(data, () => {
						if (factory.getAutoRehostCheckbox() && factory.getAutoRehostCheckbox().checked) {
							pthImgIt();
						}
					});
				});
			}
		}, false);

		// Add the action for the options toggle
		const toggleLink = document.getElementById('yadg_toggle_options');
		if (toggleLink !== null) {
			toggleLink.addEventListener('click', e => {
				e.preventDefault();

				const optionsDiv = document.getElementById('yadg_options');
				const {display} = optionsDiv.style;

				if (display === 'none' || display === '') {
					optionsDiv.style.display = 'block';
				} else {
					optionsDiv.style.display = 'none';
				}
			});
		}

		// Add the action for the template select
		const formatSelect = this.getFormatSelect();
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
		const saveSettingsLink = document.getElementById('yadg_save_settings');
		if (saveSettingsLink !== null) {
			saveSettingsLink.addEventListener('click', e => {
				e.preventDefault();

				factory.saveSettings();

				alert('Settings saved successfully.');
			});
		}

		// Add the action to the clear cache link
		const clearCacheLink = document.getElementById('yadg_clear_cache');
		if (clearCacheLink !== null) {
			clearCacheLink.addEventListener('click', e => {
				e.preventDefault();

				yadgUtil.storage.removeAll();

				alert('Cache cleared. Please reload the page for this to take effect.');
			});
		}

		const lastChecked = yadgUtil.storage.getItem(factory.KEY_LAST_CHECKED);
		if (lastChecked === null || (new Date()).getTime() - (new Date(lastChecked)).getTime() > factory.CACHE_TIMEOUT) {
			// Update the scraper and formats list
			factory.UPDATE_PROGRESS = 1;
			yadg.getScraperList(factory.setScraperSelect);
			yadg.getFormatsList(factory.setFormatSelect);
		} else {
			factory.setScraperSelect(yadgUtil.storage.getItem(factory.KEY_SCRAPER_LIST));
			factory.setFormatSelect(yadgUtil.storage.getItem(factory.KEY_FORMAT_LIST));
		}

		return true;
	},

	getApiTokenInput() {
		return document.getElementById('yadg_api_token');
	},

	getReplaceDescriptionCheckbox() {
		return document.getElementById('yadg_options_replace');
	},

	getFetchImageCheckbox() {
		return document.getElementById('yadg_options_image');
	},

	getAutoRehostCheckbox() {
		return document.getElementById('yadg_options_rehost');
	},

	getAutoPreviewCheckbox() {
		return document.getElementById('yadg_options_preview');
	},

	getReplaceDescriptionSettingKey() {
		return this.makeReplaceDescriptionSettingsKey(this.currentLocation);
	},

	makeReplaceDescriptionSettingsKey(subKey) {
		return this.KEY_REPLACE_DESCRIPTION + subKey.replace(/_/g, '');
	},

	initializeSettings() {
		let settingsVer = yadgUtil.settings.getItem(factory.KEY_SETTINGS_INIT_VER);
		const currentVer = 1;

		if (!settingsVer) {
			settingsVer = 0;
		}

		if (settingsVer < currentVer) {
			// Replace descriptions on upload and new request pages
			const locations = [
				'pth_upload',
				'pth_request',
				'waffles_upload',
				'waffles_upload_new',
				'waffles_request'
			];
			for (let i = 0; i < locations.length; i++) {
				const loc = locations[i];
				const replaceDescSettingKey = factory.makeReplaceDescriptionSettingsKey(loc);

				yadgUtil.settings.addItem(replaceDescSettingKey, true);
			}
		}

		yadgUtil.settings.addItem(factory.KEY_SETTINGS_INIT_VER, currentVer);
	},

	populateSettings() {
		const apiToken = yadgUtil.settings.getItem(factory.KEY_API_TOKEN);
		const replaceDesc = yadgUtil.settings.getItem(factory.getReplaceDescriptionSettingKey());
		const fetchImage = yadgUtil.settings.getItem(factory.KEY_FETCH_IMAGE);
		autoRehost = yadgUtil.settings.getItem(factory.KEY_AUTO_REHOST);
		autoPreview = yadgUtil.settings.getItem(factory.KEY_AUTO_PREVIEW);
		descriptionTarget = yadgUtil.settings.getItem(factory.KEY_AUTO_PREVIEW);

		if (apiToken) {
			const apiTokenInput = factory.getApiTokenInput();
			apiTokenInput.value = apiToken;
		}

		if (replaceDesc) {
			const replaceDescCheckbox = factory.getReplaceDescriptionCheckbox();
			replaceDescCheckbox.checked = true;
		}

		if (fetchImage) {
			const fetchImageCheckbox = factory.getFetchImageCheckbox();
			fetchImageCheckbox.checked = true;
		}

		if (autoRehost) {
			const autoRehostCheckbox = factory.getAutoRehostCheckbox();
			if (autoRehostCheckbox) {
				autoRehostCheckbox.checked = true;
			}
		}

		if (autoPreview && window.location.href.match(/\/upload\.php/)) {
			const autoPreviewCheckbox = factory.getAutoPreviewCheckbox();
			autoPreviewCheckbox.checked = true;
		}
	},

	saveSettings() {
		const scraperSelect = factory.getScraperSelect();
		const templateSelect = factory.getFormatSelect();
		const targetSelect = factory.getTargetSelect();
		const descriptionTargetSelect = factory.getDescriptionTargetSelect();
		const apiTokenInput = factory.getApiTokenInput();
		const replaceDescCheckbox = factory.getReplaceDescriptionCheckbox();
		const fetchImageCheckbox = factory.getFetchImageCheckbox();
		const autoRehostCheckbox = factory.getAutoRehostCheckbox();
		const autoPreviewCheckbox = factory.getAutoPreviewCheckbox();

		let currentScraper = null;
		let currentTemplate = null;
		let currentTarget = null;
		let currentDescriptionTarget = null;
		const apiToken = apiTokenInput.value.trim();
		const replaceDescription = replaceDescCheckbox.checked;
		const fetchImage = fetchImageCheckbox.checked;
		if (autoRehostCheckbox) {
			autoRehost = autoRehostCheckbox.checked;
		}
		if (window.location.href.match(/\/upload\.php/)) {
			autoPreview = autoPreviewCheckbox.checked;
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

		const replaceDescSettingKey = factory.getReplaceDescriptionSettingKey();
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

	setDescriptionBoxValue(value) {
		const descBox = factory.getDescriptionBox();
		const replaceDescCheckbox = factory.getReplaceDescriptionCheckbox();
		let replaceDesc = false;

		if (replaceDescCheckbox !== null) {
			replaceDesc = replaceDescCheckbox.checked;
		}

		if (descBox !== null && !Array.isArray(descBox)) {
			if (!replaceDesc && /\S/.test(descBox.value)) { // Check if the current description contains more than whitespace
				descBox.value += '\n\n' + value;
			} else {
				descBox.value = value;
			}
			if (descBox.parentNode.nextSibling.nextSibling) {
				const previewBtn = descBox.parentNode.nextSibling.nextSibling.firstChild.nextSibling;
				if (previewBtn && previewBtn.value === 'Preview' && factory.getAutoPreviewCheckbox().checked) {
					previewBtn.click();
				}
			}
		} else if (Array.isArray(descBox)) {
			for (let i = 0; i < descBox.length; i++) {
				descBox[i].value = value;
				const previewBtn = descBox[i].parentNode.nextSibling.nextSibling.firstChild.nextSibling;
				if (previewBtn && previewBtn.value === 'Preview' && factory.getAutoPreviewCheckbox().checked) {
					previewBtn.click();
				}
			}
		}
	},

	getFormatSelect() {
		return document.getElementById('yadg_format');
	},

	setDefaultFormat() {
		const formatSelect = factory.getFormatSelect();
		const formatOffsets = yadgUtil.getOptionOffsets(formatSelect);

		const defaultFormat = yadgUtil.settings.getItem(factory.KEY_DEFAULT_TEMPLATE);
		if (defaultFormat !== null && defaultFormat in formatOffsets) {
			formatSelect.selectedIndex = formatOffsets[defaultFormat];
		} else {
			// We have no settings so fall back to the hard coded defaults
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

	getTargetSelect() {
		return document.getElementById('yadg_target');
	},

	getDescriptionTargetSelect() {
		return document.getElementById('yadg_description_target');
	},

	setDefaultTarget() {
		const targetSelect = factory.getTargetSelect();
		const targetOffsets = yadgUtil.getOptionOffsets(targetSelect);

		const defaultTarget = yadgUtil.settings.getItem(factory.KEY_DEFAULT_TARGET);
		if (defaultTarget !== null && defaultTarget in targetOffsets) {
			targetSelect.selectedIndex = targetOffsets[defaultTarget];
		} else {
			targetSelect.selectedIndex = targetOffsets[defaultPTHTarget];
		}
	},

	setDefaultDescriptionTarget() {
		const targetDescriptionSelect = factory.getDescriptionTargetSelect();
		const targetDescriptionOffsets = yadgUtil.getOptionOffsets(targetDescriptionSelect);

		const defaultDescriptionTarget = yadgUtil.settings.getItem(factory.KEY_DESCRIPTION_TARGET);
		if (defaultDescriptionTarget !== null && defaultDescriptionTarget in targetDescriptionOffsets) {
			targetDescriptionSelect.selectedIndex = targetDescriptionOffsets[defaultDescriptionTarget];
		} else {
			targetDescriptionSelect.selectedIndex = targetDescriptionOffsets[defaultPTHDescriptionTarget];
		}
	},

	getScraperSelect() {
		return document.getElementById('yadg_scraper');
	},

	setDefaultScraper() {
		const defaultScraper = yadgUtil.settings.getItem(factory.KEY_DEFAULT_SCRAPER);
		if (defaultScraper !== null) {
			const scraperSelect = factory.getScraperSelect();
			const scraperOffsets = yadgUtil.getOptionOffsets(scraperSelect);

			if (defaultScraper in scraperOffsets) {
				scraperSelect.selectedIndex = scraperOffsets[defaultScraper];
			}
		}
	},

	setScraperSelect(scrapers) {
		const scraperSelect = factory.getScraperSelect();

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

	setFormatSelect(templates) {
		const formatSelect = factory.getFormatSelect();

		const nonUtility = [];
		const saveTemplates = [];
		for (let i = 0; i < templates.length; i++) {
			if (factory.UPDATE_PROGRESS > 0) {
				if (templates[i].name === 'What') {
					templates[i].name = 'RED';
					templates[i].nameFormatted = 'RED';
				} else if (templates[i].name === 'What (Tracks only)') {
					templates[i].name = 'RED (Tracks only)';
					templates[i].nameFormatted = 'RED (Tracks only)';
				}

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
				if (templates[i].name === 'What') {
					templates[i].name = 'PTH';
					templates[i].nameFormatted = 'PTH';
				} else if (templates[i].name === 'What (Tracks only)') {
					templates[i].name = 'PTH (Tracks only)';
					templates[i].nameFormatted = 'PTH (Tracks only)';
				}

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

	setSelect(select, data) {
		select.options.length = data.length;

		for (let i = 0; i < data.length; i++) {
			// We are not using the javascript constructor to create an Option instance because this will create an
			// incompatibility with jQuery in Chrome which will make it impossible to add a new artist field on redacted.ch
			const o = document.createElement('option');
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

	setStyles() {
		// General styles
		yadgUtil.addCSS('div#yadg_options{ display:none; margin-top:3px; } input#yadg_input,input#yadg_submit,label#yadg_format_label,a#yadg_scraper_info { margin-right: 5px } div#yadg_response { margin-top:3px; } select#yadg_scraper { margin-right: 2px } #yadg_options_template,#yadg_options_api_token,#yadg_options_replace_div { margin-bottom: 3px; } .add_form[name="yadg"] input,.add_form[name="yadg"] select { width: 90%; margin: 2px 0 !important; } input#yadg_submit { position: inherit !important}');

		// Location specific styles will go here
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

	getInputElements() {
		const buttonHTML = '<input type="submit" value="Fetch" id="yadg_submit"/>';
		const scraperSelectHTML = '<select name="yadg_scraper" id="yadg_scraper"></select>';
		let optionsHTML = '<div id="yadg_options"><div id="yadg_options_template"><label for="yadg_format" id="yadg_format_label">Template:</label><select name="yadg_format" id="yadg_format"></select></div><div id="yadg_options_target"><label for="yadg_target" id="yadg_target_label">Edition:</label><select name="yadg_target" id="yadg_target"><option value="original">Original</option><option value="other">Other</option></select></div><div id="yadg_options_description_target"><label for="yadg_description_target" id="yadg_description_target_label">Description:</label><select name="yadg_description_target" id="yadg_description_target"><option value="album">Album</option><option value="release">Release</option><option value="both">Both</option></select></div><div id="yadg_options_api_token"><label for="yadg_api_token" id="yadg_api_token_label">API token (<a href="https://yadg.cc/api/token" target="_blank">Get one here</a>):</label> <input type="text" name="yadg_api_token" id="yadg_api_token" size="50" /></div><div id="yadg_options_replace_div"><input type="checkbox" name="yadg_options_replace" id="yadg_options_replace" /> <label for="yadg_options_replace" id="yadg_options_replace_label">Replace descriptions on this page</label></div><div id="yadg_options_image_div"><input type="checkbox" name="yadg_options_image" id="yadg_options_image" /> <label for="yadg_options_image" id="yadg_options_image_label">Auto fetch Album Art (Bandcamp, Beatport, Discogs, iTunes, Junodownload, Metal-Archives, MusicBrainz)</label></div>';
		if (document.getElementsByClassName('rehost_it_cover')[0]) {
			optionsHTML += '<div id="yadg_options_rehost_div"><input type="checkbox" name="yadg_options_rehost" id="yadg_options_rehost" /> <label for="yadg_options_rehost" id="yadg_options_rehost_label">Auto rehost with <a href="https://redacted.ch/forums.php?action=viewthread&threadid=1992">[User Script] PTPIMG URL uploader</a></label></div>';
		}
		if (window.location.href.match(/\/upload\.php/)) {
			optionsHTML += '<div id="yadg_options_preview_div"><input type="checkbox" name="yadg_options_preview" id="yadg_options_preview" /> <label for="yadg_options_preview" id="yadg_options_preview_label">Auto preview description</label></div>';
		}
		optionsHTML += '<div id="yadg_options_links"><a id="yadg_save_settings" href="#" title="Save the currently selected scraper and template as default for this site and save the given API token.">Save settings</a> <span class="yadg_separator">|</span> <a id="yadg_clear_cache" href="#">Clear cache</a></div></div>';
		const inputHTML = '<input type="text" name="yadg_input" id="yadg_input" size="60" />';
		const responseDivHTML = '<div id="yadg_response"></div>';
		const toggleOptionsLinkHTML = '<a id="yadg_toggle_options" href="#">Toggle options</a>';
		const scraperInfoLink = '<a id="yadg_scraper_info" href="https://yadg.cc/available-scrapers" target="_blank" title="Get additional information on the available scrapers">[?]</a>';

		switch (this.currentLocation) {
			case 'pth_upload': {
				const tr = document.createElement('tr');
				tr.className = 'yadg_tr';
				tr.innerHTML = '<td class="label">YADG:</td><td>' + inputHTML + scraperSelectHTML + scraperInfoLink + buttonHTML + toggleOptionsLinkHTML + optionsHTML + responseDivHTML + '</td>';
				return tr;
			}

			case 'pth_edit': {
				const div = document.createElement('div');
				div.className = 'yadg_div';
				div.innerHTML = '<h3 class="label">YADG:</h3>\n' + inputHTML + '\n' + scraperSelectHTML + '\n' + scraperInfoLink + '\n' + buttonHTML + '\n' + toggleOptionsLinkHTML + '\n' + optionsHTML + '\n' + responseDivHTML;
				return div;
			}

			case 'pth_torrent_overview': {
				const div = document.createElement('div');
				div.id = 'yadg_div';
				div.className = 'box';
				div.innerHTML = '<div class="head"><strong>YADG</strong></div>\n<div class="body">\n<form class="add_form" name="yadg" method="post">\n<input type="text" name="yadg_input" id="yadg_input" />\n' + scraperSelectHTML + '\n' + scraperInfoLink + '\n' + buttonHTML + '\n' + toggleOptionsLinkHTML + '\n' + optionsHTML + '\n' + responseDivHTML;
				return div;
			}

			case 'pth_request':
			case 'pth_request_edit': {
				const tr = document.createElement('tr');
				tr.className = 'yadg_tr';
				tr.innerHTML = '<td class="label">YADG:</td><td>' + inputHTML + scraperSelectHTML + scraperInfoLink + buttonHTML + toggleOptionsLinkHTML + optionsHTML + responseDivHTML + '</td>';
				return tr;
			}

			case 'waffles_upload': {
				const tr = document.createElement('tr');
				tr.className = 'yadg_tr';
				tr.innerHTML = '<td class="heading" valign="top" align="right"><label for="yadg_input">YADG:</label></td><td>' + inputHTML + scraperSelectHTML + scraperInfoLink + buttonHTML + toggleOptionsLinkHTML + optionsHTML + responseDivHTML + '</td>';
				return tr;
			}

			case 'waffles_upload_new': {
				const p = document.createElement('p');
				p.className = 'yadg_p';
				p.innerHTML = '<label for="yadg_input">YADG:</label>' + inputHTML + scraperSelectHTML + scraperInfoLink + buttonHTML + toggleOptionsLinkHTML + optionsHTML + responseDivHTML;
				return p;
			}

			case 'waffles_request': {
				const tr = document.createElement('tr');
				tr.className = 'yadg_tr';
				tr.innerHTML = '<td style="text-align:left;width:100px;">YADG:</td><td style="text-align:left;">' + inputHTML + scraperSelectHTML + scraperInfoLink + buttonHTML + toggleOptionsLinkHTML + optionsHTML + responseDivHTML + '</td>';
				return tr;
			}

			default:
				// This should actually never happen
				return document.createElement('div');
		}
	},

	insertIntoPage(element) {
		switch (this.currentLocation) {
			case 'pth_upload': {
				const yearTr = document.getElementById('year_tr');
				yearTr.parentNode.insertBefore(element, yearTr);
				break;
			}

			case 'pth_edit': {
				const [summaryInput] = document.getElementsByName('summary');
				summaryInput.parentNode.insertBefore(element, summaryInput.nextSibling.nextSibling);
				break;
			}

			case 'pth_torrent_overview': {
				const [addArtistsBox] = document.getElementsByClassName('box_addartists');
				addArtistsBox.parentNode.insertBefore(element, addArtistsBox.nextSibling.nextSibling);
				break;
			}

			case 'pth_request':
			case 'pth_request_edit': {
				const artistTr = document.getElementById('artist_tr');
				artistTr.parentNode.insertBefore(element, artistTr);
				break;
			}

			case 'waffles_upload': {
				const [submitButton] = document.getElementsByName('submit');
				submitButton.parentNode.parentNode.parentNode.insertBefore(element, submitButton.parentNode.parentNode);
				break;
			}

			case 'waffles_upload_new': {
				const h4s = document.getElementsByTagName('h4');
				let div;
				for (let i = 0; i < h4s.length; i++) {
					if (h4s[i].innerHTML.indexOf('read the rules') !== -1) {
						div = h4s[i].parentNode;
						break;
					}
				}
				div.appendChild(element);
				break;
			}

			case 'waffles_request': {
				const [categorySelect] = document.getElementsByName('category');
				categorySelect.parentNode.parentNode.parentNode.insertBefore(element, categorySelect.parentNode.parentNode);
				break;
			}

			default:
				break;
		}
	},

	getDescriptionBox() {
		switch (this.currentLocation) {
			case 'pth_upload':
				if (factory.getDescriptionTargetSelect().value === 'album') {
					return document.getElementById('album_desc');
				}
				if (factory.getDescriptionTargetSelect().value === 'release') {
					return document.getElementById('release_desc');
				}
				if (factory.getDescriptionTargetSelect().value === 'both') {
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
				// That should actually never happen
				return document.createElement('div');
		}
	},

	getFormFillFunction() {
		const currentTarget = factory.getTargetSelect().value;
		switch (this.currentLocation) {
			case 'pth_upload': {
				const f = function (rawData) { // eslint-disable-line complexity
					let albumTitleInput;
					let yearInput;
					let labelInput;
					let catalogInput;
					if (currentTarget === 'other') {
						const remaster = document.getElementById('remaster');
						albumTitleInput = document.getElementById('title');
						yearInput = document.getElementById('remaster_year');
						labelInput = document.getElementById('remaster_record_label');
						catalogInput = document.getElementById('remaster_catalogue_number');
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
						const releaseTypeInput = document.getElementById('releasetype');
						switch (true) {
							case /.+ - Single$/.test(rawData.title):
								rawData.title = rawData.title.replace(/ - Single$/, '');
								if (releaseTypeInput.getAttribute('disabled') !== 'disabled') {
									releaseTypeInput.value = 9;
								}
								break;
							case /.+ - EP$/.test(rawData.title):
								rawData.title = rawData.title.replace(/ - EP$/, '');
								if (releaseTypeInput.getAttribute('disabled') !== 'disabled') {
									releaseTypeInput.value = 5;
								}
								break;
							default:
								break;
						}
					}

					let artistInputs = document.getElementsByName('artists[]');
					const tagsInput = document.getElementById('tags');
					const data = yadg.prepareRawResponse(rawData);
					let nullArtistCount = 0;

					if (artistInputs[0].getAttribute('disabled') !== 'disabled') {
						if (data.artists === false) {
							for (let i = 0; i < artistInputs.length; i++) {
								artistInputs[i].value = '';
							}
						} else {
							let inputIdx = 0;

							yadgUtil.addRemoveArtistBoxes(data.effective_artist_count - artistInputs.length);

							artistInputs = document.getElementsByName('artists[]');

							for (let i = 0; i < data.artist_keys.length; i++) {
								const artistKey = data.artist_keys[i];
								if (artistKey === 'null') {
									nullArtistCount++;
									continue;
								}
								const artistTypes = data.artists[artistKey];

								for (let j = 0; j < artistTypes.length; j++) {
									const artistType = artistTypes[j];
									const artistInput = artistInputs[inputIdx];
									let typeSelect = artistInput.nextSibling;

									while (typeSelect.tagName !== 'SELECT') {
										typeSelect = typeSelect.nextSibling;
									}

									artistInput.value = artistKey;

									const optionOffsets = yadgUtil.getOptionOffsets(typeSelect);

									if (artistType === 'main') {
										typeSelect.selectedIndex = optionOffsets[1]; // eslint-disable-line prefer-destructuring
									} else if (artistType === 'guest') {
										typeSelect.selectedIndex = optionOffsets[2]; // eslint-disable-line prefer-destructuring
									} else if (artistType === 'remixer') {
										typeSelect.selectedIndex = optionOffsets[3]; // eslint-disable-line prefer-destructuring
									} else {
									// We don't know this artist type, default to "main"
										typeSelect.selectedIndex = optionOffsets[1]; // eslint-disable-line prefer-destructuring
									}
									// Next artist input
									inputIdx += 1;
								}
							}
							if (nullArtistCount > 0) {
								yadgUtil.addRemoveArtistBoxes(nullArtistCount *= -1);
							}
						}
					}

					if (tagsInput.getAttribute('disabled') !== 'disabled') {
						if (data.tags === false) {
							tagsInput.value = '';
						} else {
							const tagsArray = data.tag_string.split(', ');
							const tagsUnique = tagsArray.filter((elem, index, self) => {
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
			}

			case 'pth_edit': {
				const f = function (rawData) {
					const [summaryInput] = document.getElementsByName('summary');
					const [yearInput] = document.getElementsByName('year');
					const [labelInput] = document.getElementsByName('record_label');
					const [catalogInput] = document.getElementsByName('catalogue_number');
					const data = yadg.prepareRawResponse(rawData);

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
			}

			case 'pth_torrent_overview': {
				const f = function (rawData) {
					let artistInputs = document.getElementsByName('aliasname[]');
					const data = yadg.prepareRawResponse(rawData);

					if (data.artists === false) {
						for (let i = 0; i < artistInputs.length; i++) {
							artistInputs[i].value = '';
						}
					} else {
						let inputIdx = 0;

						yadgUtil.addRemoveArtistBoxes(data.effective_artist_count - artistInputs.length);

						artistInputs = document.getElementsByName('aliasname[]');

						for (let i = 0; i < data.artist_keys.length; i++) {
							const artistKey = data.artist_keys[i];
							const artistTypes = data.artists[artistKey];

							for (let j = 0; j < artistTypes.length; j++) {
								const artistType = artistTypes[j];
								const artistInput = artistInputs[inputIdx];
								let typeSelect = artistInput.nextSibling;

								while (typeSelect.tagName !== 'SELECT') {
									typeSelect = typeSelect.nextSibling;
								}

								artistInput.value = artistKey;

								const optionOffsets = yadgUtil.getOptionOffsets(typeSelect);

								if (artistType === 'main') {
									typeSelect.selectedIndex = optionOffsets[1]; // eslint-disable-line prefer-destructuring
								} else if (artistType === 'guest') {
									typeSelect.selectedIndex = optionOffsets[2]; // eslint-disable-line prefer-destructuring
								} else if (artistType === 'remixer') {
									typeSelect.selectedIndex = optionOffsets[3]; // eslint-disable-line prefer-destructuring
								} else {
									// We don't know this artist type, default to "main"
									typeSelect.selectedIndex = optionOffsets[1]; // eslint-disable-line prefer-destructuring
								}

								// Next artist input
								inputIdx += 1;
							}
						}
					}
				};
				return f;
			}

			case 'pth_request':
			case 'pth_request_edit': {
				const f = function (rawData) {
					let artistInputs = document.getElementsByName('artists[]');
					const [albumTitleInput] = document.getElementsByName('title');
					const [yearInput] = document.getElementsByName('year');
					const [labelInput] = document.getElementsByName('recordlabel');
					const [catalogInput] = document.getElementsByName('cataloguenumber');
					const tagsInput = document.getElementById('tags');
					const data = yadg.prepareRawResponse(rawData);
					let nullArtistCount = 0;

					if (data.artists === false) {
						for (let i = 0; i < artistInputs.length; i++) {
							artistInputs[i].value = '';
						}
					} else {
						let inputIdx = 0;

						yadgUtil.addRemoveArtistBoxes(data.effective_artist_count - artistInputs.length);

						artistInputs = document.getElementsByName('artists[]');

						for (let i = 0; i < data.artist_keys.length; i++) {
							const artistKey = data.artist_keys[i];
							const artistTypes = data.artists[artistKey];
							if (artistKey === 'null') {
								nullArtistCount++;
								continue;
							}

							for (let j = 0; j < artistTypes.length; j++) {
								const artistType = artistTypes[j];
								const artistInput = artistInputs[inputIdx];
								let typeSelect = artistInput.nextSibling;

								while (typeSelect.tagName !== 'SELECT') {
									typeSelect = typeSelect.nextSibling;
								}

								artistInput.value = artistKey;

								const optionOffsets = yadgUtil.getOptionOffsets(typeSelect);

								if (artistType === 'main') {
									[, typeSelect.selectedIndex] = optionOffsets;
								} else if (artistType === 'guest') {
									[,, typeSelect.selectedIndex] = optionOffsets;
								} else if (artistType === 'remixer') {
									[,,, typeSelect.selectedIndex] = optionOffsets;
								} else {
									// We don't know this artist type, default to "main"
									[, typeSelect.selectedIndex] = optionOffsets;
								}

								// Next artist input
								inputIdx += 1;
							}
						}
						if (nullArtistCount > 0) {
							yadgUtil.addRemoveArtistBoxes(nullArtistCount *= -1);
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
			}

			case 'waffles_upload': {
				const f = function (rawData) {
					const [artistInput] = document.getElementsByName('artist');
					const [albumTitleInput] = document.getElementsByName('album');
					const [yearInput] = document.getElementsByName('year');
					const vaCheckbox = document.getElementById('va');
					const tagsInput = document.getElementById('tags');
					const data = yadg.prepareRawResponse(rawData);

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

					yadgUtil.exec(() => {
						formatName();
					});
				};
				return f;
			}

			case 'waffles_upload_new': {
				const f = function (rawData) {
					const artistInput = document.getElementById('id_artist');
					const albumTitleInput = document.getElementById('id_album');
					const yearInput = document.getElementById('id_year');
					const vaCheckbox = document.getElementById('id_va');
					const tagsInput = document.getElementById('id_tags');
					const data = yadg.prepareRawResponse(rawData);

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
			}

			case 'waffles_request': {
				const f = function (rawData) {
					const [artistInput] = document.getElementsByName('artist');
					const [albumTitleInput] = document.getElementsByName('title');
					const [yearInput] = document.getElementsByName('year');
					const data = yadg.prepareRawResponse(rawData);

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
			}

			default:
				// That should actually never happen
				return function () {};
		}
	}
};

yadgTemplates = {
	_templates: {},
	_templateUrls: {},

	getTemplate(id, callback) {
		if (id in this._templates) {
			callback(this._templates[id]);
		} else if (id in this._templateUrls) {
			const request = new requester(this._templateUrls[id], 'GET', template => { // eslint-disable-line new-cap
				yadgTemplates.addTemplate(template);
				callback(template);
			}, null, yadgTemplates.errorTemplate);
			request.send();
		} else {
			this.errorTemplate();
		}
	},

	addTemplate(template) {
		this._templates[template.id] = template;
	},

	addTemplateUrl(id, url) {
		this._templateUrls[id] = url;
	},

	errorTemplate() {
		yadg.printError('Could not get template. Please choose another one.', true);
	}
};

yadgRenderer = {
	_lastData: null,
	_lastTemplateId: null,

	render(templateId, data, callback, errorCallback) {
		this._lastData = data;
		const newTemplate = this._lastTemplateId !== templateId;
		this._lastTemplateId = templateId;

		yadgTemplates.getTemplate(templateId, template => {
			// The new template might have different dependencies, so initialize Swig with those
			if (newTemplate) {
				yadgSandbox.resetSandbox();
				yadgSandbox.initializeSwig(template.dependencies);
			}
			template.code = template.code.replace('https://what.cd', 'https://redacted.ch');
			yadgSandbox.renderTemplate(template.code, data, callback, errorCallback);
		});
	},

	renderCached(templateId, callback, errorCallback) {
		if (this.hasCached()) {
			this.render(templateId, this._lastData, callback, errorCallback);
		}
	},

	hasCached() {
		return this._lastData !== null;
	},

	clearCached() {
		this._lastData = null;
	}
};

yadg = {
	yadgHost: 'https://yadg.cc',
	baseURI: '/api/v2/',

	standardError: 'Sorry, an error occured. Please try again. If this error persists check on <a href="https://yadg.cc">yadg.cc</a> before reporting an error with the userscript.',
	authenticationError: 'Your API token is invalid. Please provide a valid API token or remove the current one.',
	lastStateError: false,

	isBusy: false,

	init() {
		this.scraperSelect = document.getElementById('yadg_scraper');
		this.formatSelect = document.getElementById('yadg_format');
		this.input = document.getElementById('yadg_input');
		this.targetSelect = document.getElementById('yadg_target');
		this.targetDescriptionSelect = document.getElementById('yadg_description_target');
		this.responseDiv = document.getElementById('yadg_response');
		this.button = document.getElementById('yadg_submit');
	},

	getBaseURL() {
		return this.yadgHost + this.baseURI;
	},

	getScraperList(callback) {
		const url = this.getBaseURL() + 'scrapers/';

		const request = new requester(url, 'GET', callback); // eslint-disable-line new-cap

		request.send();
	},

	getFormatsList(callback) {
		const url = this.getBaseURL() + 'templates/';

		this.getTemplates(url, [], callback);
	},

	getTemplates(url, templates, callback) {
		const request = new requester(url, 'GET', data => { // eslint-disable-line new-cap
			for (let i = 0; i < data.results.length; i++) {
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

	makeRequest(params) {
		if (this.isBusy) {
			return;
		}

		let data;
		if (params) {
			data = params;
		} else {
			data = {
				scraper: this.scraperSelect.options[this.scraperSelect.selectedIndex].value,
				input: this.input.value
			};
		}
		const url = this.getBaseURL() + 'query/';

		if (data.input !== '') {
			const request = new requester(url, 'POST', result => { // eslint-disable-line new-cap
				yadg.getResult(result.url);
			}, data);
			this.busyStart();
			request.send();
		}
	},

	getResult(resultUrl) {
		const request = new requester(resultUrl, 'GET', response => { // eslint-disable-line new-cap
			if (response.status === 'done') {
				if (response.data.type === 'ReleaseResult') {
					const templateId = yadg.formatSelect.options[yadg.formatSelect.selectedIndex].value;
					yadgRenderer.render(templateId, response, factory.setDescriptionBoxValue, factory.setDescriptionBoxValue);

					if (yadg.lastStateError === true) {
						yadg.responseDiv.innerHTML = '';
						yadg.lastStateError = false;
					}

					const fillFunc = factory.getFormFillFunction();
					fillFunc(response.data);
				} else if (response.data.type === 'ListResult') {
					const ul = document.createElement('ul');
					ul.id = 'yadg_release_list';

					const releaseList = response.data.items;
					for (let i = 0; i < releaseList.length; i++) {
						const {name} = releaseList[i];
						const {info} = releaseList[i];
						const {queryParams} = releaseList[i];
						const releaseUrl = releaseList[i].url;

						const li = document.createElement('li');
						const a = document.createElement('a');

						a.textContent = name;
						a.params = queryParams;
						a.href = releaseUrl;

						a.addEventListener('click', function (e) {
							e.preventDefault();
							yadg.makeRequest(this.params);
							if (factory.getFetchImageCheckbox().checked) {
								fetchImage(this.href, data => {
									insertImage(data, () => {
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

						// We got a ListResult so clear the last ReleaseResult from the render cache
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
				const delay = function () {
					yadg.getResult(response.url);
				};
				window.setTimeout(delay, 1000);
			}
		});
		request.send();
	},

	printError(message, templateError) {
		this.responseDiv.innerHTML = message;
		if (!templateError) {
			this.lastStateError = true;

			// There was a non template related error, so for consistencies sake clear the last ReleaseResult from the
			// render cache
			yadgRenderer.clearCached();
		}
	},

	failedCallback() {
		yadg.printError(yadg.standardError);
		yadg.busyStop();
	},

	failedAuthenticationCallback() {
		yadg.printError(yadg.authenticationError);
		yadg.busyStop();
	},

	busyStart() {
		this.isBusy = true;
		this.button.setAttribute('disabled', true);
		this.button.value = 'Please wait...';
		this.input.setAttribute('disabled', true);
		this.scraperSelect.setAttribute('disabled', true);
		this.formatSelect.setAttribute('disabled', true);
		this.targetSelect.setAttribute('disabled', true);
	},

	busyStop() {
		this.button.removeAttribute('disabled');
		this.button.value = 'Fetch';
		this.input.removeAttribute('disabled');
		this.scraperSelect.removeAttribute('disabled');
		this.formatSelect.removeAttribute('disabled');
		this.targetSelect.removeAttribute('disabled');
		this.isBusy = false;
	},

	prepareRawResponse(rawData) { // eslint-disable-line complexity
		const result = {};

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

			for (let i = 0; i < rawData.artists.length; i++) {
				const artist = rawData.artists[i];
				if (artist.isVarious) {
					result.is_various = true; // eslint-disable-line camelcase
				} else {
					result.artists[artist.name] = artist.types;
				}
			}
		}
		if (rawData.discs.length > 0) {
			for (let k = 0; k < rawData.discs.length; k++) {
				const disc = rawData.discs[k];
				for (let l = 0; l < disc.tracks.length; l++) {
					const track = disc.tracks[l];
					for (let m = 0; m < track.artists.length; m++) {
						const {name} = track.artists[m];
						const type = track.artists[m].types;

						let newTypes = null;
						if (name in result.artists) {
							newTypes = result.artists[name].concat(type);
							// Deduplicate new types array
							for (let i = 0; i < newTypes.length; ++i) {
								for (let j = i + 1; j < newTypes.length; ++j) {
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
		for (let i = 0; i < rawData.releaseEvents.length; i++) {
			const event = rawData.releaseEvents[i];
			if (event.date) {
				[result.year] = event.date.match(/\d{4}/);
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
			const [labelId] = rawData.labelIds;
			if (labelId.label) {
				result.label = labelId.label;
			}
			if (labelId.catalogueNrs.length > 0) {
				[result.catalog] = labelId.catalogueNrs;
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

			for (let i = 0; i < result.tags.length; i++) {
				result.tag_string += result.tags[i].replace(/\s+/g, '.'); // eslint-disable-line camelcase
				result.tag_string_nodots += result.tags[i].replace(/\s+/g, ' '); // eslint-disable-line camelcase
				if (i !== result.tags.length - 1) {
					result.tag_string += ', '; // eslint-disable-line camelcase
					result.tag_string_nodots += ', '; // eslint-disable-line camelcase
				}
			}
		}

		if (result.artists !== false) {
			// Count the artists
			result.artists_length = 0; // eslint-disable-line camelcase
			result.artist_keys = []; // eslint-disable-line camelcase
			result.effective_artist_count = 0; // eslint-disable-line camelcase

			for (const i in result.artists) {
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
			// Create a flat string of all the main artists
			let artistString = '';

			for (let i = 0; i < result.artists_length; i++) {
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

yadgSandbox.init(() => {
	if (factory.init()) { // Returns true if we run on a valid location
		yadg.init();
	}
});
