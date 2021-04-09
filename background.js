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
    function _updateAllTabs() {
      chrome.tabs.query({currentWindow: true}, function (tabs) {
        tabs.forEach(tab => updateTab(tab, tabs))
        updateTitleTimer = null;
      })
    }
    if(updateTitleTimer != null){
      clearTimeout(updateTitleTimer)
    }
    setTimeout(_updateAllTabs, 10)
  }

  function newTab() {
    chrome.tabs.create({index: 0});
  }

  function rightTab(options) {
    if (!options) {
      options = {};
    }
    chrome.windows.getLastFocused({populate: false, windowTypes: ['normal', 'popup']}, function (window) {
      if (window.focused) {
        chrome.tabs.query({currentWindow: true}, function (tabs) {
          var nextIndex = 0;
          var [minIndex, maxIndex] = getMinAndMaxIndex(tabs);
          var activeTab = null;
          for (var i = 0; i < tabs.length; i++) {
            t = tabs[i];
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
          var nextTab = tabs[0].id;
          for (var i = 0; i < tabs.length; i++) {
            t = tabs[i];
            if (options['skipSameGroup'] === true && activeTab.groupId != -1 && t.groupId != activeTab.groupId && t.index > nextIndex) {
              nextTab = t.id;
              break;

            }
            else if ((options['skipSameGroup'] != true || activeTab.groupId == -1) && t.index === nextIndex) {
              nextTab = t.id;
              break;
            }

          }
          switchTabs(nextTab);
        });
      }
    });
  }

  function updateContextMenus() {
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
      chrome.tabs.query({currentWindow: true, active: true, pinned: false}, function (tabs1) {
        var t1 = tabs1[0];
        if (t1 === undefined) {
          return;
        }
        if (t1.groupId != -1) {

          chrome.tabs.query({currentWindow: true, pinned: false}, function (tabs2) {
            var ids = [t1.id];
            for (var i = 0; i < tabs2.length; i++) {
              var t = tabs2[i];
              if (t.id !== tabId && t.groupId == t1.groupId) {
                ids.push(t.id);
              }
            }
            chrome.tabs.move(ids, {index: 0}, function () {
              updateAllTabTitles()
              if (chrome.runtime.lastError) {
              } else if (chrome.tabs.group) {
                chrome.tabs.group({groupId: t1.groupId, tabIds: ids}, function () {
                  if (chrome.runtime.lastError) {
                  }
                });
              }
            });

          });
        } else {
          chrome.tabs.move(t1.id, {index: 0}, function () {
            updateAllTabTitles()
            if (chrome.runtime.lastError) {
            }
          });
        }
      });
    }

    timer = setTimeout(moveTab, delay);

  });


  chrome.commands.onCommand.addListener(function (command) {

    if (command.startsWith("right-tab")) {
      rightTab();
    }

    else if (command.startsWith("left-tab")) {
      chrome.tabs.query({currentWindow: true}, function (tabs) {
        var nextIndex = 0;
        var [minIndex, maxIndex] = getMinAndMaxIndex(tabs);
        for (var i = 0; i < tabs.length; i++) {
          t = tabs[i];
          if (t.active) {
            nextIndex = t.index - 1;
          }
        }
        if (nextIndex > maxIndex) {
          nextIndex = minIndex;
        } else if (nextIndex < minIndex) {
          nextIndex = maxIndex;
        }
        var nextTab = tabs[0].id;
        for (var i = 0; i < tabs.length; i++) {
          t = tabs[i];
          if (t.index === nextIndex) {
            nextTab = t.id;
          }
        }
        switchTabs(nextTab);
      });
    }
    else if (command === "new-tab") {
      newTab();
    } else if (command === "right-tab-skip-same-group") {
      rightTab({skipSameGroup: true});
    } else if(command === 'fullscreen'){
      windows.getCurrent({}, function(win){
        windows.update(win.id, {state: 'fullscreen'})
      })
    }
  });
}

init();

function log(msg) {
  chrome.extension.getBackgroundPage().console.log(msg);
}


function updateTab(tab, allTabs) {
  const {id, index, url, title} = tab

  if (url.startsWith('chrome://')) {
    return
  }

  const prefixRegEx = /^\#[0-9]+ /g
  const num = index + 1
  let newPrefix = `#${num} `
  const hasPrefix = prefixRegEx.exec(title)
  if (hasPrefix && hasPrefix[0] && hasPrefix[0] === newPrefix) {
    return
  } else if (hasPrefix) {
    newPrefix += title.split(prefixRegEx)[1]
  } else {
    newPrefix += title
  }

  try {
    const script = {code: `document.title = '${newPrefix}'`}
    chrome.tabs.executeScript(id, script, function () {
      if (chrome.runtime.lastError) {
      }
    })
  } catch (e) {
    console.error(e)
  }
}
