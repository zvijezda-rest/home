// noinspection JSVoidFunctionReturnValueUsed

/*
 * Main GA Events Plugin function
 * 
 * TO DO: all variables with gaeMapper. prefix can be declared at top of function 
 * and have prefix removed thereafter. Although for now it could be helpful to 
 * keep prefix to make it obvious which values need to eventually be accessed 
 * directly from localized values.
 * 
 * Exposes track_event, click_event
 * 
 * Global: TO DO
 */
var gaeMapper = (function () {

  // Make sure options are present globally
  if (typeof ga_options !== "undefined") {

    /*
     * We temporarily need to be able to create a selector of type id or class
     * from the existing DB options.
     *
     * Eventually we will probably update the backend to store the selector as an
     * option within the associative "click" (or otherwise named) array
     *
     * @param {sequential array}
     */
    function makeSelector(click_option) {
      var selector = "";
      if (click_option.type === 'class') {
        selector += '.';
      } else if (click_option.type === 'id') {
        selector += '#';
      }

      selector += click_option.name;
      return selector;
    }

    // Click elements from DB section begins
    // TO DO clean up this code a bit to make it more like the scroll elements
    // from DB section
    var clickElementsFromDB = [];

    var click_elements_from_options = ga_options.click_elements;
    for (var i = 0; i < click_elements_from_options.length; i++) {

      var clicked = click_elements_from_options[i];
      newClickElement = {};

      var nonInteraction = (clicked.bounce === "true");
      newClickElement.data = {
        "select": makeSelector(clicked),
        "category": clicked.category,
        "action": clicked.action,
        "label": clicked.label,
        "bounce": nonInteraction,
        "evalue": clicked.value, // "value" in DB. Change in project?
        "link_click_delay": parseInt(ga_options.link_clicks_delay),
        "universal": parseInt(ga_options.universal)
      };

      // NB was unescapeChars(select) (from original js file)
      newClickElement.selector = newClickElement.data.select;
      clickElementsFromDB.push(newClickElement);
    }

    // Click elements from DB section ends

    // Scrollelements from DB section begins

    var scroll_elements_from_options = ga_options.scroll_elements;
    var scrollElementsFromDB = [];

    // NB these will be assigned meaningful names in backend eventually
    if (typeof scroll_elements_from_options !== "undefined") {
      scroll_elements_from_options.forEach(function (el) {
        var nonInteraction = (el.bounce === "true");

        scrollElementsFromDB.push({
          "select": makeSelector(el),
          "category": el.category,
          "action": el.action,
          "label": el.label,
          "bounce": nonInteraction,
          "evalue": el.value // "value" in DB. Change in project?
        });
      });
    }

    // Scrollelements from DB section ends

    // Expose modified properties to global scope
    return {

      // From ga_options
      clickElementsFromDB: clickElementsFromDB,
      scrollElementsFromDB: scrollElementsFromDB,
      advancedMode: ga_options.advanced,
      forceSnippet: ga_options.force_snippet,
      emailLinksTracking: ga_options.email_link_tracking,
      telLinksTracking: ga_options.tel_link_tracking,
      downloadTracking: ga_options.download_tracking,
      downloadTrackingFileTypes: ga_options.download_tracking_type,
      link_clicks_delay: ga_options.link_clicks_delay,
      snippet_type: ga_options.snippet_type,
      isFrontPage: gaePlaceholders.is_front_page,
      pageTitle: gaePlaceholders.page_title,
      scriptDebugMode: ga_options.script_debug_mode,
    }


  } // end if

})();


