const tabs = chrome.tabs
const windows = chrome.windows

function switchTabs(tabid) {
  // find the tab
  chrome.tabs.get(tabid, function (tab) {
    // Focus the window before the tab to fix issue #273
    chrome.windows.update(tab.windowId, {focused: true}, function () {
      // focus the tab
      chrome.tabs.update(tabid, {active: true});
    });
  });
}

function getMinAndMaxIndex(tabs) {
  var minValue = 999, maxValue = -1;
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    if (t.index > maxValue) {
      maxValue = t.index;
    }
    if (t.index < minValue) {
      minValue = t.index;
    }
  }
  return [minValue, maxValue];
}

function init() {
  var timer = null;
  var udpateContextMenuTimer = null;
  var updateTitleTimer = null;

  function updateAllTabTitles() {
  }

  function newTab() {
    chrome.tabs.query({currentWindow: true, active: true}, function (activeTabs) {
      let tab = activeTabs[0]
      chrome.tabs.create({index: 0, openerTabId: tab.id}, function (newTab) {
      });
    })
  }

  function leftTab(options) {
    if (!options) {
      options = {};
    }
    chrome.windows.getLastFocused({populate: false, windowTypes: ['normal', 'popup']}, function (window) {
      if (window.focused) {
        chrome.tabs.query({currentWindow: true}, function (currentTabs) {
          var nextIndex = 0;
          var [minIndex, maxIndex] = getMinAndMaxIndex(currentTabs);
          var activeTab = null;
          for (var i = 0; i < currentTabs.length; i++) {
            t = currentTabs[i];
            if (t.active) {
              nextIndex = t.index - 1;
              activeTab = t;
            }
          }
          if (nextIndex > maxIndex) {
            nextIndex = minIndex;
          } else if (nextIndex < minIndex) {
            nextIndex = maxIndex;
          }
          for (var i = 0; i < currentTabs.length; i++) {
            t = currentTabs[i];
            if (t.index >= nextIndex) {
              nextTab = t.id;
              break
            }
          }
          switchTabs(nextTab);


        });
      }
    });
  }

  function rightTab(options) {
    if (!options) {
      options = {};
    }
    chrome.windows.getLastFocused({populate: false, windowTypes: ['normal', 'popup']}, function (window) {
      if (window.focused) {
        chrome.tabs.query({currentWindow: true}, function (currentTabs) {
          var nextIndex = 0;
          var [minIndex, maxIndex] = getMinAndMaxIndex(currentTabs);
          var activeTab = null;
          for (var i = 0; i < currentTabs.length; i++) {
            t = currentTabs[i];
            if (t.active) {
              nextIndex = t.index + 1;
              activeTab = t;
            }
          }
          if (nextIndex > maxIndex) {
            nextIndex = minIndex;
          } else if (nextIndex < minIndex) {
            nextIndex = maxIndex;
          }
          for (var i = 0; i < currentTabs.length; i++) {
            t = currentTabs[i];
            if (t.index >= nextIndex) {
              nextTab = t.id;
              break
            }
          }

          switchTabs(nextTab);
        });
      }
    });
  }

  function updateContextMenus() {
    return
    function _updateContextMenus() {
      chrome.tabs.query({currentWindow: true, active: false}, function (tabs1) {
        tabs1.sort(
          function (first, second) {
            return first.idnex < second.index;
          });

        chrome.contextMenus.removeAll(function () {
          chrome.contextMenus.create({
            title: "new tab",
            contexts: ["all"],
            onclick: function () {
              newTab();
            }
          }, function () {

          });
          chrome.contextMenus.create({
            id: 'neotabs-uuid',
            title: "close tab",
            contexts: ["all"],
            onclick: function (info, tab) {
              chrome.tabs.remove(tab.id);
            }
          }, function () {

          });

          for (let i = 0; i < tabs1.length; i++) {
            var t = tabs1[i];
            var click = function (tabId) {
              return function () {
                chrome.tabs.update(tabId, {active: true});
              }
            }
            var title = t.title
            if (title.length > 16) {
              title = title.substring(0, 15)
            }
            chrome.contextMenus.create({
              title: '#' + title,
              id: '#' + title,
              contexts: ["all"],
              onclick: click(t.id)
            }, function () {
            });
          }

          if (udpateContextMenuTimer != null) {
            udpateContextMenuTimer = null;
          }
        });

      });
    }
    if (udpateContextMenuTimer == null) {
      udpateContextMenuTimer = setTimeout(_updateContextMenus, 100);
    }
  }

  tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    updateAllTabTitles()
  })

  tabs.onAttached.addListener(function (tabId, attachInfo) {
    updateAllTabTitles()
  })

  chrome.tabs.onMoved.addListener(function () {
    updateContextMenus();
    updateAllTabTitles();
  });
  chrome.tabs.onCreated.addListener(function () {
    updateContextMenus();
  });
  chrome.tabs.onRemoved.addListener(function () {
    updateContextMenus();
    updateAllTabTitles();
  });
  chrome.tabs.onActivated.addListener(function (tabId) {
    updateContextMenus(tabId);
    var delay = 800;
    if (timer !== null) {
      clearTimeout(timer);
    }

    function moveTab() {
      chrome.tabs.query({currentWindow: true, active: true, pinned: false}, function (activeTabs) {
        var t1 = activeTabs[0];
        if (t1 === undefined) {
          return;
        }
        chrome.tabs.query({currentWindow: true, pinned: true}, function (pinnedTabs) {
          var index = pinnedTabs.length
          chrome.tabs.move(t1.id, {index: index}, function () {
            updateAllTabTitles()
            if (chrome.runtime.lastError) {
            }
          });
        })
      });
    }

    timer = setTimeout(moveTab, delay);

  });


  chrome.commands.onCommand.addListener(function (command) {
    if (command === "right-tab-skip-same-group") {
      rightTab({skipSameGroup: true});
    } else
      if (command.startsWith("right-tab")) {
        rightTab();
      }

      else if (command.startsWith("left-tab")) {
        leftTab();
      }
      else if (command === "new-tab") {
        newTab();
      } else if (command === 'fullscreen') {
        windows.getCurrent({}, function (win) {
          windows.update(win.id, {state: 'fullscreen'})
        })
      } else if (command === 'toggle-collapse') {
        chrome.tabs.query({currentWindow: true, active: true}).then((activeTabs) => {
          var t = activeTabs[0]
          if (t.groupId != -1) {
            chrome.tabGroups.get(t.groupId).then((group) => {
              if (group.collapsed) {
                chrome.tabGroups.update(t.groupId, {collapsed: false})
              } else {
                chrome.tabGroups.update(t.groupId, {collapsed: true})
              }

            })
          }
        })
      }
  });
}

init()
