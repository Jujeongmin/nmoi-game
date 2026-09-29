/* Verse8 embed: report this page's size to the parent frame (from the Verse8 template).
   Loaded by the landing and every game so each page answers REQUEST_GAME_SIZE. */
(function () {
  'use strict';

  function reportGameSize() {
    var height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    var width = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
    window.parent.postMessage({ type: 'GAME_SIZE_RESPONSE', height: height, width: width }, '*');
  }

  window.addEventListener('load', reportGameSize);
  window.addEventListener('resize', reportGameSize);
  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'REQUEST_GAME_SIZE') reportGameSize();
  });
})();
