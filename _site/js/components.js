(function() {
  var EXCEPTIONS = [ ] //charts that need a little special attention
  // from BLOCKS[blockId]
  var BLOCKS = {
    "os": renderBlock()
        .transform(function(d) {
          var values = listify(d.totals.os),
              total = d3.sum(values.map(function(d) { return d.value; }));
          return addShares(collapseOther(values, total * .01));
        })
        .render(barChart()
          .value(function(d) { return d.share * 100; })
          .format(formatPercent))
  }
  xtag.register('bar-chart', {
    //shadow: document.getElementById('bar-chart-template').content,
    lifecycle: {
      //Everything in these methods fires for each element that matches
      created: function(){
        console.log(xtag);
        var self = this,
            blockId = this.getAttribute('block'),
            block = BLOCKS[blockId];
        debugger;
        //TODO LATER: Factor into function when other elems are written
        //Takes the place of d3.selectAll...each()
        d3.select(this)
          .datum({
            source: this.getAttribute('source'),
            block: blockId
          })
          .call(block); // use this.stack attribute to call the right code
          //if (this.stack) { call code for rendering stack layout }
          //else call code for time series
      }
      inserted: function(){ /* can whenRendered go here? */ },
      removed: function(){},
      attributeChanged: function(){ /* or perhaps "loaded" becomes an attribute and whenRendered goes here instead*/ }
    },
    methods: { /* These are publicly accessible methods! */ },
    accessors: {
      name: {
        attribute: {
          name: 'name'
        },
        get: function(){
          return this.getAttribute('name')
        },
        set: function(name){
          this.shadowRoot.querySelector('h4').textContent = name;
        },
        stack: {
          attribute:{
            name: 'stack',
            boolean: true,
          },
          get: function(stack){
            return stack;
          },
          set: function(stack){
            //if true, add code for stacked bars
            //if false, add code for time series
          }
        }
      }
    }
  });

  // common parsing and formatting functions
  var formatPercent = function(p) {
        return p >= .1
          ? trimZeroes(p.toFixed(1)) + "%"
          : "< 0.1%";
      };

  function renderBlock() {
    var url = function(d) {
          return d && d.source;
        },
        transform = Object,
        renderer = function() { },
        dispatch = d3.dispatch("loading", "load", "error", "render");

    var block = function(selection) {
      selection
        .each(load)
        .filter(function(d) {
          d.refresh = +this.getAttribute("data-refresh")
          return !isNaN(d.refresh) && d.refresh > 0;
        })
        .each(function(d) {
          var that = d3.select(this);
          d.interval = setInterval(function refresh() {
            that.each(load);
          }, d.refresh * 1000);
        });

      function load(d) {
        if (d._request) d._request.abort();

        var that = d3.select(this)
          .classed("loading", true)
          .classed("loaded error", false);

        dispatch.loading(selection, d);

        var json = url.apply(this, arguments);
        if (!json) {
          return console.error("no data source found:", this, d);
        }

        d._request = d3.json(json, function(error, data) {
          that.classed("loading", false);
          if (error) return that.call(onerror, error);

          that.classed("loaded", true);
          dispatch.load(selection, data);
          that.call(render, d._data = transform(data));
        });
      }
    };

    function onerror(selection, request) {
      var message = request.responseText;

      selection.classed("error", true)
        .select(".error-message")
          .text(message);

      dispatch.error(selection, request, message);
    }

    block.render = function(x) {
      if (!arguments.length) return renderer;
      renderer = x;
      return block;
    };

    block.url = function(x) {
      if (!arguments.length) return url;
      url = d3.functor(x);
      return block;
    };

    block.transform = function(x) {
      if (!arguments.length) return transform;
      transform = d3.functor(x);
      return block;
    };

    function render(selection, data) {
      // populate meta elements
      selection.select(".meta-name")
        .text(function(d) { return d.meta.name; });
      selection.select(".meta-desc")
        .text(function(d) { return d.meta.description; });

      selection.select(".data")
        .datum(data)
        .call(renderer, data);
      dispatch.render(selection, data);
    }
    return d3.rebind(block, dispatch, "on");
  }

  /*
   * listify an Object into its key/value pairs (entries) and sorting by
   * numeric value descending.
   */
  function listify(obj) {
    return d3.entries(obj)
      .sort(function(a, b) {
        return d3.descending(+a.value, +b.value);
      });
  }

  function barChart() {
    var bars = function(d) {
          return d;
        },
        value = function(d) {
          return d.value;
        },
        format = String,
        label = function(d) {
          return d.key;
        },
        scale = null,
        size = function(n) {
          return (n || 0).toFixed(1) + "%";
        };

    var chart = function(selection) {
      var bin = selection.selectAll(".bin")
        .data(bars);

      bin.exit().remove();

      var enter = bin.enter().append("div")
        .attr("class", "bin");
      enter.append("div")
        .attr("class", "label");
      enter.append("div")
        .attr("class", "value");
      enter.append("div")
        .attr("class", "bar")
        .style("width", "0%");

      var _scale = scale
        ? scale.call(selection, bin.data().map(value))
        : null;
       console.log("scale:", _scale ? _scale.domain() : "(none)");
      bin.select(".bar")
        .style("width", _scale
          ? function(d) {
            return size(_scale(value(d)));
          }
          : function(d) {
            return size(value(d));
          });

      bin.select(".label").html(label);
      bin.select(".value").text(function(d, i) {
        return format.call(this, value(d), d, i);
      });
    };

    chart.bars = function(x) {
      if (!arguments.length) return bars;
      bars = d3.functor(x);
      return chart;
    };

    chart.label = function(x) {
      if (!arguments.length) return label;
      label = d3.functor(x);
      return chart;
    };

    chart.value = function(x) {
      if (!arguments.length) return value;
      value = d3.functor(x);
      return chart;
    };

    chart.format = function(x) {
      if (!arguments.length) return format;
      format = d3.functor(x);
      return chart;
    };

    chart.scale = function(x) {
      if (!arguments.length) return scale;
      scale = d3.functor(x);
      return chart;
    };

    return chart;
  }

  //timeSeries & element go here TK

  function addShares(list, value) {
    if (!value) value = function(d) { return d.value; };
    var total = d3.sum(list.map(value));
    list.forEach(function(d) {
      d.share = value(d) / total;
    });

    return list;
  }

  function collapseOther(list, threshold) {
    var otherPresent = false;
    var other = {key: "Other", value: 0, children: []},
        last = list.length - 1;
    while (last > 0 && list[last].value < threshold) {
      other.value += list[last].value;
      other.children.push(list[last]);
      list.splice(last, 1);
      last--;
    }
    for (var i = 0; i < list.length; i++) {
      if (list[i].key == "Other") {
        otherPresent = true;
        list[i].value += other.value;
      }
    }
    if (!otherPresent) {
      list.push(other);
    }
    return list;
  }

})();
