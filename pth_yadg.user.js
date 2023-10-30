// ==UserScript==
// @id             pth-yadg
// @name           RED YADG
// @description    This script provides integration with online description generator YADG (http://yadg.cc) - Credit to Slack06
// @license        https://github.com/SavageCore/yadg-pth-userscript/blob/master/LICENSE
// @version        1.9.2
// @namespace      yadg
// @grant          GM_xmlhttpRequest
// @grant          GM.xmlHttpRequest
// @require        https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @require        https://yadg.cc/static/js/jsandbox.min.js
// @include        http*://*redacted.ch/upload.php*
// @include        http*://*redacted.ch/requests.php*
// @include        http*://*redacted.ch/torrents.php*
// @include        http*://*orpheus.network/upload.php*
// @include        http*://*orpheus.network/requests.php*
// @include        http*://*orpheus.network/torrents.php*
// @include        http*://*notwhat.cd/upload.php*
// @include        http*://*notwhat.cd/requests.php*
// @include        http*://*notwhat.cd/torrents.php*
// @include        http*://*dicmusic.club/upload.php*
// @include        http*://*dicmusic.club/requests.php*
// @include        http*://*dicmusic.club/torrents.php*
// @include        http*://*waffles.ch/upload.php*
// @include        http*://*waffles.ch/requests.php*
// @include        http*://*d3si.net/upload.php*
// @include        http*://*d3si.net/requests.php*
// @include        http*://*d3si.net/torrents.php*
// @include        http*://*.deepbassnine.com/upload.php*
// @include        http*://*.deepbassnine.com/requests.php*
// @include        http*://*.deepbassnine.com/torrents.php*
// @updateURL      https://github.com/SavageCore/yadg-pth-userscript/raw/master/pth_yadg.meta.js
// @downloadURL    https://github.com/SavageCore/yadg-pth-userscript/raw/master/pth_yadg.user.js
// ==/UserScript==

// --------- USER SETTINGS START ---------

/*	global window	unsafeWindow document GM JSandbox formatName AddArtistField RemoveArtistField alert Image */
/*	eslint max-depth: 'off', block-scoped-var: 'off', no-loop-func: 'off', no-alert: 'off', unicorn/prefer-module: 'off', no-bitwise: 'off' */

/*
Here you can set site specific default templates.
You can find a list of available templates at: https://yadg.cc/api/v2/templates/
*/
const defaultPTHFormat = 5;
const defaultWafflesFormat = 9;
const defaultPTHTarget = 'other';
const defaultPTHDescriptionTarget = 'album';
let yadg; // eslint-disable-line prefer-const
let factory; // eslint-disable-line prefer-const
let yadgRenderer; // eslint-disable-line prefer-const
let yadgTemplates; // eslint-disable-line prefer-const
let autoRehost;

// --------- USER SETTINGS END ---------

function fetchImage(link, callback) {
	if (!link) {
		return;
	}

	const input = document.querySelector('[name="image"]');
	if (input === null) {
		return;
	}

	const disabled = input.getAttribute('disabled');
	if (disabled === 'disabled') {
		return;
	}

	if (/imgur|ptpimg|deepbassnine/g.test(input.value)) {
		return;
	}

	switch (true) {
		case /discogs/.test(link): {
			GM.xmlHttpRequest({
				method: 'GET',
				url: link,
				onload(response) {
					if (response.status === 200) {
						const container = document.implementation.createHTMLDocument()
							.documentElement;
						container.innerHTML = response.responseText;
						const script = container.querySelector('#release_schema');
						try {
							const data = JSON.parse(script.textContent);
							callback(data.image);
						} catch {
							callback(false);
						}
					}
				},
			});
			break;
		}

		case /music.apple/.test(link): {
			const regex = /apple\.com\/(?:([a-z]{2,3})\/)?.*\/(?:(\d+)|id(\d*))/;
			const result = regex.exec(link);
			const id = result[2] | result[3];
			let country = 'us';
			if (result[1]) {
				[, country] = result;
			}

			GM.xmlHttpRequest({
				method: 'GET',
				url: 'https://itunes.apple.com/lookup?id=' + id + '&country=' + country,
				onload(response) {
					if (response.status === 200) {
						const data = JSON.parse(response.responseText);
						const settingCover = factory.getCoverSize().value;
						const hires = settingCover === 'large' ? data.results[0].artworkUrl100.replace(
							'100x100bb',
							'100000x100000-999',
						) : data.results[0].artworkUrl100.replace(
							'100x100bb',
							'700x700bb',
						);

						if (typeof callback === 'function') {
							callback(hires);
						}
					}
				},
			});
			break;
		}

		case /bandcamp/.test(link):
		case factory.getScraperSelect().value === 'bandcamp': {
			let img;
			GM.xmlHttpRequest({
				method: 'GET',
				url: link,
				onload(response) {
					if (response.status === 200) {
						const container = document.implementation.createHTMLDocument()
							.documentElement;
						container.innerHTML = response.responseText;
						const [imgElement_] = container.querySelectorAll(
							'#tralbumArt > a > img',
						);
						if (!imgElement_) {
							if (typeof callback === 'function') {
								callback(false);
							}

							return false;
						}

						const scaledImg = imgElement_.src;
						const settingCover = factory.getCoverSize().value;
						const originalImg = settingCover === 'large' ? scaledImg.replace(/_16/, '_0') : scaledImg.replace(/_16/, '_10');

						const temporaryImg = new Image();
						temporaryImg.src = originalImg;
						temporaryImg.addEventListener('load', function () {
							img = this.width === this.height ? originalImg : scaledImg;

							if (typeof callback === 'function') {
								callback(img);
							}
						});
					}
				},
			});
			break;
		}

		case /beatport/.test(link): {
			GM.xmlHttpRequest({
				method: 'GET',
				url: link,
				onload(response) {
					if (response.status === 200) {
						const container = document.implementation.createHTMLDocument()
							.documentElement;
						container.innerHTML = response.responseText;
						try {
							const script = container.querySelector('#__NEXT_DATA__');
							const data = JSON.parse(script.textContent);
							const {dynamic_uri} = data.props.pageProps.release.image; // eslint-disable-line camelcase
							const size = factory.getCoverSize().value;
							const resolution = size === 'large' ? 1400 : 500;
							const uri = dynamic_uri.replaceAll(/{([hw])}/g, resolution); // eslint-disable-line camelcase
							callback(uri);
						} catch (error) {
							console.log(error);
							callback(false);
						}
					}
				},
			});
			break;
		}

		case /musicbrainz/.test(link): {
			const regex = /release\/(.*)/;
			const {1: id} = regex.exec(link);
			GM.xmlHttpRequest({
				headers: {
					'User-Agent': 'YADG/1.4.41 (yadg.cc)',
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
				},
			});
			break;
		}

		case /junodownload/.test(link): {
			GM.xmlHttpRequest({
				method: 'GET',
				url: link,
				onload(response) {
					if (response.status === 200) {
						const container = document.implementation.createHTMLDocument()
							.documentElement;
						container.innerHTML = response.responseText;
						if (typeof callback === 'function') {
							callback(container.querySelector('.img-fluid-fill').src);
						}
					}
				},
			});
			break;
		}

		case /metal-archives/.test(link): {
			GM.xmlHttpRequest({
				method: 'GET',
				url: link,
				onload(response) {
					if (response.status === 200) {
						const container = document.implementation.createHTMLDocument()
							.documentElement;
						container.innerHTML = response.responseText;

						const parser = document.createElement('a');
						parser.href = container.querySelectorAll('#cover > img')[0].src;
						const imgLink
							= parser.protocol + '//' + parser.hostname + parser.pathname;
						if (typeof callback === 'function') {
							callback(imgLink);
						}
					}
				},
			});
			break;
		}

		case /allmusic/.test(link): {
			GM.xmlHttpRequest({
				method: 'GET',
				url: link,
				onload(response) {
					if (response.status === 200) {
						const container = document.implementation.createHTMLDocument()
							.documentElement;
						container.innerHTML = response.responseText;
						const data = container.querySelector('[data-largeurl]');
						// No image available https://www.allmusic.com/album/release/beatles-mr0003843619
						if (data !== null) {
							const cover = data.dataset.largeurl;
							if (typeof callback === 'function') {
								callback(cover);
							}
						}
					}
				},
			});
			break;
		}

		case /deezer/.test(link): {
			const regex = /\.com\/(\w+\/)?(album)\/(\d+)/g;
			const helper = regex.exec(link);
			const id = helper[3];
			GM.xmlHttpRequest({
				method: 'GET',
				url: 'https://api.deezer.com/album/' + id,
				onload(response) {
					if (response.status === 200) {
						const data = JSON.parse(response.responseText);
						const settingCover = factory.getCoverSize().value;
						const cover = settingCover === 'large' ? data.cover_xl.replace(
							'1000x1000-000000-80-0-0.jpg',
							'1400x1400-000000-100-0-0.jpg',
						) : data.cover_xl;

						if (typeof callback === 'function') {
							callback(cover);
						}
					}
				},
			});
			break;
		}

		default: {
			break;
		}
	}
}

function pthImgIt() {
	const [pthImgIt] = document.querySelectorAll('.rehost_it_cover');
	let imgElement;

	switch (window.location.href) {
		case (window.location.href.match(/\/upload\.php/) || {}).input: {
			imgElement = document.querySelector('#image').value;
			break;
		}

		case (window.location.href.match(/torrents\.php\?action=editgroup/) || {})
			.input: {
			imgElement = document.querySelectorAll(
				'#content > div > div:nth-child(2) > form > div > input[type="text"]:nth-child(5)',
			)[0].value;
			break;
		}

		default: {
			break;
		}
	}

	if (pthImgIt && imgElement) {
		pthImgIt.click();
	}
}

function insertImage(img, callback) {
	switch (window.location.href) {
		case (window.location.href.match(/\/upload\.php/) || {}).input: {
			const input = document.querySelector('#image');
			input.value = img;
			if (input.getAttribute('autorehost') === 'true') {
				const evt = document.createEvent('HTMLEvents');
				evt.initEvent('keyup', false, true);
				input.dispatchEvent(evt);
			}

			input.parentNode.parentNode.insertAdjacentHTML(
				'beforebegin',
				'<tr id="yadg_image_preview_tr"><td class="label">Album Art Preview:</td><td><img id="yadg_image_preview" src="'
				+ img
				+ '" width="300px" /></tr></td>',
			);
			callback();
			break;
		}

		case (window.location.href.match(/torrents\.php\?action=editgroup/) || {})
			.input: {
			const [imageInputElement] = document.querySelectorAll(
				'#content > div > div:nth-child(2) > form > div > input[type="text"]:nth-child(5)',
			);
			imageInputElement.value = img;
			imageInputElement.parentNode.insertAdjacentHTML(
				'beforebegin',
				'<div id="yadg_image_preview_div"><img id="yadg_image_preview" src="'
					+ img
					+ '" width="300px" /></div>',
			);
			callback();
			break;
		}

		case (window.location.href.match(/requests\.php\?/) || {}).input: {
			const [imageInputElement] = document.querySelectorAll(
				'#image_tr > td:nth-child(2) > input[type="text"]:nth-child(1)',
			);
			imageInputElement.value = img;
			imageInputElement.parentNode.parentNode.insertAdjacentHTML(
				'beforebegin',
				'<tr id="yadg_image_preview_tr"><td class="label">Album Art Preview:</td><td><img id="yadg_image_preview" src="'
				+ img
				+ '" width="300px" /></tr></td>',
			);
			callback();
			break;
		}

		default: {
			break;
		}
	}
}

