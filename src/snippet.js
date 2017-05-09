!function() {
if (window.PerformanceLongTaskTiming) {
  var g = window.__tti = {e: []};
  g.o = new PerformanceObserver(function(l){
    console.log(l);
    g.e=g.e.concat(l.getEntries())
  });
  g.o.observe({entryTypes:['longtask']});
}
}();
