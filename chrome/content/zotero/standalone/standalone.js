/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

Components.utils.import("resource://gre/modules/Services.jsm");

/**
 * This object contains the various functions for the interface
 */
const ZoteroStandalone = new function() {
	/**
	 * Run when standalone window first opens
	 */
	this.onLoad = function() {
		Zotero.Promise.try(function () {
			if(!Zotero) {
				throw true;
			}
			if(Zotero.initializationPromise.isPending()) {
				Zotero.showZoteroPaneProgressMeter();
			}
			return Zotero.initializationPromise;
		})
		.then(function () {
			if (Zotero.Prefs.get('devtools.errorconsole.enabled', true)) {
				document.getElementById('menu_errorConsole').hidden = false;
			}
			
			Zotero.hideZoteroPaneOverlays();
			ZoteroPane.init();
			ZoteroPane.makeVisible();
			
			// Don't ask before handing http and https URIs
			var eps = Components.classes['@mozilla.org/uriloader/external-protocol-service;1']
					.getService(Components.interfaces.nsIExternalProtocolService);
			var hs = Components.classes["@mozilla.org/uriloader/handler-service;1"]
					.getService(Components.interfaces.nsIHandlerService);
			for (let scheme of ["http", "https"]) {
				var handlerInfo = eps.getProtocolHandlerInfo(scheme);
				handlerInfo.preferredAction = Components.interfaces.nsIHandlerInfo.useSystemDefault;
				handlerInfo.alwaysAskBeforeHandling = false;
				hs.store(handlerInfo);
			}
			
			// Add add-on listeners (not yet hooked up)
			Services.obs.addObserver(gXPInstallObserver, "addon-install-disabled", false);
			Services.obs.addObserver(gXPInstallObserver, "addon-install-started", false);
			Services.obs.addObserver(gXPInstallObserver, "addon-install-blocked", false);
			Services.obs.addObserver(gXPInstallObserver, "addon-install-failed", false);
			Services.obs.addObserver(gXPInstallObserver, "addon-install-complete", false);
		})
		.catch(function (e) {
			try { Zotero.debug(e, 1); } catch (e) {}
			Components.utils.reportError(e);
			ZoteroPane.displayStartupError();
			window.close();
			return;
		});
	}
	
	/**
	 * Builds new item menu
	 */
	this.buildNewItemMenu = function() {
		var addMenu = document.getElementById('menu_NewItemPopup');
		
		// Remove all nodes so we can regenerate
		while(addMenu.hasChildNodes()) addMenu.removeChild(addMenu.firstChild);
		
		var typeSets = [Zotero.ItemTypes.getPrimaryTypes(), Zotero.ItemTypes.getSecondaryTypes()];
		for(var j=0; j<typeSets.length; j++) {
			var t = typeSets[j];
			
			// Sort by localized name
			var itemTypes = [];
			for (var i=0; i<t.length; i++) {
				itemTypes.push({
					id: t[i].id,
					name: t[i].name,
					localized: Zotero.ItemTypes.getLocalizedString(t[i].id)
				});
			}
			var collation = Zotero.getLocaleCollation();
			itemTypes.sort(function(a, b) {
				return collation.compareString(1, a.localized, b.localized);
			});
			
			for (var i = 0; i<itemTypes.length; i++) {
				var menuitem = document.createElement("menuitem");
				menuitem.setAttribute("label", itemTypes[i].localized);
				menuitem.setAttribute("tooltiptext", "");
				let type = itemTypes[i].id;
				menuitem.addEventListener("command", function() {
					ZoteroPane_Local.newItem(type, null, null, true);
				}, false);
				menuitem.className = "zotero-tb-add";
				addMenu.appendChild(menuitem);
			}
			
			// add separator between sets
			if(j !== typeSets.length-1) {
				addMenu.appendChild(document.createElement("menuseparator"));
			}
		}
	}
	
	this.updateAddonsPane = function (doc) {
		// Hide unsigned add-on verification warnings
		//
		// This only works for the initial load of the window. If the user switches to Appearance
		// or Plugins and then back to Extensions, the warnings will appear again. A better way to
		// disable this might be discoverable by studying
		// https://dxr.mozilla.org/mozilla-central/source/toolkit/mozapps/extensions/content/extensions.js
		var addonList = doc.getElementById('addon-list');
		setTimeout(function () {
			for (let i = 0; i < addonList.itemCount; i++) {
				let richListItem = addonList.getItemAtIndex(i);
				let container = doc.getAnonymousElementByAttribute(
					richListItem, 'anonid', 'warning-container'
				);
				if (container) {
					let link = doc.getAnonymousElementByAttribute(
						richListItem, 'anonid', 'warning-link'
					);
					if (link && link.href.indexOf('unsigned-addons') != -1) {
						richListItem.removeAttribute('notification');
						container.hidden = true;
					}
				}
			}
		});
	}
	
	/**
	 * Handles help menu requests
	 */
	this.openHelp = function(type) {
		if(type === "troubleshooting") {
			ZoteroPane.loadURI("http://www.zotero.org/support/getting_help");
		} else if(type === "feedback") {
			ZoteroPane.loadURI("http://forums.zotero.org/categories/");
		} else {
			ZoteroPane.loadURI("http://www.zotero.org/support/");
		}
	}
	
	/**
	 * Checks for updates
	 */
	this.checkForUpdates = function() {
		window.open('chrome://mozapps/content/update/updates.xul', 'updateChecker', 'chrome,centerscreen');
	}
	
	/**
	 * Called before standalone window is closed
	 */
	this.onUnload = function() {
		ZoteroPane.destroy();
		goQuitApplication();
	}
}

/** Taken from browser.js **/
function toJavaScriptConsole() {
	toOpenWindowByType("global:console", "chrome://global/content/console.xul");
}

function toOpenWindowByType(inType, uri, features)
{
	var topWindow = Services.wm.getMostRecentWindow(inType);
	
	if (topWindow) {
		topWindow.focus();
	} else if(features) {
		window.open(uri, "_blank", features);
	} else {
		window.open(uri, "_blank", "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
	}
}

const gXPInstallObserver = {
	observe: function (aSubject, aTopic, aData) {
		var installInfo = aSubject.QueryInterface(Components.interfaces.amIWebInstallInfo);
		var win = installInfo.originatingWindow;
		switch (aTopic) {
			case "addon-install-disabled":
			case "addon-install-blocked":
			case "addon-install-failed":
				var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService);
				promptService.alert(win, Zotero.getString("standalone.addonInstallationFailed.title"),
					Zotero.getString("standalone.addonInstallationFailed.body", installInfo.installs[0].name));
				break;
			/*case "addon-install-started":
			case "addon-install-complete":*/
		}
	}
};

window.addEventListener("load", function(e) { ZoteroStandalone.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ZoteroStandalone.onUnload(e); }, false);