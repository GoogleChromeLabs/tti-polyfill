(function() {
    if (window.PerformanceObserver) {
        window.__tti_lts = [];
        window.__tti_lto = new PerformanceObserver(function(entryList) {
          window.__tti_lts.push(...entryList.getEntries());
        });
        window.__tti_lto.observe({entryTypes: ["longtask"]});
    }
})();
