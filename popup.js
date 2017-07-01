/**
 * Get the current tab’s URL, title, ID, and favIconUrl.
 *
 * @param {function(object, number)} callback - called when the URL, title, ID, and
 *   favicon URL of the current tab is found.
 */
function getCurrentTabInfo(callback) {
  // Query filter to be passed to chrome.tabs.query - see
  // https://developer.chrome.com/extensions/tabs#method-query
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    // chrome.tabs.query invokes the callback with a list of tabs that match the
    // query. When the popup is opened, there is certainly a window and at least
    // one tab, so we can safely assume that |tabs| is a non-empty array.
    // A window can only have one active tab at a time, so the array consists of
    // exactly one tab.
    var tab = tabs[0];

    // A tab is a plain object that provides information about the tab.
    // See https://developer.chrome.com/extensions/tabs#type-Tab
    var url = tab.url;
    var title = tab.title;
    var favIconUrl = tab.favIconUrl;
    var tabId = tab.id;
    console.assert(typeof url === 'string', 'tab.url should be a string');
    console.assert(typeof title === 'string', 'tab.title should be a string');
    console.assert(!favIconUrl || typeof favIconUrl === 'string', 'tab.favIconUrl should be falsey or a string');
    console.assert(typeof tabId === 'number', 'tab.id should be a number');

    callback({url, title, favIconUrl}, tabId);
  });
}

/**
 * Create and return the DOM element for a reading list item.
 *
 * @param {string} url - the URL of the page
 * @param {string} title - the URL of the page
 * @param {string} itemClass (optional) - a class to add to the element, used to animate
 *   incoming reading items
 */
function addReadingItem(info, itemClass) {
  var url = info.url;
  var title = info.title;
  var favIconUrl = info.favIconUrl;

  var item = document.createElement('div');
  item.className = 'reading-item';

  if (itemClass) {
    item.className += ' ' + itemClass;
  }

  var link = document.createElement('a');
  link.className = 'item-link';
  link.href = url;
  link.setAttribute('alt', title);

  var linkTitle = document.createElement('span');
  linkTitle.className = 'title';
  linkTitle.textContent = title;
  link.appendChild(linkTitle);

  var linkHost = document.createElement('span');
  linkHost.textContent = link.hostname || url;
  link.appendChild(linkHost);

  if (favIconUrl) {
    var favicon = document.createElement('div');
    favicon.className = 'favicon';
    var faviconImg = document.createElement('img');
    faviconImg.setAttribute('src', favIconUrl);
    favicon.appendChild(faviconImg);
    link.appendChild(favicon);
  }

  var delBtn = document.createElement('a');
  delBtn.innerHTML = '&times;';
  delBtn.id = url;
  delBtn.className = 'button delete-button';
  item.appendChild(link);
  item.appendChild(delBtn);

  return item;
}

/**
 * Remove a reading list item from the DOM and optionally from storage.
 *
 * @param {elementNodeReference} element - the reading list item DOM element
 * @param {string} id (optional) - the ID of the page in storage
 */
function removeReadingItem(element, id) {
  // If the id is set, remove the reading item from storage
  if (typeof id !== 'undefined') {
    chrome.storage.sync.remove(id);

    // Find tabs with the reading item’s url
    chrome.tabs.query({ url: id.replace(/#.*/, '') }, function(tabs) {
      for (var i = 0; i < tabs.length; i++) {
        // If the url is identical, remove the “✔” from the badge
        if (tabs[i].url === id) {
          chrome.browserAction.setBadgeText({
            text: '',
            tabId: tabs[i].id
          });
        }
      }
    });
  }

  // Listen for the end of an animation
  element.addEventListener('animationend', function() {
    // Remove the item from the DOM when the animation is finished
    element.remove();
  });

  // Add the class to start the animation
  element.className += ' slideout';
}

/**
 * Update storage, removing the “readingList” key and storing each URL as a key
 *
 * @param {array} readingList - an array of reading list items
 */
function repairStorage(readingList) {
  var setObj = {};

  for (var i = 0; i < readingList.length; i++) {
    setObj[readingList[i].url] = readingList[i];
  }

  chrome.storage.sync.set(setObj, function() {
    chrome.storage.sync.remove('readingList');
  });

  return setObj;
}

document.addEventListener('DOMContentLoaded', function() {
  var RL = document.getElementById('reading-list');

  (function renderReadingList() {
    // Get the reading list from storage
    chrome.storage.sync.get(null, function(pages) {
      // Array of page objects with url, title, and addedAt
      var pageList = [];
      var extraItems;

      if (pages.readingList) {
        extraItems = repairStorage(pages.readingList);
        delete pages.readingList;
        Object.assign(pages, extraItems);
      }

      for (page in pages) {
        if (pages.hasOwnProperty(page)) {
          pageList.push(pages[page]);
        }
      }

      // Sort reading list by most to least recent
      pageList.sort(function(a, b) {
        return b.addedAt - a.addedAt;
      });

      // Add each page to the reading list
      pageList.forEach(function(page) {
        var readingItem = addReadingItem(page);
        RL.appendChild(readingItem);
      });
    });
  })();

  // Listen for click events in the reading list
  RL.addEventListener('click', function(e) {
    var target = e.target;

    // If the target's parent is an <a> we pretend the <a> is the target
    if (target.parentNode.tagName === 'A') {
      target = target.parentNode;
    }

    if (/(\s|^)delete-button(\s|$)/.test(target.className)) {
      removeReadingItem(e.target.parentNode, target.id);
    }
    // Default <a> behaviour is to load the page in the popup
    else if (target.tagName === 'A' && /(\s|^)item-link(\s|$)/.test(target.className)) {
      e.preventDefault();

      // If the control key or meta key (⌘ on Mac, ⊞ on Windows) is pressed
      if (e.ctrlKey || e.metaKey) {
        // Open in new tab
        chrome.tabs.create({
          url: target.href,
          active: false
        });
      } else {
        // Otherwise open in the current tab
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          var tab = tabs[0];
          chrome.tabs.update(tab.id, { url: target.href });
          window.close();
        });
      }
    }
    // If the target is a button, it is a delete button
    // Remove the item from the reading list
    else if (target.tagName === 'BUTTON') {
      // Remove the reading list item from storage
      // removeReadingItem(e.target.parentNode, target.id);
    }
  });

  // Save the page open in the current tab to the reading list
  document.getElementById('savepage').addEventListener('click', function() {
    getCurrentTabInfo(function(tabInfo, tabId) {
      var setObj = {};

      setObj[tabInfo.url] = {
        url: tabInfo.url,
        title: tabInfo.title,
        favIconUrl: tabInfo.favIconUrl,
        addedAt: Date.now()
      };

      chrome.storage.sync.set(setObj, function() {
        // Look for a delete button with the ID of the url
        var currentItem = document.getElementById(tabInfo.url);

        // If it exists, remove it from the list
        // Prevents duplicates
        if (currentItem) {
          removeReadingItem(currentItem.parentNode);
        }

        var readingItem = addReadingItem(tabInfo, 'slidein');
        RL.insertBefore(readingItem, RL.firstChild);

        // Add a “✔” to the badge for the tab
        if (tabId) {
          chrome.browserAction.setBadgeText({
            text: '✔',
            tabId: tabId
          });
        }
      });
    });
  });
});
