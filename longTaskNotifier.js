window._observer = new PerformanceObserver(function(entryList) {
  var entries = entryList.getEntries();
  for (var i = 0; i < entries.length; i++) {
    console.log("New long task entry!")
    console.log(entries[i]);
  }
});
window._observer.observe({entryTypes: ["longtask"]});