gaEventsMain = (function ($) {

  "use strict";

  // This is the tracking element.
  // It could already have been created by another plugin.
  var ga_element;

  $(document).ready(function () {

    // TO DO: This needs to be conditional on non-excluded roles!
    // (Another export from mapper is probably the best way to get these
    // at the current stage.)
    applyBindings();
  });

  /*
   * Apply bindings from values stored in DB
   */
  function applyBindings() {

    // Bind click events stored in DB to the DOM body
    // "clicked is the data which gets passed to the click_event function
    // "selector" is the id or class of the element clicked
    gaeMapper.clickElementsFromDB.forEach(function (el) {

      $('body').on('click', el.selector, el.data, click_event);
    });

    bindDownloadTrackingEvents();
    bindEmailLinksTracking();
    bindTelLinksTracking();
    // Bind scroll events stored in the DB to the window
    $(window).on('scroll', bindScrollEventsFromDB);
  }

  /**
   * Binds Scroll events from DB
   *
   * @returns {undefined}
   */
  function bindScrollEventsFromDB() {

    // TO DO this code can be simplified a lot. May be better to use
    // $('element').scroll()

    var ga_window = $(window).height();
    var ga_scroll_top = $(document).scrollTop();

    for (var i = 0; i < gaeMapper.scrollElementsFromDB.length; i++) {

      if (!gaeMapper.scrollElementsFromDB[i].sent) {

        // NB was unescapeChars( gaeMapper.scrollElementsFromDB[i].select)
        var $select = $(gaeMapper.scrollElementsFromDB[i].select);
        gaeMapper.scrollElementsFromDB[i].offset = $select.offset();

        if (gaeMapper.scrollElementsFromDB[i].offset && ga_scroll_top + ga_window >= gaeMapper.scrollElementsFromDB[i].offset.top + $select.height()) {
          track_event(gaeMapper.scrollElementsFromDB[i].category, gaeMapper.scrollElementsFromDB[i].action, gaeMapper.scrollElementsFromDB[i].label, gaeMapper.scrollElementsFromDB[i].bounce, gaeMapper.scrollElementsFromDB[i].evalue);

          gaeMapper.scrollElementsFromDB[i].sent = true;
        }
      }
    }
  }

  /**
   * Binds Download Tracking
   *
   * @returns {undefined}
   */
  function bindDownloadTrackingEvents() {
    if (gaeMapper.downloadTracking === "1") {
      gaeMapper.downloadTrackingFileTypes.forEach(function (ftype) {
        var lowercase = ftype.toLowerCase();
        var uppercase = ftype.toUpperCase();

        $('body').on('click', 'a[href$=".' + lowercase + '"]', trackFileDownloaded);
        $('body').on('click', 'a[href$=".' + uppercase + '"]', trackFileDownloaded);
      });
    }
  }  // End of bindScrollEvents

  function bindEmailLinksTracking() {
    if (gaeMapper.emailLinksTracking === "1") {
      $('body').on('click', 'a[href^="mailto:"]', function (e) {
        e.preventDefault();
        var label = this.href.split(':').pop();
        var action = "Email Link";
        var category = getPageName();
        track_event(category,action,label,false, "");
        handleLinks(this, e);
      });
    }
  }

  function bindTelLinksTracking() {
    if (gaeMapper.telLinksTracking === "1") {
      $('body').on('click', 'a[href^="tel:"]', function (e) {
        e.preventDefault();
        var label = this.href.split(':').pop();
        var action = "Telephone Number Link";
        var category = getPageName();
        track_event(category,action,label,false, "");
        handleLinks(this, e);
      });
    }
  }

  var trackFileDownloaded = function (e) {
    e.preventDefault();
    var label = this.href.split('/').pop();
    var action = "Download";
    var category = getPageName();
    track_event(category,action,label,false, "");
    handleLinks(this, e);
  };

  /*
   * The main function for tracking events
   *
   * Param data types currently under review
   *
   * @param {string} category
   * @param {string} action
   * @param {string} label
   * @param {bool} bounce
   * @param {string}? evalue
   * @returns {undefined}
   */
  var track_event = function (category, action, label, bounce, evalue) {
    if (typeof ga_element === "undefined") {
      if (typeof ga !== 'undefined') {
        ga_element = ga;
      } else if (typeof _gaq !== 'undefined') {
        ga_element = _gaq;
      } else if (typeof __gaTracker === "function") {
        ga_element = __gaTracker;
      } else if (typeof gaplusu === "function") {
        ga_element = gaplusu;
      } else if (gaeMapper.snippet_type !== 'gtm' && typeof dataLayer === "undefined") {
        return;
      }
    }

    var event_category = !category ? 'uncategorized' : category;
    category = event_category;

    var event_action = !action ? '' : action;
    action = event_action;

    var event_label = !label ? '' : label;
    label = event_label;

    var event_value = !evalue ? '' : evalue;
    var event_bounce = !bounce ? false : bounce;
    switch (gaeMapper.forceSnippet) {
      case "none":
        if (useGlobalSiteTagSnippet()) {
          globalSiteTagEvent(category, action, label, event_value, event_bounce);
        } else if (useGoogleTagManagerSnippet()) {
          googleTagManagerEvent(category, action, label, event_value, event_bounce);
        } else  if (useUniversalTrackingSnippet()) {
          universalTrackingEvent(category, action, label, event_value, event_bounce);
        } else if (useLegacySnippet()) {
          legacyTrackingEvent(category, action, label, event_value, event_bounce);
        }
        break;
      case "gtm":
        googleTagManagerEvent(category, action, label, event_value, event_bounce);
        break;
      case "gst":
        globalSiteTagEvent(category, action, label, event_value, event_bounce);
        break;
      case "universal":
        universalTrackingEvent(category, action, label, event_value, event_bounce);
        break;
    }
  }; // End of track_event function

  var useGoogleTagManagerSnippet = function () {
    return (
      gaeMapper.snippet_type === "gtm" ||
      (typeof dataLayer !== "undefined" && typeof gtag === "undefined")
    );
  };

  var useGlobalSiteTagSnippet = function () {
    return gaeMapper.snippet_type === "gst" || typeof gtag !== "undefined";
  };

  var useUniversalTrackingSnippet = function () {
    return (
      gaeMapper.snippet_type === "universal" ||
      typeof ga !== "undefined" ||
      typeof __gaTracker === "function"
    );
  };

  var useLegacySnippet = function () {
    return gaeMapper.snippet_type === "legacy" || typeof _gaq !== "undefined";
  };

  // Use the Google Tag Manager object to send an event
  var googleTagManagerEvent = function (
    category,
    action,
    label,
    value,
    bounce
  ) {
    dataLayer.push({
      event: "WPGAE",
      eventCategory: category,
      eventAction: action,
      eventLabel: label,
      eventValue: value,
      nonInteraction: bounce,
    });
  };

  var globalSiteTagEvent = function (category, action, label, value, bounce) {
    gtag("event", action, {
      // Event parameters
      event_category: category,
      event_label: label,
      value: value,
      non_interaction: bounce,
    });
  };

  var universalTrackingEvent = function (
    category,
    action,
    label,
    value,
    bounce
  ) {
    if (value) {
      ga_element("send", "event", category, action, label, value, {
        nonInteraction: bounce,
      });
    } else {
      ga_element("send", "event", category, action, label, {
        nonInteraction: bounce,
      });
    }
  };

  var legacyTrackingEvent = function (category, action, label, value, bounce) {
    ga_element.push(["_trackEvent", category, action, label, value, bounce]);
  };


  /**
   * Click event function
   *
   * @param {event} event
   * @returns {undefined}
   */
  var click_event = function (event) {

    track_event(event.data.category, event.data.action, event.data.label, event.data.bounce, event.data.evalue, this);
    if (typeof event.data.link_click_delay !== 'undefined' && event.data.link_click_delay > 0 && typeof event.target.href !== 'undefined' && event.target.nodeName == "A") {
      handleLinks(this, event);
    }
  }; // End of click event function


  var isNewTab = function (self) {
    var target = $(self).attr("target")
    if (typeof target !== "undefined" && target.trim() === "_blank") {
        return true;
      }
    return false;
  }

  var handleLinks = function (self, event) {
    event.preventDefault();
    var link = getUrl(event);


    var w;
    var openInNewTab = isNewTab(self)
    if (openInNewTab) {
      w = window.open('', '_blank');
    }

    var hash = isJustHashLink(link);
    if (typeof hash !== "undefined" && hash !== "") {
      window.location.hash = hash;
    } else if (window.location.href !== link){
      setTimeout(function () {
        if (openInNewTab) {
          w.location.href = link;
        } else {
          window.location = link;
        }
      }, parseInt(gaeMapper.link_clicks_delay), w);
    }
  }

  var getUrl = function ( event ) {
    var url = "";
    if ( event.target.tagName !== "A" ) {
      url = $( event.target ).parents( "a" ).attr( "href" );
    } else {
      url = event.target.href;
    }
    return url;
  };

  var isJustHashLink = function ( url ) {
    if ( typeof url !== "undefined" && url.indexOf( "#" ) === 0 ) {
      return url;
    }
    return "";
  };

  function getPageName () {
    if ("1" === gaeMapper.isFrontPage) {
      return "Home";
    } else {
      if (typeof gaeMapper.pageTitle !== "undefined") {
        return gaeMapper.pageTitle;
      }
    }
    return "";
  }

})(jQuery);