// --------- THIRD PARTY CODE AREA START ---------

//
// Creates an object which gives some helper methods to
// Save/Load/Remove data to/from the localStorage
//
// Source from: https://github.com/gergob/localstoragewrapper
//
function LocalStorageWrapper(appPrefix) {
	'use strict';

	if (appPrefix === undefined) {
		throw new Error('applicationPrefix parameter should be defined');
	}

	const delimiter = '_';

	// If the passed in value for prefix is not string, it should be converted
	const keyPrefix
		= typeof appPrefix === 'string'
			? appPrefix
			: JSON.stringify(appPrefix);

	const localStorage = window.localStorage || unsafeWindow.localStorage;

	const isLocalStorageAvailable = function () {
		return localStorage !== undefined;
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
			throw new Error(
				'LocalStorage is not supported by your browser, data cannot be saved',
			);
		}

		// Keys are always strings
		const checkedKey = typeof key === 'string' ? key : JSON.stringify(key);

		return checkedKey;
	};

	//
	// saves the value associated to the key into the localStorage
	//
	const addItem = function (key, value) {
		try {
			const checkedKey = makeChecks(key);
			const combinedKey = this.getKeyPrefix() + delimiter + checkedKey;
			localStorage.setItem(combinedKey, JSON.stringify(value));
		} catch (error) {
			console.log(error);
			throw error;
		}
	};

	//
	// gets the value of the object saved to the key passed as parameter
	//
	const getItem = function (key) {
		let result;
		try {
			const checkedKey = makeChecks(key);
			const combinedKey = this.getKeyPrefix() + delimiter + checkedKey;
			const resultAsJSON = localStorage.getItem(combinedKey);
			result = JSON.parse(resultAsJSON);
		} catch (error) {
			console.log(error);
			throw error;
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
			throw new Error(
				'LocalStorage is not supported by your browser, data cannot be saved',
			);
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
		let result = false;
		try {
			const checkedKey = makeChecks(key);
			const combinedKey = this.getKeyPrefix() + delimiter + checkedKey;
			localStorage.removeItem(combinedKey);
			result = true;
		} catch (error) {
			console.log(error);
			throw error;
		}

		return result;
	};

	//
	// removes all the values from the localStorage
	//
	const removeAll = function () {
		try {
			const allKeys = this.getAllKeys();
			for (const key of allKeys) {
				const checkedKey = makeChecks(key);
				const combinedKey = this.getKeyPrefix() + delimiter + checkedKey;
				localStorage.removeItem(combinedKey);
			}
		} catch (error) {
			console.log(error);
			throw error;
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
		removeAll,
	};
}

// --------- THIRD PARTY CODE AREA END ---------

const yadgUtil = {
	exec(fn) {
		const script = document.createElement('script');
		script.setAttribute('type', 'application/javascript');
		script.textContent = '(' + fn + ')();';
		document.body.append(script); // Run the script
		script.remove(); // Clean up
	},

	// Handle for updating page css, taken from one of hateradio's scripts
	addCSS(style) {
		if (!this.style) {
			this.style = document.createElement('style');
			this.style.type = 'text/css';
			(document.head || document.querySelectorAll('head')[0]).append(
				this.style,
			);
		}

		this.style.append(document.createTextNode(style + '\n'));
	},

	setValueIfSet(value, input, cond) {
		input.value = cond ? value : '';
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

	settings: new LocalStorageWrapper('yadgSettings'),
};

// Very simple wrapper for XmlHttpRequest
// eslint-disable-next-line max-params
function Requester(url, method, callback, data, errorCallback) {
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
			onerror: errorCallback,
		};
		if (method === 'POST') {
			details.data = JSON.stringify(this.data);
		}

		const headers = {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		};

		if (yadgUtil.settings.getItem(factory.KEY_API_TOKEN)) {
			headers.Authorization
				= 'Token ' + yadgUtil.settings.getItem(factory.KEY_API_TOKEN);
		}

		details.headers = headers;

		GM.xmlHttpRequest(details);
	};
}

