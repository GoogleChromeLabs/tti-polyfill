window._observer = new PerformanceObserver(function(entryList) {
  var entries = entryList.getEntries();
  window._networkReqs = window._networkReqs || [];
  window._longTasks = window._longTasks || [];
  for (var i = 0; i < entries.length; i++) {
    console.log("New observer entry!")
    console.log(entries[i]);
    if (entries[i].entryType === 'resource') {
      window._networkReqs.push([entries[i].fetchStart, entries[i].responseEnd]);
    }
    if (entries[i].entryType === "longtask") {
      window._longTasks.push([entries[i].startTime, entries[i].startTime + entries[i].duration]);
    }
  }
});
window._observer.observe({entryTypes: ["longtask", "resource"]});
console.log("Long task observer created");