const yadgSandbox = {
	KEY_LAST_WARNING: 'templateLastWarning',

	init(callback) {
		GM.xmlHttpRequest({
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
						throw new Error(
							'No no valid implementation of window.URL.createObjectURL found.',
						);
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
			},
		});
	},

	loadSwig(callback) {
		// ImportScripts for the web worker will not work in Firefox with cross-domain requests
		// see: https://bugzilla.mozilla.org/show_bug.cgi?id=756589
		// so download the Swig files manually with GM.xmlHttpRequest
		GM.xmlHttpRequest({
			method: 'GET',
			url: yadg.yadgHost + '/static/js/swig.min.js',
			onload(response) {
				if (response.status === 200) {
					yadgSandbox.swigScript = response.responseText;

					GM.xmlHttpRequest({
						method: 'GET',
						url: yadg.yadgHost + '/static/js/swig.custom.js',
						onload(response) {
							if (response.status === 200) {
								yadgSandbox.swigCustomScript = response.responseText;
								callback();
							}
						},
					});
				}
			},
		});
	},

	initializeSwig(dependencies) {
		if (!(this.swigScript && this.swigCustomScript)) {
			yadg.failedCallback();
			return;
		}

		yadgSandbox.exec({data: this.swigScript, onerror: yadg.failedCallback});
		yadgSandbox.exec({
			data: this.swigCustomScript,
			onerror: yadg.failedCallback,
		});
		yadgSandbox.exec({
			data:
				'var myswig = new swig.Swig({ loader: swig.loaders.memory(input.templates), autoescape: false }), i=0; yadg_filters.register_filters(myswig);',
			input: {templates: dependencies},
		});
	},

	renderTemplate(template, data, callback, error) {
		const evalString
			= 'myswig.render(input.template, { locals: input.data, filename: \'scratchpad\' + (i++) })';
		this.eval({
			data: evalString,
			callback(out) {
				callback(out);
			},
			input: {template, data},
			onerror(error_) {
				error(error_);
			},
		});
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
		if (
			lastWarning === null
			|| now.getTime() - new Date(lastWarning).getTime() > factory.CACHE_TIMEOUT
		) {
			console.log(
				'Could not load the necessary script files for executing YADG. If this error persists you might need to update the user script. You will only get this message once a day.',
			);
			yadgUtil.storage.addItem(this.KEY_LAST_WARNING, now);
		}
	},
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
	KEY_AUTO_SELECT_SCRAPER: 'autoSelectScraper',
	KEY_COVER_SIZE: 'coverSize',

	CACHE_TIMEOUT: 1000 * 60 * 60 * 24, // 24 hours

	UPDATE_PROGRESS: 0,
	locations: [
		{
			name: 'pth_upload',
			regex: /http(s)?:\/\/(.*\.)?redacted\.ch\/upload\.php.*/i,
		},
		{
			name: 'pth_edit',
			regex: /http(s)?:\/\/(.*\.)?redacted\.ch\/torrents\.php\?action=editgroup&groupid=.*/i,
		},
		{
			name: 'pth_request',
			regex: /http(s)?:\/\/(.*\.)?redacted\.ch\/requests\.php\?action=new/i,
		},
		{
			name: 'pth_request_edit',
			regex: /http(s)?:\/\/(.*\.)?redacted\.ch\/requests\.php\?action=edit&id=.*/i,
		},
		{
			name: 'pth_torrent_overview',
			regex: /http(s)?:\/\/(.*\.)?redacted\.ch\/torrents\.php\?id=.*/i,
		},
		{
			name: 'd3si_upload',
			regex: /http(s)?:\/\/(.*\.)?d3si\.net\/upload\.php.*/i,
		},
		{
			name: 'd3si_edit',
			regex: /http(s)?:\/\/(.*\.)?d3si\.net\/torrents\.php\?action=editgroup&groupid=.*/i,
		},
		{
			name: 'd3si_request',
			regex: /http(s)?:\/\/(.*\.)?d3si\.net\/requests\.php\?action=new/i,
		},
		{
			name: 'd3si_request_edit',
			regex: /http(s)?:\/\/(.*\.)?d3si\.net\/requests\.php\?action=edit&id=.*/i,
		},
		{
			name: 'd3si_torrent_overview',
			regex: /http(s)?:\/\/(.*\.)?d3si\.net\/torrents\.php\?id=.*/i,
		},
		{
			name: 'ops_upload',
			regex: /http(s)?:\/\/(.*\.)?orpheus\.network\/upload\.php.*/i,
		},
		{
			name: 'ops_edit',
			regex: /http(s)?:\/\/(.*\.)?orpheus\.network\/torrents\.php\?id=\d+&action=editgroup/i,
		},
		{
			name: 'ops_request',
			regex: /http(s)?:\/\/(.*\.)?orpheus\.network\/requests\.php\?action=new/i,
		},
		{
			name: 'ops_request_edit',
			regex: /http(s)?:\/\/(.*\.)?orpheus\.network\/requests\.php\?action=edit&id=.*/i,
		},
		{
			name: 'ops_torrent_overview',
			regex: /http(s)?:\/\/(.*\.)?orpheus\.network\/torrents\.php\?id=.*/i,
		},
		{
			name: 'nwcd_upload',
			regex: /http(s)?:\/\/(.*\.)?notwhat\.cd\/upload\.php.*/i,
		},
		{
			name: 'nwcd_edit',
			regex: /http(s)?:\/\/(.*\.)?notwhat\.cd\/torrents\.php\?action=editgroup&groupid=.*/i,
		},
		{
			name: 'nwcd_request',
			regex: /http(s)?:\/\/(.*\.)?notwhat\.cd\/requests\.php\?action=new/i,
		},
		{
			name: 'nwcd_request_edit',
			regex: /http(s)?:\/\/(.*\.)?notwhat\.cd\/requests\.php\?action=edit&id=.*/i,
		},
		{
			name: 'nwcd_torrent_overview',
			regex: /http(s)?:\/\/(.*\.)?notwhat\.cd\/torrents\.php\?id=.*/i,
		},
		{
			name: 'dic_upload',
			regex: /http(s)?:\/\/(.*\.)?dicmusic\.club\/upload\.php.*/i,
		},
		{
			name: 'dic_edit',
			regex: /http(s)?:\/\/(.*\.)?dicmusic\.club\/torrents\.php\?action=editgroup&groupid=.*/i,
		},
		{
			name: 'dic_request',
			regex: /http(s)?:\/\/(.*\.)?dicmusic\.club\/requests\.php\?action=new/i,
		},
		{
			name: 'dic_request_edit',
			regex: /http(s)?:\/\/(.*\.)?dicmusic\.club\/requests\.php\?action=edit&id=.*/i,
		},
		{
			name: 'dic_torrent_overview',
			regex: /http(s)?:\/\/(.*\.)?dicmusic\.club\/torrents\.php\?id=.*/i,
		},
		{
			name: 'waffles_upload',
			regex: /http(s)?:\/\/(.*\.)?waffles\.ch\/upload\.php.*/i,
		},
		{
			name: 'waffles_request',
			regex: /http(s)?:\/\/(.*\.)?waffles\.ch\/requests\.php\?do=add/i,
		},
		{
			name: 'db9_upload',
			regex: /https:\/\/www.deepbassnine\.com\/upload\.php.*/i,
		},
		{
			name: 'db9_edit',
			regex: /https:\/\/www.deepbassnine\.com\/torrents\.php\?action=editgroup&groupid=\d+/i,
		},
		{
			name: 'db9_request',
			regex: /https:\/\/www.deepbassnine\.com\/requests\.php\?action=new/i,
		},
		{
			name: 'db9_request_edit',
			regex: /https:\/\/www.deepbassnine\.com\/requests\.php\?action=edit&id=.*/i,
		},
		{
			name: 'db9_torrent_overview',
			regex: /https:\/\/www.deepbassnine\.com\/torrents\.php\?id=.*/i,
		},
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

		if (this.currentLocation === 'pth_request') {
			this.inputsOff(document.URL);
		}

		this.insertIntoPage(this.getInputElements());

		// Set the necessary styles
		this.setStyles();

		// Make sure we initialize the settings to the most recent version
		this.initializeSettings();

		// Populate settings inputs
		this.populateSettings();

		// Add the appropriate action for the input textbox
		const input = document.querySelector('#yadg_input');
		input.addEventListener('input', () => {
			if (factory.getAutoSelectScraperCheckbox().checked) {
				const inputValue = input.value;
				const yadgScraper = document.querySelector('#yadg_scraper');
				if (/discogs/.test(inputValue)) {
					yadgScraper.value = 'discogs';
				} else if (/music.apple/.test(inputValue)) {
					yadgScraper.value = 'itunes';
				} else if (/bandcamp/.test(inputValue)) {
					yadgScraper.value = 'bandcamp';
				} else if (/beatport/.test(inputValue)) {
					yadgScraper.value = 'beatport';
				} else if (/musicbrainz/.test(inputValue)) {
					yadgScraper.value = 'musicbrainz';
				} else if (/junodownload/.test(inputValue)) {
					yadgScraper.value = 'junodownload';
				} else if (/metal-archives/.test(inputValue)) {
					yadgScraper.value = 'metalarchives';
				} else if (/deezer/.test(inputValue)) {
					yadgScraper.value = 'deezer';
				} else if (/allmusic/.test(inputValue)) {
					yadgScraper.value = 'allmusic';
				}
			}
		});

		// Add the appropriate action for the button
		const button = document.querySelector('#yadg_submit');
		button.addEventListener(
			'click',
			event => {
				event.preventDefault();
				yadg.makeRequest();
				if (factory.getFetchImageCheckbox().checked) {
					fetchImage(input.value, data => {
						if (data) {
							insertImage(data, () => {
								if (
									factory.getAutoRehostCheckbox()
									&& factory.getAutoRehostCheckbox().checked
								) {
									pthImgIt();
								}
							});
						}
					});
				}
			},
			false,
		);

		// Add the action for the options toggle
		const toggleLink = document.querySelector('#yadg_toggle_options');
		if (toggleLink !== null) {
			toggleLink.addEventListener('click', event => {
				event.preventDefault();

				const optionsDiv = document.querySelector('#yadg_options');
				const {display} = optionsDiv.style;

				optionsDiv.style.display = display === 'none' || display === '' ? 'block' : 'none';
			});
		}

		// Add the action for the cover size select
		const coverSizeSetting = document.querySelector('#yadg_options_image');
		if (coverSizeSetting !== null) {
			coverSizeSetting.addEventListener('click', () => {
				const optionsCoverSize = document.querySelector(
					'#yadg_options_coversize',
				);
				const {display} = optionsCoverSize.style;
				optionsCoverSize.style.display = display === 'none' || display === '' ? 'block' : 'none';
			});
		}

		// Add the action for the template select
		const formatSelect = this.getFormatSelect();
		if (formatSelect !== null) {
			formatSelect.addEventListener('change', function () {
				if (yadgRenderer.hasCached()) {
					yadgRenderer.renderCached(
						this.value,
						factory.setDescriptionBoxValue,
						factory.setDescriptionBoxValue,
					);
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
		const saveSettingsLink = document.querySelector('#yadg_save_settings');
		if (saveSettingsLink !== null) {
			saveSettingsLink.addEventListener('click', event => {
				event.preventDefault();

				factory.saveSettings();

				alert('Settings saved successfully.');
			});
		}

		// Add the action to the clear cache link
		const clearCacheLink = document.querySelector('#yadg_clear_cache');
		if (clearCacheLink !== null) {
			clearCacheLink.addEventListener('click', event => {
				event.preventDefault();

				yadgUtil.storage.removeAll();

				alert('Cache cleared. Please reload the page for this to take effect.');
			});
		}

		const lastChecked = yadgUtil.storage.getItem(factory.KEY_LAST_CHECKED);
		if (
			lastChecked === null
			|| Date.now() - new Date(lastChecked).getTime()
			> factory.CACHE_TIMEOUT
		) {
			// Update the scraper and formats list
			factory.UPDATE_PROGRESS = 1;
			yadg.getScraperList(factory.setScraperSelect);
			yadg.getFormatsList(factory.setFormatSelect);
		} else {
			factory.setScraperSelect(
				yadgUtil.storage.getItem(factory.KEY_SCRAPER_LIST),
			);
			factory.setFormatSelect(
				yadgUtil.storage.getItem(factory.KEY_FORMAT_LIST),
			);
		}

		return true;
	},

	getApiTokenInput() {
		return document.querySelector('#yadg_api_token');
	},

	getReplaceDescriptionCheckbox() {
		return document.querySelector('#yadg_options_replace');
	},

	getFetchImageCheckbox() {
		return document.querySelector('#yadg_options_image');
	},

	getAutoRehostCheckbox() {
		return document.querySelector('#yadg_options_rehost');
	},

	getAutoPreviewCheckbox() {
		return document.querySelector('#yadg_options_preview');
	},

	getAutoSelectScraperCheckbox() {
		return document.querySelector('#yadg_options_auto_select_scraper');
	},

	getReplaceDescriptionSettingKey() {
		return this.makeReplaceDescriptionSettingsKey(this.currentLocation);
	},

	makeReplaceDescriptionSettingsKey(subKey) {
		return this.KEY_REPLACE_DESCRIPTION + subKey.replaceAll('_', '');
	},

	// Disable fields when groupid set
	inputsOff(url) {
		if (/groupid=\d+/.test(url)) {
			for (const i of [
				'artists[]',
				'importance[]',
				'title',
				'releasetype',
				'genre_tags',
				'tags',
			]) {
				for (const element of document.getElementsByName(i)) {
					element.readOnly = true;
				}
			}
		}
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
				'ops_upload',
				'ops_request',
				'nwcd_upload',
				'nwcd_request',
				'dic_upload',
				'dic_request',
				'waffles_upload',
				'waffles_upload_new',
				'waffles_request',
				'd3si_upload',
				'd3si_request',
				'db9_upload',
				'db9_request',
			];
			for (const loc of locations) {
				const replaceDescSettingKey = factory.makeReplaceDescriptionSettingsKey(
					loc,
				);

				yadgUtil.settings.addItem(replaceDescSettingKey, true);
			}
		}

		yadgUtil.settings.addItem(factory.KEY_SETTINGS_INIT_VER, currentVer);
	},

	populateSettings() {
		const apiToken = yadgUtil.settings.getItem(factory.KEY_API_TOKEN);
		const replaceDesc = yadgUtil.settings.getItem(
			factory.getReplaceDescriptionSettingKey(),
		);
		const fetchImage = yadgUtil.settings.getItem(factory.KEY_FETCH_IMAGE);
		const autoPreview = yadgUtil.settings.getItem(factory.KEY_AUTO_PREVIEW);
		autoRehost = yadgUtil.settings.getItem(factory.KEY_AUTO_REHOST);
		const autoSelectScraper = yadgUtil.settings.getItem(
			factory.KEY_AUTO_SELECT_SCRAPER,
		);
		const coverSize = yadgUtil.settings.getItem(factory.KEY_COVER_SIZE);

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

		if (autoPreview) {
			const autoPreviewCheckbox = factory.getAutoPreviewCheckbox();
			autoPreviewCheckbox.checked = true;
		}

		if (autoSelectScraper) {
			const autoSelectScraperCheckbox = factory.getAutoSelectScraperCheckbox();
			autoSelectScraperCheckbox.checked = true;
		}

		if (coverSize) {
			const coverSizeOption = factory.getCoverSize();
			coverSizeOption.value = coverSize;
			if (factory.getFetchImageCheckbox().checked) {
				const optionsCoverSize = document.querySelector(
					'#yadg_options_coversize',
				);
				optionsCoverSize.style.display = 'block';
			}
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
		const autoSelectScraperCheckbox = factory.getAutoSelectScraperCheckbox();
		const coverSize = factory.getCoverSize();

		let currentScraper = null;
		let currentTemplate = null;
		let currentTarget = null;
		let currentDescriptionTarget = null;
		let currentCoverSize = null;
		const apiToken = apiTokenInput.value.trim();
		const replaceDescription = replaceDescCheckbox.checked;
		const fetchImage = fetchImageCheckbox.checked;
		const autoSelectScraper = autoSelectScraperCheckbox.checked;
		const autoPreview = autoPreviewCheckbox.checked;
		if (autoRehostCheckbox) {
			autoRehost = autoRehostCheckbox.checked;
		}

		if (scraperSelect.options.length > 0) {
			currentScraper = scraperSelect.options[scraperSelect.selectedIndex].value;
		}

		if (templateSelect.options.length > 0) {
			currentTemplate
				= templateSelect.options[templateSelect.selectedIndex].value;
		}

		if (targetSelect.options.length > 0) {
			currentTarget = targetSelect.options[targetSelect.selectedIndex].value;
		}

		if (descriptionTargetSelect.options.length > 0) {
			currentDescriptionTarget
				= descriptionTargetSelect.options[descriptionTargetSelect.selectedIndex]
					.value;
		}

		if (coverSize.options.length > 0) {
			currentCoverSize = coverSize.options[coverSize.selectedIndex].value;
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
			yadgUtil.settings.addItem(
				factory.KEY_DESCRIPTION_TARGET,
				currentDescriptionTarget,
			);
		}

		if (currentCoverSize !== null) {
			yadgUtil.settings.addItem(factory.KEY_COVER_SIZE, currentCoverSize);
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
		} else {
			yadgUtil.settings.removeItem(factory.KEY_AUTO_PREVIEW);
		}

		if (autoSelectScraper) {
			yadgUtil.settings.addItem(factory.KEY_AUTO_SELECT_SCRAPER, true);
		} else {
			yadgUtil.settings.removeItem(factory.KEY_AUTO_SELECT_SCRAPER);
		}
	},

	setDescriptionBoxValue(value) {
		const descBox = factory.getDescriptionBox();
		const replaceDesc = factory.getReplaceDescriptionCheckbox().checked;
		const skipAutoPreview = ['pth_torrent_overview',
			'ops_torrent_overview',
			'dic_torrent_overview',
			'db9_torrent_overview'].includes(factory.currentLocation);

		const boxes = Array.isArray(descBox) ? descBox : [descBox];
		for (const box of boxes) {
			const disabled = box.getAttribute('disabled');
			if (disabled === 'disabled') {
				continue;
			}

			if (replaceDesc) {
				box.value = value;
			} else {
				const blankline = /\S/.test(box.value) ? '\n\n' : '';
				box.value += blankline + value;
			}

			if (skipAutoPreview) {
				continue;
			}

			const parent = box.parentElement;
			if (parent === null) {
				continue;
			}

			const td = parent.parentElement;
			if (td === null) {
				continue;
			}

			const button = td.querySelector('.button_preview_0, .button_preview_1');
			const autoPreviewChecked = factory.getAutoPreviewCheckbox().checked;
			if (button && autoPreviewChecked) {
				button.click();
			}
		}
	},

	getFormatSelect() {
		return document.querySelector('#yadg_format');
	},

	setDefaultFormat() {
		const formatSelect = factory.getFormatSelect();
		const formatOffsets = yadgUtil.getOptionOffsets(formatSelect);

		const defaultFormat = yadgUtil.settings.getItem(
			factory.KEY_DEFAULT_TEMPLATE,
		);
		if (defaultFormat !== null && defaultFormat in formatOffsets) {
			formatSelect.selectedIndex = formatOffsets[defaultFormat];
		} else {
			// We have no settings so fall back to the hard coded defaults
			switch (this.currentLocation) {
				case 'waffles_upload':
				case 'waffles_upload_new':
				case 'waffles_request': {
					formatSelect.selectedIndex = formatOffsets[defaultWafflesFormat];
					break;
				}

				default: {
					formatSelect.selectedIndex = formatOffsets[defaultPTHFormat];
					break;
				}
			}
		}
	},

	getCoverSize() {
		return document.querySelector('#yadg_coversize');
	},

	getTargetSelect() {
		return document.querySelector('#yadg_target');
	},

	getDescriptionTargetSelect() {
		return document.querySelector('#yadg_description_target');
	},

	setDefaultTarget() {
		const targetSelect = factory.getTargetSelect();
		const targetOffsets = yadgUtil.getOptionOffsets(targetSelect);

		const defaultTarget = yadgUtil.settings.getItem(factory.KEY_DEFAULT_TARGET);
		targetSelect.selectedIndex = defaultTarget !== null && defaultTarget in targetOffsets ? targetOffsets[defaultTarget] : targetOffsets[defaultPTHTarget];
	},

	setDefaultDescriptionTarget() {
		const targetDescriptionSelect = factory.getDescriptionTargetSelect();
		const targetDescriptionOffsets = yadgUtil.getOptionOffsets(
			targetDescriptionSelect,
		);

		const defaultDescriptionTarget = yadgUtil.settings.getItem(
			factory.KEY_DESCRIPTION_TARGET,
		);
		if (
			defaultDescriptionTarget !== null
			&& defaultDescriptionTarget in targetDescriptionOffsets
		) {
			targetDescriptionSelect.selectedIndex
				= targetDescriptionOffsets[defaultDescriptionTarget];
		} else {
			targetDescriptionSelect.selectedIndex
				= targetDescriptionOffsets[defaultPTHDescriptionTarget];
		}
	},

	getScraperSelect() {
		return document.querySelector('#yadg_scraper');
	},

	setDefaultScraper() {
		const defaultScraper = yadgUtil.settings.getItem(
			factory.KEY_DEFAULT_SCRAPER,
		);
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
		for (const element of templates) {
			if (factory.UPDATE_PROGRESS > 0) {
				if (element.name === 'What') {
					element.name = 'RED';
					element.nameFormatted = 'RED';
				} else if (element.name === 'What (Tracks only)') {
					element.name = 'RED (Tracks only)';
					element.nameFormatted = 'RED (Tracks only)';
				}

				yadgTemplates.addTemplate(element);

				saveTemplates.push({
					id: element.id,
					url: element.url,
					name: element.name,
					nameFormatted: element.nameFormatted,
					owner: element.owner,
					default: element.default,
					isUtility: element.isUtility,
				});
			} else {
				if (element.name === 'What') {
					element.name = 'PTH';
					element.nameFormatted = 'PTH';
				} else if (element.name === 'What (Tracks only)') {
					element.name = 'PTH (Tracks only)';
					element.nameFormatted = 'PTH (Tracks only)';
				}

				yadgTemplates.addTemplateUrl(element.id, element.url);
			}

			if (!element.isUtility) {
				nonUtility.push(element);
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

		for (const [i, element] of data.entries()) {
			// We are not using the javascript constructor to create an Option instance because this will create an
			// incompatibility with jQuery in Chrome which will make it impossible to add a new artist field on redacted.ch
			const o = document.createElement('option');
			o.text = 'nameFormatted' in element ? element.nameFormatted : element.name;

			o.value = element.value || element.id;
			o.selected = element.default;
			select.options[i] = o;
			if (element.default) {
				select.selectedIndex = i;
			}

			if (element.url) {
				o.dataset.url = element.url;
			}
		}
	},

	setStyles() {
		// General styles
		yadgUtil.addCSS(
			'div#yadg_options{ display:none; margin-top:3px; } input#yadg_input,input#yadg_submit,label#yadg_format_label,a#yadg_scraper_info { margin-right: 5px } div#yadg_response { margin-top:3px; } select#yadg_scraper { margin-right: 2px } #yadg_options_template,#yadg_options_api_token,#yadg_options_replace_div { margin-bottom: 3px; } .add_form[name="yadg"] input,.add_form[name="yadg"] select { width: 90%; margin: 2px 0 !important; } input#yadg_submit { position: inherit !important} div#yadg_options_coversize { display:none; padding-left: 16px }',
		);

		// Location specific styles will go here
		switch (this.currentLocation) {
			case 'waffles_upload': {
				yadgUtil.addCSS(
					'div#yadg_response ul { margin-left: 0 !important; padding-left: 0 !important; }',
				);
				break;
			}

			case 'waffles_request': {
				yadgUtil.addCSS(
					'div#yadg_response ul { margin-left: 0 !important; padding-left: 0 !important; }',
				);
				break;
			}

			default: {
				break;
			}
		}
	},

	// eslint-disable-next-line complexity
	getInputElements() {
		const buttonHTML = '<input type="submit" value="Fetch" id="yadg_submit"/>';
		const scraperSelectHTML
			= '<select name="yadg_scraper" id="yadg_scraper"></select>';
		let optionsHTML
			= '<div id="yadg_options"><div id="yadg_options_template"><label for="yadg_format" id="yadg_format_label">Template:</label><select name="yadg_format" id="yadg_format"></select></div><div id="yadg_options_target"><label for="yadg_target" id="yadg_target_label">Edition:</label><select name="yadg_target" id="yadg_target"><option value="original">Original</option><option value="other">Other</option></select></div><div id="yadg_options_description_target"><label for="yadg_description_target" id="yadg_description_target_label">Description:</label><select name="yadg_description_target" id="yadg_description_target"><option value="album">Album</option><option value="release">Release</option><option value="both">Both</option></select></div><div id="yadg_options_api_token"><label for="yadg_api_token" id="yadg_api_token_label">API token (<a href="https://yadg.cc/api/token" target="_blank">Get one here</a>):</label> <input type="text" name="yadg_api_token" id="yadg_api_token" size="50" /></div><div id="yadg_options_replace_div"><input type="checkbox" name="yadg_options_replace" id="yadg_options_replace" /> <label for="yadg_options_replace" id="yadg_options_replace_label">Replace descriptions on this page</label></div><div id="yadg_options_image_div"><input type="checkbox" name="yadg_options_image" id="yadg_options_image" /> <label for="yadg_options_image" id="yadg_options_image_label">Auto fetch Album Art (Allmusic, Bandcamp, Beatport, Deezer, Discogs, iTunes, Junodownload, Metal-Archives, MusicBrainz)</label></div>';
		optionsHTML
			+= '<div id="yadg_options_coversize"><label for="yadg_coversize" id="yadg_coversize_label">Cover size: </label><select name="yadg_coversize" id="yadg_coversize"><option value="large">Large</option><option value="medium">Medium</option></select></div>';
		if (document.querySelectorAll('.rehost_it_cover')[0]) {
			optionsHTML
				+= '<div id="yadg_options_rehost_div"><input type="checkbox" name="yadg_options_rehost" id="yadg_options_rehost" /> <label for="yadg_options_rehost" id="yadg_options_rehost_label">Auto rehost with <a href="https://redacted.ch/forums.php?action=viewthread&threadid=1992">[User Script] PTPIMG URL uploader</a></label></div>';
		}

		optionsHTML += '<div id="yadg_options_preview_div"><input type="checkbox" name="yadg_options_preview" id="yadg_options_preview" /> <label for="yadg_options_preview" id="yadg_options_preview_label">Auto preview description</label></div>';
		optionsHTML += '<div id="yadg_options_auto_select_scraper_div"><input type="checkbox" name="yadg_options_auto_select_scraper" id="yadg_options_auto_select_scraper"/><label for="yadg_options_auto_select_scraper" id="yadg_options_auto_select_scraper_label">Auto select the correct scraper when pasting the URL</label></div>		';
		optionsHTML += '<div id="yadg_options_links"><a id="yadg_save_settings" href="#" title="Save the currently selected scraper and template as default for this site and save the given API token.">Save settings</a> <span class="yadg_separator">|</span> <a id="yadg_clear_cache" href="#">Clear cache</a></div></div>';
		const inputHTML = '<input type="text" name="yadg_input" id="yadg_input" size="60" />';
		const responseDivHTML = '<div id="yadg_response"></div>';
		const toggleOptionsLinkHTML
			= '<a id="yadg_toggle_options" href="#">Toggle options</a>';
		const scraperInfoLink
			= '<a id="yadg_scraper_info" href="https://yadg.cc/available-scrapers" target="_blank" title="Get additional information on the available scrapers">[?]</a>';

		switch (this.currentLocation) {
			case 'db9_upload':
			case 'nwcd_upload':
			case 'ops_upload':
			case 'dic_upload':
			case 'd3si_upload':
			case 'pth_upload': {
				const tr = document.createElement('tr');
				tr.className = 'yadg_tr';
				tr.innerHTML
					= '<td class="label">YADG:</td><td>'
					+ inputHTML
					+ scraperSelectHTML
					+ scraperInfoLink
					+ buttonHTML
					+ toggleOptionsLinkHTML
					+ optionsHTML
					+ responseDivHTML
					+ '</td>';
				return tr;
			}

			case 'nwcd_edit':
			case 'ops_edit':
			case 'db9_edit':
			case 'dic_edit':
			case 'd3si_edit':
			case 'pth_edit': {
				const div = document.createElement('div');
				div.className = 'yadg_div';
				div.innerHTML
					= '<h3 class="label">YADG:</h3>\n'
					+ inputHTML
					+ '\n'
					+ scraperSelectHTML
					+ '\n'
					+ scraperInfoLink
					+ '\n'
					+ buttonHTML
					+ '\n'
					+ toggleOptionsLinkHTML
					+ '\n'
					+ optionsHTML
					+ '\n'
					+ responseDivHTML;
				return div;
			}

			case 'nwcd_torrent_overview':
			case 'ops_torrent_overview':
			case 'db9_torrent_overview':
			case 'dic_torrent_overview':
			case 'd3si_torrent_overview':
			case 'pth_torrent_overview': {
				const div = document.createElement('div');
				div.id = 'yadg_div';
				div.className = 'box';
				div.innerHTML
					= '<div class="head"><strong>YADG</strong></div>\n<div class="body">\n<form class="add_form" name="yadg" method="post">\n<input type="text" name="yadg_input" id="yadg_input" />\n'
					+ scraperSelectHTML
					+ '\n'
					+ scraperInfoLink
					+ '\n'
					+ buttonHTML
					+ '\n'
					+ toggleOptionsLinkHTML
					+ '\n'
					+ optionsHTML
					+ '\n'
					+ responseDivHTML;
				return div;
			}

			case 'nwcd_request':
			case 'nwcd_request_edit':
			case 'ops_request':
			case 'ops_request_edit':
			case 'db9_request':
			case 'db9_request_edit':
			case 'dic_request':
			case 'dic_request_edit':
			case 'd3si_request':
			case 'd3si_request_edit':
			case 'pth_request':
			case 'pth_request_edit': {
				const tr = document.createElement('tr');
				tr.className = 'yadg_tr';
				tr.innerHTML
					= '<td class="label">YADG:</td><td>'
					+ inputHTML
					+ scraperSelectHTML
					+ scraperInfoLink
					+ buttonHTML
					+ toggleOptionsLinkHTML
					+ optionsHTML
					+ responseDivHTML
					+ '</td>';
				return tr;
			}

			case 'waffles_upload': {
				const tr = document.createElement('tr');
				tr.className = 'yadg_tr';
				tr.innerHTML
					= '<td class="heading" valign="top" align="right"><label for="yadg_input">YADG:</label></td><td>'
					+ inputHTML
					+ scraperSelectHTML
					+ scraperInfoLink
					+ buttonHTML
					+ toggleOptionsLinkHTML
					+ optionsHTML
					+ responseDivHTML
					+ '</td>';
				return tr;
			}

			case 'waffles_upload_new': {
				const p = document.createElement('p');
				p.className = 'yadg_p';
				p.innerHTML
					= '<label for="yadg_input">YADG:</label>'
					+ inputHTML
					+ scraperSelectHTML
					+ scraperInfoLink
					+ buttonHTML
					+ toggleOptionsLinkHTML
					+ optionsHTML
					+ responseDivHTML;
				return p;
			}

			case 'waffles_request': {
				const tr = document.createElement('tr');
				tr.className = 'yadg_tr';
				tr.innerHTML
					= '<td style="text-align:left;width:100px;">YADG:</td><td style="text-align:left;">'
					+ inputHTML
					+ scraperSelectHTML
					+ scraperInfoLink
					+ buttonHTML
					+ toggleOptionsLinkHTML
					+ optionsHTML
					+ responseDivHTML
					+ '</td>';
				return tr;
			}

			default: {
				// This should actually never happen
				return document.createElement('div');
			}
		}
	},

	// eslint-disable-next-line complexity
	insertIntoPage(element) {
		switch (this.currentLocation) {
			case 'db9_upload':
			case 'nwcd_upload':
			case 'ops_upload':
			case 'dic_upload':
			case 'd3si_upload':
			case 'pth_upload': {
				const yearTr = document.querySelector('#year_tr');
				yearTr.parentNode.insertBefore(element, yearTr);
				break;
			}

			case 'nwcd_edit':
			case 'ops_edit':
			case 'db9_edit':
			case 'dic_edit':
			case 'd3si_edit':
			case 'pth_edit': {
				const [summaryInput] = document.getElementsByName('summary');
				summaryInput.parentNode.insertBefore(
					element,
					summaryInput.nextSibling.nextSibling,
				);
				break;
			}

			case 'nwcd_torrent_overview':
			case 'ops_torrent_overview':
			case 'db9_torrent_overview':
			case 'dic_torrent_overview':
			case 'd3si_torrent_overview':
			case 'pth_torrent_overview': {
				const [addArtistsBox] = document.querySelectorAll('.box_addartists');
				if (addArtistsBox) {
					addArtistsBox.parentNode.insertBefore(
						element,
						addArtistsBox.nextSibling.nextSibling,
					);
				}

				break;
			}

			case 'nwcd_request':
			case 'nwcd_request_edit':
			case 'ops_request':
			case 'ops_request_edit':
			case 'db9_request':
			case 'db9_request_edit':
			case 'dic_request':
			case 'dic_request_edit':
			case 'd3si_request':
			case 'd3si_request_edit':
			case 'pth_request':
			case 'pth_request_edit': {
				const artistTr = document.querySelector('#artist_tr');
				artistTr.parentNode.insertBefore(element, artistTr);
				break;
			}

			case 'waffles_upload': {
				const [submitButton] = document.getElementsByName('submit');
				submitButton.parentNode.parentNode.parentNode.insertBefore(
					element,
					submitButton.parentNode.parentNode,
				);
				break;
			}

			case 'waffles_upload_new': {
				const h4s = document.querySelectorAll('h4');
				let div;
				for (const h4 of h4s) {
					if (h4s[h4].innerHTML.includes('read the rules')) {
						div = h4s[h4].parentNode;
						break;
					}
				}

				div.append(element);
				break;
			}

			case 'waffles_request': {
				const [categorySelect] = document.getElementsByName('category');
				categorySelect.parentNode.parentNode.parentNode.insertBefore(
					element,
					categorySelect.parentNode.parentNode,
				);
				break;
			}

			default: {
				break;
			}
		}
	},

	// eslint-disable-next-line complexity
	getDescriptionBox() {
		switch (this.currentLocation) {
			case 'db9_upload':
			case 'nwcd_upload':
			case 'ops_upload':
			case 'dic_upload':
			case 'd3si_upload':
			case 'pth_upload': {
				if (factory.getDescriptionTargetSelect().value === 'album') {
					return document.querySelector('#album_desc');
				}

				if (factory.getDescriptionTargetSelect().value === 'release') {
					return document.querySelector('#release_desc');
				}

				if (factory.getDescriptionTargetSelect().value === 'both') {
					return [
						document.querySelector('#album_desc'),
						document.querySelector('#release_desc'),
					];
				}

				break;
			}

			case 'nwcd_edit':
			case 'ops_edit':
			case 'db9_edit':
			case 'dic_edit':
			case 'd3si_edit':
			case 'pth_edit': {
				return document.getElementsByName('body')[0];
			}

			case 'nwcd_torrent_overview':
			case 'ops_torrent_overview':
			case 'db9_torrent_overview':
			case 'dic_torrent_overview':
			case 'd3si_torrent_overview':
			case 'pth_torrent_overview': {
				if (!Object.prototype.hasOwnProperty.call(this, 'dummybox')) {
					this.dummybox = document.createElement('div');
				}

				return this.dummybox;
			}

			case 'nwcd_request':
			case 'nwcd_request_edit':
			case 'ops_request':
			case 'ops_request_edit':
			case 'db9_request':
			case 'db9_request_edit':
			case 'dic_request':
			case 'dic_request_edit':
			case 'd3si_request':
			case 'd3si_request_edit':
			case 'pth_request':
			case 'pth_request_edit': {
				return document.getElementsByName('description')[0];
			}

			case 'waffles_upload': {
				return document.querySelector('#descr');
			}

			case 'waffles_upload_new': {
				return document.querySelector('#id_descr');
			}

			case 'waffles_request': {
				return document.getElementsByName('information')[0];
			}

			default: {
				// That should actually never happen
				return document.createElement('div');
			}
		}
	},

	// eslint-disable-next-line complexity
	getFormFillFunction() {
		const currentTarget = factory.getTargetSelect().value;
		switch (this.currentLocation) {
			case 'db9_upload': { return rawData => {
				const title = document.querySelector('#title');
				const label = document.querySelector('#recordlabel');
				const catalog = document.querySelector('#catalogue_number');
				const year = document.querySelector('#year');
				const releaseType = document.querySelector('#releasetype');
				const format = document.querySelector('#media');
				const tags = document.querySelector('#tags');
				const genreTagsInput = document.querySelector('#genre_tags');

				const inputs = {
					title,
					label,
					catalog,
					year,
					releaseType,
					format,
					tag_string: tags, // eslint-disable-line camelcase
				};

				const data = yadg.prepareRawResponse(rawData);

				for (const name of Object.keys(inputs)) {
					const input = inputs[name];
					const inputName = name;
					const value = data[name];
					if (!input || !value) {
						continue;
					}

					const disabled = input.getAttribute('disabled');
					if (disabled === 'disabled') {
						continue;
					}

					if (inputName === 'tag_string') {
						const tagsArray = value.split(', ');
						const tagsUnique = tagsArray.filter((element, index, self) => index === self.indexOf(element));
						const tagsFiltered = tagsUnique.filter(element => element.toLowerCase() !== 'electronic');
						const tagsLowercase = tagsFiltered.map(element => element.toLowerCase());
						for (const element of genreTagsInput.options) {
							if (tagsLowercase.includes(element.value)) {
								genreTagsInput.value = element.value;

								const index = tagsLowercase.indexOf(element.value);
								if (index > -1) {
									tagsLowercase.splice(index, 1);
								}

								break;
							}
						}

						input.value = tagsLowercase.join(',');
					} else {
						input.value = value;
					}
				}

				const kinds = {main: 1, guest: 2, remixer: 3};

				const {artists} = data;

				for (const name of Object.keys(artists)) {
					const roles = artists[name];
					for (const role of roles) {
						document.querySelector('[name="artists[]"]:last-of-type').value = name;
						document.querySelector('#artistfields > #importance:last-of-type').value = kinds[role];
						document.querySelector('#artistfields > a').click();
					}
				}
			};
			}

			case 'd3si_upload':
			case 'pth_upload': {
				// eslint-disable-next-line complexity
				const f = function (rawData) {
					let albumTitleInput;
					let yearInput;
					let labelInput;
					let catalogInput;
					if (currentTarget === 'other') {
						albumTitleInput = document.querySelector('#title');
						yearInput = document.querySelector('#remaster_year');
						labelInput = document.querySelector('#remaster_record_label');
						catalogInput = document.querySelector('#remaster_catalogue_number');
						unsafeWindow.CheckYear(); // eslint-disable-line new-cap
					} else {
						albumTitleInput = document.querySelector('#title');
						yearInput = document.querySelector('#year');
						labelInput = document.querySelector('#remaster_record_label');
						catalogInput = document.querySelector('#remaster_catalogue_number');
					}

					if (/music.apple/.test(rawData.url)) {
						const releaseTypeInput = document.querySelector('#releasetype');
						switch (true) {
							case /.+ - Single$/.test(rawData.title): {
								rawData.title = rawData.title.replace(/ - Single$/, '');
								if (releaseTypeInput.getAttribute('disabled') !== 'disabled') {
									releaseTypeInput.value = 9;
								}

								break;
							}

							case /.+ - EP$/.test(rawData.title): {
								rawData.title = rawData.title.replace(/ - EP$/, '');
								if (releaseTypeInput.getAttribute('disabled') !== 'disabled') {
									releaseTypeInput.value = 5;
								}

								break;
							}

							default: {
								break;
							}
						}
					}

					let artistInputs = document.getElementsByName('artists[]');
					const tagsInput = document.querySelector('#tags');
					const mediaInput = document.querySelector('#media');
					const releaseTypeInput = document.querySelector('#releasetype');
					const data = yadg.prepareRawResponse(rawData);
					let nullArtistCount = 0;

					if (artistInputs[0].getAttribute('disabled') !== 'disabled') {
						if (data.artists === false) {
							for (const element of artistInputs) {
								element.value = '';
							}
						} else {
							let inputIdx = 0;

							yadgUtil.addRemoveArtistBoxes(
								data.effective_artist_count - artistInputs.length,
							);

							artistInputs = document.getElementsByName('artists[]');

							for (let i = 0; i < data.artist_keys.length; i++) {
								const artistKey = data.artist_keys[i];
								if (artistKey === 'null') {
									nullArtistCount++;
									continue;
								}

								const artistTypes = data.artists[artistKey];

								for (const artistType of artistTypes) {
									const artistInput = artistInputs[inputIdx];
									let typeSelect = artistInput.nextSibling;

									while (typeSelect.tagName !== 'SELECT') {
										typeSelect = typeSelect.nextSibling;
									}

									artistInput.value = artistKey;

									const optionOffsets = yadgUtil.getOptionOffsets(typeSelect);

									switch (artistType) {
										case 'main': {
											typeSelect.selectedIndex = optionOffsets[1];

											break;
										}

										case 'guest': {
											typeSelect.selectedIndex = optionOffsets[2];

											break;
										}

										case 'remixer': {
											typeSelect.selectedIndex = optionOffsets[3];

											break;
										}

										default: {
											// We don't know this artist type, default to "main"
											typeSelect.selectedIndex = optionOffsets[1];
										}
									}

									// Next artist input
									inputIdx += 1;
								}
							}

							if (nullArtistCount > 0) {
								yadgUtil.addRemoveArtistBoxes((nullArtistCount *= -1));
							}
						}
					}

					if (tagsInput.getAttribute('disabled') !== 'disabled') {
						if (data.tags === false) {
							tagsInput.value = '';
						} else {
							const tagsArray = data.tag_string.split(', ');
							const tagsUnique = tagsArray.filter((element, index, self) => index === self.indexOf(element));
							tagsInput.value = tagsUnique.join(',').toLowerCase();
						}
					}

					if (yearInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(data.year, yearInput, data.year !== false);
					}

					if (albumTitleInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(
							data.title,
							albumTitleInput,
							data.title !== false,
						);
					}

					if (labelInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(
							data.label,
							labelInput,
							data.label !== false,
						);
					}

					if (catalogInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(
							data.catalog,
							catalogInput,
							data.catalog !== false,
						);
					}

					if (mediaInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(
							data.format,
							mediaInput,
							data.format !== false,
						);
					}

					if (releaseTypeInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(
							data.releaseType,
							releaseTypeInput,
							data.releaseType !== false,
						);
					}
				};

				return f;
			}

			case 'ops_upload': {
				// eslint-disable-next-line complexity
				const f = function (rawData) {
					let albumTitleInput;
					let yearInput;
					let labelInput;
					let catalogInput;
					if (currentTarget === 'other') {
						const remaster = document.querySelector('#remaster');
						albumTitleInput = document.querySelector('#title');
						yearInput = document.querySelector('#remaster_year');
						labelInput = document.querySelector('#remaster_record_label');
						catalogInput = document.querySelector('#remaster_catalogue_number');
						remaster.checked = 'checked';
						unsafeWindow.Remaster(); // eslint-disable-line new-cap
						unsafeWindow.CheckYear(); // eslint-disable-line new-cap
					} else {
						albumTitleInput = document.querySelector('#title');
						yearInput = document.querySelector('#year');
						labelInput = document.querySelector('#record_label');
						catalogInput = document.querySelector('#catalogue_number');
					}

					if (/itunes/.test(rawData.url)) {
						const releaseTypeInput = document.querySelector('#releasetype');
						switch (true) {
							case /.+ - Single$/.test(rawData.title): {
								rawData.title = rawData.title.replace(/ - Single$/, '');
								if (releaseTypeInput.getAttribute('disabled') !== 'disabled') {
									releaseTypeInput.value = 9;
								}

								break;
							}

							case /.+ - EP$/.test(rawData.title): {
								rawData.title = rawData.title.replace(/ - EP$/, '');
								if (releaseTypeInput.getAttribute('disabled') !== 'disabled') {
									releaseTypeInput.value = 5;
								}

								break;
							}

							default: {
								break;
							}
						}
					}

					let artistInputs = document.getElementsByName('artists[]');
					const tagsInput = document.querySelector('#tags');
					const data = yadg.prepareRawResponse(rawData);
					let nullArtistCount = 0;

					if (artistInputs[0].getAttribute('disabled') !== 'disabled') {
						if (data.artists === false) {
							for (const element of artistInputs) {
								element.value = '';
							}
						} else {
							let inputIdx = 0;

							yadgUtil.addRemoveArtistBoxes(
								data.effective_artist_count - artistInputs.length,
							);

							artistInputs = document.getElementsByName('artists[]');

							for (let i = 0; i < data.artist_keys.length; i++) {
								const artistKey = data.artist_keys[i];
								if (artistKey === 'null') {
									nullArtistCount++;
									continue;
								}

								const artistTypes = data.artists[artistKey];

								for (const artistType of artistTypes) {
									const artistInput = artistInputs[inputIdx];
									let typeSelect = artistInput.nextSibling;

									while (typeSelect.tagName !== 'SELECT') {
										typeSelect = typeSelect.nextSibling;
									}

									artistInput.value = artistKey;

									const optionOffsets = yadgUtil.getOptionOffsets(typeSelect);

									switch (artistType) {
										case 'main': {
											typeSelect.selectedIndex = optionOffsets[1];

											break;
										}

										case 'guest': {
											typeSelect.selectedIndex = optionOffsets[2];

											break;
										}

										case 'remixer': {
											typeSelect.selectedIndex = optionOffsets[3];

											break;
										}

										default: {
											// We don't know this artist type, default to "main"
											typeSelect.selectedIndex = optionOffsets[1];
										}
									}

									// Next artist input
									inputIdx += 1;
								}
							}

							if (nullArtistCount > 0) {
								yadgUtil.addRemoveArtistBoxes((nullArtistCount *= -1));
							}
						}
					}

					if (tagsInput.getAttribute('disabled') !== 'disabled') {
						if (data.tags === false) {
							tagsInput.value = '';
						} else {
							const tagsArray = data.tag_string.split(', ');
							const tagsUnique = tagsArray.filter((element, index, self) => index === self.indexOf(element));
							tagsInput.value = tagsUnique.join(',').toLowerCase();
						}
					}

					if (yearInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(data.year, yearInput, data.year !== false);
					}

					if (albumTitleInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(
							data.title,
							albumTitleInput,
							data.title !== false,
						);
					}

					if (labelInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(
							data.label,
							labelInput,
							data.label !== false,
						);
					}

					if (catalogInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(
							data.catalog,
							catalogInput,
							data.catalog !== false,
						);
					}
				};

				return f;
			}

			case 'nwcd_upload': {
				// eslint-disable-next-line complexity
				const f = function (rawData) {
					let albumTitleInput;
					let yearInput;
					let labelInput;
					let catalogInput;
					if (currentTarget === 'other') {
						albumTitleInput = document.querySelector('#title');
						yearInput = document.querySelector('#remaster_year');
						labelInput = document.querySelector('#remaster_record_label');
						catalogInput = document.querySelector('#remaster_catalogue_number');
						unsafeWindow.CheckYear(); // eslint-disable-line new-cap
					} else {
						const unknownCheckbox = document.querySelector('#unknown');
						albumTitleInput = document.querySelector('#title');
						yearInput = document.querySelector('#year');
						unknownCheckbox.checked = 'checked';
						unsafeWindow.ToggleUnknown(); // eslint-disable-line new-cap
					}

					if (/itunes/.test(rawData.url)) {
						const releaseTypeInput = document.querySelector('#releasetype');
						switch (true) {
							case /.+ - Single$/.test(rawData.title): {
								rawData.title = rawData.title.replace(/ - Single$/, '');
								if (releaseTypeInput.getAttribute('disabled') !== 'disabled') {
									releaseTypeInput.value = 9;
								}

								break;
							}

							case /.+ - EP$/.test(rawData.title): {
								rawData.title = rawData.title.replace(/ - EP$/, '');
								if (releaseTypeInput.getAttribute('disabled') !== 'disabled') {
									releaseTypeInput.value = 5;
								}

								break;
							}

							default: {
								break;
							}
						}
					}

					let artistInputs = document.getElementsByName('artists[]');
					const tagsInput = document.querySelector('#tags');
					const data = yadg.prepareRawResponse(rawData);
					let nullArtistCount = 0;

					if (artistInputs[0].getAttribute('disabled') !== 'disabled') {
						if (data.artists === false) {
							for (const element of artistInputs) {
								element.value = '';
							}
						} else {
							let inputIdx = 0;

							yadgUtil.addRemoveArtistBoxes(
								data.effective_artist_count - artistInputs.length,
							);

							artistInputs = document.getElementsByName('artists[]');

							for (let i = 0; i < data.artist_keys.length; i++) {
								const artistKey = data.artist_keys[i];
								if (artistKey === 'null') {
									nullArtistCount++;
									continue;
								}

								const artistTypes = data.artists[artistKey];

								for (const artistType of artistTypes) {
									const artistInput = artistInputs[inputIdx];
									let typeSelect = artistInput.nextSibling;

									while (typeSelect.tagName !== 'SELECT') {
										typeSelect = typeSelect.nextSibling;
									}

									artistInput.value = artistKey;

									const optionOffsets = yadgUtil.getOptionOffsets(typeSelect);

									switch (artistType) {
										case 'main': {
											typeSelect.selectedIndex = optionOffsets[1];

											break;
										}

										case 'guest': {
											typeSelect.selectedIndex = optionOffsets[2];

											break;
										}

										case 'remixer': {
											typeSelect.selectedIndex = optionOffsets[3];

											break;
										}

										default: {
											// We don't know this artist type, default to "main"
											typeSelect.selectedIndex = optionOffsets[1];
										}
									}

									// Next artist input
									inputIdx += 1;
								}
							}

							if (nullArtistCount > 0) {
								yadgUtil.addRemoveArtistBoxes((nullArtistCount *= -1));
							}
						}
					}

					if (tagsInput.getAttribute('disabled') !== 'disabled') {
						if (data.tags === false) {
							tagsInput.value = '';
						} else {
							const tagsArray = data.tag_string.split(', ');
							const tagsUnique = tagsArray.filter((element, index, self) => index === self.indexOf(element));
							tagsInput.value = tagsUnique.join(',').toLowerCase();
						}
					}

					if (yearInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(data.year, yearInput, data.year !== false);
					}

					if (albumTitleInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(
							data.title,
							albumTitleInput,
							data.title !== false,
						);
					}

					if (labelInput && labelInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(
							data.label,
							labelInput,
							data.label !== false,
						);
					}

					if (catalogInput && catalogInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(
							data.catalog,
							catalogInput,
							data.catalog !== false,
						);
					}
				};

				return f;
			}

			case 'dic_upload': {
				// eslint-disable-next-line complexity
				const f = function (rawData) {
					let albumTitleInput;
					let yearInput;
					let labelInput;
					let catalogInput;
					if (currentTarget === 'other') {
						albumTitleInput = document.querySelector('#title');
						yearInput = document.querySelector('#remaster_year');
						labelInput = document.querySelector('#remaster_record_label');
						catalogInput = document.querySelector('#remaster_catalogue_number');
						unsafeWindow.CheckYear(); // eslint-disable-line new-cap
					} else {
						const unknownCheckbox = document.querySelector('#unknown');
						albumTitleInput = document.querySelector('#title');
						yearInput = document.querySelector('#year');
						unknownCheckbox.checked = 'checked';
						unsafeWindow.ToggleUnknown(); // eslint-disable-line new-cap
					}

					if (/itunes/.test(rawData.url)) {
						const releaseTypeInput = document.querySelector('#releasetype');
						switch (true) {
							case /.+ - Single$/.test(rawData.title): {
								rawData.title = rawData.title.replace(/ - Single$/, '');
								if (releaseTypeInput.getAttribute('disabled') !== 'disabled') {
									releaseTypeInput.value = 9;
								}

								break;
							}

							case /.+ - EP$/.test(rawData.title): {
								rawData.title = rawData.title.replace(/ - EP$/, '');
								if (releaseTypeInput.getAttribute('disabled') !== 'disabled') {
									releaseTypeInput.value = 5;
								}

								break;
							}

							default: {
								break;
							}
						}
					}

					let artistInputs = document.getElementsByName('artists[]');
					const tagsInput = document.querySelector('#tags');
					const data = yadg.prepareRawResponse(rawData);
					let nullArtistCount = 0;

					if (artistInputs[0].getAttribute('disabled') !== 'disabled') {
						if (data.artists === false) {
							for (const element of artistInputs) {
								element.value = '';
							}
						} else {
							let inputIdx = 0;

							yadgUtil.addRemoveArtistBoxes(
								data.effective_artist_count - artistInputs.length,
							);

							artistInputs = document.getElementsByName('artists[]');

							for (let i = 0; i < data.artist_keys.length; i++) {
								const artistKey = data.artist_keys[i];
								if (artistKey === 'null') {
									nullArtistCount++;
									continue;
								}

								const artistTypes = data.artists[artistKey];

								for (const artistType of artistTypes) {
									const artistInput = artistInputs[inputIdx];
									let typeSelect = artistInput.nextSibling;

									while (typeSelect.tagName !== 'SELECT') {
										typeSelect = typeSelect.nextSibling;
									}

									artistInput.value = artistKey;

									const optionOffsets = yadgUtil.getOptionOffsets(typeSelect);

									switch (artistType) {
										case 'main': {
											typeSelect.selectedIndex = optionOffsets[1];

											break;
										}

										case 'guest': {
											typeSelect.selectedIndex = optionOffsets[2];

											break;
										}

										case 'remixer': {
											typeSelect.selectedIndex = optionOffsets[3];

											break;
										}

										default: {
											// We don't know this artist type, default to "main"
											typeSelect.selectedIndex = optionOffsets[1];
										}
									}

									// Next artist input
									inputIdx += 1;
								}
							}

							if (nullArtistCount > 0) {
								yadgUtil.addRemoveArtistBoxes((nullArtistCount *= -1));
							}
						}
					}

					if (tagsInput.getAttribute('disabled') !== 'disabled') {
						if (data.tags === false) {
							tagsInput.value = '';
						} else {
							const tagsArray = data.tag_string.split(', ');
							const tagsUnique = tagsArray.filter((element, index, self) => index === self.indexOf(element));
							tagsInput.value = tagsUnique.join(',').toLowerCase();
						}
					}

					if (yearInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(data.year, yearInput, data.year !== false);
					}

					if (albumTitleInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(
							data.title,
							albumTitleInput,
							data.title !== false,
						);
					}

					if (labelInput && labelInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(
							data.label,
							labelInput,
							data.label !== false,
						);
					}

					if (catalogInput && catalogInput.getAttribute('disabled') !== 'disabled') {
						yadgUtil.setValueIfSet(
							data.catalog,
							catalogInput,
							data.catalog !== false,
						);
					}
				};

				return f;
			}

			case 'nwcd_edit':
			case 'ops_edit':
			case 'db9_edit':
			case 'dic_edit':
			case 'd3si_edit':
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

					if (
						labelInput
						&& labelInput.getAttribute('disabled') !== 'disabled'
					) {
						yadgUtil.setValueIfSet(
							data.label,
							labelInput,
							data.label !== false,
						);
					}

					if (
						catalogInput
						&& catalogInput.getAttribute('disabled') !== 'disabled'
					) {
						yadgUtil.setValueIfSet(
							data.catalog,
							catalogInput,
							data.catalog !== false,
						);
					}
				};

				return f;
			}

			case 'nwcd_torrent_overview':
			case 'ops_torrent_overview':
			case 'db9_torrent_overview':
			case 'dic_torrent_overview':
			case 'd3si_torrent_overview':
			case 'pth_torrent_overview': {
				const f = function (rawData) {
					let artistInputs = document.getElementsByName('aliasname[]');
					const data = yadg.prepareRawResponse(rawData);

					if (data.artists === false) {
						for (const element of artistInputs) {
							element.value = '';
						}
					} else {
						let inputIdx = 0;

						yadgUtil.addRemoveArtistBoxes(
							data.effective_artist_count - artistInputs.length,
						);

						artistInputs = document.getElementsByName('aliasname[]');

						for (let i = 0; i < data.artist_keys.length; i++) {
							const artistKey = data.artist_keys[i];
							const artistTypes = data.artists[artistKey];

							for (const artistType of artistTypes) {
								const artistInput = artistInputs[inputIdx];
								let typeSelect = artistInput.nextSibling;

								while (typeSelect.tagName !== 'SELECT') {
									typeSelect = typeSelect.nextSibling;
								}

								artistInput.value = artistKey;

								const optionOffsets = yadgUtil.getOptionOffsets(typeSelect);

								switch (artistType) {
									case 'main': {
										typeSelect.selectedIndex = optionOffsets[1];

										break;
									}

									case 'guest': {
										typeSelect.selectedIndex = optionOffsets[2];

										break;
									}

									case 'remixer': {
										typeSelect.selectedIndex = optionOffsets[3];

										break;
									}

									default: {
										// We don't know this artist type, default to "main"
										typeSelect.selectedIndex = optionOffsets[1];
									}
								}

								// Next artist input
								inputIdx += 1;
							}
						}
					}
				};

				return f;
			}

			case 'db9_request':
			case 'db9_request_edit': { return rawData => {
				const title = document.querySelector('#title');
				const label = document.querySelector('#recordlabel');
				const catalog = document.querySelector('#catalogue_number');
				const year = document.querySelector('#year');
				const releaseType = document.querySelector('#releasetype');
				const format = document.querySelector('#media');
				const tags = document.querySelector('#tags');

				const inputs = {
					title,
					label,
					catalog,
					year,
					releaseType,
					format,
					tag_string: tags, // eslint-disable-line camelcase
				};

				const data = yadg.prepareRawResponse(rawData);

				for (const name of Object.keys(inputs)) {
					const input = inputs[name];
					const value = data[name];
					if (!input || !value) {
						continue;
					}

					const disabled = input.getAttribute('disabled');
					if (disabled === 'disabled') {
						continue;
					}

					input.value = value;
				}

				const kinds = {main: 1, guest: 2, remixer: 3};

				const {artists} = data;

				for (const name of Object.keys(artists)) {
					const roles = artists[name];
					for (const role of roles) {
						document.querySelector('[name="artists[]"]:last-of-type').value = name;
						document.querySelector('#artistfields > #importance:last-of-type').value = kinds[role];
						document.querySelector('#artistfields > a').click();
					}
				}
			};
			}

			case 'nwcd_request':
			case 'nwcd_request_edit':
			case 'ops_request':
			case 'ops_request_edit':
			case 'dic_request':
			case 'dic_request_edit':
			case 'd3si_request':
			case 'd3si_request_edit':
			case 'pth_request':
			case 'pth_request_edit': {
				const f = function (rawData) {
					let artistInputs = document.getElementsByName('artists[]');
					const [albumTitleInput] = document.getElementsByName('title');
					const [yearInput] = document.getElementsByName('year');
					const [labelInput] = document.getElementsByName('recordlabel');
					const [catalogInput] = document.getElementsByName('cataloguenumber');
					const tagsInput = document.querySelector('#tags');
					const data = yadg.prepareRawResponse(rawData);
					let nullArtistCount = 0;

					if (!/groupid=\d+/.test(document.location.search)) {
						if (data.artists === false) {
							for (const element of artistInputs) {
								element.value = '';
							}
						} else {
							let inputIdx = 0;

							yadgUtil.addRemoveArtistBoxes(
								data.effective_artist_count - artistInputs.length,
							);

							artistInputs = document.getElementsByName('artists[]');

							for (let i = 0; i < data.artist_keys.length; i++) {
								const artistKey = data.artist_keys[i];
								const artistTypes = data.artists[artistKey];
								if (artistKey === 'null') {
									nullArtistCount++;
									continue;
								}

								for (const artistType of artistTypes) {
									const artistInput = artistInputs[inputIdx];
									let typeSelect = artistInput.nextSibling;

									while (typeSelect.tagName !== 'SELECT') {
										typeSelect = typeSelect.nextSibling;
									}

									artistInput.value = artistKey;

									const optionOffsets = yadgUtil.getOptionOffsets(typeSelect);

									switch (artistType) {
										case 'main': {
											typeSelect.selectedIndex = optionOffsets[1];

											break;
										}

										case 'guest': {
											typeSelect.selectedIndex = optionOffsets[2];

											break;
										}

										case 'remixer': {
											typeSelect.selectedIndex = optionOffsets[3];

											break;
										}

										default: {
											// We don't know this artist type, default to "main"
											typeSelect.selectedIndex = optionOffsets[1];
										}
									}

									// Next artist input
									inputIdx += 1;
								}
							}

							if (nullArtistCount > 0) {
								yadgUtil.addRemoveArtistBoxes((nullArtistCount *= -1));
							}
						}

						tagsInput.value = data.tags === false ? '' : data.tag_string.toLowerCase();

						yadgUtil.setValueIfSet(
							data.title,
							albumTitleInput,
							data.title !== false,
						);
					}

					yadgUtil.setValueIfSet(data.year, yearInput, data.year !== false);
					yadgUtil.setValueIfSet(data.label, labelInput, data.label !== false);
					yadgUtil.setValueIfSet(
						data.catalog,
						catalogInput,
						data.catalog !== false,
					);
				};

				return f;
			}

			case 'waffles_upload': {
				const f = function (rawData) {
					const [artistInput] = document.getElementsByName('artist');
					const [albumTitleInput] = document.getElementsByName('album');
					const [yearInput] = document.getElementsByName('year');
					const vaCheckbox = document.querySelector('#va');
					const tagsInput = document.querySelector('#tags');
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
					yadgUtil.setValueIfSet(
						data.title,
						albumTitleInput,
						data.title !== false,
					);

					tagsInput.value = data.tags === false ? '' : data.tag_string_nodots.toLowerCase();

					yadgUtil.exec(() => {
						formatName();
					});
				};

				return f;
			}

			case 'waffles_upload_new': {
				const f = function (rawData) {
					const artistInput = document.querySelector('#id_artist');
					const albumTitleInput = document.querySelector('#id_album');
					const yearInput = document.querySelector('#id_year');
					const vaCheckbox = document.querySelector('#id_va');
					const tagsInput = document.querySelector('#id_tags');
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
					yadgUtil.setValueIfSet(
						data.title,
						albumTitleInput,
						data.title !== false,
					);

					tagsInput.value = data.tags === false ? '' : data.tag_string_nodots.toLowerCase();
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
					yadgUtil.setValueIfSet(
						data.title,
						albumTitleInput,
						data.title !== false,
					);
				};

				return f;
			}

			default: {
				// That should actually never happen
				return function () {};
			}
		}
	},
};

yadgTemplates = {
	_templates: {},
	_templateUrls: {},

	getTemplate(id, callback) {
		if (id in this._templates) {
			callback(this._templates[id]);
		} else if (id in this._templateUrls) {
			const request = new Requester(
				this._templateUrls[id],
				'GET',
				template => {
					yadgTemplates.addTemplate(template);
					callback(template);
				},
				null,
				yadgTemplates.errorTemplate,
			);
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
	},
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

			template.code = template.code.replace(
				'https://what.cd',
				'https://' + window.location.hostname,
			);
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
	},
};

yadg = {
	yadgHost: 'https://yadg.cc',
	baseURI: '/api/v2/',

	standardError:
		'Sorry, an error occured. Please try again. If this error persists check on <a href="https://yadg.cc">yadg.cc</a> before reporting an error with the userscript.',
	authenticationError:
		'Your API token is invalid. Please provide a valid API token or remove the current one.',
	lastStateError: false,

	isBusy: false,

	init() {
		this.scraperSelect = document.querySelector('#yadg_scraper');
		this.formatSelect = document.querySelector('#yadg_format');
		this.input = document.querySelector('#yadg_input');
		this.targetSelect = document.querySelector('#yadg_target');
		this.targetDescriptionSelect = document.querySelector(
			'#yadg_description_target',
		);
		this.responseDiv = document.querySelector('#yadg_response');
		this.button = document.querySelector('#yadg_submit');
	},

	getBaseURL() {
		return this.yadgHost + this.baseURI;
	},

	getScraperList(callback) {
		const url = this.getBaseURL() + 'scrapers/';

		const request = new Requester(url, 'GET', callback);

		request.send();
	},

	getFormatsList(callback) {
		const url = this.getBaseURL() + 'templates/';

		this.getTemplates(url, [], callback);
	},

	getTemplates(url, templates, callback) {
		const request = new Requester(url, 'GET', data => {
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

	makeRequest(parameters) {
		if (this.isBusy) {
			return;
		}

		let data;
		if (parameters) {
			data = parameters;
		} else {
			// If beta.musicbrainz.org link strip query params and remove beta
			if (this.input.value.includes('beta.musicbrainz.org')) {
				this.input.value = this.input.value.replace(/beta./, '');
				this.input.value = this.input.value.replace(/\?.*$/, '');
			}

			data = {
				scraper: this.scraperSelect.options[this.scraperSelect.selectedIndex]
					.value,
				input: this.input.value,
			};
		}

		const url = this.getBaseURL() + 'query/';

		if (data.input !== '') {
			const request = new Requester(
				url,
				'POST',
				result => {
					yadg.getResult(result.url);
				},
				data,
			);
			this.busyStart();
			request.send();
		}
	},

	getResult(resultUrl) {
		const request = new Requester(resultUrl, 'GET', response => {
			if (response.status === 'done') {
				switch (response.data.type) {
					case 'ReleaseResult': {
						const templateId
							= yadg.formatSelect.options[yadg.formatSelect.selectedIndex].value;
						yadgRenderer.render(
							templateId,
							response,
							factory.setDescriptionBoxValue,
							factory.setDescriptionBoxValue,
						);

						if (yadg.lastStateError === true) {
							yadg.responseDiv.innerHTML = '';
							yadg.lastStateError = false;
						}

						const fillFunc = factory.getFormFillFunction();
						fillFunc(response.data);

						break;
					}

					case 'ListResult': {
						const ul = document.createElement('ul');
						ul.id = 'yadg_release_list';

						const releaseList = response.data.items;
						for (const element of releaseList) {
							const {name, info, queryParams} = element;
							const releaseUrl = element.url;

							const li = document.createElement('li');
							const a = document.createElement('a');

							a.textContent = name;
							a.params = queryParams;
							a.href = releaseUrl;

							a.addEventListener(
								'click',
								function (event) {
									event.preventDefault();
									yadg.makeRequest(this.params);
									if (factory.getFetchImageCheckbox().checked) {
										fetchImage(this.href, data => {
											insertImage(data, () => {
												if (
													factory.getAutoRehostCheckbox()
													&& factory.getAutoRehostCheckbox().checked
												) {
													pthImgIt();
												}
											});
										});
									}
								},
								false,
							);

							li.append(a);
							li.append(document.createElement('br'));
							if (info) {
								li.append(document.createTextNode(info));
							}

							ul.append(li);
						}

						if (ul.childNodes.length === 0) {
							yadg.printError('Sorry, there were no matches.');
						} else {
							yadg.responseDiv.innerHTML = '';
							yadg.responseDiv.append(ul);
							yadg.lastStateError = false;

							// We got a ListResult so clear the last ReleaseResult from the render cache
							yadgRenderer.clearCached();
						}

						break;
					}

					case 'NotFoundResult': {
						yadg.printError(
							'I could not find the release with the given ID. You may want to try again with another one.',
						);

						break;
					}

					default: {
						yadg.printError('Something weird happened. Please try again');
					}
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

	// eslint-disable-next-line complexity
	prepareRawResponse(rawData) {
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
		result.format = false;
		result.releaseType = false;

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
				switch (result.tags[i]) {
					case 'Techno (Peak Time / Driving)': {
						result.tags[i] = 'Techno';
						break;
					}

					case 'Techno (Raw / Deep / Hypnotic)': {
						result.tags[i] = 'Dub Techno';
						break;
					}

					case 'Minimal / Deep Tech': {
						result.tags[i] = 'Tech House';
						break;
					}

					default: {
						break;
					}
				}

				result.tag_string += result.tags[i].replaceAll(/\s+/g, '.').replace(/\bn\b|&/, 'and'); // eslint-disable-line camelcase
				result.tag_string_nodots += result.tags[i].replaceAll(/\s+/g, ' '); // eslint-disable-line camelcase
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
				if (Object.prototype.hasOwnProperty.call(result.artists, i)) {
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
				if (result.artists[result.artist_keys[i]].includes('main')) {
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

		if (rawData.format) {
			const format = rawData.format.toLowerCase();
			if (format.includes('vinyl')) {
				result.format = 'Vinyl';
			} else if (format.includes('cd')) {
				result.format = 'CD';
			} else if (format.includes('dvd') || format.includes('dvd-video')) {
				result.format = 'DVD';
			} else if (format.includes('sacd')) {
				result.format = 'SACD';
			} else if (format.includes('cassettes')) {
				result.format = 'Cassette';
			} else if (format.includes('Blu-ray')) {
				result.format = 'Blu-Ray';
			} else if (format.includes('file')) {
				result.format = 'WEB';
			}
		}

		if (rawData.format) {
			const format = rawData.format.toLowerCase();
			if (format.includes('album') || rawData.styles.includes('Album')) {
				result.releaseType = 1;
			} else if (format.includes('soundtrack') || rawData.styles.includes('Soundtrack')) {
				result.releaseType = 3;
			} else if (format.includes('ep') || rawData.styles.includes('EP')) {
				result.releaseType = 5;
			} else if (format.includes('anthology') || rawData.styles.includes('Anthology')) {
				result.releaseType = 6;
			} else if (format.includes('compilation') || rawData.styles.includes('Compilation')) {
				result.releaseType = 7;
			} else if (format.includes('single') || rawData.styles.includes('Single')) {
				result.releaseType = 9;
			}
		}

		return result;
	},
};

yadgSandbox.init(() => {
	if (factory.init()) {
		// Returns true if we run on a valid location
		yadg.init();
	}
});
